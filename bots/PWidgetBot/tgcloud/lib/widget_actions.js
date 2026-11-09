import { api } from 'sdk';

const MAX_STATE_BYTES = 1024;
const safeNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const encode = (value) => {
  const result = JSON.stringify(value);
  if (new TextEncoder().encode(result).length > MAX_STATE_BYTES) throw new Error('Widget state is too large');
  return result;
};
const answer = (value) => {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > MAX_STATE_BYTES) return JSON.stringify({ ok: false, message: 'Response too large.' });
  return text;
};

async function updateState(query, nextState) {
  const encoded = encode(nextState);
  if (query.widget_id) {
    await api.editSharedWidgetData({ widget_id: query.widget_id, public_data: encoded, cache_time: 5 });
    return;
  }
  if (!query.chat?.id || !query.message_id) throw new Error('Message reference is missing');
  await api.editMessageWidgetData({ chat_id: query.chat.id, message_id: query.message_id, chat_data: encoded });
}

function walletSummary(query) {
  if (query.type?.type === 'data' && query.type.wallet_card) {
    const card = query.type.wallet_card;
    return { ok: true, message: 'Wallet card received.', wallet: {
      address: card.address || null, amount: card.amount || null, public_key: card.public_key || null,
    } };
  }
  if (query.type?.type === 'sign_data') {
    return { ok: true, message: 'Wallet-signed data received. Verify its signature and bot domain before trusting it.', wallet: {
      address: query.type.wallet?.address || null, signedDataReceived: Boolean(query.type.sign_data),
    } };
  }
  if (query.type?.type === 'sent_transaction') {
    return { ok: true, message: 'Wallet transaction notification received.', wallet: {
      address: query.type.wallet?.address || null, messageHash: query.type.msg_hash || null,
    } };
  }
  return null;
}

function parseStateToken(token) {
  return String(token || '').split(',').map((part) => safeNumber(part, 0));
}

export async function handleWidgetQuery(query) {
  let result = { ok: true, message: 'Request received.' };
  const wallet = walletSummary(query);
  if (wallet) {
    result = wallet;
  } else {
    const [action, token = ''] = String(query.data || '').split('|');
    const values = parseStateToken(token);
    if (action === 'demo:ping') {
      result = { ok: true, message: 'PWidgetBot received your request and answered it.' };
    } else if (action.startsWith('vote:')) {
      const choice = Number(action.slice(5));
      if (!Number.isInteger(choice) || choice < 0 || choice > 2) result = { ok: false, message: 'Invalid poll option.' };
      else {
        const votes = [0, 1, 2].map((index) => Math.max(0, values[index] || 0));
        votes[choice] += 1;
        await updateState(query, { votes, total: votes.reduce((sum, count) => sum + count, 0) });
        result = { ok: true, message: 'Vote recorded.' };
      }
    } else if (action === 'reaction:add') {
      await updateState(query, { count: Math.max(0, values[0]) + 1 });
      result = { ok: true, message: 'Reaction added.' };
    } else if (action === 'clicker:tap' || action === 'state:increment') {
      await updateState(query, { count: Math.max(0, values[0]) + 1 });
      result = { ok: true, message: 'State updated.' };
    } else if (action.startsWith('progress:')) {
      const delta = Number(action.slice(9));
      if (!Number.isFinite(delta) || Math.abs(delta) > 10) result = { ok: false, message: 'Invalid progress change.' };
      else {
        await updateState(query, { progress: Math.min(100, Math.max(0, values[0] + delta)) });
        result = { ok: true, message: 'Progress updated.' };
      }
    } else if (action.startsWith('rating:')) {
      const rating = Number(action.slice(7));
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) result = { ok: false, message: 'Invalid rating.' };
      else {
        await updateState(query, { rating });
        result = { ok: true, message: `Thanks for rating this demo ${rating}/5.` };
      }
    } else if (action.startsWith('guess:')) {
      const guess = Number(action.slice(6));
      if (!Number.isInteger(guess) || guess < 1 || guess > 5) result = { ok: false, message: 'Choose a number from 1 to 5.' };
      else {
        const attempts = Math.max(0, values[0]) + 1;
        const message = guess === 3 ? 'Correct — you found the demo number!' : guess < 3 ? 'Too low. Try again.' : 'Too high. Try again.';
        await updateState(query, { attempts, result: guess === 3 ? 'won' : '' });
        result = { ok: true, message };
      }
    } else if (action.startsWith('quiz:')) {
      const choice = Number(action.slice(5));
      const correct = choice === 1;
      await updateState(query, { answered: true, correct: correct ? 1 : 0 });
      result = { ok: true, message: correct ? 'Correct! answerWidgetQuery is the method.' : 'Not quite. The correct method is answerWidgetQuery.' };
    } else if (action === 'dashboard:refresh') {
      const next = { visitors: (values[0] || 128) + 1, tasks: Math.max(0, (values[1] || 7) - 1), progress: Math.min(100, (values[2] || 64) + 2) };
      await updateState(query, next);
      result = { ok: true, message: 'Dashboard data refreshed.' };
    } else if (action === 'leaderboard:score') {
      const myScore = Math.max(0, values[0] || 72) + 10;
      const scores = [{ name: 'Alex', score: 120 }, { name: 'Sam', score: 95 }, { name: 'You', score: myScore }].sort((a, b) => b.score - a.score);
      await updateState(query, { myScore, scores });
      result = { ok: true, message: 'Your score increased by 10.' };
    } else {
      result = { ok: false, message: 'Unknown demo action.' };
    }
  }
  await api.answerWidgetQuery({ widget_query_id: query.id, data: answer(result) });
}
