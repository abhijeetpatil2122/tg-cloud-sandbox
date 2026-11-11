import { api } from 'sdk';
import { getUserProfileWidgetData, showUserProfile } from './profile.js';
import { buildProfileWidget2Html, serializeProfileWidget2Data } from './profile_widget2.js';

export async function showReviewerProfileWidget(chatId, user) {
  let stage = 'load-profile-data';
  try {
    const profile = await getUserProfileWidgetData(user);

    stage = 'build-profile-html';
    const html = buildProfileWidget2Html();
    if (typeof html !== 'string' || !html.trim() || html.includes(String.fromCharCode(0))) {
      throw new Error('Profile widget HTML is empty or contains a NUL character.');
    }

    stage = 'serialize-profile-state';
    const chatData = serializeProfileWidget2Data(profile);
    if (typeof chatData !== 'string' || !chatData) {
      throw new Error('Profile widget chat_data serializer returned an invalid payload.');
    }

    stage = 'send-profile-widget';
    const sent = await api.sendWidget({
      chat_id: chatId,
      html,
      chat_data: chatData,
      caption: 'Your ReviewTV profile · reviewer ledger, category breakdown and latest reviews.',
      reply_markup: { inline_keyboard: [[
        { text: '‹ Back to profile', callback_data: 'rv:profile' },
      ]] },
    });
    console.info('ReviewTV profile widget sent', {
      htmlLength: html.length,
      serverEchoLength: sent?.widget?.html?.length ?? null,
      serverEchoMatches: sent?.widget?.html === html,
    });
    return sent;
  } catch (error) {
    console.error('ReviewTV profile widget failed', {
      stage,
      name: error?.name,
      message: error?.message,
      description: error?.description,
      code: error?.code,
      method: error?.method,
      stack: error?.stack,
    });
    return showUserProfile(chatId, user);
  }
}
