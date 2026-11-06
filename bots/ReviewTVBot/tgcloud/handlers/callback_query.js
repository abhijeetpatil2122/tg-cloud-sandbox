import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { reviewDrafts, reviews, reviewReactions, communityConfig, categoryTopics, topicCounters } from '../schema.js';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import { categories, getCategory, getRatingVerdict, isAdmin, ratingVerdicts } from '../lib/config.js';
import { buildReviewRichMessage, buildReviewKeyboard, buildEditKeyboard, buildHowToRichMessage, buildMyReviewsRichMessage } from '../lib/formatting.js';
import { publishReview } from '../lib/publishing.js';
import { refreshLeaderboard } from '../lib/leaderboard.js';
import { showUserProfile } from '../lib/profile.js';

async function answer(id, text) {
  const params = { callback_query_id: id };
  if (text) params.text = text;
  await api.answerCallbackQuery(params);
}

function withBack(keyboard = null) {
  const rows = keyboard?.inline_keyboard ? keyboard.inline_keyboard.map(row => [...row]) : [];
  rows.push([
    { text: '‹ Back', callback_data: 'rv:back' },
    { text: 'Cancel review', callback_data: 'rv:cancel', style: 'danger' },
  ]);
  return { inline_keyboard: rows };
}

function categoryKeyboard() {
  const rows = [];
  for (let i = 0; i < categories.length; i += 2) {
    rows.push(categories.slice(i, i + 2).map(item => ({
      text: item.label, callback_data: `rv:category:${item.key}`,
    })));
  }
  rows.push([{ text: 'Cancel review', callback_data: 'rv:cancel', style: 'danger' }]);
  return { inline_keyboard: rows };
}

function ratingKeyboard() {
  return { inline_keyboard: [
    ratingVerdicts.slice(0, 2).map((v) => ({ text: v.label, callback_data: `rv:rating:${v.key}`, style: v.style })),
    ratingVerdicts.slice(2).map((v) => ({ text: v.label, callback_data: `rv:rating:${v.key}`, style: v.style })),
  ] };
}

function spoilerKeyboard() {
  return { inline_keyboard: [[
    { text: 'Contains spoilers', callback_data: 'rv:spoiler:yes', style: 'danger' },
    { text: 'No spoilers', callback_data: 'rv:spoiler:no', style: 'success' },
  ]] };
}

async function editPrompt(chatId, messageId, text, replyMarkup = null) {
  return api.editMessageText({
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup || { inline_keyboard: [] },
  });
}

async function preview(chatId, draft) {
  return api.editMessageText({
    chat_id: chatId,
    message_id: draft.data.promptMessageId,
    rich_message: buildReviewRichMessage(draft.data, null, true),
    reply_markup: buildReviewKeyboard(draft.data, 'preview'),
  });
}

function errorForUser(error) {
  const raw = String(error?.description || error?.message || error || '').replace(/\s+/g, ' ').trim();
  if (/not connected|publishing topic|category/i.test(raw)) return 'This category is not connected to a publishing topic yet. Please contact the bot administrator.';
  if (/not enough rights|administrator|chat not found|thread|topic/i.test(raw)) return 'The bot cannot post to the selected community topic. Please ask an administrator to check its forum permissions and topic mapping.';
  if (/photo|file|media|wrong file/i.test(raw)) return 'Telegram could not use one of those images. Edit the photos and try a Telegram photo or a public direct HTTPS image link.';
  if (/database|SQLITE|constraint|no such table/i.test(raw)) return 'The review database is not ready for publishing. Please contact the bot administrator.';
  return 'Telegram could not publish this review right now.';
}

