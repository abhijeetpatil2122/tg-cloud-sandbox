import { api, db } from 'sdk';
import { eq, sql, sum } from 'sdk/db';
import { FEATURES, REFERRALS } from './config.js';
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

export async function attributeReferral(userId, startArgument = '') {
  const match = String(startArgument || '').match(/^ref_(\d{5,15})$/);
  if (!match) return false;
  const referredBy = Number(match[1]);
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(referredBy) || id <= 0 || referredBy <= 0 || id === referredBy) return false;
  try {
    const [existing, referrer] = await Promise.all([
      db.select().from(botUsers).where(eq(botUsers.userId, id)).get(),
      db.select().from(botUsers).where(eq(botUsers.userId, referredBy)).get(),
    ]);
    if (!existing || existing.referredBy || !referrer || referrer.isBanned) return false;
    await db.update(botUsers).set({ referredBy })
      .where(eq(botUsers.userId, id)).run();
    return true;
  } catch (error) {
    console.error('Referral attribution unavailable:', error?.message || error);
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
      throw new Error('Adjustment cancelled: the customer does not have enough Portal Points.');
    }
  }
  await updateWalletTransaction(transaction.id, 'completed');
  return { transactionId: transaction.id, userId: id, points, direction: isCredit ? 'added' : 'removed' };
}

export async function referralMessage(userId) {
  const id = Number(userId);
  const [me, _row, invited, rewards] = await Promise.all([
    api.getMe(),
    db.select().from(botUsers).where(eq(botUsers.userId, id)).get(),
    db.select().from(botUsers).where(eq(botUsers.referredBy, id)).all(),
    db.select().from(walletTransactions).where(eq(walletTransactions.userId, id)).all(),
  ]);
  const username = String(me?.username || '').replace(/^@/, '');
  const link = username ? 'https://t.me/' + username + '?start=ref_' + id : '';
  const rewardRows = rewards.filter(item => item.kind === 'referral_reward' && item.status === 'completed');
  const earned = rewardRows.reduce((total, item) => total + Math.max(0, Number(item.points) || 0), 0);
  const active = FEATURES.referralsEnabled && Number(REFERRALS.minimumQualifyingStars) > 0;
  return { blocks: [
    { type: 'heading', size: 1, text: 'Referral programme' },
    { type: 'paragraph', text: active
      ? 'Invite people with your personal link. A reward is credited after their first successful deposit that meets the minimum requirement.'
      : 'Your referral link and invite tracking are being prepared. Reward payouts remain disabled until the qualifying deposit threshold is configured.' },
    ...(link ? [
      { type: 'paragraph', text: [{ type: 'bold', text: 'Your invite link' }, '\n' + link] },
      { type: 'buttons', buttons: [{ text: 'Share invite link', url: 'https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent('Join Portals SMM') , style: 'primary' }] },
    ] : [{ type: 'paragraph', text: 'The bot username is not available yet. Please try again later.' }]),
    { type: 'table', caption: 'Your referral summary', is_bordered: true, is_compact: true, cells: [
      [{ text: 'Metric', is_header: true }, { text: 'Total', is_header: true }],
      [{ text: 'Invited users' }, { text: String(invited.length), align: 'right' }],
      [{ text: 'Rewards earned' }, { text: earned.toLocaleString('en-IN') + ' Portal Points', align: 'right' }],
      [{ text: 'Reward rate' }, { text: String(REFERRALS.rewardPercent) + '%', align: 'right' }],
    ] },
    { type: 'details', summary: 'How referrals qualify', blocks: [
      { type: 'paragraph', text: 'Only the first qualifying successful Stars deposit counts. Self-referrals are rejected, attribution cannot be replaced, and duplicate payment updates cannot create duplicate rewards.' },
    ] },
    { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
  ] };
}

export async function creditReferralReward(referredUserId, stars, depositedPoints) {
  const minimum = Number(REFERRALS.minimumQualifyingStars);
  if (!FEATURES.referralsEnabled || !Number.isSafeInteger(minimum) || minimum <= 0 || Number(stars) < minimum) return null;
  const referred = await db.select().from(botUsers).where(eq(botUsers.userId, Number(referredUserId))).get();
  const referrerId = Number(referred?.referredBy || 0);
  if (!referrerId || referrerId === Number(referredUserId) || referred.referralRewardedAt) return null;
  const rewardPoints = Math.floor(Number(depositedPoints) * Number(REFERRALS.rewardPercent) / 100);
  if (!Number.isSafeInteger(rewardPoints) || rewardPoints <= 0) return null;
  const transaction = await createWalletTransaction({
    userId: referrerId,
    kind: 'referral_reward',
    title: 'Referral deposit reward',
    points: rewardPoints,
    reference: 'Referred user ' + Number(referredUserId),
    idempotencyKey: 'referral-first-deposit:' + Number(referredUserId),
  });
  const credit = await creditWalletPoints({
    userId: referrerId,
    transactionId: transaction.id,
    amount: rewardPoints,
    kind: 'referral_reward',
    idempotencyKey: 'referral-first-deposit-ledger:' + Number(referredUserId),
  });
  await updateWalletTransaction(transaction.id, 'completed');
  await db.update(botUsers).set({ referralRewardedAt: new Date() })
    .where(eq(botUsers.userId, Number(referredUserId))).run();
  try {
    await api.sendMessage({
      chat_id: referrerId,
      text: 'Your referral reward has been credited: ' + rewardPoints + ' Portal Points.',
    });
  } catch (error) {
    console.error('Referral reward notification failed:', error?.description || error);
  }
  return { referrerId, rewardPoints, duplicate: credit.duplicate };
}

export async function adminStatsMessage() {
  const [users, payments, orders, services, points, referralStats] = await Promise.all([
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS banned FROM bot_users`),
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) AS refunded, SUM(CASE WHEN status IN ('needs_review','processing') THEN 1 ELSE 0 END) AS review, SUM(CASE WHEN status = 'completed' THEN stars ELSE 0 END) AS stars FROM wallet_transactions WHERE kind = 'deposit'`),
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed FROM service_orders`),
    db.get(sql`SELECT COUNT(*) AS total, SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled, SUM(CASE WHEN customer_price IS NOT NULL AND customer_price > 0 THEN 1 ELSE 0 END) AS priced FROM provider_services WHERE is_telegram = 1`),
    db.get(sql`SELECT COALESCE(SUM(amount),0) AS outstanding FROM wallet_ledger`),
    db.get(sql`SELECT COUNT(*) AS referred, (SELECT COALESCE(SUM(points),0) FROM wallet_transactions WHERE kind = 'referral_reward' AND status = 'completed') AS points FROM bot_users WHERE referred_by IS NOT NULL`),
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
    table('Referral activity', [['Attributed users', referralStats?.referred], ['Referral rewards issued (points)', referralStats?.points]]),
    { type: 'paragraph', text: 'Net Portal Points ledger balance across all customers: ' + Number(points?.outstanding || 0).toLocaleString('en-IN') },
    { type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] },
  ] };
}
