import { api, EndpointError } from 'sdk';
import { createShareRequest, trackEvent, upsertUser } from '../lib/storage.js';

export default async function (_input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const requestId = Math.floor(Math.random() * 2147483646) + 1;
  await upsertUser(user);
  await createShareRequest(requestId, user.id);

  await api.sendMessage({
    chat_id: user.id,
    text: 'Choose the channel you want to connect. Telegram will ask you to add this bot as an administrator with permission to post. Review the requested permissions before confirming.',
    reply_markup: {
      keyboard: [[{
        text: 'Share channel and add bot',
        request_chat: {
          request_id: requestId,
          chat_is_channel: true,
          user_administrator_rights: { can_manage_chat: true, can_post_messages: true },
          bot_administrator_rights: { can_manage_chat: true, can_post_messages: true },
          request_title: true,
          request_username: true,
          request_photo: true
        }
      }]],
      resize_keyboard: true,
      one_time_keyboard: true,
      input_field_placeholder: 'Select a channel'
    }
  });
  await trackEvent(user.id, 'chat_share_requested');
  return { ok: true, message: 'Open the bot chat and tap “Share channel and add bot”.' };
}
