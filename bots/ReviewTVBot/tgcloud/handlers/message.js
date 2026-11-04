import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { reviews } from '../schema.js';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import { categories, isAdmin } from '../lib/config.js';
import {
  buildHelpRichMessage, buildHowToRichMessage, buildReviewRichMessage,
  buildReviewKeyboard, buildEditKeyboard, buildMyReviewsRichMessage,
} from '../lib/formatting.js';
import { publishReview } from '../lib/publishing.js';
import { communityConfig, categoryTopics } from '../schema.js';
import {
  connectForum, setCategoryTopic, showSettings, disconnectForum,
} from '../lib/forum.js';

function parseCommand(text) {
  const [rawCommand, ...args] = text.trim().split(/\s+/);
  return { command: rawCommand.split('@', 1)[0].toLowerCase(), args };
}

async function editPrompt(chatId, messageId, text, replyMarkup) {
  const params = { chat_id: chatId, message_id: messageId, text };
  params.reply_markup = replyMarkup || { inline_keyboard: [] };
  return api.editMessageText(params);
}

async function deleteUserMessage(message) {
  if (!message?.chat?.id || !message?.message_id) return;
  try { await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id }); }
  catch (error) { console.warn('Could not remove a submitted review message', error?.description || error?.message || error); }
}

function withBack(keyboard = null) {
  const rows = keyboard?.inline_keyboard ? keyboard.inline_keyboard.map(row => [...row]) : [];
  rows.push([{ text: '‹ Back', callback_data: 'rv:back' }, { text: 'Cancel review', callback_data: 'rv:cancel', style: 'danger' }]);
  return { inline_keyboard: rows };
}

async function sendRich(chatId, richMessage, replyMarkup) {
  const params = { chat_id: chatId, rich_message: richMessage };
  if (replyMarkup) params.reply_markup = replyMarkup;
  return api.sendRichMessage(params);
}

async function showWelcome(message) {
  const user = message.from ?? {};
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'there';
  const rich = { blocks: [
    { type: 'heading', size: 1, text: `Welcome, ${fullName}.` },
    { type: 'paragraph', text: 'A simple place to share thoughtful reviews of movies, series, and anime.' },
    { type: 'paragraph', text: 'Submit your review with a rating, genre, and optional poster. Published reviews are organised in the appropriate topic of @Review_Tv.' },
    { type: 'divider' },
    { type: 'footer', text: ['Review publishing hub: ', { type: 'url', text: '@Review_Tv', url: 'https://t.me/Review_Tv' }, '. Use /help to see available commands.'] },
  ] };
  await sendRich(message.chat.id, rich, { inline_keyboard: [[
    { text: 'Write a review', callback_data: 'rv:start', style: 'success' },
    { text: 'How to use', callback_data: 'rv:howto' },
  ]] });
}

async function showHowTo(chatId) {
  await sendRich(chatId, buildHowToRichMessage(), {
    inline_keyboard: [[{ text: 'Start a review', callback_data: 'rv:start', style: 'success' }]],
  });
}

async function showHelp(chatId, userId) {
  const rich = buildHelpRichMessage(isAdmin(userId));
  await sendRich(chatId, rich, {
    inline_keyboard: [[{ text: 'How to use', callback_data: 'rv:howto' }]],
  });
}

async function promptStep(chatId, draft, text, keyboard = null) {
  const messageId = draft.data.promptMessageId;
  if (messageId) return editPrompt(chatId, messageId, text, keyboard);
  const sent = await api.sendMessage({ chat_id: chatId, text, reply_markup: withBack(keyboard) });
  draft.data.promptMessageId = sent.message_id;
  await saveDraft(draft.userId, chatId, draft.step, draft.data);
  return sent;
}

