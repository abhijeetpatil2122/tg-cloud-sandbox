export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Keep the entire Telegram Message and complete raw Update. Do not project
// these objects into a selected list of fields: Telegram adds fields over time.
export function reportFor(message, update, mode) {
  const target = message?.reply_to_message || message?.external_reply || message;
  const targetSelection = message?.reply_to_message
    ? 'replied-to message'
    : message?.external_reply
      ? 'external replied-to message'
      : 'invoking message';

  return {
    inspector: 'IdPullBot',
    mode,
    target_selection: targetSelection,
    target_message: target,
    current_message: message,
    raw_update: update || { message },
  };
}

export function stringifyReport(report) {
  return JSON.stringify(report, null, 2);
}

function chunks(text) {
  const result = [];
  let current = '';
  let escapedLength = 0;

  for (const character of String(text)) {
    const escaped = escapeHtml(character);
    if (current && escapedLength + escaped.length > 3400) {
      result.push(current);
      current = '';
      escapedLength = 0;
    }
    current += character;
    escapedLength += escaped.length;
  }

  if (current || result.length === 0) result.push(current);
  return result;
}

export async function sendReport(api, chatId, reportText, replyToMessageId) {
  const parts = chunks(reportText);

  for (let index = 0; index < parts.length; index += 1) {
    const params = {
      chat_id: chatId,
      text:
        '<b>Message debug — part ' + (index + 1) + '/' + parts.length + '</b>\n' +
        '<pre><code class="language-js">' + escapeHtml(parts[index]) + '</code></pre>',
      parse_mode: 'HTML',
    };

    if (index === 0 && Number.isSafeInteger(replyToMessageId) && replyToMessageId > 0) {
      params.reply_parameters = {
        message_id: replyToMessageId,
        allow_sending_without_reply: true,
      };
    }

    await api.sendMessage(params);
  }
}

function userButton(text, requestId, emojiId, style, options = {}) {
  const requestUsers = { request_id: requestId };
  if (options.bot !== undefined) requestUsers.user_is_bot = options.bot;
  if (options.premium === true) requestUsers.user_is_premium = true;
  if (options.maxQuantity) requestUsers.max_quantity = options.maxQuantity;
  if (options.requestName) requestUsers.request_name = true;
  if (options.requestUsername) requestUsers.request_username = true;
  if (options.requestPhoto) requestUsers.request_photo = true;

  const button = {
    text,
    icon_custom_emoji_id: emojiId,
    request_users: requestUsers,
  };
  if (style) button.style = style;
  return button;
}

function chatButton(text, requestId, emojiId, style, options = {}) {
  const requestChat = {
    request_id: requestId,
    chat_is_channel: options.channel === true,
  };
  if (options.forum === true) requestChat.chat_is_forum = true;
  if (options.created === true) requestChat.chat_is_created = true;
  if (options.requestTitle) requestChat.request_title = true;
  if (options.requestUsername) requestChat.request_username = true;
  if (options.requestPhoto) requestChat.request_photo = true;
  if (options.adminRights) requestChat.user_administrator_rights = options.adminRights;

  const button = {
    text,
    icon_custom_emoji_id: emojiId,
    request_chat: requestChat,
  };
  if (style) button.style = style;
  return button;
}

export function shareKeyboard() {
  // Match the original BB keyboard exactly: four rows (3, 3, 2, 2),
  // original button order, request options, styles and custom emoji IDs.
  // Do not set input_field_placeholder; the original keyboard did not set one.
  return {
    keyboard: [
      [
        userButton('User', 1, '5771887475421090729', 'primary', {
          bot: false, requestName: true, requestUsername: true, requestPhoto: true,
        }),
        chatButton('Channel', 2, '5886436057091673541', 'success', {
          channel: true, requestTitle: true, requestUsername: true, requestPhoto: true,
        }),
        chatButton('Group', 3, '5877530150345641603', 'primary', {
          requestTitle: true, requestUsername: true, requestPhoto: true,
        }),
      ],
      [
        chatButton('Forum', 4, '5883997877172179131', undefined, {
          forum: true, requestTitle: true,
        }),
        userButton('Bot', 5, '5931614414351372818', undefined, {
          bot: true, maxQuantity: 10, requestName: true, requestUsername: true, requestPhoto: true,
        }),
        userButton('Premium', 6, '5956148757899776734', undefined, {
          premium: true, requestName: true, requestUsername: true, requestPhoto: true,
        }),
      ],
      [
        chatButton('Owner Group', 7, '5890741826230423364', 'success', {
          created: true, requestTitle: true,
        }),
        chatButton('Owner Channel', 8, '5891169510483823323', 'success', {
          channel: true, created: true, requestTitle: true,
        }),
      ],
      [
        chatButton('Admin Group', 9, '5994297722574737553', 'primary', {
          requestTitle: true, adminRights: { can_manage_chat: true },
        }),
        chatButton('Admin Channel', 10, '5891243564309942507', 'primary', {
          channel: true, requestTitle: true, adminRights: { can_manage_chat: true },
        }),
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}
