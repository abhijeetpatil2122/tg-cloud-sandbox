import { api } from 'sdk';
import { recordInspection } from '../lib/stats.js';
import { reportFor, stringifyReport } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';

function errorMessage(error) {
  return String(error?.description || error?.message || error || 'unknown error').slice(0, 300);
}

async function notifyAdmin(text) {
  try {
    await api.sendMessage({ chat_id: 1314643983, text: 'IdPullBot guest-mode diagnostic: ' + text });
  } catch {
    // The admin may not have started the bot; diagnostics remain in runtime logs.
  }
}

export default async function (message, ctx) {
  const guestQueryId = message?.guest_query_id;
  if (!guestQueryId) {
    console.error('IdPullBot received guest_message without guest_query_id.');
    return;
  }

  // The handler receives the Message payload; ctx.update retains the complete
  // Telegram Update. Keep both in the report, including any reply context
  // actually present in the update.
  const update = ctx?.update || { guest_message: message };
  const report = stringifyReport(reportFor(message, update, 'guest'));

  try {
    await recordInspection(
      message.from?.id || message.guest_bot_caller_user?.id,
      'guest',
    );
  } catch (error) {
    console.error('IdPullBot guest statistics update failed: ' + errorMessage(error));
  }

  let result;
  try {
    const title = 'IdPullBot Debug — ' +
      (message.chat?.title || message.chat?.username || 'Guest chat') +
      ' — ' + String(message.message_id || 'unknown');
    const articleUrl = await createArticle(title, report);

    result = {
      type: 'article',
      id: 'idpull-' + String(message.message_id || 'report').slice(0, 48),
      title: 'Message debug report',
      description: 'Open the complete message inspection in Telegraph.',
      input_message_content: {
        message_text: 'Message inspection complete.',
      },
      reply_markup: {
        inline_keyboard: [[{ text: 'Open Article', url: articleUrl }]],
      },
    };
  } catch (error) {
    const reason = errorMessage(error);
    console.error('IdPullBot Telegraph creation failed in guest mode: ' + reason);
    await notifyAdmin(reason);
    result = {
      type: 'article',
      id: 'idpull-unavailable-' + String(message.message_id || 'report').slice(0, 40),
      title: 'Debug report unavailable',
      description: 'The Telegraph report could not be published.',
      input_message_content: {
        message_text: 'The debug report is temporarily unavailable.',
      },
    };
  }

  try {
    await api.answerGuestQuery({
      guest_query_id: guestQueryId,
      result,
    });
  } catch (error) {
    const reason = errorMessage(error);
    console.error('IdPullBot answerGuestQuery failed: ' + reason);
    await notifyAdmin(reason);
    throw error;
  }
}