async function showCategoryPicker(chatId, userId) {
  const rows = [];
  for (let i = 0; i < categories.length; i += 2) {
    rows.push(categories.slice(i, i + 2).map((item) => ({
      text: item.label, callback_data: `rv:category:${item.key}`,
    })));
  }
  rows.push([{ text: 'Cancel review', callback_data: 'rv:cancel', style: 'danger' }]);
  const sent = await api.sendMessage({ chat_id: chatId, text: 'Choose the category for your review:', reply_markup: { inline_keyboard: rows } });
  await saveDraft(userId, chatId, 'category', { promptMessageId: sent.message_id });
}

async function showPreview(chatId, draft) {
  const data = { ...draft.data, authorName: draft.data.authorName || 'Telegram user' };
  const params = {
    chat_id: chatId,
    message_id: data.promptMessageId,
    rich_message: buildReviewRichMessage(data, null, true),
    reply_markup: buildReviewKeyboard(data, 'preview'),
  };
  await api.editMessageText(params);
}

async function startReview(message) {
  if (message.chat.type !== 'private' || !message.from?.id) {
    await api.sendMessage({ chat_id: message.chat.id, text: 'Please submit reviews in your private chat with the bot.' });
    return;
  }
  const existing = await getDraft(message.from.id);
  if (existing) {
    if (existing.step === 'complete') return showPreview(message.chat.id, existing);
    if (existing.step === 'publishing') {
      await api.sendMessage({ chat_id: message.chat.id, text: 'Your review is currently being published. Please wait a moment.' });
      return;
    }
    const prompts = {
      category: 'Choose the category for your review:',
      title: 'Send the movie, show, or anime title.',
      year: 'Send the release year (for example, 2024).',
      genre: 'Optionally send the genre or genres (for example, Action, Drama, Romance), or tap Skip genre.',
      season: 'Send the season number, or tap Skip season.',
      rating: 'Choose your rating from 1 to 10.',
      review_text: 'Write your review in 20–3000 characters.',
      poster: 'Send a poster photo or a direct HTTPS image URL, or skip this step.',
      spoiler: 'Does your review contain spoilers?',
    };
    const keyboards = {
      category: { inline_keyboard: categories.reduce((rows, item, i) => { const r=Math.floor(i/2); rows[r] ||= []; rows[r].push({text:item.label,callback_data:`rv:category:${item.key}`}); return rows; },[]) },
      genre: { inline_keyboard: [[{text:'Skip genre',callback_data:'rv:genre:skip'}]] },
      season: { inline_keyboard: [[{text:'Skip season',callback_data:'rv:season:skip'}]] },
      rating: { inline_keyboard: [[1,2,3,4,5].map(n=>({text:String(n),callback_data:`rv:rating:${n}`})) , [6,7,8,9,10].map(n=>({text:String(n),callback_data:`rv:rating:${n}`}))] },
      poster: { inline_keyboard: [[{text:'Skip poster',callback_data:'rv:poster:skip'}]] },
      spoiler: { inline_keyboard: [[{text:'Contains spoilers',callback_data:'rv:spoiler:yes',style:'danger'},{text:'No spoilers',callback_data:'rv:spoiler:no',style:'success'}]] },
    };
    await editPrompt(message.chat.id, existing.data.promptMessageId, prompts[existing.step] || 'Continue your review.', withBack(keyboards[existing.step]));
    return;
  }
  await showCategoryPicker(message.chat.id, message.from.id);
}

async function transition(message, draft, nextStep, prompt, keyboard = null, nextData = draft.data) {
  // Persist the updated values collected from this message before advancing the wizard.
  // Cloning draft.data here silently discarded every newly entered field.
  const data = { ...nextData };
  await saveDraft(message.from.id, message.chat.id, nextStep, data);
  await editPrompt(message.chat.id, data.promptMessageId, prompt, withBack(keyboard));
}

