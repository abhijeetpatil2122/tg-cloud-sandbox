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
    { type: 'heading', size: 1, text: '🚀 Portals SMM' },
    { type: 'paragraph', text: `Welcome, ${name}!` },
    { type: 'paragraph', text: 'Your Telegram growth workspace — manage services, Portal Points and orders in one place.' },
    { type: 'heading', size: 2, text: '✨ Quick access' }, 
    { type: 'divider' },
    row(button('📈 Services', 'ps:services', 'primary'), button('⭐ Deposit', 'ps:deposit', 'success')),
    row(button('💼 Wallet', 'ps:wallet'), button('🧾 History', 'ps:history')),
    row(button('📦 My Orders', 'ps:orders'), button('🎁 Referral', 'ps:referral')),
    row(button('💬 Support', 'ps:support'), button('❔ Help', 'ps:help', 'link')),
  ];
  if (showAdmin) blocks.push(row(button('⚙️ Administrator panel', 'ps:admin')));
  blocks.push({ type: 'footer', text: '⭐ Payments via Telegram Stars · Portal Points are store credit' });
  return { blocks };
}

export function helpMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '❔ Help' },
    { type: 'paragraph', text: 'Use the buttons below or the commands to navigate the Portals SMM storefront.' },
    { type: 'list', items: [
      { blocks: [{ type: 'paragraph', text: '/start — Open the storefront' }] },
      { blocks: [{ type: 'paragraph', text: '/menu — Return to the storefront' }] },
      { blocks: [{ type: 'paragraph', text: '/services — Browse Telegram services' }] },
      { blocks: [{ type: 'paragraph', text: '/deposit — Add Portal Points' }] },
      { blocks: [{ type: 'paragraph', text: '/orders — View your orders' }] },
      { blocks: [{ type: 'paragraph', text: '/wallet — View your balance' }] },
      { blocks: [{ type: 'paragraph', text: '/history — View your transactions' }] },
      { blocks: [{ type: 'paragraph', text: '/referral — View your referral details' }] },
      { blocks: [{ type: 'paragraph', text: '/support — Contact support' }] },
      { blocks: [{ type: 'paragraph', text: '/paysupport — Report a payment issue' }] },
      { blocks: [{ type: 'paragraph', text: '/terms — Read store terms' }] }, 
      { blocks: [{ type: 'paragraph', text: '/help — View this help page' }] },
    ] },
    { type: 'paragraph', text: 'Portal Points are internal store credit. They are not cash and cannot be withdrawn as Telegram Stars.' },
    row(button('‹ Main menu', 'ps:home', 'link')),
  ] };
}

const screens = {
  services: {
    title: '📈 Services',
    description: 'The service catalogue is being prepared. Available services will appear here once supplier rates and delivery terms have been reviewed.',
  },
  deposit: {
    title: '⭐ Deposit',
    description: 'Stars deposits are not enabled yet. Your balance will be credited only after Telegram confirms a successful payment.',
  },
  wallet: {
    title: '💼 Wallet',
    description: 'Your Portal Points balance and transaction history will appear here.',
  },
  orders: {
    title: '📦 My Orders',
    description: 'Your order history and delivery status will appear here after the catalogue is enabled.',
  },
  referral: {
    title: '🎁 Referral programme',
    description: 'Your personal referral link and reward history will appear here when the programme is enabled.',
  },
  support: {
    title: '💬 Support',
    description: 'For payment failures or Stars deposit questions, use /paysupport. Include your transaction or order reference and never share passwords or login codes.',
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
    { type: 'heading', size: 1, text: '⚙️ Administrator panel' },
    { type: 'paragraph', text: 'Manage services, supplier access, wallet activity and administrator accounts.' },
    { type: 'paragraph', text: `Designated owners: 6522801911 · 1314643983` },
    { type: 'paragraph', text: `Registered administrators: ${ids.length}` },
    row(button('⭐ Payments', 'ps:admin:payments', 'primary'), button('Recent activity', 'ps:admin:transactions')),
    row(button('↩️ Refunds', 'ps:admin:refunds', 'danger'), button('💬 Payment support', 'ps:admin:paysupport')),
    row(button('🔌 Provider', 'ps:admin:provider'), button('📈 Services', 'ps:admin:services')),
    row(button('🧹 Reset test data', 'ps:admin:resetdb', 'danger')),
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


export function providerAdminMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '🔌 Provider' },
    { type: 'paragraph', text: 'Check the supplier connection and refresh the Telegram service list.' },
    row(button('Check connection', 'ps:admin:provider:check', 'primary'), button('Sync services', 'ps:admin:services:sync', 'success')),
    row(button('Telegram catalogue', 'ps:admin:services')),
    row(button('‹ Administrator panel', 'ps:admin', 'link')),
  ] };
}

export function providerBalanceMessage(result) {
  return { blocks: [
    { type: 'heading', size: 1, text: '🔌 Provider connection' },
    { type: 'paragraph', text: `Connection successful\nSupplier balance: ${result.balance} ${result.currency}` },
    row(button('‹ Provider', 'ps:admin:provider', 'link')),
  ] };
}

