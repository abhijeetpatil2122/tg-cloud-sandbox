export default async function (_input, ctx) {
  const user = ctx.initData?.user;
  if (!user?.id) {
    return { ok: false, message: 'Open this app from Telegram.' };
  }

  return {
    ok: true,
    service: 'Telegram Serverless',
    serverTime: new Date().toISOString(),
    user: {
      id: user.id,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      username: user.username || '',
      language_code: user.language_code || '',
    },
  };
}
