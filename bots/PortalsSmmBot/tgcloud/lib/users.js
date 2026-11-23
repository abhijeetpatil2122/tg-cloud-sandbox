import { db } from 'sdk';
import { eq, sql, sum } from 'sdk/db';

import { botUsers, walletTransactions, walletLedger, serviceOrders, providerServices } from '../schema.js';
import { createWalletTransaction, creditWalletPoints, debitWalletPoints, updateWalletTransaction } from './wallet.js';
import { isAdmin } from './admins.js';

export async function trackUser(user, chatType = 'private') {
  const userId = Number(user?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0 || user?.is_bot) return false;
  const now = new Date();
  try {
    await db.insert(botUsers).values({
      userId,
      username: user.username || null,
      firstName: user.first_name || null,
      lastName: user.last_name || null,
      languageCode: user.language_code || null,
      isBot: false,
      firstSeenAt: now,
      lastSeenAt: now,
      lastChatType: String(chatType || 'private'),
    }).onConflictDoUpdate({
      target: botUsers.userId,
      set: {
        username: user.username || null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        languageCode: user.language_code || null,
        lastSeenAt: now,
        lastChatType: String(chatType || 'private'),
      },
    }).run();
    return true;
  } catch (error) {
    console.error('User tracking unavailable (database migration may be pending):', error?.message || error);
    return false;
  }
}

export async function isUserBanned(userId) {
  try {
    const row = await db.select({ isBanned: botUsers.isBanned })
      .from(botUsers).where(eq(botUsers.userId, Number(userId))).get();
    return Boolean(row?.isBanned);
  } catch {
    return false;
  }
}

export async function setUserBanned(userId, banned, adminId) {
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Enter a valid Telegram user ID.');
  if (await isAdmin(id)) throw new Error('Administrator accounts cannot be banned through customer moderation.');
  const now = new Date();
  await db.insert(botUsers).values({
    userId: id,
    isBanned: Boolean(banned),
    firstSeenAt: now,
    lastSeenAt: now,
    lastChatType: 'unknown',
  }).onConflictDoUpdate({
    target: botUsers.userId,
    set: { isBanned: Boolean(banned) },
  }).run();
  return { userId: id, banned: Boolean(banned), adminId: Number(adminId) };
}

export async function adjustUserBalance({ userId, amount, direction, adminId, reason = '' }) {
  const id = Number(userId);
  const points = Number(amount);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Enter a valid Telegram user ID.');
  if (!Number.isSafeInteger(points) || points <= 0 || points > 100000000) throw new Error('Enter a whole-number amount between 1 and 100,000,000.');
  const isCredit = direction === 'add';
  if (!isCredit && direction !== 'remove') throw new Error('Invalid balance adjustment.');
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const transaction = await createWalletTransaction({
    userId: id,
    kind: 'admin_adjustment',
    title: isCredit ? 'Administrator balance credit' : 'Administrator balance debit',
    points: isCredit ? points : -points,
    reference: ('Admin ' + adminId + (reason ? ' · ' + reason : '')).slice(0, 100),
    idempotencyKey: 'admin-adjustment:' + suffix,
  });
  if (isCredit) {
    await creditWalletPoints({
      userId: id,
      transactionId: transaction.id,
      amount: points,
      kind: 'admin_balance_credit',
      idempotencyKey: 'admin-adjustment-credit:' + suffix,
    });
  } else {
    const result = await debitWalletPoints({
      userId: id,
      transactionId: transaction.id,
      amount: points,
      kind: 'admin_balance_debit',
      idempotencyKey: 'admin-adjustment-debit:' + suffix,
    });
    if (!result.debited) {
      await updateWalletTransaction(transaction.id, 'failed');
      throw new Error('Adjustment cancelled: the customer does not have enough USD.');
    }
  }
  await updateWalletTransaction(transaction.id, 'completed');
  return { transactionId: transaction.id, userId: id, points, direction: isCredit ? 'added' : 'removed' };
}

export async function adminStatsMessage() {
  const [users, payments, orders, services, points] = await Promise.all([
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS banned FROM bot_users`),
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded, SUM(CASE WHEN status IN ('needs_review','processing') THEN 1 ELSE 0 END) AS review, SUM(CASE WHEN status = 'completed' THEN stars ELSE 0 END) AS stars FROM wallet_transactions WHERE kind = 'deposit'`),
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM service_orders`),
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled, SUM(CASE WHEN customer_price IS NOT NULL AND customer_price > 0 THEN 1 ELSE 0 END) AS priced FROM provider_services WHERE is_telegram = 1`),
    db.get(sql`SELECT COALESCE(SUM(amount),0) AS outstanding FROM wallet_ledger`),
  ]);
  const table = (caption, rows) => ({ type: 'table', caption, is_bordered: true, is_compact: true, cells: [
    [{ text: 'Metric', is_header: true }, { text: 'Value', is_header: true }],
    ...rows.map(([label, value]) => [{ text: label }, { text: String(value ?? 0), align: 'right' }]),
  ] });
  return { blocks: [
    { type: 'heading', size: 1, text: 'Global bot statistics' },
    { type: 'paragraph', text: 'Live totals from the bot database. Payment totals count confirmed deposit records; refunded records are reported separately.' },
    table('Audience', [['Registered users', users?.total], ['Banned users', users?.banned]]),
    table('Telegram Stars payments', [['Deposit records', payments?.total], ['Confirmed deposits', payments?.completed], ['Refunded deposits', payments?.refunded], ['Needs review', payments?.review], ['Confirmed Stars volume', payments?.stars]]),
    table('Service operations', [['Orders recorded', orders?.total], ['Completed orders', orders?.completed], ['Telegram services', services?.total], ['Priced services', services?.priced], ['Enabled services', services?.enabled]]),
    { type: 'paragraph', text: 'Net USD wallet balance across all customers: ' + Number(points?.outstanding || 0).toLocaleString('en-IN') },
    { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
  ] };
}
