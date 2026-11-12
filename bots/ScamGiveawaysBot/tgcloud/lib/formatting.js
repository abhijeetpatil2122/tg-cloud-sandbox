function clean(value) {
  return String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim();
}
export function welcomeMessage(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || 'there';
  return { blocks: [
    { type: 'heading', size: 1, text: `👋 Welcome, ${clean(name)}` },
    { type: 'paragraph', text: 'Help make Telegram safer. Submit a clear report about a suspicious account or fake giveaway, with the amount involved and a public proof source.' },
    { type: 'paragraph', text: 'Reports are collected for review. A submission is an allegation, not a verified finding.' },
  ] };
}
const prompts = {
  handle: ['Scammer username', 'Send the Telegram handle of the account you are reporting, including @. Example: @username'],
  amount: ['Amount involved', 'How much money or cryptocurrency was involved? Example: $250, ₹5,000 or 3 TON'],
  summary: ['Short summary', 'Briefly explain what happened and why you suspect this is a scam.'],
  proof: ['Proof channel', 'Send the public Telegram channel username or link where the evidence can be reviewed. Example: @channelname or https://t.me/channelname'],
  edit_handle: ['Edit scammer username', 'Send the corrected Telegram handle, including @.'],
  edit_amount: ['Edit amount', 'Send the corrected amount involved.'],
  edit_summary: ['Edit summary', 'Send the corrected short summary.'],
  edit_proof: ['Edit proof channel', 'Send the corrected public channel username or t.me link.'],
};
export function promptMessage(step) {
  const [title, body] = prompts[step] || prompts.handle;
  return { blocks: [{ type: 'heading', size: 2, text: title }, { type: 'paragraph', text: body }] };
}
export function previewMessage(d) {
  return { blocks: [
    { type: 'heading', size: 1, text: 'Report preview' },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Scammer: ' }, clean(d.scammerHandle)] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Amount: ' }, clean(d.amount)] },
    { type: 'paragraph', text: { type: 'bold', text: 'Summary' } },
    { type: 'paragraph', text: clean(d.summary) },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Proof channel: ' }, clean(d.proofChannel)] },
    { type: 'divider' },
    { type: 'paragraph', text: 'Review every detail before submitting. For now, the report will be sent to your private chat only.' },
  ] };
}
export function previewKeyboard() {
  return { inline_keyboard: [
    [{ text: 'Edit report', callback_data: 'sg:edit', style: 'primary' }],
    [{ text: 'Publish', callback_data: 'sg:publish', style: 'success' }, { text: 'Cancel ❌', callback_data: 'sg:cancel', style: 'danger' }],
  ] };
}
export function editKeyboard() {
  return { inline_keyboard: [
    [{ text: 'Scammer username', callback_data: 'sg:field:handle' }, { text: 'Amount', callback_data: 'sg:field:amount' }],
    [{ text: 'Summary', callback_data: 'sg:field:summary' }, { text: 'Proof channel', callback_data: 'sg:field:proof' }],
    [{ text: '‹ Back to preview', callback_data: 'sg:preview' }],
    [{ text: 'Cancel ❌', callback_data: 'sg:cancel', style: 'danger' }],
  ] };
}
export function reportPostMessage(d) {
  return { blocks: [
    { type: 'heading', size: 1, text: 'Scam report' },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Reported account: ' }, clean(d.scammerHandle)] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Amount involved: ' }, clean(d.amount)] },
    { type: 'paragraph', text: { type: 'bold', text: 'Summary' } },
    { type: 'paragraph', text: clean(d.summary) },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Proof channel: ' }, clean(d.proofChannel)] },
    { type: 'divider' },
    { type: 'footer', text: 'Status: Submitted for review · Unverified report' },
  ] };
}