async function handleDraftInput(message, draft) {
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const data = { ...draft.data };
  const userId = message.from.id;
  const chatId = message.chat.id;
  const editing = draft.step.startsWith('edit_');

  if (draft.step === 'title' || draft.step === 'edit_title') {
    if (text.length < 2 || text.length > 160) return editPrompt(chatId, data.promptMessageId, 'Please send a title between 2 and 160 characters.', withBack());
    data.title = text;
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    return transition(message, draft, 'year', 'Send the release year (for example, 2024).', null, data);
  }
  if (draft.step === 'year' || draft.step === 'edit_year') {
    const year = Number(text);
    const maxYear = new Date().getUTCFullYear() + 5;
    if (!/^\d{4}$/.test(text) || !Number.isInteger(year) || year < 1888 || year > maxYear) return editPrompt(chatId, data.promptMessageId, `Please send a valid four-digit year between 1888 and ${maxYear}.`, withBack());
    data.year = year;
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    return transition(message, draft, 'genre', 'Optionally send the genre or genres (for example, Action, Drama, Romance), or tap Skip genre.', { inline_keyboard: [[{text:'Skip genre',callback_data:'rv:genre:skip'}]] }, data);
  }
  if (draft.step === 'genre' || draft.step === 'edit_genre') {
    if (text.toLowerCase() === '/skip') data.genre = null;
    else {
      if (text.length < 2 || text.length > 80) return editPrompt(chatId, data.promptMessageId, 'Send genre names between 2 and 80 characters, or tap Skip genre.', withBack({ inline_keyboard: [[{text:'Skip genre',callback_data:'rv:genre:skip'}]] }));
      data.genre = text;
    }
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    if (data.categoryKey === 'tv_shows') return transition(message, draft, 'season', 'Send the season number, or tap Skip season.', { inline_keyboard: [[{text:'Skip season',callback_data:'rv:season:skip'}]] }, data);
    return transition(message, draft, 'rating', 'Choose your rating from 1 to 10.', ratingKeyboard(), data);
  }
  if (draft.step === 'season' || draft.step === 'edit_season') {
    if (text.toLowerCase() === '/skip') data.season = null;
    else {
      const season = Number(text);
      if (!/^\d{1,2}$/.test(text) || !Number.isInteger(season) || season < 1 || season > 99) return editPrompt(chatId, data.promptMessageId, 'Send a season number from 1 to 99, or tap Skip season.', withBack({ inline_keyboard: [[{text:'Skip season',callback_data:'rv:season:skip'}]] }));
      data.season = season;
    }
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    return transition(message, draft, 'rating', 'Choose your rating from 1 to 10.', ratingKeyboard());
  }
  if (draft.step === 'review_text' || draft.step === 'edit_text') {
    if (text.length < 20 || text.length > 3000) return editPrompt(chatId, data.promptMessageId, 'Please write between 20 and 3000 characters for your review.', withBack());
    data.reviewText = text;
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    return transition(message, draft, 'poster', 'Send a poster photo or a direct HTTPS image URL, or skip this step.', { inline_keyboard: [[{text:'Skip poster',callback_data:'rv:poster:skip'}]] }, data);
  }
  if (draft.step === 'poster' || draft.step === 'edit_poster') {
    if (Array.isArray(message.photo) && message.photo.length) {
      data.posterFileId = message.photo[message.photo.length - 1].file_id;
      data.posterUrl = null;
    } else if (/^https:\/\/\S+$/i.test(text)) {
      data.posterFileId = null;
      data.posterUrl = text;
    } else if (text.toLowerCase() === '/skip') {
      data.posterFileId = null;
      data.posterUrl = null;
    } else return editPrompt(chatId, data.promptMessageId, 'Send a poster photo or a direct HTTPS image URL, or tap Skip poster.', withBack({ inline_keyboard: [[{text:'Skip poster',callback_data:'rv:poster:skip'}]] }));
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    return transition(message, draft, 'spoiler', 'Does your review contain spoilers?', spoilerKeyboard(), data);
  }
  if (draft.step === 'complete') return showPreview(chatId, draft);
}

