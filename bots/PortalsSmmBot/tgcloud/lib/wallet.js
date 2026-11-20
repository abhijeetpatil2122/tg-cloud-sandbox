import { db } from 'sdk';
import { desc, eq, sum } from 'sdk/db';
import { walletLedger, walletTransactions } from '../schema.js';

function formatPoints(value) {
  const amount = Number(value) || 0;
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toLocaleString('en-IN')} Portal Points`;
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(Number(value || 0) * 1000);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusText(status) {
  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded',
    cancelled: 'Cancelled',
    needs_review: 'Under review',
  };
  return labels[String(status || '').toLowerCase()] || 'Recorded';
}

function transactionBlock(item, includeUser = false) {
  const parts = [
    item.title || 'Wallet transaction',
    formatPoints(item.points),
    `Status: ${statusText(item.status)}`,
    formatDate(item.createdAt),
  ];
  if (Number(item.stars) > 0) parts.splice(2, 0, `Paid: ${Number(item.stars)} Stars`);
  if (item.reference) parts.push(`Reference: ${String(item.reference).slice(0, 48)}`);
  if (includeUser) parts.push(`User: ${item.userId}`);
  return { type: 'paragraph', text: parts.join('\n') };
}

export async function walletMessage(userId) {
  try {
    const balanceRow = await db.select({ total: sum(walletLedger.amount) })
      .from(walletLedger)
      .where(eq(walletLedger.userId, Number(userId)))
      .get();
    const history = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.userId, Number(userId)))
      .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
      .limit(8)
      .all();

    const balance = Number(balanceRow?.total || 0);
    const blocks = [
      { type: 'heading', size: 1, text: 'Wallet' },
      { type: 'paragraph', text: `Available balance\n${balance.toLocaleString('en-IN')} Portal Points` },
      { type: 'divider' },
      { type: 'heading', size: 2, text: 'Recent transactions' },
    ];

    if (history.length) {
      for (const item of history) {
        blocks.push(transactionBlock(item));
        blocks.push({ type: 'divider' });
      }
    } else {
      blocks.push({ type: 'paragraph', text: 'No transactions yet.' });
    }

    blocks.push({
      type: 'buttons',
      buttons: [
        { text: 'Full history', callback_data: 'ps:history' },
        { text: 'Deposit', callback_data: 'ps:deposit', style: 'success' },
      ],
    });
    blocks.push({ type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] });
    return { blocks };
  } catch (error) {
    console.error('Wallet screen unavailable:', error?.description || error?.message || 'database not ready');
    return {
      blocks: [
        { type: 'heading', size: 1, text: 'Wallet' },
        { type: 'paragraph', text: 'Your wallet and transaction history are being prepared. Please check back soon.' },
        { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
      ],
    };
  }
}

export async function transactionHistoryMessage(userId, page = 0) {
  const safePage = Math.max(0, Math.min(1000, Number(page) || 0));
  try {
    const rows = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.userId, Number(userId)))
      .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
      .limit(8)
      .offset(safePage * 8)
      .all();

    const blocks = [
      { type: 'heading', size: 1, text: 'Transaction history' },
      { type: 'paragraph', text: 'Deposits, purchases, rewards and wallet adjustments.' },
      { type: 'divider' },
    ];
    if (!rows.length && safePage === 0) {
      blocks.push({ type: 'paragraph', text: 'No transactions yet.' });
    } else if (!rows.length) {
      blocks.push({ type: 'paragraph', text: 'There are no more transactions.' });
    } else {
      for (const item of rows) {
        blocks.push(transactionBlock(item));
        blocks.push({ type: 'divider' });
      }
    }

    const buttons = [];
    if (safePage > 0) buttons.push({ text: '‹ Newer', callback_data: `ps:history:${safePage - 1}` });
    if (rows.length === 8) buttons.push({ text: 'Older ›', callback_data: `ps:history:${safePage + 1}` });
    if (buttons.length) blocks.push({ type: 'buttons', buttons });
    blocks.push({ type: 'buttons', buttons: [{ text: '‹ Wallet', callback_data: 'ps:wallet', style: 'link' }] });
    return { blocks };
  } catch (error) {
    console.error('Transaction history unavailable:', error?.description || error?.message || 'database not ready');
    return {
      blocks: [
        { type: 'heading', size: 1, text: 'Transaction history' },
        { type: 'paragraph', text: 'Transaction history is being prepared. Please check back soon.' },
        { type: 'buttons', buttons: [{ text: '‹ Wallet', callback_data: 'ps:wallet', style: 'link' }] },
      ],
    };
  }
}

export async function adminTransactionsMessage(page = 0) {
  const safePage = Math.max(0, Math.min(1000, Number(page) || 0));
  const rows = await db.select().from(walletTransactions)
    .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
    .limit(10)
    .offset(safePage * 10)
    .all();
  const blocks = [
    { type: 'heading', size: 1, text: 'Recent transactions' },
    { type: 'paragraph', text: 'Latest customer wallet activity.' },
    { type: 'divider' },
  ];
  if (!rows.length) {
    blocks.push({ type: 'paragraph', text: 'No transactions have been recorded.' });
  } else {
    for (const item of rows) {
      blocks.push(transactionBlock(item, true));
      blocks.push({ type: 'divider' });
    }
  }
  const buttons = [];
  if (safePage > 0) buttons.push({ text: '‹ Newer', callback_data: `ps:admin:transactions:${safePage - 1}` });
  if (rows.length === 10) buttons.push({ text: 'Older ›', callback_data: `ps:admin:transactions:${safePage + 1}` });
  if (buttons.length) blocks.push({ type: 'buttons', buttons });
  blocks.push({ type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] });
  return { blocks };
}
