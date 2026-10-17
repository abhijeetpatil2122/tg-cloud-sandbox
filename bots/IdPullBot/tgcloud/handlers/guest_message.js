import { api } from 'sdk';
import { recordInspection } from '../lib/stats.js';
import { reportFor, stringifyReport } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';

function errorMessage(error) {
  return String(error?.description || error?.message || error || 'unknown error').slice(0, 300);
}

export default async function (message, ctx) {
  const guestQueryId = message?.guest_query_id;
  if (!guestQueryId) {
    console.error('IdPullBot received guest_message without guest_query_id.');
    return;
  }

  // Keep the complete guest_message and complete raw Update. If the guest
  // message is a reply, reportFor selects its replied-to message as the target.
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
        inline_keyboard: [[{ text: 'Open report', url: articleUrl }]],
      },
    };
  } catch (error) {
    console.error('IdPullBot Telegraph creation failed in guest mode: ' + errorMessage(error));
    result = {
      type: 'article',
      id: 'idpull-unavailable-' + String(message.message_id || 'report').slice(0, 40),
      title: 'Debug report unavailable',
      description: 'The report could not be published to Telegraph.',
      input_message_content: {
        message_text: 'The debug report could not be published. Please try again shortly.',
      },
    };
  }

  try {
    await api.answerGuestQuery({
      guest_query_id: guestQueryId,
      result,
    });
  } catch (error) {
    // Guest responses must use answerGuestQuery; sendMessage cannot answer a
    // guest query in a chat where the bot is not a member.
    console.error('IdPullBot answerGuestQuery failed: ' + errorMessage(error));
    throw error;
  }
}