function ratingKeyboard() {
  return { inline_keyboard: [
    [1,2,3,4,5].map(n=>({text:String(n),callback_data:`rv:rating:${n}`})),
    [6,7,8,9,10].map(n=>({text:String(n),callback_data:`rv:rating:${n}`})),
  ] };
}
function spoilerKeyboard() {
  return { inline_keyboard: [[
    { text: 'Contains spoilers', callback_data: 'rv:spoiler:yes', style: 'danger' },
    { text: 'No spoilers', callback_data: 'rv:spoiler:no', style: 'success' },
  ]] };
}
async function saveAndPreview(userId, chatId, data) {
  await saveDraft(userId, chatId, 'complete', data);
  const draft = await getDraft(userId);
  return showPreview(chatId, draft);
}

async function listMyReviews(chatId, userId, page = 0, messageId = null) {
  const rows = await db.select().from(reviews).where(eq(reviews.authorId, userId)).all();
  const published = rows.filter(row => row.status === 'published').sort((a,b) => b.id-a.id);
  if (!published.length) return api.sendMessage({ chat_id: chatId, text: 'You have not published a review yet. Send /review when you are ready.' });
  const pageSize = 10;
  const pageCount = Math.ceil(published.length / pageSize);
  const safePage = Math.max(0, Math.min(Number(page) || 0, pageCount - 1));
  const items = published.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const params = { chat_id: chatId, rich_message: buildMyReviewsRichMessage(items, safePage, pageCount, published.length) };
  const buttons = [];
  if (safePage > 0) buttons.push({ text: '‹ Previous', callback_data: `rv:reviews:${safePage - 1}` });
  if (safePage + 1 < pageCount) buttons.push({ text: 'Next ›', callback_data: `rv:reviews:${safePage + 1}` });
  params.reply_markup = { inline_keyboard: buttons.length ? [buttons] : [] };
  if (messageId) { params.message_id = messageId; return api.editMessageText(params); }
  return api.sendRichMessage(params);
}

async function showAdmin(chatId, userId, command) {
  if (!isAdmin(userId)) return;
  if (command === '/admin') {
    return sendRich(chatId,{blocks:[
      {type:'heading',size:1,text:'ReviewTVBot Admin'},
      {type:'paragraph',text:'Private administration and publishing controls.'},
      {type:'list',items:[
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/admin'},' — Open this administration panel']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/stats'},' — View review totals and category statistics']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/settings'},' — View forum connection and topic mappings']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/connect'},' — Connect the review forum (run by the forum creator)']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/settopic category_key'},' — Assign the current forum topic to a review category']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/disconnect'},' — Disable the connected review forum']}]},
      ]},
      {type:'footer',text:'Choose a section below. This panel is private to authorized administrators.'},
    ]},{inline_keyboard:[[
      {text:'Statistics',callback_data:'rv:admin:stats'},
      {text:'Settings',callback_data:'rv:admin:settings'},
    ]]});
  }
  if (command === '/stats') return showAdminStats(chatId);
  if (command === '/settings') return showAdminSettings(chatId);
}

async function showAdminStats(chatId, messageId = null) {
  const all = await db.select().from(reviews).all();
  const published = all.filter(row=>row.status==='published');
  const cells = [
    [{text:'Category',is_header:true},{text:'Published',is_header:true}],
    ...categories.map(c=>[{text:c.label},{text:String(published.filter(r=>r.categoryKey===c.key).length)}]),
    [{text:'Total published'},{text:String(published.length)}],
    [{text:'Draft / failed'},{text:String(all.length-published.length)}],
  ];
  const params={chat_id:chatId,rich_message:{blocks:[
    {type:'heading',size:1,text:'Review statistics'},
    {type:'table',cells,is_bordered:true,is_striped:true,is_compact:true},
    {type:'footer',text:'Counts are based on saved review records.'},
  ]},reply_markup:{inline_keyboard:[[{text:'‹ Admin panel',callback_data:'rv:admin:home'}]]}};
  if(messageId){params.message_id=messageId;return api.editMessageText(params);}
  return sendRich(chatId,params.rich_message,params.reply_markup);
}

