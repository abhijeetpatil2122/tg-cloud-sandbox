import { db } from 'sdk';
import { and, eq, inArray } from 'sdk/db';
import {
  adminSessions,
  depositIntents,
  paymentSupportTickets,
  serviceOrders,
  userSessions,
  walletTransactions,
} from '../schema.js';

export async function resetPreviewMessage() {
  const pendingIntents = await db.$count(depositIntents, inArray(depositIntents.status, ['pending', 'failed']));
  const pendingDeposits = await db.$count(walletTransactions, and(
    eq(walletTransactions.kind, 'deposit'),
    inArray(walletTransactions.status, ['pending', 'failed']),
  ));
  const sessions = await db.$count(userSessions);
  const tickets = await db.$count(paymentSupportTickets);
  const orders = await db.$count(serviceOrders);
  return { blocks: [
    { type: 'heading', size: 1, text: '🧹 Reset test data' },
    { type: 'paragraph', text: 'This temporary admin tool clears unfinished payment and order workflow data.' },
    { type: 'table', caption: 'Data that will be cleared', is_bordered: true, is_striped: true, cells: [
      [{ text: 'Data', is_header: true }, { text: 'Records', is_header: true, align: 'right' }],
      [{ text: 'Unfinished/failed invoices' }, { text: String(pendingIntents), align: 'right' }],
      [{ text: 'Unfinished deposit records' }, { text: String(pendingDeposits), align: 'right' }],
      [{ text: 'Payment support test tickets' }, { text: String(tickets), align: 'right' }],
      [{ text: 'In-progress sessions' }, { text: String(sessions), align: 'right' }],
      [{ text: 'Order test records' }, { text: String(orders), align: 'right' }],
    ] },
    { type: 'details', summary: 'What will be preserved', blocks: [
      { type: 'list', items: [
        { blocks: [{ type: 'paragraph', text: 'Confirmed Stars payments, refunds and the append-only wallet ledger.' }] },
        { blocks: [{ type: 'paragraph', text: 'Customer Portal Points and all financial audit history.' }] },
        { blocks: [{ type: 'paragraph', text: 'Provider catalogue, service prices and administrator accounts.' }] },
      ] },
    ] },
    { type: 'paragraph', text: 'This cannot be undone. Confirm only if you want to clear the test data listed above.' },
    { type: 'buttons', buttons: [{ text: '🗑 Confirm reset', callback_data: 'ps:admin:resetdb:confirm', style: 'danger' }] },
    { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
  ] };
}

export async function resetTestData() {
  const pendingIntents = await db.$count(depositIntents, inArray(depositIntents.status, ['pending', 'failed']));
  const pendingDeposits = await db.$count(walletTransactions, and(
    eq(walletTransactions.kind, 'deposit'),
    inArray(walletTransactions.status, ['pending', 'failed']),
  ));
  const sessions = await db.$count(userSessions);
  const adminPending = await db.$count(adminSessions);
  const tickets = await db.$count(paymentSupportTickets);
  const orders = await db.$count(serviceOrders);

  await db.delete(depositIntents).where(inArray(depositIntents.status, ['pending', 'failed'])).run();
  await db.delete(walletTransactions).where(and(
    eq(walletTransactions.kind, 'deposit'),
    inArray(walletTransactions.status, ['pending', 'failed']),
  )).run();
  await db.delete(userSessions).run();
  await db.delete(adminSessions).run();
  await db.delete(paymentSupportTickets).run();
  await db.delete(serviceOrders).run();

  return { pendingIntents, pendingDeposits, sessions, adminPending, tickets, orders };
}

export function resetCompleteMessage(result) {
  const total = Object.values(result).reduce((sum, value) => sum + Number(value || 0), 0);
  return { blocks: [
    { type: 'heading', size: 1, text: '✓ Test data cleared' },
    { type: 'paragraph', text: total + ' test/workflow records cleared. Confirmed Stars payments, wallet balances, financial ledger, provider catalogue and administrator accounts were preserved.' },
    { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
  ] };
}
