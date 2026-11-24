import { api } from 'sdk';

const button = (text, callback_data, style) => ({
  text,
  callback_data,
  ...(style ? { style } : {}),
});

const row = (...buttons) => ({ type: 'buttons', buttons });
// Use a callback in Rich Messages. The callback sends a conventional
// Bot API inline-keyboard URL button, which has broader client compatibility.
const supportProfileButton = () => ({
  type: 'buttons',
  align: 'left',
  buttons: [{ text: 'Open profile', callback_data: 'ps:support:contact' }],
});

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
    { type: 'paragraph', text: 'Your Telegram growth workspace — manage services, wallet and service history in one place.' },
    { type: 'heading', size: 2, text: '✨ Quick access' }, 
    { type: 'divider' },
    row(button('📈 Services', 'ps:services', 'primary'), button('⭐ Deposit', 'ps:deposit', 'success')),
    row(button('💼 Wallet', 'ps:wallet'), button('🧾 Payment History', 'ps:history')),
    row(button('📈 Order History', 'ps:orders'), button('🔒 VPN Service', 'ps:vpn')),
    row(button('💬 Support', 'ps:support'), button('❔ Help', 'ps:help', 'link')),
  ];
  if (showAdmin) blocks.push(row(button('⚙️ Administrator panel', 'ps:admin')));
  return { blocks };
}

export function helpMessage(showAdmin = false) {
  const commands = [
    '/start — Open the storefront',
    '/menu — Return to the main menu',
    '/services — Browse available Telegram services',
    '/deposit [stars] — Open deposit options or request an invoice for a Star amount',
    '/wallet — View your wallet balance',
    '/history — View wallet transactions',
    '/orders — View service orders (also available as /servicehistory)',
    '/support — Contact service support',
    '/paysupport — Get help with a payment or deposit',
    '/vpn — View VPN plans and contact support',
    '/help — View this command guide',
    '/cancel — Cancel an active custom-deposit input',
  ];
  if (showAdmin) commands.push(
    '/admin — Open the administrator panel',
    '/payments — Review Stars payment records',
    '/refund [transaction_id] — Review a Stars refund',
    '/servicesetup — Open the service configuration guide',
    '/stats — View administrator statistics',
    '/resetdb — Review and reset temporary test data',
  );

  const helpSection = (heading, points) => [
    { type: 'heading', size: 3, text: heading },
    { type: 'list', items: points.map(point => ({
      blocks: [{ type: 'paragraph', text: point }],
    })) },
  ];

  return { blocks: [
    { type: 'heading', size: 1, text: '❔ Help' },
    {
      type: 'expandable_blockquote',
      blocks: [
        ...helpSection('💳 Payments', [
          'Choose a Telegram Stars package or enter a custom amount.',
          'Your wallet is credited only after Telegram confirms the successful payment.',
          'For a missing or delayed credit, open the Support section and include your payment reference.',
        ]),
        ...helpSection('💼 Wallet', [
          'Your wallet displays available store credit in USD.',
          'Wallet credit is for purchases inside the storefront and is not withdrawable cash.',
        ]),
        ...helpSection('📈 Orders', [
          'Review the service description, target format and quantity limits before ordering.',
          'Delivery estimates can vary by service and supplier.',
          'Use Order History to track order references and statuses.',
        ]),
        ...helpSection('↩️ Refunds', [
          'Refund requests are reviewed against the original payment and order status.',
          'Spent wallet credit may not be refundable.',
          'Never make a second payment for an invoice already confirmed by Telegram.',
        ]),
        ...helpSection('🔄 Guaranteed Refill', [
          'A refill is available only when the selected service includes a refill guarantee.',
          'If a drop occurs during the guarantee period, contact Support with your order ID.',
        ]),
        ...helpSection('🛡️ Fair Use', [
          'Use services only for lawful purposes and follow each service’s requirements.',
          'Fraud, payment abuse, reselling access without permission and service exploitation are prohibited.',
          'Never share Telegram passwords, login codes or account credentials.',
        ]),
      ],
    },
    { type: 'paragraph', text: 'Use the menu buttons or these commands to navigate the storefront.' },
    { type: 'list', items: commands.map(text => ({ blocks: [{ type: 'paragraph', text }] })) },
    row(button('‹ Main menu', 'ps:home', 'link')),
  ] };
}

