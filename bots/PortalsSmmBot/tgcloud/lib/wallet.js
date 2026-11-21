import { db } from 'sdk';
import { desc, eq, ne, or, sql, sum } from 'sdk/db';
import { walletLedger, walletTransactions } from '../schema.js';


export async function createWalletTransaction({
  userId,
  kind,
  title,
  points = 0,
  stars = 0,
  reference = null,
  idempotencyKey,
}) {
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) throw new Error('Invalid user.');
  if (!idempotencyKey || typeof idempotencyKey !== 'string') throw new Error('A transaction reference is required.');
  const existing = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.idempotencyKey, idempotencyKey)).get();
  if (existing) return existing;
  const rows = await db.insert(walletTransactions).values({
    userId: Number(userId),
    kind: String(kind),
    status: 'pending',
    title: String(title).slice(0, 100),
    points: Number(points),
    stars: Number(stars),
    reference: reference == null ? null : String(reference).slice(0, 100),
    idempotencyKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing().returning().run();
  if (rows?.[0]) return rows[0];
  return db.select().from(walletTransactions)
    .where(eq(walletTransactions.idempotencyKey, idempotencyKey)).get();
}

export async function updateWalletTransaction(transactionId, status, reference = null) {
  const values = { status: String(status), updatedAt: new Date() };
  if (reference !== null) values.reference = String(reference);
  await db.update(walletTransactions).set(values)
    .where(eq(walletTransactions.id, Number(transactionId))).run();
}

export async function creditWalletPoints({
  userId,
  transactionId,
  amount,
  kind,
  idempotencyKey,
}) {
  const points = Number(amount);
  if (!Number.isSafeInteger(points) || points <= 0) throw new Error('Credit must be a positive whole number.');
  const rows = await db.insert(walletLedger).values({
    userId: Number(userId),
    transactionId: Number(transactionId),
    amount: points,
    kind: String(kind),
    idempotencyKey: String(idempotencyKey),
    createdAt: new Date(),
  }).onConflictDoNothing().returning().run();
  if (rows?.[0]) return { credited: true, duplicate: false };
  const existing = await db.select().from(walletLedger)
    .where(eq(walletLedger.idempotencyKey, String(idempotencyKey))).get();
  return { credited: Boolean(existing), duplicate: Boolean(existing) };
}

export async function debitWalletPoints({
  userId,
  transactionId,
  amount,
  kind,
  idempotencyKey,
}) {
  const points = Number(amount);
  if (!Number.isSafeInteger(points) || points <= 0) throw new Error('Debit must be a positive whole number.');
  const uid = Number(userId);
  const txId = Number(transactionId);
  const key = String(idempotencyKey);
  const result = await db.run(sql`
    INSERT INTO wallet_ledger
      (user_id, transaction_id, amount, kind, idempotency_key, created_at)
    SELECT ${uid}, ${txId}, ${-points}, ${String(kind)}, ${key}, unixepoch()
    WHERE COALESCE(
      (SELECT SUM(amount) FROM wallet_ledger WHERE user_id = ${uid}),
      0
    ) >= ${points}
    ON CONFLICT(idempotency_key) DO NOTHING
    RETURNING id
  `);
  if (Number(result?.rowsAffected) > 0) return { debited: true, duplicate: false };
  const existing = await db.select().from(walletLedger)
    .where(eq(walletLedger.idempotencyKey, key)).get();
  if (existing) return { debited: true, duplicate: true };
  return { debited: false, duplicate: false, reason: 'insufficient_funds' };
}

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

const customerHistoryFilter = or(ne(walletTransactions.kind, 'deposit'), ne(walletTransactions.status, 'pending'));

export async function walletMessage(userId) {
  try {
    const balanceRow = await db.select({ total: sum(walletLedger.amount) })
      .from(walletLedger)
      .where(eq(walletLedger.userId, Number(userId)))
      .get();
    const history = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.userId, Number(userId)), customerHistoryFilter)
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
      .where(eq(walletTransactions.userId, Number(userId)), customerHistoryFilter)
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
  try {
    const rows = await db.select().from(walletTransactions)
      .where(customerHistoryFilter)
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
  } catch (error) {
    console.error('Admin transaction history unavailable:', error?.description || error?.message || 'database not ready');
    return {
      blocks: [
        { type: 'heading', size: 1, text: 'Recent transactions' },
        { type: 'paragraph', text: 'Transaction records will appear here once the wallet is enabled.' },
        { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
      ],
    };
  }
}
