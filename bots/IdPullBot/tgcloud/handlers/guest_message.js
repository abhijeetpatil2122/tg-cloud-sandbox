import { api } from 'sdk';
import { recordInspection } from '../lib/stats.js';
import { reportFor, stringifyReport } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';

function errorMessage(error) {
  return String(error?.description || error?.message || error || 'unknown error').slice(0, 300);
}

export default async function (payload, ctx) {
  // Serverless normally unwraps guest_message to a Message, while ctx.update
  // retains the original Update. Accept either shape to avoid dropping a query.
  const message = payload?.guest_message || payload;
  const update = ctx?.update || (payload?.guest_message ? payload : { guest_message: message });
  const guestQueryId = message?.guest_query_id || update?.guest_message?.guest_query_id;

  if (!guestQueryId) {
    console.error('IdPullBot guest handler received no guest query ID.');
    return;
  }

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
    console.error('IdPullBot Telegraph article creation failed in guest mode: ' + errorMessage(error));
    result = {
      type: 'article',
      id: 'idpull-unavailable-' + String(message.message_id || 'report').slice(0, 40),
      title: 'Message report unavailable',
      description: 'The report could not be prepared right now.',
      input_message_content: {
        message_text: 'The report could not be prepared right now.',
      },
    };
  }

  try {
    await api.answerGuestQuery({
      guest_query_id: guestQueryId,
      result,
    });
  } catch (error) {
    console.error('IdPullBot answerGuestQuery failed: ' + errorMessage(error));
    throw error;
  }
}