export function adminServicesMessage(services = [], page = 0) {
  const safePage = Math.max(0, Number(page) || 0);
  const start = safePage * 6;
  const rows = services.slice(start, start + 6);
  const blocks = [
    { type: 'heading', size: 1, text: '📈 Telegram services' },
    { type: 'paragraph', text: services.length + ' Telegram services found. New services remain disabled until reviewed and priced.' },
    { type: 'divider' },
  ];
  if (!rows.length) blocks.push({ type: 'paragraph', text: 'No Telegram services have been synced yet.' });
  for (const item of rows) {
    blocks.push({ type: 'table', caption: 'Service #' + item.serviceId + ' · ' + item.name, is_bordered: true, is_compact: true, cells: [
      [{ text: 'Field', is_header: true }, { text: 'Value', is_header: true }],
      [{ text: 'Category' }, { text: item.category || 'Telegram' }],
      [{ text: 'Type' }, { text: item.type }],
      [{ text: 'Supplier rate' }, { text: String(item.rate) }],
      [{ text: 'Quantity' }, { text: item.minQty + '–' + item.maxQty }],
      [{ text: 'Customer price' }, { text: Number(item.customerPrice) > 0 ? item.customerPrice + ' Portal Points' : 'Not set' }],
      [{ text: 'Refill / cancel' }, { text: (item.refill ? 'Refill' : 'No refill') + ' · ' + (item.cancel ? 'Cancel' : 'No cancel') }],
      [{ text: 'Status' }, { text: item.enabled ? 'Enabled' : 'Disabled' }],
    ] });
    blocks.push(row(
      button('Set price', 'ps:admin:service:price:' + item.serviceId),
      button(item.enabled ? 'Disable' : 'Enable', 'ps:admin:service:' + (item.enabled ? 'disable' : 'enable') + ':' + item.serviceId, item.enabled ? 'danger' : 'success'),
    ));
    blocks.push({ type: 'divider' });
  }
  const buttons = [];
  if (safePage > 0) buttons.push(button('‹ Previous', 'ps:admin:services:' + (safePage - 1)));
  if (start + 6 < services.length) buttons.push(button('Next ›', 'ps:admin:services:' + (safePage + 1)));
  if (buttons.length) blocks.push(row(...buttons));
  blocks.push(row(button('Sync services', 'ps:admin:services:sync', 'success')));
  blocks.push(row(button('‹ Provider', 'ps:admin:provider', 'link')));
  return { blocks };
}
export function customerServicesMessage(services = [], page = 0) {
  const safePage = Math.max(0, Number(page) || 0);
  const start = safePage * 10;
  const visible = services.slice(start, start + 10);
  const blocks = [
    { type: 'heading', size: 1, text: '📈 Services' },
    { type: 'paragraph', text: 'Choose a Telegram service.' },
  ];
  if (!services.length) {
    blocks.push({ type: 'paragraph', text: 'No services are available at the moment.' });
  } else {
    for (let i = 0; i < visible.length; i += 2) {
      const first = visible[i];
      const second = visible[i + 1];
      blocks.push(row(
        button(first.name.slice(0, 60), `ps:service:${first.serviceId}`),
        ...(second ? [button(second.name.slice(0, 60), `ps:service:${second.serviceId}`)] : []),
      ));
    }
    const navigation = [];
    if (safePage > 0) navigation.push(button('‹ Previous', `ps:services:${safePage - 1}`));
    if (start + 10 < services.length) navigation.push(button('Next ›', `ps:services:${safePage + 1}`));
    if (navigation.length) blocks.push(row(...navigation));
  }
  blocks.push(row(button('‹ Main menu', 'ps:home', 'link')));
  return { blocks };
}

export function customerServiceDetailsMessage(item) {
  return { blocks: [
    { type: 'heading', size: 1, text: '📈 ' + item.name },
    { type: 'table', caption: 'Service details · ID ' + item.serviceId, is_bordered: true, is_striped: true, cells: [
      [{ text: 'Details', is_header: true }, { text: 'Information', is_header: true }],
      [{ text: 'Price' }, { text: [{ type: 'bold', text: Number(item.customerPrice).toLocaleString('en-IN') + ' Portal Points' }] }],
      [{ text: 'Quantity range' }, { text: Number(item.minQty).toLocaleString('en-IN') + ' – ' + Number(item.maxQty).toLocaleString('en-IN') }],
      [{ text: 'Category' }, { text: item.category || 'Telegram' }],
      [{ text: 'Service type' }, { text: item.type }],
      [{ text: 'Refill' }, { text: item.refill ? 'Available' : 'Not available' }],
      [{ text: 'Cancellation' }, { text: item.cancel ? 'Available on request' : 'Not available' }],
    ] },
    { type: 'details', summary: 'Before placing an order', blocks: [
      { type: 'list', items: [
        { blocks: [{ type: 'paragraph', text: 'Check the target format and quantity limits.' }] },
        { blocks: [{ type: 'paragraph', text: 'Use a public Telegram target where required.' }] },
        { blocks: [{ type: 'paragraph', text: 'Never share passwords, login codes or account credentials.' }] },
      ] },
    ] },
    row(button('‹ Services', 'ps:services', 'link')),
  ] };
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
