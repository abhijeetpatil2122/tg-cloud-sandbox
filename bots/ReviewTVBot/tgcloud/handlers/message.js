import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { reviews } from '../schema.js';
import { getDraft, saveDraft, deleteDraft, appendDraftMedia } from '../lib/sessions.js';
import { categories, getNumericRatingStyle, isAdmin, ratingVerdicts } from '../lib/config.js';
import {
  buildHelpRichMessage, buildHowToRichMessage, buildReviewRichMessage,
  buildReviewKeyboard, buildEditKeyboard, buildMyReviewsRichMessage,
} from '../lib/formatting.js';
import { publishReview } from '../lib/publishing.js';
import { refreshLeaderboard } from '../lib/leaderboard.js';
import { showUserProfile } from '../lib/profile.js';
import { communityConfig, categoryTopics } from '../schema.js';
import {
  connectForum, setCategoryTopic, showSettings, disconnectForum,
} from '../lib/forum.js';

function normalizeGenres(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean).map((item) => {
    if (item.startsWith('#')) return item;
    return `#${item.replace(/\s+/g, '_')}`;
  }).join(', ');
}
function titlePrompt(categoryKey) {
  const label = categoryKey === 'tv_shows' ? 'TV series' : categoryKey === 'k_c_j_dramas' ? 'K/C/J drama' : categoryKey === 'anime' ? 'anime' : 'movie';
  return `Send the ${label} title.`;
}
function yearPrompt(categoryKey) {
  return ['tv_shows', 'k_c_j_dramas'].includes(categoryKey) ? 'Send the first release year. You can add the end year next, or skip if unknown.' : 'Send the release year, or skip if unknown.';
}
function genrePrompt() { return 'Optionally add genres separated by commas, or skip this step.'; }


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
    { type: 'heading', size: 1, text: `👋 Welcome, ${fullName}` },
    { type: 'paragraph', text: 'Share thoughtful reviews of movies, series, dramas, and anime.' },
    { type: 'paragraph', text: 'Choose a category, give a required 1–10 rating, add an optional verdict, and publish when your preview is ready.' },
    { type: 'paragraph', text: ['Community: ', { type: 'button', button: { text: '@Review_Tv', url: 'https://t.me/Review_Tv' } }] },
    { type: 'footer', text: 'Use /help for commands or /howtouse for the submission guide.' },
  ] };
  await sendRich(message.chat.id, rich, { inline_keyboard: [[
    { text: 'Profile', callback_data: 'rv:profile' }, { text: 'How to use', callback_data: 'rv:howto' },
  ], [{ text: 'Write a review', callback_data: 'rv:start', style: 'success' }]] });
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
  let existing = await getDraft(message.from.id);
  if (existing?.step === 'publishing') {
    const publishingAge = Date.now() - new Date(existing.updatedAt).getTime();
    // A Serverless invocation can be interrupted while waiting on Telegram's
    // media fetch. Recover abandoned locks so the author is never stuck forever.
    if (!Number.isFinite(publishingAge) || publishingAge > 120000) {
      await saveDraft(message.from.id, message.chat.id, 'complete', existing.data);
      existing = await getDraft(message.from.id);
    }
  }
  if (existing) {
    if (existing.step === 'complete') return showPreview(message.chat.id, existing);
    if (existing.step === 'publishing') {
      await api.sendMessage({ chat_id: message.chat.id, text: 'Your review is currently being published. Please wait a moment. If it seems stuck, send /cancel to cancel this draft, then use /review to start again.' });
      return;
    }
    const prompts = {
      category: 'Choose the category for your review:',
      title: titlePrompt(existing.data.categoryKey),
      year: yearPrompt(existing.data.categoryKey),
      end_year: 'If the series has ended, send its final year (for example, 2020). Otherwise tap Skip end year.',
      edit_year: 'Send the corrected release year. For TV series, you can also update its end year, or tap Skip year if unknown.',
      edit_end_year: 'Send the series end year, or tap Skip end year if it is still ongoing or unknown.',
      genre: genrePrompt(),
      season: 'Send a season number, or skip.',
      rating: 'Choose a rating from 1–10.',
      verdict: 'Choose an optional verdict, or skip.',
      edit_rating: 'Choose a rating from 1–10.',
      edit_verdict: 'Choose an optional verdict, or skip.',
      review_text: 'Write your review (20–5,000 characters).',
      media: 'Add photos if you like, then tap Done or Skip.',
      edit_media: 'Add replacement photos, then tap Done or Skip.',
      spoiler: 'Does your review contain spoilers?',
    };
    const keyboards = {
      category: { inline_keyboard: categories.reduce((rows, item, i) => { const r=Math.floor(i/2); rows[r] ||= []; rows[r].push({text:item.label,callback_data:`rv:category:${item.key}`}); return rows; },[]) },
      genre: { inline_keyboard: [[{text:'Skip genre',callback_data:'rv:genre:skip'}]] },
      season: { inline_keyboard: [[{text:'Skip season',callback_data:'rv:season:skip'}]] },
      rating: ratingKeyboard(),
      edit_rating: ratingKeyboard(),
      verdict: verdictKeyboard(),
      edit_verdict: verdictKeyboard(),
      year: { inline_keyboard: [[{text:'Skip year',callback_data:'rv:year:skip'}]] },
      end_year: { inline_keyboard: [[{text:'Skip end year',callback_data:'rv:year:skip'}]] },
      edit_year: {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]},
      edit_end_year: {inline_keyboard:[[{text:'Skip end year',callback_data:'rv:year:skip'}]]},
      media: { inline_keyboard: [[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]] },
      edit_media: {inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]},
      spoiler: { inline_keyboard: [[{text:'Contains spoilers',callback_data:'rv:spoiler:yes',style:'danger'},{text:'No spoilers',callback_data:'rv:spoiler:no',style:'success'}]] },
    };
    const prompt = existing.step === 'title' ? titlePrompt(existing.data.categoryKey) : existing.step === 'year' ? yearPrompt(existing.data.categoryKey) : prompts[existing.step] || 'Continue your review.';
    await editPrompt(message.chat.id, existing.data.promptMessageId, prompt, withBack(keyboards[existing.step]));
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
    if (text.length < 2 || text.length > 160) return editPrompt(chatId, data.promptMessageId, 'Send a title between 2 and 160 characters.', withBack());
    data.title = text;
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    return transition(message, draft, 'year', yearPrompt(data.categoryKey), {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}, data);
  }
  if (draft.step === 'year' || draft.step === 'edit_year') {
    const year=Number(text), maxYear=new Date().getUTCFullYear()+5;
    if(!/^\d{4}$/.test(text)||!Number.isInteger(year)||year<1888||year>maxYear)return editPrompt(chatId,data.promptMessageId,`Please send a valid four-digit year between 1888 and ${maxYear}, or tap Skip year.`,withBack({inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}));
    data.year=year; data.endYear=null; await deleteUserMessage(message);
    if(['tv_shows','k_c_j_dramas'].includes(data.categoryKey)) return transition(message,draft,editing?'edit_end_year':'end_year','If the series has ended, send its final year (for example, 2020). Otherwise tap Skip end year.',{inline_keyboard:[[{text:'Skip end year',callback_data:'rv:year:skip'}]]},data);
    if(editing)return saveAndPreview(userId,chatId,data);
    return transition(message,draft,'genre',genrePrompt(),{inline_keyboard:[[{text:'Skip genre',callback_data:'rv:genre:skip'}]]},data);
  }
  if (draft.step === 'end_year' || draft.step === 'edit_end_year') {
    const endYear=Number(text), maxYear=new Date().getUTCFullYear()+5;
    if(!/^\d{4}$/.test(text)||!Number.isInteger(endYear)||endYear<1888||endYear>maxYear||(data.year&&endYear<data.year))return editPrompt(chatId,data.promptMessageId,`Please send a valid end year between ${data.year||1888} and ${maxYear}; it cannot be earlier than the start year. Or tap Skip end year.`,withBack({inline_keyboard:[[{text:'Skip end year',callback_data:'rv:year:skip'}]]}));
    data.endYear=endYear; await deleteUserMessage(message);
    if(editing)return saveAndPreview(userId,chatId,data);
    return transition(message,draft,'genre',genrePrompt(),{inline_keyboard:[[{text:'Skip genre',callback_data:'rv:genre:skip'}]]},data);
  }
  if (draft.step === 'genre' || draft.step === 'edit_genre') {
    if (text.toLowerCase() === '/skip') data.genre = null;
    else {
      if (text.length < 2 || text.length > 80 || !text.split(',').every((item) => item.trim().length > 0)) return editPrompt(chatId, data.promptMessageId, 'Send genre names separated by commas (up to 80 characters), or tap Skip genre.', withBack({ inline_keyboard: [[{text:'Skip genre',callback_data:'rv:genre:skip'}]] }));
      data.genre = normalizeGenres(text);
    }
    await deleteUserMessage(message);
    if (editing) return saveAndPreview(userId, chatId, data);
    if (['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey)) return transition(message, draft, 'season', 'Send a season number, or skip.', { inline_keyboard: [[{text:'Skip season',callback_data:'rv:season:skip'}]] }, data);
    return transition(message, draft, 'rating', 'Choose a rating from 1–10.', ratingKeyboard(), data);
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
    return transition(message, draft, 'rating', 'Choose a rating from 1–10.', ratingKeyboard(), data);
  }
  if (draft.step === 'review_text' || draft.step === 'edit_text') {
    if (text.length < 20 || text.length > 5000) return editPrompt(chatId, data.promptMessageId, 'Please write between 20 and 5000 characters for your review.', withBack());
    data.reviewText = text;
    await deleteUserMessage(message);
    if(editing)return saveAndPreview(userId,chatId,data);
    data.media=[];data.mediaMode='slideshow';
    return transition(message,draft,'media','Send one or more photos, or paste direct HTTPS image links separated by commas. Tap Done when finished, or Skip photos.',{inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]},data);
  }
  if(draft.step==='media'||draft.step==='edit_media'){
    const photo=Array.isArray(message.photo)&&message.photo.length
      ? [{type:'photo',media:message.photo[message.photo.length-1].file_id}]
      : null;
    const links=text.split(',').map(link=>link.trim()).filter(Boolean);
    const validLinks=links.length>0&&links.every(link=>/^https:\/\/[^\s,]+$/i.test(link));
    const items=photo||(validLinks?links.map(link=>({type:'photo',media:link})):null);
    if(!items)return editPrompt(chatId,data.promptMessageId,'Send Telegram photos (albums are supported), or paste direct HTTPS image links separated by commas. You can add up to 10 images, then tap Done.',withBack({inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]}));
    const appended=await appendDraftMedia(userId,chatId,items);
    if(!appended){
      const latest=await getDraft(userId);
      const count=Array.isArray(latest?.data?.media)?latest.data.media.length:0;
      await deleteUserMessage(message);
      return editPrompt(chatId,data.promptMessageId,count>=10?'You can add up to 10 images. Tap Done to continue.':'This review is no longer accepting images. Send /review to resume.',withBack({inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'}]]}));
    }
    // Each album photo is a separate update. Keep the append atomic, but restore
    // the normal wizard UX: remove the user's upload and refresh the single prompt.
    await deleteUserMessage(message);
    const latest=await getDraft(userId);
    const count=Array.isArray(latest?.data?.media)?latest.data.media.length:0;
    const added=items.length;
    const promptText=count>=10
      ? `Received your images. ${count}/10 added — tap Done to continue.`
      : `Received ${added} image${added===1?'':'s'} (${count}/10). Send more photos or comma-separated links, or tap Done.`;
    try {
      await editPrompt(chatId,data.promptMessageId,promptText,withBack({inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]}));
    } catch (error) {
      console.warn('Could not refresh the media upload prompt',error?.description||error?.message||error);
    }
    return;
  }
  if(draft.step==='poster'||draft.step==='edit_poster'){
    if(Array.isArray(message.photo)&&message.photo.length)data.media=[{type:'photo',media:message.photo[message.photo.length-1].file_id}];else if(/^https:\/\/\S+$/i.test(text))data.media=[{type:'photo',media:text}];else if(text.toLowerCase()==='/skip')data.media=[];else return editPrompt(chatId,data.promptMessageId,'Send a photo or direct HTTPS image URL, or skip.',withBack());
    data.mediaMode='slideshow';await deleteUserMessage(message);if(editing)return saveAndPreview(userId,chatId,data);return transition(message,draft,'spoiler','Does your review contain spoilers?',spoilerKeyboard(),data);
  }
  if (draft.step === 'complete') return showPreview(chatId, draft);
}

function ratingKeyboard() {
  return { inline_keyboard: [
    [1, 2, 3, 4, 5].map((rating) => ({ text: String(rating), callback_data: `rv:rating:${rating}`, style: getNumericRatingStyle(rating) })),
    [6, 7, 8, 9, 10].map((rating) => ({ text: String(rating), callback_data: `rv:rating:${rating}`, style: getNumericRatingStyle(rating) })),
  ] };
}
function verdictKeyboard() {
  return { inline_keyboard: [
    ratingVerdicts.slice(0, 2).map((v) => ({ text: v.label, callback_data: `rv:verdict:${v.key}`, style: v.style })),
    ratingVerdicts.slice(2).map((v) => ({ text: v.label, callback_data: `rv:verdict:${v.key}`, style: v.style })),
    [{ text: 'Skip verdict', callback_data: 'rv:verdict:skip' }],
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
  buttons.push({ text: '‹ Back to profile', callback_data: 'rv:profile' });
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
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/leaderboard'},' — Initialize or repair the top 20 leaderboard message']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/settings'},' — View forum connection and topic mappings']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/connect'},' — Connect the review forum (run by the forum creator)']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/settopic category_key'},' — Assign the current forum topic to a review category']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/disconnect'},' — Disable the connected review forum']}]},
        {blocks:[{type:'paragraph',text:[{type:'bold',text:'/resetdb'},' — Temporarily clear test reviews, drafts, and numbering (confirmation required)']}]},
      ]},
      {type:'footer',text:'Choose a section below. This panel is private to authorized administrators.'},
    ]},{inline_keyboard:[[
      {text:'Statistics',callback_data:'rv:admin:stats'},
      {text:'Settings',callback_data:'rv:admin:settings'},
    ], [{text:'Refresh leaderboard',callback_data:'rv:admin:leaderboard'}
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
      {type:'paragraph',text:[{type:'bold',text:'Chat ID:'},' ',{type:'code',text:String(config.chatId)}]},
      {type:'paragraph',text:[{type:'bold',text:'Status:'},' ',config.enabled?'Connected ✅':'Disconnected']},
      {type:'divider'},
      {type:'heading',size:3,text:'Category topics'},
      {type:'list',items:categories.map(category=>{
        const mapping=mappings.find(item=>item.categoryKey===category.key&&item.chatId===config.chatId);
        return {blocks:[{type:'paragraph',text:[{type:'bold',text:category.label},' — ',mapping?String(mapping.topicId):'Not configured']}]};
      })},
      {type:'paragraph',text:[{type:'bold',text:'Leaderboard'},' — ',(mappings.find(item=>item.categoryKey==='leaderboard'&&item.chatId===config.chatId)?.topicId ?? 'Not configured').toString()]},
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
      if (command === '/profile') {
        if (message.chat.type !== 'private' || !userId) return;
        return showUserProfile(message.chat.id, message.from);
      }
      if (command === '/leaderboard') {
        if (message.chat.type !== 'private' || !isAdmin(userId)) return;
        try {
          const result = await refreshLeaderboard();
          return api.sendMessage({ chat_id: message.chat.id, text: result.replaced ? `Leaderboard repaired with a new message (ID: ${result.messageId}).` : `Leaderboard initialized or refreshed successfully (message ID: ${result.messageId}).` });
        } catch (error) {
          return api.sendMessage({ chat_id: message.chat.id, text: error?.message || 'Could not initialize the leaderboard. Check the forum and topic configuration.' });
        }
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
      if (command === '/resetdb') {
        if (message.chat.type !== 'private' || !isAdmin(userId)) return;
        return api.sendMessage({chat_id:message.chat.id,text:'⚠️ Reset ReviewTVBot test data? This permanently deletes all saved reviews, active drafts, and review-number counters. Forum connection and category-topic settings will be preserved. Existing Telegram posts in the forum will NOT be deleted.',reply_markup:{inline_keyboard:[[{text:'Yes, clear test data',callback_data:'rv:resetdb:confirm',style:'danger'},{text:'Cancel',callback_data:'rv:resetdb:cancel'}]]}});
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