async function showAdminSettings(chatId, messageId = null) {
  const config=await db.select().from(communityConfig).get();
  const mappings=await db.select().from(categoryTopics).all();
  const blocks=[{type:'heading',size:1,text:'Forum settings'}];
  if(!config) blocks.push({type:'paragraph',text:'No forum is connected yet. Run /connect in the forum supergroup as its creator.'});
  else {
    blocks.push({type:'paragraph',text:[{type:'bold',text:'Forum:'},' @Review_Tv']},
      {type:'paragraph',text:[{type:'bold',text:'Chat ID:'},' ',{type:'monospace',text:String(config.chatId)}]},
      {type:'paragraph',text:[{type:'bold',text:'Status:'},' ',config.enabled?'Connected ✅':'Disconnected']},
      {type:'divider'},
      {type:'heading',size:3,text:'Category topics'},
      {type:'list',items:categories.map(category=>{
        const mapping=mappings.find(item=>item.categoryKey===category.key&&item.chatId===config.chatId);
        return {blocks:[{type:'paragraph',text:[{type:'bold',text:category.label},' — ',mapping?String(mapping.topicId):'Not configured']}]};
      })},
      );
  }
  const params={chat_id:chatId,rich_message:{blocks},reply_markup:{inline_keyboard:[[{text:'‹ Admin panel',callback_data:'rv:admin:home'}]]}};
  if(messageId){params.message_id=messageId;return api.editMessageText(params);}
  return sendRich(chatId,params.rich_message,params.reply_markup);
}
export default async function (message) {
  if (!message?.chat?.id) return;
  const text = typeof message.text === 'string' ? message.text : '';
  try {
    if (text.startsWith('/')) {
      const { command, args } = parseCommand(text);
      const userId = message.from?.id;
      if (command === '/start') {
        await showWelcome(message);
        return;
      }
      if (command === '/help') return showHelp(message.chat.id,message.from?.id);
      if (command === '/howtouse') return showHowTo(message.chat.id);
      if (command === '/review') return startReview(message);
      if (command === '/cancel') {
        if (message.chat.type !== 'private' || !userId) return;
        const draft = await getDraft(userId);
        if (!draft) return api.sendMessage({chat_id:message.chat.id,text:'You do not have an active review draft.'});
        await deleteDraft(userId);
        return editPrompt(message.chat.id,draft.data.promptMessageId,'Your review draft has been cancelled.',null);
      }
      if (command === '/myreviews') {
        if (message.chat.type !== 'private' || !userId) return;
        return listMyReviews(message.chat.id,userId,0);
      }
      if (['/admin','/stats'].includes(command)) {
        if (message.chat.type !== 'private' || !isAdmin(userId)) return;
        return showAdmin(message.chat.id,userId,command);
      }
      if (command === '/settings') {
        if (message.chat.type !== 'private' || !isAdmin(userId)) return;
        return showAdmin(message.chat.id,userId,command);
      }
      if (command === '/connect') {
        if (!isAdmin(userId)) return;
        return connectForum(message);
      }
      if (command === '/settopic') {
        if (!isAdmin(userId)) return;
        return setCategoryTopic(message,args[0] ?? '');
      }
      if (command === '/disconnect') {
        if (message.chat.type !== 'private' || !isAdmin(userId)) return;
        return disconnectForum({chat:{id:message.chat.id},from:{id:userId}},args[0]);
      }
      if (command !== '/skip') return;
    }
    if (message.chat.type !== 'private' || !message.from?.id) return;
    const draft = await getDraft(message.from.id);
    if (draft && draft.chatId === message.chat.id) await handleDraftInput(message,draft);
  } catch (error) {
    console.error('ReviewTVBot message handler failed',error);
    try { await api.sendMessage({chat_id:message.chat.id,text:'Sorry, I could not complete that step. Please try again. Your saved draft is safe.'}); }
    catch (sendError) { console.error('ReviewTVBot fallback send failed',sendError); }
  }
}
