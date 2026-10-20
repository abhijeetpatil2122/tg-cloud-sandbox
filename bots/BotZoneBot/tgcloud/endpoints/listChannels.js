import { EndpointError } from 'sdk';
import { listSavedChats } from '../lib/storage.js';

export default async function (_input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) throw new EndpointError('Open this app from Telegram.', { code: 'TELEGRAM_AUTH_REQUIRED' });
  const channels = await listSavedChats(user.id);
  return { ok: true, channels };
}
