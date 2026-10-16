import { api, db } from 'sdk';
import { desc, eq } from 'sdk/db';
import { demoNotes } from '../schema.js';

const HELP =
  'Telegram Mini App Demo\n\n' +
  '/start — open the demo Mini App\n' +
  '/saved — show your 10 most recent saved notes\n' +
  '/help — show this menu\n\n' +
  'Save notes in the Mini App, then use /saved here to retrieve them.';

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId) return;

  const text = (message.text || '').trim();
  const command = (text.split(/\s+/, 1)[0] || '').split('@')[0].toLowerCase();

  if (command === '/start') {
    return api.sendMessage({
      chat_id: chatId,
      text:
        'Welcome to the Telegram Mini App Demo 👋\n\n' +
        'Explore a hosted Mini App, authenticated backend endpoints, and persistent notes — all powered by Telegram Serverless.\n\n' +
        'Tap below to open the demo. Save a note in the Mini App, then use /saved to retrieve your notes here. Use /help for commands.',
      reply_markup: {
        inline_keyboard: [[
          {
            text: 'Open Mini App',
            web_app: { url: 'https://app8747772496.tgcloud.ai/' },
          },
        ]],
      },
    });
  }

  if (command === '/saved') {
    const userId = message?.from?.id;
    if (!userId) {
      return api.sendMessage({
        chat_id: chatId,
        text: 'I could not identify your Telegram account. Please try again in a private chat.',
      });
    }

    const notes = await db.select({
      note: demoNotes.note,
    })
      .from(demoNotes)
      .where(eq(demoNotes.userId, userId))
      .orderBy(desc(demoNotes.createdAt))
      .limit(10)
      .all();

    if (!notes.length) {
      return api.sendMessage({
        chat_id: chatId,
        text: 'You have no saved notes yet. Open the Mini App below and save your first note.',
        reply_markup: {
          inline_keyboard: [[
            {
              text: 'Open Mini App',
              web_app: { url: 'https://app8747772496.tgcloud.ai/' },
            },
          ]],
        },
      });
    }

    const noteList = notes.map((item, index) => `${index + 1}. ${item.note}`).join('\n\n');
    return api.sendMessage({
      chat_id: chatId,
      text: 'Your ' + notes.length + ' most recent saved notes:\n\n' + noteList,
    });
  }

  if (command === '/help') {
    return api.sendMessage({ chat_id: chatId, text: HELP });
  }
}
