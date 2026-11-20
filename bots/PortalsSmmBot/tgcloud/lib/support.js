import { api, db } from 'sdk';
import { desc, eq } from 'sdk/db';
import { paymentSupportTickets } from '../schema.js';

export async function adminPaymentSupportMessage(page = 0) {
  const safePage = Math.max(0, Math.min(1000, Number(page) || 0));
  const rows = await db.select().from(paymentSupportTickets)
    .where(eq(paymentSupportTickets.status, 'open'))
    .orderBy(desc(paymentSupportTickets.createdAt), desc(paymentSupportTickets.id))
    .limit(6)
    .offset(safePage * 6)
    .all();

  const blocks = [
    { type: 'heading', size: 1, text: '💬 Payment support' },
    { type: 'paragraph', text: 'Open payment questions submitted by customers.' },
    { type: 'divider' },
  ];
  if (!rows.length) blocks.push({ type: 'paragraph', text: 'There are no open payment support requests.' });
  for (const item of rows) {
    blocks.push({ type: 'paragraph', text: 'Ticket #' + item.id + ' · User ' + item.userId + '\n' + String(item.message).slice(0, 700) });
    blocks.push({ type: 'buttons', buttons: [{ text: 'Mark resolved', callback_data: 'ps:admin:paysupport:resolve:' + item.id, style: 'success' }] });
  }
  const nav = [];
  if (safePage > 0) nav.push({ text: '‹ Previous', callback_data: 'ps:admin:paysupport:' + (safePage - 1) });
  if (rows.length === 6) nav.push({ text: 'Next ›', callback_data: 'ps:admin:paysupport:' + (safePage + 1) });
  if (nav.length) blocks.push({ type: 'buttons', buttons: nav });
  blocks.push({ type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] });
  return { blocks };
}

export async function resolvePaymentSupportTicket(ticketId) {
  const ticket = await db.select().from(paymentSupportTickets)
    .where(eq(paymentSupportTickets.id, Number(ticketId))).get();
  if (!ticket || ticket.status !== 'open') return { resolved: false };
  await db.update(paymentSupportTickets)
    .set({ status: 'resolved', updatedAt: new Date() })
    .where(eq(paymentSupportTickets.id, Number(ticketId))).run();
  await api.sendMessage({
    chat_id: Number(ticket.userId),
    text: '💬 Your payment support request #' + ticket.id + ' has been marked as resolved. If you still need help, you can send /paysupport again.',
  });
  return { resolved: true, userId: ticket.userId };
}
