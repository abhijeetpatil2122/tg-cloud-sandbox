import { api } from 'sdk';

export function buildHomeMessage(firstName = 'there') {
  return {
    blocks: [
      { type: 'heading', size: 1, text: 'Portals SMM' },
      { type: 'paragraph', text: `Welcome, ${firstName}. Manage your services, Portal Points, and orders from one place.` },
      { type: 'divider' },
      { type: 'heading', size: 3, text: 'Your storefront' },
      { type: 'paragraph', text: 'Choose an option below to continue.' },
      { type: 'footer', text: 'Secure checkout · Telegram Stars · Order tracking' },
    ],
  };
}

export function buildHelpMessage() {
  return {
    blocks: [
      { type: 'heading', size: 1, text: 'Help & commands' },
      { type: 'paragraph', text: 'Use the buttons to navigate the storefront. All purchases and account actions are available in private chat only.' },
      { type: 'paragraph', text: '/start — Open the storefront' },
      { type: 'paragraph', text: '/menu — Return to the main menu' },
      { type: 'paragraph', text: '/help — View help and available commands' },
      { type: 'paragraph', text: 'Portal Points are internal store credit. They are not cash and cannot be withdrawn as Telegram Stars.' },
    ],
  };
}

export async function sendHome(chatId, firstName = 'there', showAdmin = false) {
  return api.sendRichMessage({
    chat_id: chatId,
    rich_message: buildHomeMessage(firstName),
    reply_markup: { inline_keyboard: [
      [
        { text: 'Services', callback_data: 'ps:services' },
        { text: 'Deposit', callback_data: 'ps:deposit' },
      ],
      [
        { text: 'Wallet', callback_data: 'ps:wallet' },
        { text: 'My Orders', callback_data: 'ps:orders' },
      ],
      [
        { text: 'Referral', callback_data: 'ps:referral' },
        { text: 'Support', callback_data: 'ps:support' },
      ],
      [{ text: 'Help', callback_data: 'ps:help', style: 'link' }],
      ...(showAdmin ? [[{ text: 'Admin panel', callback_data: 'ps:admin' }]] : []),
    ] },
  });
}

export async function sendHelp(chatId) {
  return api.sendRichMessage({
    chat_id: chatId,
    rich_message: buildHelpMessage(),
    reply_markup: { inline_keyboard: [[
      { text: '‹ Main menu', callback_data: 'ps:home' },
    ]] },
  });
}
