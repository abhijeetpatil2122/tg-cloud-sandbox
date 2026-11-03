import { api } from 'sdk';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import { getCategory } from '../lib/config.js';
import { buildReviewRichMessage, buildReviewKeyboard, buildEditKeyboard, buildHowToRichMessage } from '../lib/formatting.js';
import { publishReview } from '../lib/publishing.js';

async function answer(id,text) {
  const params={callback_query_id:id};
  if(text) params.text=text;
  await api.answerCallbackQuery(params);
}
async function editPrompt(chatId,messageId,text,replyMarkup) {
  const params={chat_id:chatId,message_id:messageId,text};
  if(replyMarkup) params.reply_markup=replyMarkup;
  return api.editMessageText(params);
}
function ratingKeyboard() {
  return {inline_keyboard:[
    [1,2,3,4,5].map(n=>({text:String(n),callback_data:`rv:rating:${n}`})),
    [6,7,8,9,10].map(n=>({text:String(n),callback_data:`rv:rating:${n}`})),
  ]};
}
async function preview(chatId,draft) {
  return api.editMessageText({
    chat_id:chatId,message_id:draft.data.promptMessageId,
    rich_message:buildReviewRichMessage(draft.data,null,true),
    reply_markup:buildReviewKeyboard(draft.data,'preview'),
  });
}
export default async function(query) {
  if(!query?.id) return;
  const chat=query.message?.chat;
  const userId=query.from?.id;
  try {
    if(!chat || chat.type!=='private' || !userId || chat.id!==userId) {
      await answer(query.id,'Please use these buttons in your private chat with the bot.');
      return;
    }
    const [prefix,action,value]=String(query.data??'').split(':');
    if(prefix!=='rv') { await answer(query.id,'This button is not recognized.'); return; }
    if(action==='howto') {
      await answer(query.id);
      await api.sendRichMessage({chat_id:chat.id,rich_message:buildHowToRichMessage()});
      return;
    }
    if(action==='start') {
      await answer(query.id);
      const sent=await api.sendMessage({chat_id:chat.id,text:'Choose the category for your review:',reply_markup:{inline_keyboard:[
        [{text:'Hollywood Movies',callback_data:'rv:category:hollywood_movies'},{text:'Bollywood Movies',callback_data:'rv:category:bollywood_movies'}],
        [{text:'South Indian Movies',callback_data:'rv:category:south_indian_movies'},{text:'Other Regional Movies',callback_data:'rv:category:other_regional_movies'}],
        [{text:'TV Shows & Series',callback_data:'rv:category:tv_shows'},{text:'Anime',callback_data:'rv:category:anime'}],
      ]}});
      await saveDraft(userId,chat.id,'category',{promptMessageId:sent.message_id});
      return;
    }
    if(action==='noop') { await answer(query.id); return; }
    const draft=await getDraft(userId);
    if(action==='category') {
      if(draft && draft.step !== 'category') { await answer(query.id,'You already have an active review. Resume it with /review or cancel with /cancel.'); return; }
      const category=getCategory(value);
      if(!category) { await answer(query.id,'Unknown category.'); return; }
      await saveDraft(userId,chat.id,'title',{...(draft?.data ?? {}),categoryKey:category.key,promptMessageId:query.message.message_id,authorName:[query.from.first_name,query.from.last_name].filter(Boolean).join(' ')||'Telegram user'});
      await answer(query.id);
      await editPrompt(chat.id,query.message.message_id,'Send the movie, show, or anime title.',null);
      return;
    }
    if(!draft || draft.chatId!==chat.id) { await answer(query.id,'This review session has expired. Send /review to start again.'); return; }
    const data={...draft.data};
    if(action==='season' && value==='skip' && draft.step==='season') {
      data.season=null; await saveDraft(userId,chat.id,'rating',data); await answer(query.id);
      await editPrompt(chat.id,data.promptMessageId,'Choose your rating from 1 to 10.',ratingKeyboard()); return;
    }
    if(action==='rating' && ['rating','edit_rating'].includes(draft.step)) {
      const rating=Number(value);
      if(!Number.isInteger(rating)||rating<1||rating>10) { await answer(query.id,'Choose a rating from 1 to 10.'); return; }
      data.rating=rating; await answer(query.id);
      if(draft.step==='edit_rating') {
        await saveDraft(userId,chat.id,'complete',data);
        const updated=await getDraft(userId); return preview(chat.id,updated);
      }
      await saveDraft(userId,chat.id,'review_text',data);
      await editPrompt(chat.id,data.promptMessageId,'Write your review in 20–3000 characters.',null); return;
    }
    if(action==='poster' && value==='skip' && ['poster','edit_poster'].includes(draft.step)) {
      data.posterFileId=null; await answer(query.id);
      if(draft.step==='edit_poster') {
        await saveDraft(userId,chat.id,'complete',data); const updated=await getDraft(userId); return preview(chat.id,updated);
      }
      await saveDraft(userId,chat.id,'spoiler',data);
      await editPrompt(chat.id,data.promptMessageId,'Does your review contain spoilers?',{inline_keyboard:[[
        {text:'Contains spoilers',callback_data:'rv:spoiler:yes',style:'danger'},
        {text:'No spoilers',callback_data:'rv:spoiler:no',style:'success'},
      ]]}); return;
    }
    if(action==='spoiler' && draft.step==='spoiler' && ['yes','no'].includes(value)) {
      data.hasSpoilers=value==='yes'; await saveDraft(userId,chat.id,'complete',data); await answer(query.id);
      const updated=await getDraft(userId); return preview(chat.id,updated);
    }
    if(action==='edit' && draft.step==='complete') {
      if(value==='menu') { await answer(query.id); return editPrompt(chat.id,data.promptMessageId,'Choose the field you want to edit:',buildEditKeyboard()); }
      const steps={title:['edit_title','Send the corrected title.'],year:['edit_year','Send the corrected release year.'],season:['edit_season','Send a season number, or /skip.'],rating:['edit_rating','Choose the corrected rating.'],text:['edit_text','Send the corrected review text.'],poster:['edit_poster','Send a new poster photo, or skip.'],spoiler:['spoiler','Choose the spoiler setting.']};
      const selected=steps[value];
      if(!selected) { await answer(query.id,'Unknown field.'); return; }
      await saveDraft(userId,chat.id,selected[0],data); await answer(query.id);
      if(value==='rating') return editPrompt(chat.id,data.promptMessageId,selected[1],ratingKeyboard());
      if(value==='poster') return editPrompt(chat.id,data.promptMessageId,selected[1],{inline_keyboard:[[{text:'Remove poster',callback_data:'rv:poster:skip'}]]});
      if(value==='spoiler') return editPrompt(chat.id,data.promptMessageId,selected[1],{inline_keyboard:[[{text:'Contains spoilers',callback_data:'rv:spoiler:yes',style:'danger'},{text:'No spoilers',callback_data:'rv:spoiler:no',style:'success'}]]});
      if(value==='season') return editPrompt(chat.id,data.promptMessageId,selected[1],{inline_keyboard:[[{text:'Skip season',callback_data:'rv:season:skip'}]]});
      return editPrompt(chat.id,data.promptMessageId,selected[1],null);
    }
    if(action==='preview' && draft.step==='complete') { await answer(query.id); return preview(chat.id,draft); }
    if(action==='cancel') {
      await deleteDraft(userId); await answer(query.id,'Draft cancelled.');
      return editPrompt(chat.id,data.promptMessageId,'Your review draft has been cancelled.',null);
    }
    if(action==='publish' && draft.step==='complete') {
      await saveDraft(userId,chat.id,'publishing',data);
      await answer(query.id,'Publishing your review…');
      try {
        const result=await publishReview(userId,{...draft,step:'complete',data});
        await deleteDraft(userId);
        await editPrompt(chat.id,data.promptMessageId,`Your review has been published successfully.\n\nReview #${String(result.reviewNumber).padStart(3,'0')} · ${result.category.label}\n${result.link}`,null);
        await api.sendMessage({chat_id:userId,text:`Your review is now live in ${result.category.label}.\n\nOpen it here: ${result.link}`});
      } catch(error) {
        console.error('Review publishing failed',error);
        await saveDraft(userId,chat.id,'complete',data);
        await editPrompt(chat.id,data.promptMessageId,'I could not publish this review yet. Your draft is saved. Please try Publish again in a moment.',buildReviewKeyboard(data,'preview'));
      }
      return;
    }
    await answer(query.id,'This button is no longer active.');
  } catch(error) {
    console.error('ReviewTVBot callback handler failed',error);
    try { await answer(query.id,'Something went wrong. Your saved draft is safe.'); } catch(answerError) { console.error('Callback acknowledgement failed',answerError); }
  }
}