const screens = {
  services: {
    title: '📈 Services',
    description: 'Browse the available Telegram services and view VPN plan information.',
  },
  deposit: {
    title: '⭐ Deposit',
    description: 'Choose a Telegram Stars package to add funds. 80 Stars = $1.',
  },
  wallet: {
    title: '💼 Wallet',
    description: 'Your USD balance and transaction history will appear here.',
  },
  orders: {
    title: '📈 Order History',
    description: 'Your past service orders, charges and delivery statuses.',
  },
  support: {
    title: '💬 Support',
    description: 'For service, Order refills or payment assistance, include your order or transaction reference.',
  },
};

export function vpnPlansMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '🔐 Portals VPN — Choose Your Plan' },
    { type: 'paragraph', text: 'Get 1-year access with unlimited country coverage.' },
    { type: 'heading', size: 2, text: 'Available Plans' },
    { type: 'table', caption: 'Available plans · USD', is_bordered: true, is_striped: true, is_compact: true, cells: [
      [{ text: 'Plan', is_header: true }, { text: 'Price', is_header: true, align: 'right' }],
      [{ text: '🥉 Basic Plan' }, { text: '$100', align: 'right' }],
      [{ text: '🥈 Advanced Plan' }, { text: '$200', align: 'right' }],
      [{ text: '🥇 Premium Pack' }, { text: '$300', align: 'right' }],
    ] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Validity: ' }, '1 Year'] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Country Coverage: ' }, 'Unlimited countries'] },
    supportProfileButton(),
    row(button('‹ Main menu', 'ps:home', 'link')),
  ] };
}

