import { EndpointError } from 'sdk';
import { listSavedChats, trackEvent, upsertUser } from '../lib/storage.js';

export default async function (_input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  await upsertUser(user);
  const channels = await listSavedChats(user.id);
  await trackEvent(user.id, 'channels_listed', { metadata: { count: channels.length } });
  return { ok: true, channels };
}
