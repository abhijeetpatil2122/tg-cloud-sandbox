import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { reviewDrafts, reviews, reviewReactions, communityConfig, categoryTopics, topicCounters } from '../schema.js';
import { getDraft, saveDraft, deleteDraft } from '../lib/sessions.js';
import { categories, getCategory, getNumericRatingStyle, getRatingVerdict, isAdmin, ratingVerdicts } from '../lib/config.js';
import { buildReviewRichMessage, buildReviewKeyboard, buildEditKeyboard, buildHelpRichMessage, buildHowToRichMessage, buildMyReviewsRichMessage, buildAdminPanelRichMessage, buildAdminStatsRichMessage, buildAdminResetConfirmation } from '../lib/formatting.js';
import { publishReview } from '../lib/publishing.js';
import { refreshLeaderboard } from '../lib/leaderboard.js';
import { showReviewerProfileWidget } from '../lib/profile_widget_sender.js';

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
function titlePrompt(categoryKey) {
  const labels = {
    hollywood_movies: 'Hollywood movie',
    bollywood_movies: 'Bollywood movie',
    south_indian_movies: 'South Indian movie',
    other_regional_movies: 'regional movie',
    international_movies: 'international movie',
    tv_shows: 'TV series',
    k_c_j_dramas: 'K/C/J drama',
    anime: 'anime title',
  };
  return `Send the ${labels[categoryKey] || 'review'} title.`;
}
function yearPrompt(categoryKey) {
  return ['tv_shows', 'k_c_j_dramas'].includes(categoryKey) ? 'Send the first release year. You can add the end year next, or skip if unknown.' : 'Send the release year, or skip if unknown.';
}
function genrePrompt() { return 'Optionally add genres separated by commas, or skip this step.'; }


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
        return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks:[{type:'heading',size:2,text:'Reset cancelled'},{type:'paragraph',text:'No database records were changed.'},{type:'footer',text:{type:'button',button:{text:'Admin panel',callback_data:'rv:admin:home',style:'link'}}}]},reply_markup:{inline_keyboard:[]}});
      }
      if (value === 'confirm') {
        await answer(query.id, 'Clearing test data…');
        await db.delete(reviewReactions).run();
        await db.delete(reviews).run();
        await db.delete(reviewDrafts).run();
        await db.delete(topicCounters).run();
        let leaderboardRefreshed = false;
        try { await refreshLeaderboard(); leaderboardRefreshed = true; }
        catch (error) { console.warn('Leaderboard refresh after test-data reset failed', error?.description || error?.message || error); }
        return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks:[
          {type:'heading',size:2,text:'✓ Test data cleared'},
          {type:'paragraph',text:'Saved reviews, reaction votes, active drafts and review-number counters have been cleared.'},
          {type:'paragraph',text:'Forum connection and category-topic settings were preserved. Existing posts in Telegram topics were not deleted.'},
          {type:'paragraph',text:leaderboardRefreshed?'The saved leaderboard message has also been refreshed.':'The leaderboard could not be refreshed automatically. Use /leaderboard after checking its topic configuration.'},
          {type:'divider'},
          {type:'footer',text:{type:'button',button:{text:'Admin panel',callback_data:'rv:admin:home',style:'link'}}},
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
        try { const result = await refreshLeaderboard(); return api.sendRichMessage({chat_id:chat.id,rich_message:{blocks:[{type:'heading',size:2,text:'✓ Leaderboard Updated'},{type:'paragraph',text:result.replaced?'A replacement leaderboard message has been created.':'The community leaderboard is up to date.'}]}}); }
        catch (error) { console.warn('Leaderboard refresh action failed',error?.description||error?.message||error); return api.sendMessage({chat_id:chat.id,text:'Could not update the leaderboard. Check the forum connection and leaderboard topic configuration.'}); }
      }
      if (value === 'home') return api.editMessageText({
        chat_id: chat.id, message_id: query.message.message_id,
        rich_message: buildAdminPanelRichMessage(),
        reply_markup: { inline_keyboard: [
          [{ text: 'Statistics', callback_data: 'rv:admin:stats' }, { text: 'Settings', callback_data: 'rv:admin:settings' }],
          [{ text: 'Refresh leaderboard', callback_data: 'rv:admin:leaderboard' }],
          [{ text: 'Reset test data', callback_data: 'rv:admin:resetdb', style: 'danger' }],
        ] },
      });
      if (value === 'stats') {
        const rows = await db.select().from(reviews).all();
        return api.editMessageText({ chat_id: chat.id, message_id: query.message.message_id, rich_message: buildAdminStatsRichMessage(rows) });
      }
      if (value === 'resetdb') {
        return api.editMessageText({ chat_id: chat.id, message_id: query.message.message_id, rich_message: buildAdminResetConfirmation(), reply_markup: { inline_keyboard: [] } });
      }
      if (value === 'settings') {
        const config = await db.select().from(communityConfig).get();
        const mappings = await db.select().from(categoryTopics).all();
        const blocks = [{ type: 'heading', size: 1, text: '⚙️ Forum Settings' }];
        if (!config) {
          blocks.push({ type: 'paragraph', text: 'No forum is connected yet. Connect the forum as its creator to begin configuring topics.' });
        } else {
          blocks.push(
            { type: 'paragraph', text: [{ type: 'bold', text: 'Forum: ' }, config.chatTitle || '@Review_Tv'] },
            { type: 'paragraph', text: [{ type: 'bold', text: 'Chat ID: ' }, { type: 'code', text: String(config.chatId) }] },
            { type: 'paragraph', text: [{ type: 'bold', text: 'Status: ' }, config.enabled ? 'Connected ✅' : 'Disconnected'] },
            { type: 'divider' },
            { type: 'heading', size: 3, text: 'Topic mappings' },
          );
          const rows = categories.map((category) => {
            const mapping = mappings.find((item) => item.categoryKey === category.key && item.chatId === config.chatId);
            return [{ text: category.label, align: 'left' }, { text: mapping ? String(mapping.topicId) : '—', align: 'right' }];
          });
          const leaderboard = mappings.find((item) => item.categoryKey === 'leaderboard' && item.chatId === config.chatId);
          rows.push([{ text: 'Leaderboard', align: 'left' }, { text: leaderboard ? String(leaderboard.topicId) : '—', align: 'right' }]);
          blocks.push({ type: 'table', cells: [
            [{ text: 'Topic', is_header: true, align: 'left' }, { text: 'Topic ID', is_header: true, align: 'right' }],
            ...rows,
          ], is_striped: true, caption: 'Configured forum topics' });
        }
        blocks.push({ type: 'divider' }, { type: 'footer', text: { type: 'button', button: { text: '‹ Admin panel', callback_data: 'rv:admin:home', style: 'link' } } });
        return api.editMessageText({ chat_id: chat.id, message_id: query.message.message_id, rich_message: { blocks }, reply_markup: { inline_keyboard: [] } });
      }
    }
    if (action === 'home') {
      await answer(query.id);
      const welcomeRichMessage = { blocks: [
        { type: 'heading', size: 1, text: `👋 Welcome, ${[query.from.first_name, query.from.last_name].filter(Boolean).join(' ') || 'there'}` },
        { type: 'paragraph', text: 'Share thoughtful reviews of movies, series, dramas, and anime.' },
        { type: 'paragraph', text: 'Choose a category, give a required 1–10 rating, add an optional verdict, and publish when your preview is ready.' },
        { type: 'paragraph', text: ['Community: ', { type: 'button', button: { text: '@Review_Tv', url: 'https://t.me/Review_Tv' } }] },
        { type: 'divider' },
        { type: 'footer', text: ['Quick access: ', { type: 'button', button: { text: 'Help & Commands', callback_data: 'rv:help', style: 'link' } }, '  ', { type: 'button', button: { text: 'How to use', callback_data: 'rv:howto', style: 'link' } }] },
      ] };
      const welcomeKeyboard = { inline_keyboard: [[
        { text: 'Profile', callback_data: 'rv:profile' }, { text: 'How to use', callback_data: 'rv:howto' },
      ], [{ text: 'Write a review', callback_data: 'rv:start', style: 'success' }]] };

      // Widget messages cannot be edited into Rich Messages; return to the same
      // welcome screen used by the /start command instead.
      if (query.message?.widget) {
        try {
          await api.deleteMessage({ chat_id: chat.id, message_id: query.message.message_id });
        } catch (error) {
          console.warn('Could not remove the profile widget before returning home', error?.description || error?.message || error);
        }
        return api.sendRichMessage({
          chat_id: chat.id,
          rich_message: welcomeRichMessage,
          reply_markup: welcomeKeyboard,
        });
      }

      return api.editMessageText({
        chat_id: chat.id,
        message_id: query.message.message_id,
        rich_message: welcomeRichMessage,
        reply_markup: welcomeKeyboard,
      });
    }
    if (action === 'help') {
      await answer(query.id);
      return api.editMessageText({ chat_id: chat.id, message_id: query.message.message_id, rich_message: buildHelpRichMessage(isAdmin(userId)), reply_markup: { inline_keyboard: [[{ text: 'How to use', callback_data: 'rv:howto' }], [{ text: '‹ Back to menu', callback_data: 'rv:home' }]] } });
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
        {type:'list',items:items.map((item,index)=>({value:safe*size+index+1,type:'1',blocks:[{type:'paragraph',text:[{type:'bold',text:`${item.title}${item.year ? ` (${item.year}${item.endYear ? ` — ${item.endYear}` : ''})` : ''}`},' ',...(item.messageLink?[{type:'button',button:{text:`★ ${item.rating}/10`,url:item.messageLink,style:getNumericRatingStyle(item.rating)}}]:[{type:'bold',text:`★ ${item.rating}/10`}])]}]}))},
        {type:'footer',text:`Showing ${safe*size+1}–${safe*size+items.length} of ${published.length} published reviews • Page ${safe+1}/${count}`},
      ];
      const nav=[];if(safe>0)nav.push({text:'‹ Previous',callback_data:`rv:reviews:${safe-1}`});if(safe+1<count)nav.push({text:'Next ›',callback_data:`rv:reviews:${safe+1}`});
      nav.push({text:'‹ Back to profile',callback_data:'rv:profile'});
      await answer(query.id);
      return api.editMessageText({chat_id:chat.id,message_id:query.message.message_id,rich_message:{blocks},reply_markup:{inline_keyboard:nav.length?[nav]:[] }});
    }
    if (action === 'profile') {
      await answer(query.id);
      if (query.message?.message_id) {
        try {
          await api.deleteMessage({ chat_id: chat.id, message_id: query.message.message_id });
        } catch (error) {
          console.warn('Could not remove the previous profile message', error?.description || error?.message || error);
        }
      }
      return showReviewerProfileWidget(chat.id, query.from);
    }
    if (action === 'howto') {
      await answer(query.id);
      await api.editMessageText({
        chat_id: chat.id,
        message_id: query.message.message_id,
        rich_message: buildHowToRichMessage(),
        reply_markup: { inline_keyboard: [[{ text: 'Start a review', callback_data: 'rv:start', style: 'success' }], [{ text: '‹ Back to menu', callback_data: 'rv:home' }]] },
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
      await editPrompt(chat.id, data.promptMessageId, titlePrompt(category.key), withBack());
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
        year: ['title', titlePrompt(data.categoryKey), null],
        genre: ['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey)
          ? ['end_year', 'If the series has ended, send its final year, or tap Skip end year.', {inline_keyboard:[[{text:'Skip end year',callback_data:'rv:year:skip'}]]}]
          : ['year', 'Send the release year, or tap Skip year if unsure.', {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}],
        end_year: ['year', yearPrompt(data.categoryKey), {inline_keyboard:[[{text:'Skip year',callback_data:'rv:year:skip'}]]}],
        season: ['genre', 'Optionally add genres, or skip.', { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }],
        rating: ['tv_shows', 'k_c_j_dramas'].includes(data.categoryKey)
          ? ['season', 'Send a season number, or skip.', { inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }]
          : ['genre', 'Optionally add genres, or skip.', { inline_keyboard: [[{ text: 'Skip genre', callback_data: 'rv:genre:skip' }]] }],
        verdict: ['rating', 'Choose a rating from 1–10.', ratingKeyboard()],
        review_text: ['verdict', 'Choose an optional verdict, or skip.', verdictKeyboard()],
        media: ['review_text', 'Write your review (20–5,000 characters).', null],
        spoiler: ['media', 'Send Telegram photos or direct HTTPS image URLs separated by commas (up to 10 images), or skip.', {inline_keyboard:[[{text:'Done',callback_data:'rv:media:done',style:'success'},{text:'Skip photos',callback_data:'rv:media:skip'}]]}],
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
        return editPrompt(chat.id, data.promptMessageId, 'Send a season number, or skip.', withBack({ inline_keyboard: [[{ text: 'Skip season', callback_data: 'rv:season:skip' }]] }));
      }
      await saveDraft(userId, chat.id, 'rating', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose a rating from 1–10.', withBack(ratingKeyboard()));
    }

    if (action === 'season' && value === 'skip' && ['season', 'edit_season'].includes(draft.step)) {
      data.season = null;
      await answer(query.id);
      if (draft.step === 'edit_season') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'rating', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose a rating from 1–10.', withBack(ratingKeyboard()));
    }

    if (action === 'rating' && ['rating', 'edit_rating'].includes(draft.step)) {
      const rating = Number(value);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        await answer(query.id, 'Choose a rating from 1 to 10.');
        return;
      }
      data.rating = rating;
      await answer(query.id);
      if (draft.step === 'edit_rating') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'verdict', data);
      return editPrompt(chat.id, data.promptMessageId, 'Choose an optional verdict, or skip.', withBack(verdictKeyboard()));
    }

    if (action === 'verdict' && ['verdict', 'edit_verdict'].includes(draft.step)) {
      if (value === 'skip') data.ratingVerdict = null;
      else {
        const verdict = getRatingVerdict(value);
        if (!verdict) { await answer(query.id, 'Choose a valid verdict or skip this step.'); return; }
        data.ratingVerdict = verdict.key;
      }
      await answer(query.id);
      if (draft.step === 'edit_verdict') {
        await saveDraft(userId, chat.id, 'complete', data);
        return preview(chat.id, await getDraft(userId));
      }
      await saveDraft(userId, chat.id, 'review_text', data);
      return editPrompt(chat.id, data.promptMessageId, 'Write your review (20–5,000 characters).', withBack());
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
      return editPrompt(chat.id,data.promptMessageId,genrePrompt(),withBack({inline_keyboard:[[{text:'Skip genre',callback_data:'rv:genre:skip'}]]}));
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
        title: ['edit_title', titlePrompt(data.categoryKey)],
        year: ['edit_year', yearPrompt(data.categoryKey)],
        genre: ['edit_genre', genrePrompt()],
        season: ['edit_season', 'Send a season number, or skip.'],
        rating: ['edit_rating', 'Choose a rating from 1–10.'],
        verdict: ['edit_verdict', 'Choose an optional verdict, or skip.'],
        text: ['edit_text', 'Write your review (20–5,000 characters).'],
        media: ['edit_media', 'Add replacement photos, then tap Done or Skip.'],
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
        : value === 'verdict' ? verdictKeyboard()
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