export function sectionMessage(section) {
  const page = screens[section];
  if (!page) return unavailableMessage();
  return { blocks: [
    { type: 'heading', size: 1, text: page.title },
    { type: 'paragraph', text: page.description },
    { type: 'divider' },
    ...(section === 'support' ? [
      supportProfileButton(),
    ] : []),
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
    row(button('↩️ Refunds', 'ps:admin:refunds', 'danger')),
    row(button('🔌 Provider', 'ps:admin:provider'), button('📈 Services', 'ps:admin:services')),
    row(button('Service setup guide', 'ps:admin:service-guide', 'primary')),
    row(button('Global statistics', 'ps:admin:stats', 'primary')),
    row(button('Add balance', 'ps:admin:balance:add', 'success'), button('Remove balance', 'ps:admin:balance:remove', 'danger')),
    row(button('Ban user', 'ps:admin:user:ban', 'danger'), button('Unban user', 'ps:admin:user:unban', 'success')),
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
  const services = result.services || [];
  const enabled = services.filter(item => item.enabled).length;
  const priced = services.filter(item => Number(item.customerPrice) > 0).length;
  const latestSync = services.reduce((latest, item) => {
    const value = item.lastSyncedAt instanceof Date ? item.lastSyncedAt.getTime() : Number(item.lastSyncedAt || 0) * 1000;
    return Math.max(latest, value);
  }, 0);
  const date = latestSync ? new Date(latestSync).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Not synced yet';
  return { blocks: [
    { type: 'heading', size: 1, text: 'Provider connection' },
    { type: 'table', caption: 'Live connection check', is_bordered: true, is_compact: true, cells: [
      [{ text: 'Check', is_header: true, align: 'left' }, { text: 'Result', is_header: true, align: 'right' }],
      [{ text: 'API status' }, { text: [{ type: 'bold', text: 'Connected' }], align: 'right' }],
      [{ text: 'Supplier' }, { text: 'smm.plus', align: 'right' }],
      [{ text: 'Supplier balance' }, { text: Number(result.balance).toLocaleString('en-IN') + ' ' + result.currency, align: 'right' }],
      [{ text: 'Telegram services' }, { text: String(services.length), align: 'right' }],
      [{ text: 'Services with price' }, { text: String(priced), align: 'right' }],
      [{ text: 'Enabled services' }, { text: String(enabled), align: 'right' }],
      [{ text: 'Last catalogue sync' }, { text: date, align: 'right' }],
    ] },
    { type: 'details', summary: 'Connection information', blocks: [
      { type: 'paragraph', text: 'The balance endpoint authenticated successfully. API credentials are intentionally not displayed. Catalogue counts come from the local Telegram-only service snapshot.' },
    ] },
    row(button('‹ Provider', 'ps:admin:provider', 'link')),
  ] };
}

export function serviceSetupGuideMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: 'Service setup guide' },
    { type: 'paragraph', text: 'A synced service is not automatically available to customers. Review its supplier details, set a selling price, then enable it.' },
    { type: 'anchor', name: 'steps' },
    { type: 'heading', size: 2, text: 'Setup steps' },
    { type: 'list', items: [
      { value: 1, blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Sync the catalogue. ' }, 'Open Provider → Sync services. Only Telegram services are imported.'] }] },
      { value: 2, blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Review the service. ' }, 'Check service ID, target type, supplier rate, minimum/maximum quantity, refill and cancellation support.'] }] },
      { value: 3, blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Set your selling price. ' }, 'Open the service and choose Set price. Enter the customer charge in whole USD.'] }] },
      { value: 4, blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Enable it. ' }, 'Use Enable only after the price and service details have been checked.'] }] },
      { value: 5, blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Verify the customer view. ' }, 'Open the public Services page and inspect the description and price.'] }] },
    ] },
    { type: 'anchor', name: 'pricing' },
    { type: 'heading', size: 2, text: 'Pricing calculation' },
    { type: 'paragraph', text: 'The planning target is a 30% gross margin. First convert the supplier cost into INR using a verified FX rate. Then calculate the customer price:' },
    { type: 'mathematical_expression', expression: String.raw`P=\operatorname{round}_{5}\left(\frac{C_{INR}}{(1-0.30)\times V_{INR/point}}\right)` },
    { type: 'paragraph', text: [{ type: 'italic', text: 'P = selling USD; C = supplier cost in INR for the exact requested quantity; V = approved INR accounting value of one USD.' }, ' Round to the nearest $5, not always upward.'] },
    { type: 'details', summary: 'Important supplier-rate warning', blocks: [
      { type: 'paragraph', text: 'Do not assume every supplier rate is per 1,000 units. Read the service rate unit and calculate the cost for the actual order quantity. Confirm the provider currency, min/max quantity and any refill/cancel conditions before enabling.' },
    ] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Current safeguard: ' }, 'newly synced services stay disabled until a customer price is set and an administrator explicitly enables them.'] },
    { type: 'paragraph', text: ['Ready to review the available entries? ', { type: 'button', button: { text: 'Open catalogue', callback_data: 'ps:admin:services', style: 'primary' } }] },
    { type: 'paragraph', text: [{ type: 'anchor_link', text: 'Back to setup steps ↑', anchor_name: 'steps' }, '  ·  ', { type: 'anchor_link', text: 'Pricing ↑', anchor_name: 'pricing' }, '  ·  ', { type: 'anchor_link', text: 'Top ↑', anchor_name: '' }] },
    row(button('Open Telegram catalogue', 'ps:admin:services', 'primary')),
    row(button('‹ Administrator panel', 'ps:admin', 'link')),
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
    blocks.push({ type: 'table', caption: 'Service #' + item.serviceId + ' · ' + item.name, is_bordered: true, is_striped: true,  cells: [
      [{ text: 'Field', is_header: true, align: 'left' }, { text: 'Value', is_header: true, align: 'right' }],
      [{ text: 'Category', align: 'left' }, { text: item.category || 'Telegram', align: 'right' }],
      [{ text: 'Type', align: 'left' }, { text: item.type, align: 'right' }],
      [{ text: 'Supplier rate', align: 'left' }, { text: String(item.rate), align: 'right' }],
      [{ text: 'Quantity', align: 'left' }, { text: item.minQty + '–' + item.maxQty, align: 'right' }],
      [{ text: 'Customer price', align: 'left' }, { text: Number(item.customerPrice) > 0 ? '$' + Number(item.customerPrice).toLocaleString('en-US') : 'Not set', align: 'right' }],
      [{ text: 'Refill / cancel', align: 'left' }, { text: (item.refill ? 'Refill' : 'No refill') + ' · ' + (item.cancel ? 'Cancel' : 'No cancel'), align: 'right' }],
      [{ text: 'Status', align: 'left' }, { text: item.enabled ? 'Enabled' : 'Disabled', align: 'right' }],
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
    { type: 'table', caption: 'Service details · ID ' + item.serviceId, is_bordered: false, is_striped: true, is_compact: true, cells: [
      [{ text: 'Details', is_header: true, align: 'left' }, { text: 'Information', is_header: true, align: 'right' }],
      [{ text: 'Price', align: 'left' }, { text: [{ type: 'bold', text: '$' + Number(item.customerPrice).toLocaleString('en-US') }] }],
      [{ text: 'Quantity range', align: 'left' }, { text: Number(item.minQty).toLocaleString('en-IN') + ' – ' + Number(item.maxQty).toLocaleString('en-IN') }],
      [{ text: 'Category', align: 'left' }, { text: item.category || 'Telegram' }],
      [{ text: 'Service type', align: 'left' }, { text: item.type }],
      [{ text: 'Refill', align: 'left' }, { text: item.refill ? 'Available' : 'Not available' }],
      [{ text: 'Cancellation', align: 'left' }, { text: item.cancel ? 'Available on request' : 'Not available' }],
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
