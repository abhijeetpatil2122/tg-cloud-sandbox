import { api } from 'sdk';

const button = (text, callback_data, style) => ({
  text,
  callback_data,
  ...(style ? { style } : {}),
});

const row = (...buttons) => ({ type: 'buttons', buttons });

export function fullName(user = {}) {
  const name = [user.first_name, user.last_name]
    .filter(value => typeof value === 'string' && value.trim())
    .map(value => value.trim())
    .join(' ');
  return name || 'there';
}

export function homeMessage(name = 'there', showAdmin = false) {
  const blocks = [
    { type: 'heading', size: 1, text: 'Portals SMM' },
    { type: 'paragraph', text: `Welcome, ${name}.` },
    { type: 'paragraph', text: 'Your place to manage services, Portal Points and orders.' },
    { type: 'divider' },
    row(button('Services', 'ps:services', 'primary'), button('Deposit', 'ps:deposit', 'success')),
    row(button('Wallet', 'ps:wallet'), button('Transactions', 'ps:history')),
    row(button('My Orders', 'ps:orders'), button('Referral', 'ps:referral')),
    row(button('Support', 'ps:support'), button('Help', 'ps:help', 'link')),
  ];
  if (showAdmin) blocks.push(row(button('Administrator panel', 'ps:admin')));
  blocks.push({ type: 'footer', text: 'Payments via Telegram Stars · Portal Points are store credit' });
  return { blocks };
}

export function helpMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: 'Help' },
    { type: 'paragraph', text: 'Use the buttons below to navigate the Portals SMM storefront.' },
    { type: 'list', items: [
      { blocks: [{ type: 'paragraph', text: '/start — Open the storefront' }] },
      { blocks: [{ type: 'paragraph', text: '/menu — Return to the storefront' }] },
      { blocks: [{ type: 'paragraph', text: '/wallet — View your balance' }] },
      { blocks: [{ type: 'paragraph', text: '/history — View your transactions' }] },
      { blocks: [{ type: 'paragraph', text: '/help — View this help page' }] },
    ] },
    { type: 'paragraph', text: 'Portal Points are internal store credit. They are not cash and cannot be withdrawn as Telegram Stars.' },
    row(button('‹ Main menu', 'ps:home', 'link')),
  ] };
}

const screens = {
  services: {
    title: 'Services',
    description: 'The service catalogue is being prepared. Available services will appear here once supplier rates and delivery terms have been reviewed.',
  },
  deposit: {
    title: 'Deposit',
    description: 'Stars deposits are not enabled yet. Your balance will be credited only after Telegram confirms a successful payment.',
  },
  wallet: {
    title: 'Wallet',
    description: 'Your Portal Points balance and transaction history will appear here.',
  },
  orders: {
    title: 'My Orders',
    description: 'Your order history and delivery status will appear here after the catalogue is enabled.',
  },
  referral: {
    title: 'Referral programme',
    description: 'Your personal referral link and reward history will appear here when the programme is enabled.',
  },
  support: {
    title: 'Support',
    description: 'Support information will be published here. Keep your internal order ID available when requesting help.',
  },
};

export function sectionMessage(section) {
  const page = screens[section];
  if (!page) return unavailableMessage();
  return { blocks: [
    { type: 'heading', size: 1, text: page.title },
    { type: 'paragraph', text: page.description },
    { type: 'divider' },
    row(button('‹ Main menu', 'ps:home', 'link')),
  ] };
}

export function unavailableMessage() {
  return { blocks: [
    { type: 'heading', size: 2, text: 'Page unavailable' },
    { type: 'paragraph', text: 'This option is not available yet.' },
    row(button('‹ Main menu', 'ps:home', 'link')),
  ] };
}

export function adminPanelMessage(adminIds = [], databaseAvailable = true, canManage = true) {
  const ids = [...new Set(adminIds)].sort((a, b) => a - b);
  const blocks = [
    { type: 'heading', size: 1, text: 'Administrator panel' },
    { type: 'paragraph', text: 'Manage bot access and administrator accounts.' },
    { type: 'paragraph', text: `Designated owners: 6522801911 · 1314643983` },
    { type: 'paragraph', text: `Registered administrators: ${ids.length}` },
    row(button('Recent transactions', 'ps:admin:transactions', 'primary')),
  ];
  if (!databaseAvailable) {
    blocks.push({ type: 'paragraph', text: 'Administrator storage is temporarily unavailable. Owner access remains active.' });
  }
  if (canManage) blocks.push(row(button('Add administrator', 'ps:admin:add', 'success'), button('Remove administrator', 'ps:admin:remove', 'danger')));
  blocks.push(row(button('‹ Main menu', 'ps:home', 'link')));
  return { blocks };
}

export function adminAddPromptMessage() {
  return { blocks: [
    { type: 'heading', size: 2, text: 'Add administrator' },
    { type: 'paragraph', text: 'Send the numeric Telegram user ID you want to add. The account will receive administrator access.' },
    row(button('Cancel', 'ps:admin:cancel', 'link')),
  ] };
}

export function adminRemovalMessage(ids = []) {
  const blocks = [
    { type: 'heading', size: 1, text: 'Remove administrator' },
    { type: 'paragraph', text: 'Select an account to remove. The designated owners are protected.' },
  ];
  for (const id of ids) {
    blocks.push(row(button(`Remove ${id}`, `ps:admin:del:${id}`, 'danger')));
  }
  if (!ids.length) blocks.push({ type: 'paragraph', text: 'There are no removable administrators.' });
  blocks.push(row(button('‹ Back to admin panel', 'ps:admin', 'link')));
  return { blocks };
}

export async function sendRich(chatId, richMessage) {
  return api.sendRichMessage({ chat_id: chatId, rich_message: richMessage });
}

export async function editRich(chatId, messageId, richMessage) {
  return api.editMessageText({
    chat_id: chatId,
    message_id: messageId,
    rich_message: richMessage,
  });
}

export async function sendHome(chatId, user, showAdmin = false) {
  return sendRich(chatId, homeMessage(fullName(user), showAdmin));
}

export async function sendHelp(chatId) {
  return sendRich(chatId, helpMessage());
}