export default async function (query) {
  if (!query?.id) return;
  const chat = query.message?.chat;
  const userId = query.from?.id;
  try {
    if (!userId) { await answer(query.id, 'Unable to identify your Telegram account.'); return; }
    const [prefix, action, value, detail] = String(query.data ?? '').split(':');
    if (prefix === 'rv' && action === 'react') {
      const reviewId = Number(value);
      const reaction = detail;
      if (!Number.isInteger(reviewId) || reviewId < 1 || !['like', 'dislike'].includes(reaction) || !chat?.id || !query.message?.message_id) {
        await answer(query.id, 'This reaction button is invalid.');
        return;
      }
      const review = await db.select().from(reviews).where(eq(reviews.id, reviewId)).get();
      if (!review || review.status !== 'published' || review.chatId !== chat.id || review.messageId !== query.message.message_id) {
        await answer(query.id, 'This review is no longer available.');
        return;
      }
      const existingVote = await db.select().from(reviewReactions)
        .where(and(eq(reviewReactions.reviewId, reviewId), eq(reviewReactions.userId, userId))).get();
      if (existingVote?.reaction === reaction) {
        await db.delete(reviewReactions).where(and(
          eq(reviewReactions.reviewId, reviewId),
          eq(reviewReactions.userId, userId),
        )).run();
      } else {
        await db.insert(reviewReactions).values({
          reviewId, userId, reaction, createdAt: new Date(), updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [reviewReactions.reviewId, reviewReactions.userId],
          set: { reaction, updatedAt: new Date() },
        }).run();
      }
      const votes = await db.select().from(reviewReactions).where(eq(reviewReactions.reviewId, reviewId)).all();
      const counts = {
        likes: votes.filter((vote) => vote.reaction === 'like').length,
        dislikes: votes.filter((vote) => vote.reaction === 'dislike').length,
      };
      const userReaction = existingVote?.reaction === reaction ? null : reaction;
      await answer(query.id, userReaction ? 'Your reaction has been saved.' : 'Your reaction has been removed.');
      return api.editMessageReplyMarkup({
        chat_id: chat.id,
        message_id: query.message.message_id,
        reply_markup: buildReviewKeyboard({}, 'published', reviewId, counts, userReaction),
      });
    }
    if (!chat || chat.type !== 'private' || !userId || chat.id !== userId) {
      await answer(query.id, 'Please use these buttons in your private chat with the bot.');
      return;
    }
    if (prefix === 'rv' && action === 'resetdb') {
      if (!isAdmin(userId)) { await answer(query.id, 'Not authorized.'); return; }
      if (value === 'cancel') {
        await answer(query.id, 'Reset cancelled.');
        return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,text:'Database reset cancelled.',reply_markup:{inline_keyboard:[]}});
      }
      if (value === 'confirm') {
        await answer(query.id, 'Clearing test data…');
        await db.delete(reviewReactions).run();
        await db.delete(reviews).run();
        await db.delete(reviewDrafts).run();
        await db.delete(topicCounters).run();
        return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks:[
          {type:'heading',size:2,text:'Test data cleared'},
          {type:'paragraph',text:'All saved reviews, reaction votes, active drafts, and review-number counters have been cleared.'},
          {type:'paragraph',text:'Forum connection and category-topic settings were preserved. Existing posts in Telegram topics were not deleted.'},
        ]},reply_markup:{inline_keyboard:[]}});
      }
      await answer(query.id, 'Unknown reset action.');
      return;
    }
    if (prefix !== 'rv') {
      await answer(query.id, 'This button is not recognized.');
      return;
    }

    if (action === 'admin') {
      if (!isAdmin(userId)) { await answer(query.id, 'Not authorized.'); return; }
      await answer(query.id);
      if (value === 'leaderboard') {
        try { const result = await refreshLeaderboard(); return api.sendMessage({chat_id:chat.id,text:result.replaced?`Leaderboard repaired (message ID: ${result.messageId}).`:`Leaderboard refreshed (message ID: ${result.messageId}).`}); }
        catch (error) { return api.sendMessage({chat_id:chat.id,text:error?.message||'Could not initialize the leaderboard.'}); }
      }
      if (value === 'home') return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks:[
        {type:'heading',size:1,text:'ReviewTVBot Admin'},
        {type:'paragraph',text:'Private administration and publishing controls.'},
        {type:'list',items:[
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/admin'},' — Open this administration panel']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/stats'},' — View review totals and category statistics']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/settings'},' — View forum connection and topic mappings']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/leaderboard'},' — Initialize or repair the top 20 leaderboard']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/connect'},' — Connect the review forum (run by the forum creator)']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/settopic category_key'},' — Assign the current forum topic to a review category']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/disconnect'},' — Disable the connected review forum']}]},
          {blocks:[{type:'paragraph',text:[{type:'bold',text:'/resetdb'},' — Temporarily clear test reviews, drafts, and numbering']}]},
        ]},
        {type:'footer',text:'Choose a section below. This panel is private to authorized administrators.'},
      ]},reply_markup:{inline_keyboard:[[{text:'Statistics',callback_data:'rv:admin:stats'},{text:'Settings',callback_data:'rv:admin:settings'}],[{text:'Refresh leaderboard',callback_data:'rv:admin:leaderboard'}]]}});
      if (value === 'stats') {
        const all=await db.select().from(reviews).all(); const published=all.filter(row=>row.status==='published');
        const cells=[[{text:'Category',is_header:true},{text:'Published',is_header:true}],...categories.map(c=>[{text:c.label},{text:String(published.filter(r=>r.categoryKey===c.key).length)}]),[{text:'Total published'},{text:String(published.length)}],[{text:'Draft / failed'},{text:String(all.length-published.length)}]];
        return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks:[{type:'heading',size:1,text:'Review statistics'},{type:'table',cells,is_bordered:true,is_striped:true,is_compact:true},{type:'footer',text:'Counts are based on saved review records.'}]},reply_markup:{inline_keyboard:[[{text:'‹ Admin panel',callback_data:'rv:admin:home'}]]}});
      }
      if (value === 'settings') {
        const config=await db.select().from(communityConfig).get(); const mappings=await db.select().from(categoryTopics).all();
        const blocks=[{type:'heading',size:1,text:'Forum settings'}];
        if(!config) blocks.push({type:'paragraph',text:'No forum is connected yet. Run /connect in the forum supergroup as its creator.'});
        else blocks.push({type:'paragraph',text:[{type:'bold',text:'Forum:'},' @Review_Tv']},{type:'paragraph',text:[{type:'bold',text:'Chat ID:'},' ',{type:'code',text:String(config.chatId)}]},{type:'paragraph',text:[{type:'bold',text:'Status:'},' ',config.enabled?'Connected ✅':'Disconnected']},{type:'divider'},{type:'heading',size:3,text:'Category topics'},{type:'list',items:categories.map(category=>{const mapping=mappings.find(item=>item.categoryKey===category.key&&item.chatId===config.chatId);return {blocks:[{type:'paragraph',text:[{type:'bold',text:category.label},' — ',mapping?String(mapping.topicId):'Not configured']}]};})},{type:'paragraph',text:[{type:'bold',text:'Leaderboard'},' — ',String(mappings.find(item=>item.categoryKey==='leaderboard'&&item.chatId===config.chatId)?.topicId ?? 'Not configured')]});
        return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks},reply_markup:{inline_keyboard:[[{text:'‹ Admin panel',callback_data:'rv:admin:home'}]]}});
      }
    }
    if (action === 'home') {
      await answer(query.id);
      return api.editMessageText({
        chat_id: chat.id, message_id: query.message.message_id,
        rich_message: { blocks: [
          { type: 'heading', size: 1, text: `Welcome, ${[query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || 'there'}.` },
          { type: 'paragraph', text: 'A simple place to share thoughtful reviews of movies, series, anime, and dramas.' },
          { type: 'paragraph', text: 'Submit your review with a rating, genre, and optional poster. Published reviews are organised in the appropriate community topic.' },
          { type: 'divider' },
          { type: 'footer', text: 'Use /help to see available commands.' },
        ] },
        reply_markup: { inline_keyboard: [[{ text: 'Profile', callback_data: 'rv:profile' }, { text: 'How to use', callback_data: 'rv:howto' }], [{ text: 'Write a review', callback_data: 'rv:start', style: 'success' }]] },
      });
    }
    if (action === 'reviews') {
      const page=Number(value);
      if(!Number.isInteger(page)||page<0){await answer(query.id,'Invalid page.');return;}
      const rows=await db.select().from(reviews).where(eq(reviews.authorId,userId)).all();
      const published=rows.filter(row=>row.status==='published').sort((a,b)=>b.id-a.id);
      const size=10,count=Math.ceil(published.length/size),safe=Math.min(page,Math.max(0,count-1));
      if(!count){await answer(query.id,'No published reviews found.');return;}
      const items=published.slice(safe*size,(safe+1)*size);
      const blocks=[
        {type:'heading',size:2,text:'YOUR REVIEWS'},
        {type:'list',items:items.map((item,index)=>({value:safe*size+index+1,type:'1',blocks:[{type:'paragraph',text:[{type:'bold',text:`${item.title}${item.year ? ` (${item.year}${item.endYear ? ` — ${item.endYear}` : ''})` : ''}`},' ',...(item.messageLink?[{type:'button',button:{text:`★ ${item.rating}/10`,url:item.messageLink,style:'success'}}]:[{type:'bold',text:`★ ${item.rating}/10`}])]}]}))},
        {type:'footer',text:`Showing ${safe*size+1}–${safe*size+items.length} of ${published.length} published reviews • Page ${safe+1}/${count}`},
      ];
      const nav=[];if(safe>0)nav.push({text:'‹ Previous',callback_data:`rv:reviews:${safe-1}`});if(safe+1<count)nav.push({text:'Next ›',callback_data:`rv:reviews:${safe+1}`});
      nav.push({text:'‹ Back to profile',callback_data:'rv:profile'});
      await answer(query.id);
      return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks},reply_markup:{inline_keyboard:nav.length?[nav]:[] }});
    }
    if (action === 'profile') {
      await answer(query.id);
      return showUserProfile(chat.id, query.from, query.message.message_id);
    }
    if (action === 'howto') {
      await answer(query.id);
      await api.editMessageText({
        chat_id: chat.id,
        message_id: query.message.message_id,
        rich_message: buildHowToRichMessage(),
        reply_markup: { inline_keyboard: [[{ text: 'Write a review', callback_data: 'rv:start', style: 'success' }]] },
      });
      return;
    }
    if (action === 'noop') {
      await answer(query.id);
      return;
    }

    let draft = await getDraft(userId);
    if (draft?.step === 'publishing') {
      const publishingAge = Date.now() - new Date(draft.updatedAt).getTime();
      if (!Number.isFinite(publishingAge) || publishingAge > 120000) {
        await saveDraft(userId, chat.id, 'complete', draft.data);
        draft = await getDraft(userId);
      }
    }
    if (action === 'start') {
      if (draft && draft.step !== 'complete') {
        await answer(query.id, 'You already have a review in progress. Resume it with /review or cancel it first.');
        return;
      }
      if (draft?.step === 'complete') {
        await answer(query.id, 'You already have a completed draft. Opening its preview.');
        return preview(chat.id, draft);
      }
      await answer(query.id);
      await saveDraft(userId, chat.id, 'category', { promptMessageId: query.message.message_id });
      await editPrompt(chat.id, query.message.message_id, 'Choose the category for your review:', categoryKeyboard());
      return;
    }

    if (action === 'category') {
      if (draft && draft.step !== 'category') {
        await answer(query.id, 'You already have an active review. Resume it with /review or cancel it first.');
        return;
      }
      const category = getCategory(value);
      if (!category) {
        await answer(query.id, 'Unknown category.');
        return;
      }
      const data = {
        ...(draft?.data ?? {}),
        categoryKey: category.key,
        promptMessageId: query.message.message_id,
        authorName: [query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || 'Telegram user',
      };
      await saveDraft(userId, chat.id, 'title', data);
      await answer(query.id);
      await editPrompt(chat.id, data.promptMessageId, 'Send the movie, show, or anime title.', withBack());
      return;
    }

    if (!draft || draft.chatId !== chat.id) {
      await answer(query.id, 'This review session has expired. Send /review to start again.');
      return;
    }
    const data = { ...draft.data };

    if (action === 'back') {
      await answer(query.id);
      if (draft.step.startsWith('edit_')) return preview(chat.id, { ...draft, step: 'complete' });
      const previous = {
        title: ['category', 'Choose the category for your review:', categoryKeyboard()],
        year: ['title', 'Send the movie, show, or anime title.', null],
        genre: ['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey)
          ? ['end_year', 'If the series has ended, send its final year, or tap Skip end year.', {inline_keyboard:[[{text:'Skip end year',callback_data:'rv:year:skip'}]]}]
          : ['year', 'Send the release year, or tap Skip year if unsure.', {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}],
        end_year: ['year', 'Send the release year, or tap Skip year if unsure.', {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}],
        season: ['genre', 'Optionally send the genre or genres, or tap Skip genre.', { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }],
        rating: ['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey)
          ? ['season', 'Send the season number, or tap Skip season.', { inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }]
          : ['genre', 'Optionally send the genre or genres, or tap Skip genre.', { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }],
        review_text: ['rating', 'Choose your review verdict.', ratingKeyboard()],
        media: ['review_text', 'Write your review in 20–5000 characters.', null],
        spoiler: ['media', 'Send photos or direct HTTPS image URLs, or tap Skip photos.', {inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]}],
      }[draft.step];
      if (!previous) return preview(chat.id, { ...draft, step: 'complete' });
      await saveDraft(userId, chat.id, previous[0], data);
      return editPrompt(chat.id, data.promptMessageId, previous[1], withBack(previous[2]));
    }

    if (action === 'genre' && value === 'skip' && ['genre', 'edit_genre'].includes(draft.step)) {
      data.genre = null;
      await answer(query.id);
      if (draft.step === 'edit_genre') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      if (['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey)) {
        await saveDraft(userId, chat.id, 'season', data);
        return editPrompt(chat.id, data.promptMessageId, 'Send the season number, or tap Skip season.', withBack({ inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }));
      }
      await saveDraft(userId, chat.id, 'rating', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose your rating from 1 to 10.', withBack(ratingKeyboard()));
    }

    if (action === 'season' && value === 'skip' && ['season', 'edit_season'].includes(draft.step)) {
      data.season = null;
      await answer(query.id);
      if (draft.step === 'edit_season') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'rating', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose your rating from 1 to 10.', withBack(ratingKeyboard()));
    }

    if (action === 'rating' && ['rating', 'edit_rating'].includes(draft.step)) {
      const verdict = getRatingVerdict(value);
      if (!verdict) {
        await answer(query.id, 'Choose one of the available review verdicts.');
        return;
      }
      data.ratingVerdict = verdict.key;
      data.rating = null;
      await answer(query.id);
      if (draft.step === 'edit_rating') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'review_text', data);
      return editPrompt(chat.id, data.promptMessageId, 'Write your review in 20–5000 characters.', withBack());
    }

    if(action==='year'&&value==='skip'&&['year','edit_year','end_year','edit_end_year'].includes(draft.step)){
      const editingYear = draft.step.startsWith('edit_');
      if (draft.step === 'year' || draft.step === 'edit_year') {
        data.year = null;
        data.endYear = null;
      } else {
        data.endYear = null;
      }
      await answer(query.id);
      if(editingYear){await saveDraft(userId,chat.id,'complete',data);return preview(chat.id,await getDraft(userId));}
      await saveDraft(userId,chat.id,'genre',data);
      return editPrompt(chat.id,data.promptMessageId,'Optionally send genre names separated by commas (Action, Drama) or hashtags (#Action, #Drama). We’ll add missing # symbols automatically. Tap Skip genre if you want to leave it blank.',withBack({inline_keyboard:[[{text:'Skip genre',callback_data:'rv:genre:skip'}]]}));
    }
    if(action==='media'&&['done','skip'].includes(value)&&['media','edit_media'].includes(draft.step)){
      // Re-read after album updates: each Telegram photo arrives in its own
      // Serverless invocation, so the initial callback snapshot may be stale.
      const latestDraft=await getDraft(userId);
      const latestData={...(latestDraft?.data||data)};
      if(value==='skip')latestData.media=[];
      latestData.media=Array.isArray(latestData.media)?latestData.media:[];
      latestData.mediaMode='slideshow';
      await answer(query.id);
      if(draft.step==='edit_media'){
        await saveDraft(userId,chat.id,'complete',latestData);
        return preview(chat.id,await getDraft(userId));
      }
      await saveDraft(userId,chat.id,'spoiler',latestData);
      return editPrompt(chat.id,latestData.promptMessageId,'Does your review contain spoilers?',withBack(spoilerKeyboard()));
    }

    if (action === 'spoiler' && ['spoiler', 'edit_spoiler'].includes(draft.step) && ['yes', 'no'].includes(value)) {
      data.hasSpoilers = value === 'yes';
      await saveDraft(userId, chat.id, 'complete', data);
      await answer(query.id);
      return preview(chat.id, await getDraft(userId));
    }

    if (action === 'edit' && draft.step === 'complete') {
      if (value === 'menu') {
        await answer(query.id);
        await saveDraft(userId, chat.id, 'complete', data);
        return editPrompt(chat.id, data.promptMessageId, 'Choose the field you want to edit:', buildEditKeyboard());
      }
      const steps = {
        title: ['edit_title', 'Send the corrected title.'],
        year: ['edit_year', 'Send the corrected release year. For TV series, you’ll also be able to add an end year.'],
        genre: ['edit_genre', 'Send genre names separated by commas (Action, Drama) or hashtags (#Action, #Drama). Missing # symbols are added automatically, or tap Skip genre.'],
        season: ['edit_season', 'Send a season number, or tap Skip season.'],
        rating: ['edit_rating', 'Choose the corrected rating.'],
        text: ['edit_text', 'Send the corrected review text (20–5000 characters).'],
        media: ['edit_media', 'Send replacement photos, or paste direct HTTPS image links separated by commas. Tap Done when finished.'],
        spoiler: ['edit_spoiler', 'Choose the spoiler setting.'],
      };
      const selected = steps[value];
      if (!selected) {
        await answer(query.id, 'Unknown field.');
        return;
      }
      if (value === 'media') { data.media = []; data.mediaMode = 'slideshow'; }
      await saveDraft(userId, chat.id, selected[0], data);
      await answer(query.id);
      const keyboard = value === 'rating' ? ratingKeyboard()
        : value === 'year' ? {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}
        : value === 'genre' ? { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }
        : value === 'media' ? {inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]}
        : value === 'spoiler' ? spoilerKeyboard()
        : value === 'season' ? { inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }
        : null;
      return editPrompt(chat.id, data.promptMessageId, selected[1], withBack(keyboard));
    }

    if (action === 'preview' && draft.step === 'complete') {
      await answer(query.id);
      return preview(chat.id, draft);
    }

    if (action === 'cancel') {
      await deleteDraft(userId);
      await answer(query.id, 'Draft cancelled.');
      return editPrompt(chat.id, data.promptMessageId, 'Your review draft has been cancelled.');
    }

    if (action === 'publish' && draft?.step === 'publishing') {
      await answer(query.id, 'Your review is currently being published. Please wait a moment. If it gets stuck, send /cancel to cancel this draft, then use /review to start again.');
      return;
    }

    if (action === 'publish' && draft?.step === 'complete') {
      const claim = await db.update(reviewDrafts).set({ step: 'publishing', updatedAt: new Date() })
        .where(and(eq(reviewDrafts.userId, userId), eq(reviewDrafts.step, 'complete'))).run();
      if (!claim.rowsAffected) {
        await answer(query.id, 'This review is already being processed.');
        return;
      }
      await answer(query.id, 'Publishing your review…');
      try {
        const result = await publishReview(userId, { ...draft, step: 'complete', data });
        await deleteDraft(userId);
        await api.editMessageText({
          chat_id: chat.id,
          message_id: data.promptMessageId,
          rich_message:{blocks:[
            {type:'heading',size:2,text:'Review published'},
            {type:'paragraph',text:['Your review has been published in ',{type:'bold',text:result.topicName||result.category.label},'.']},
            {type:'paragraph',text:{type:'button',button:{text:'View published review',url:result.link,style:'success'}}},
            {type:'footer',text:`Review #${String(result.reviewNumber).padStart(3,'0')}`},
          ]},
          reply_markup:{inline_keyboard:[[{text:'My Reviews',callback_data:'rv:reviews:0'}]]},
        });
      } catch (error) {
        console.error('Review publishing failed', {
          message: error?.message,
          description: error?.description,
          error_code: error?.error_code,
          stack: error?.stack,
        });
        await saveDraft(userId, chat.id, 'complete', data);
        await editPrompt(chat.id, data.promptMessageId,
          `I couldn't publish this review: ${errorForUser(error)} Your draft is saved; you can retry or edit it.`,
          buildReviewKeyboard(data, 'preview'));
      }
      return;
    }

    await answer(query.id, 'This button is no longer active.');
  } catch (error) {
    console.error('ReviewTVBot callback handler failed', error);
    try {
      await answer(query.id, 'Something went wrong. Your saved draft is safe.');
    } catch (answerError) {
      console.error('Callback acknowledgement failed', answerError);
    }
  }
}
