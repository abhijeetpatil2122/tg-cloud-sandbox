import { api } from 'sdk';

const MAX_STATE_BYTES = 1024;
const safeParse = (value) => {
  if (typeof value !== 'string' || value.length > MAX_STATE_BYTES) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
const encode = (value) => {
  const result = JSON.stringify(value);
  if (new TextEncoder().encode(result).length > MAX_STATE_BYTES) throw new Error('Widget state is too large');
  return result;
};
const answer = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (new TextEncoder().encode(text).length > MAX_STATE_BYTES) return JSON.stringify({ ok: false, message: 'Response too large.' });
  return text;
};

async function updateState(query, shared, nextState) {
  const encoded = encode(nextState);
  if (shared || query.widget_id) {
    if (!query.widget_id) throw new Error('Shared widget ID is missing');
    await api.editSharedWidgetData({ widget_id: query.widget_id, public_data: encoded, cache_time: 5 });
    return;
  }
  if (!query.chat?.id || !query.message_id) throw new Error('Message reference is missing');
  await api.editMessageWidgetData({
    chat_id: query.chat.id,
    message_id: query.message_id,
    chat_data: encoded,
  });
}

function walletSummary(query) {
  if (query.type?.type === 'data' && query.type.wallet_card) {
    const card = query.type.wallet_card;
    return { ok: true, message: 'Wallet card received.', wallet: {
      address: card.address || null,
      amount: card.amount || null,
      public_key: card.public_key || null,
    } };
  }
  if (query.type?.type === 'sign_data') {
    return { ok: true, message: 'Wallet-signed data received. Verify its signature and domain before trusting it.', wallet: {
      address: query.type.wallet?.address || null,
      signedDataReceived: Boolean(query.type.sign_data),
    } };
  }
  if (query.type?.type === 'sent_transaction') {
    return { ok: true, message: 'Wallet transaction notification received.', wallet: {
      address: query.type.wallet?.address || null,
      messageHash: query.type.msg_hash || null,
    } };
  }
  return null;
}

export async function handleWidgetQuery(query, shared) {
  let result = { ok: true, message: 'Request received.' };
  const wallet = walletSummary(query);
  if (wallet) {
    result = wallet;
  } else {
    const action = String(query.data || '');
    const state = safeParse(shared || query.widget_id ? query.public_data : query.chat_data);
    if (action === 'demo:ping') {
      result = { ok: true, message: 'PWidgetBot received your request and answered it.' };
    } else if (action.startsWith('vote:')) {
      const choice = Number(action.slice(5));
      if (!Number.isInteger(choice) || choice < 0 || choice > 2) {
        result = { ok: false, message: 'Invalid poll option.' };
      } else {
        const votes = Array.isArray(state.votes) && state.votes.length === 3 ? state.votes.map((n) => Number(n) || 0) : [0, 0, 0];
        votes[choice] += 1;
        const next = { votes, total: votes.reduce((sum, n) => sum + n, 0) };
        await updateState(query, true, next);
        result = { ok: true, message: 'Vote recorded.' };
      }
    } else if (action === 'reaction:add') {
      const next = { count: Math.max(0, Number(state.count) || 0) + 1 };
      await updateState(query, true, next);
      result = { ok: true, message: 'Reaction added.' };
    } else if (action === 'clicker:tap' || action === 'state:increment') {
      const next = { ...state, count: Math.max(0, Number(state.count) || 0) + 1 };
      await updateState(query, false, next);
      result = { ok: true, message: 'State updated.' };
    } else if (action.startsWith('progress:')) {
      const delta = Number(action.slice(9));
      if (!Number.isFinite(delta) || Math.abs(delta) > 10) {
        result = { ok: false, message: 'Invalid progress change.' };
      } else {
        const next = { progress: Math.min(100, Math.max(0, (Number(state.progress) || 0) + delta)) };
        await updateState(query, false, next);
        result = { ok: true, message: 'Progress updated.' };
      }
    } else if (action.startsWith('rating:')) {
      const rating = Number(action.slice(7));
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) result = { ok: false, message: 'Invalid rating.' };
      else {
        await updateState(query, false, { rating });
        result = { ok: true, message: `Thanks for rating this demo ${rating}/5.` };
      }
    } else if (action.startsWith('guess:')) {
      const guess = Number(action.slice(6));
      if (!Number.isInteger(guess) || guess < 1 || guess > 5) result = { ok: false, message: 'Choose a number from 1 to 5.' };
      else {
        const target = 3;
        const attempts = (Number(state.attempts) || 0) + 1;
        const message = guess === target ? 'Correct — you found the demo number!' : guess < target ? 'Too low. Try again.' : 'Too high. Try again.';
        await updateState(query, false, { attempts, result: guess === target ? 'won' : '' });
        result = { ok: true, message };
      }
    } else if (action === 'dashboard:refresh') {
      const next = { visitors: (Number(state.visitors) || 128) + 1, tasks: Math.max(0, (Number(state.tasks) || 7) - 1), progress: Math.min(100, (Number(state.progress) || 64) + 2) };
      await updateState(query, true, next);
      result = { ok: true, message: 'Dashboard data refreshed.' };
    } else if (action === 'leaderboard:score') {
      const scores = Array.isArray(state.scores) ? state.scores.slice(0, 10) : [];
      const mine = scores.find((item) => item.name === 'You');
      if (mine) mine.score = (Number(mine.score) || 0) + 10;
      else scores.push({ name: 'You', score: 10 });
      scores.sort((a, b) => Number(b.score) - Number(a.score));
      await updateState(query, true, { scores });
      result = { ok: true, message: 'Your score increased by 10.' };
    } else {
      result = { ok: false, message: 'Unknown demo action.' };
    }
  }
  await api.answerWidgetQuery({ widget_query_id: query.id, data: answer(result) });
}
