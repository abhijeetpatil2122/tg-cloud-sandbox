function clean(value) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim();
}
function proofUrl(value) {
  const input = clean(value);
  if (input.startsWith('@')) return 'https://t.me/' + input.slice(1);
  if (/^https?:\/\//i.test(input)) return input;
  return 'https://' + input;
}
function detailList(d) {
  return {
    type: 'list',
    items: [
      { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Reported account: ' }, clean(d.scammerHandle)] }] },
      { blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: 'Amount involved: ' }, clean(d.amount)] }] },
    ],
  };
}
export function welcomeMessage(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || 'there';
  return { blocks: [
    { type: 'heading', size: 1, text: `👋 Welcome, ${clean(name)}` },
    { type: 'paragraph', text: 'Help make Telegram safer by reporting suspicious accounts and fake giveaways with clear details and a public evidence source.' },
    { type: 'paragraph', text: 'Every submission is reviewed by an administrator. Reports are allegations until independently verified.' },
  ] };
}
const prompts = {
  handle: ['👤 Scammer username', 'Send the Telegram username of the account you are reporting, including @.'],
  amount: ['💰 Amount involved', 'Enter the amount and currency or asset exactly as applicable. Examples: $250, 3 GRAM or 0.05 BTC.'],
  summary: ['📝 What happened?', 'Briefly explain what happened and why you believe it may be a scam.'],
  proof: ['🔎 Evidence source', 'Send a public Telegram channel username or t.me link where the evidence can be reviewed.'],
  edit_handle: ['👤 Edit username', 'Send the corrected Telegram username, including @.'],
  edit_amount: ['💰 Edit amount', 'Send the corrected amount and currency or asset.'],
  edit_summary: ['📝 Edit summary', 'Send the corrected summary.'],
  edit_proof: ['🔎 Edit evidence source', 'Send the corrected public channel username or t.me link.'],
};
export function promptMessage(step) {
  const [title, body] = prompts[step] || prompts.handle;
  return { blocks: [{ type: 'heading', size: 2, text: title }, { type: 'paragraph', text: body }] };
}
function proofButton(d) {
  return { type: 'buttons', align: 'left', buttons: [
    { text: 'Open evidence source', style: 'link', url: proofUrl(d.proofChannel) },
  ] };
}
export function previewMessage(d) {
  return { blocks: [
    { type: 'heading', size: 1, text: '🧾 Report preview' },
    detailList(d),
    { type: 'heading', size: 3, text: '📝 Summary' },
    { type: 'expandable_blockquote', text: clean(d.summary) },
    { type: 'heading', size: 3, text: '🔗 Evidence source' },
    { type: 'paragraph', text: 'The evidence link is available below.' },
    proofButton(d),
    { type: 'divider' },
    { type: 'footer', text: 'Please check all details. Your report will be sent to administrators for review, not published immediately.' },
  ] };
}
export function previewKeyboard() {
  return { inline_keyboard: [
    [{ text: 'Edit report', callback_data: 'sg:edit', style: 'primary' }],
    [{ text: 'Submit for review', callback_data: 'sg:submit', style: 'success' }, { text: 'Cancel', callback_data: 'sg:cancel' }],
  ] };
}
export function editKeyboard() {
  return { inline_keyboard: [
    [{ text: 'Username', callback_data: 'sg:field:handle' }, { text: 'Amount', callback_data: 'sg:field:amount' }],
    [{ text: 'Summary', callback_data: 'sg:field:summary' }, { text: 'Evidence', callback_data: 'sg:field:proof' }],
    [{ text: '‹ Back to preview', callback_data: 'sg:preview' }],
    [{ text: 'Cancel', callback_data: 'sg:cancel' }],
  ] };
}
export function reportPostMessage(d, reportId, admin = false) {
  const blocks = [
    { type: 'heading', size: 1, text: `🛡️ Scam report #${reportId}` },
    detailList(d),
    { type: 'heading', size: 3, text: '📝 Summary' },
    { type: 'expandable_blockquote', text: clean(d.summary) },
    { type: 'heading', size: 3, text: '🔗 Evidence source' },
    proofButton(d),
    { type: 'divider' },
    { type: 'footer', text: admin ? 'Status: Pending administrator review · Allegation not yet verified' : 'Status: Published after administrator review · Allegation, not a legal finding' },
  ];
  return { blocks };
}
export function adminPanelMessage(channelTitle) {
  return { blocks: [
    { type: 'heading', size: 1, text: '⚙️ Admin panel' },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Publishing channel: ' }, channelTitle || 'Not configured'] },
    { type: 'paragraph', text: 'Configure the channel that receives approved reports. Only reports approved by an administrator are published.' },
  ] };
}
export function adminPanelKeyboard() {
  return { inline_keyboard: [
    [{ text: 'Configure channel', callback_data: 'sg:admin:configure', style: 'primary' }],
    [{ text: 'Reset test data', callback_data: 'sg:admin:reset', style: 'danger' }],
  ] };
}
export function resetConfirmMessage() {
  return { blocks: [
    { type: 'heading', size: 2, text: '⚠️ Reset test data?' },
    { type: 'paragraph', text: 'This permanently deletes all report drafts and stored reports. The configured publishing channel will be kept.' },
    { type: 'paragraph', text: 'This action cannot be undone.' },
  ] };
}
export function adminReviewKeyboard(id) {
  return { inline_keyboard: [
    [{ text: 'Approve and publish', callback_data: `sg:admin:approve:${id}`, style: 'success' }],
    [{ text: 'Decline report', callback_data: `sg:admin:decline:${id}`, style: 'danger' }],
  ] };
}
