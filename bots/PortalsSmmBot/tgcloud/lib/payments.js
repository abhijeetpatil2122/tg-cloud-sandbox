import { api, db } from 'sdk';
import { desc, eq, sql, sum } from 'sdk/db';
import { FEATURES, WALLET } from './config.js';
import { depositIntents, walletLedger, walletTransactions, termsAcceptances } from '../schema.js';
import { createWalletTransaction, creditWalletPoints, debitWalletPoints, updateWalletTransaction } from './wallet.js';
import { sendRich } from './ui.js';
import { listAdmins } from './admins.js';
import { isUserBanned } from './users.js';

export const DEPOSIT_PACKAGES = [80, 160, 400, 4000, 8000];

export const TERMS_VERSION = '2026-11-23';

export async function hasAcceptedTerms(userId) {
  const row = await db.select().from(termsAcceptances)
    .where(eq(termsAcceptances.userId, Number(userId))).get();
  return Boolean(row && row.version === TERMS_VERSION);
}

export async function acceptStoreTerms(userId) {
  await db.insert(termsAcceptances).values({
    userId: Number(userId),
    version: TERMS_VERSION,
    acceptedAt: new Date(),
  }).onConflictDoUpdate({
    target: termsAcceptances.userId,
    set: { version: TERMS_VERSION, acceptedAt: new Date() },
  }).run();
}

export function termsAcceptanceMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '📜 Before you deposit' },
    { type: 'paragraph', text: 'Please review the store terms before adding wallet funds.' },
    { type: 'buttons', buttons: [{ text: 'Read store terms', callback_data: 'ps:terms', style: 'primary' }] },
    { type: 'buttons', buttons: [{ text: '✓ I agree — continue', callback_data: 'ps:deposit:accept', style: 'success' }] },
    { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
  ] };
}

export function termsMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '📜 Portals SMM — Store terms' },
    { type: 'paragraph', text: 'Please read these terms before using the store. They explain payments, store credit, service requirements and support.' },
    { type: 'heading', size: 2, text: '1. ⭐ Payments' },
    { type: 'list', items: [
      { blocks: [{ type: 'paragraph', text: 'Payments are accepted in Telegram Stars (XTR).' }] },
      { blocks: [{ type: 'paragraph', text: 'A deposit is credited only after Telegram sends a verified successful payment receipt.' }] },
      { blocks: [{ type: 'paragraph', text: 'An invoice, payment attempt, screenshot or pre-checkout approval is not proof of payment.' }] },
    ] },
    { type: 'table', caption: 'Wallet conversion', is_bordered: true, is_compact: true, cells: [
      [{ text: 'Telegram Stars', is_header: true }, { text: 'USD balance', is_header: true }],
      [{ text: '80 Stars' }, { text: [{ type: 'bold', text: '$1.00' }] }],
      [{ text: '160 Stars' }, { text: [{ type: 'bold', text: '$2.00' }] }],
      [{ text: '400 Stars' }, { text: [{ type: 'bold', text: '$5.00' }] }],
      [{ text: '4,000 Stars' }, { text: [{ type: 'bold', text: '$50.00' }] }],
      [{ text: '8,000 Stars' }, { text: [{ type: 'bold', text: '$100.00' }] }],
    ] },
    { type: 'heading', size: 2, text: '2. 💼 USD wallet balance' },
    { type: 'paragraph', text: 'The USD figure is an internal wallet accounting balance, not a bank deposit or cash withdrawal.' },
    { type: 'heading', size: 2, text: '3. 📈 Services and orders' },
    { type: 'list', items: [
      { blocks: [{ type: 'paragraph', text: 'Each service has its own target format, quantity limits, capabilities and delivery conditions.' }] },
      { blocks: [{ type: 'paragraph', text: 'Review the service description and price before placing an order.' }] },
      { blocks: [{ type: 'paragraph', text: 'Never provide Telegram passwords, login codes, recovery codes or account credentials.' }] },
      { blocks: [{ type: 'paragraph', text: 'Delivery estimates are estimates; platform changes and supplier conditions can affect completion.' }] },
    ] },
    { type: 'heading', size: 2, text: '4. ↩️ Refunds and payment issues' },
    { type: 'paragraph', text: 'Telegram Stars payment refunds are reviewed against the original Telegram charge and the USD balance credited. Where a refund is approved, the corresponding wallet funds are reversed. A refund may be blocked if the credited wallet funds have already been spent.' },
    { type: 'paragraph', text: 'For failed deposits, missing credits or refund questions, contact @roexe with the transaction reference. Never pay again while an earlier payment is under review.' },
    { type: 'heading', size: 2, text: '5. 🛡️ Fair use and account safety' },
    { type: 'list', items: [
      { blocks: [{ type: 'paragraph', text: 'Fake accounts, fraudulent payments and attempts to exploit the service are prohibited.' }] },
      { blocks: [{ type: 'paragraph', text: 'Do not use the service for unlawful activity or to violate Telegram or third-party platform rules.' }] },
      { blocks: [{ type: 'paragraph', text: 'We may review suspicious activity where abuse is reasonably suspected.' }] },
    ] },
    { type: 'details', summary: 'Need help or have a payment dispute?', blocks: [
      { type: 'paragraph', text: 'Contact @roexe with the payment reference, amount and approximate time. Do not share passwords, login codes or private credentials.' },
    ] },
    { type: 'footer', text: 'By selecting “I agree”, you confirm that you have read and accepted these store terms.' },
    { type: 'buttons', buttons: [{ text: '✓ I agree — continue', callback_data: 'ps:deposit:accept', style: 'success' }] },
    { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
  ] };
}

function makePayload(userId) {
  // Opaque database reference, not an authorization token.
  return 'psd_' + userId + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 14);
}

async function notifyAdmins(message) {
  try {
    const ids = await listAdmins();
    await Promise.all(ids.map(id => api.sendMessage({ chat_id: id, text: message }).catch(error => {
      console.error('Payment admin notification failed:', error?.description || error);
    })));
  } catch (error) {
    console.error('Payment admin list unavailable:', error?.description || error);
  }
}

export function depositUnavailableMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '⭐ Stars deposit' },
    { type: 'paragraph', text: 'Stars deposits are temporarily unavailable. Your balance is never credited from a screenshot or payment attempt — only Telegram’s confirmed receipt counts.' },
    { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
  ] };
}

export function depositMessage() {
  return { blocks: [
    { type: 'heading', size: 1, text: '⭐ Add funds' },
    { type: 'paragraph', text: 'Pay with Telegram Stars. 80 Stars = $1.00 in your wallet. Gram holders can buy Stars through Fragment, then use those Stars here.' },
    { type: 'divider' },
    { type: 'paragraph', text: 'Choose a package:' },
    { type: 'buttons', buttons: [
      { text: '80 ⭐ · $1', callback_data: 'ps:deposit:80' },
      { text: '160 ⭐ · $2', callback_data: 'ps:deposit:160' },
      { text: '400 ⭐ · $5', callback_data: 'ps:deposit:400' },
    ] },
    { type: 'buttons', buttons: [
      { text: '4,000 ⭐ · $50', callback_data: 'ps:deposit:4000' },
      { text: '8,000 ⭐ · $100', callback_data: 'ps:deposit:8000' },
    ] },
    { type: 'paragraph', text: 'Custom amounts are disabled. Choose one of the listed packages.' },
    { type: 'footer', text: '⭐ Payments are processed by Telegram. Your USD balance is internal store credit.' },
    { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
  ] };
}

export async function createStarsInvoice(userId, chatId, stars) {
  const amount = Number(stars);
  if (!FEATURES.depositsEnabled) throw new Error('Stars deposits are not enabled yet.');
  if (!await hasAcceptedTerms(userId)) throw new Error('Please read and accept the store terms before depositing.');
  if (!Number.isSafeInteger(amount) || !DEPOSIT_PACKAGES.includes(amount)) {
    throw new Error('Choose one of the available Stars packages.');
  }
  if (amount % Number(WALLET.starsPerDollar) !== 0) throw new Error('80 Stars = $1. Choose a whole-dollar package.');
  const points = amount / Number(WALLET.starsPerDollar);
  if (!Number.isSafeInteger(points) || points <= 0) throw new Error('The deposit amount is invalid.');

  const payload = makePayload(userId);
  const transaction = await createWalletTransaction({
    userId,
    kind: 'deposit',
    title: 'Telegram Stars deposit',
    points,
    stars: amount,
    idempotencyKey: 'deposit:' + payload,
  });

  await db.insert(depositIntents).values({
    userId: Number(userId),
    payload,
    stars: amount,
    points,
    transactionId: transaction.id,
    status: 'pending',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).run();

  try {
    return await api.sendInvoice({
      chat_id: chatId,
      title: 'USD wallet balance',
      description: amount + ' Telegram Stars add $' + points + ' to your wallet.',
      payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: '$' + points + ' wallet balance', amount }],
    });
  } catch (error) {
    await db.update(depositIntents).set({ status: 'failed', updatedAt: new Date() })
      .where(eq(depositIntents.payload, payload)).run();
    await updateWalletTransaction(transaction.id, 'failed');
    throw error;
  }
}

export async function validatePreCheckout(query) {
  let ok = false;
  try {
    const intent = await db.select().from(depositIntents)
      .where(eq(depositIntents.payload, String(query.invoice_payload || ''))).get();
    const expiry = intent?.expiresAt instanceof Date
      ? intent.expiresAt.getTime()
      : Number(intent?.expiresAt || 0) * 1000;
    const banned = await isUserBanned(query.from?.id);
    ok = Boolean(
      !banned &&
      intent &&
      intent.status === 'pending' &&
      Number(intent.userId) === Number(query.from?.id) &&
      query.currency === 'XTR' &&
      Number(query.total_amount) === Number(intent.stars) &&
      expiry > Date.now()
    );
  } catch (error) {
    console.error('Pre-checkout validation failed:', error?.description || error?.message || error);
  }

  await api.answerPreCheckoutQuery(ok
    ? { pre_checkout_query_id: query.id, ok: true }
    : {
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: 'This invoice is no longer valid. Please create a new deposit.',
      });
}

export async function handleSuccessfulPayment(message) {
  const payment = message?.successful_payment;
  const userId = Number(message?.from?.id);
  if (!payment || !userId) return false;

  const payload = String(payment.invoice_payload || '');
  const chargeId = String(payment.telegram_payment_charge_id || '');
  let intent = null;

  try {
    intent = await db.select().from(depositIntents)
      .where(eq(depositIntents.payload, payload)).get();

    const valid = Boolean(
      intent &&
      Number(intent.userId) === userId &&
      (intent.status === 'pending' || (intent.status === 'completed' && intent.telegramChargeId === chargeId)) &&
      payment.currency === 'XTR' &&
      Number(payment.total_amount) === Number(intent.stars) &&
      Number(intent.points) === Number(intent.stars) / Number(WALLET.starsPerDollar) &&
      chargeId
    );

    if (!valid) {
      if (intent) {
        await db.update(depositIntents).set({ status: 'needs_review', updatedAt: new Date() })
          .where(eq(depositIntents.id, intent.id)).run();
        await updateWalletTransaction(intent.transactionId, 'needs_review', chargeId || null);
      }
      await notifyAdmins('⚠️ Payment needs review\nUser: ' + userId + '\nPayload: ' + payload.slice(0, 60) + '\nStars: ' + (Number(payment.total_amount) || 0) + '\nReceipt did not match a pending deposit. No wallet funds were credited.');
      await sendRich(message.chat.id, { blocks: [
        { type: 'heading', size: 1, text: '⚠️ Payment under review' },
        { type: 'paragraph', text: 'Telegram confirmed a payment, but the deposit details need administrator review. Contact @roexe if you need help.' },
      ] });
      return true;
    }

    const credit = await creditWalletPoints({
      userId,
      transactionId: intent.transactionId,
      amount: intent.points,
      kind: 'stars_deposit',
      idempotencyKey: 'telegram-stars:' + chargeId,
    });

    await db.update(depositIntents).set({
      status: 'completed',
      telegramChargeId: chargeId,
      updatedAt: new Date(),
    }).where(eq(depositIntents.id, intent.id)).run();
    await updateWalletTransaction(intent.transactionId, 'completed', chargeId);

    await sendRich(message.chat.id, { blocks: [
      { type: 'heading', size: 1, text: '⭐ Payment received' },
      { type: 'paragraph', text: intent.stars + ' Stars received\n$' + intent.points + ' USD ' + (credit.duplicate ? 'were already credited' : 'have been added') + ' to your wallet.' },
      { type: 'paragraph', text: 'Payment reference: ' + chargeId.slice(0, 28) },
      { type: 'buttons', buttons: [
        { text: '💼 Open wallet', callback_data: 'ps:wallet', style: 'primary' },
        { text: '🧾 Transaction history', callback_data: 'ps:history' },
      ] },
    ] });

    await notifyAdmins('⭐ Stars deposit confirmed\nUser: ' + userId + '\nStars: ' + intent.stars + '\nUSD credited: $' + intent.points + '\nTransaction: #' + intent.transactionId + '\nCharge: ' + chargeId);
    return true;
  } catch (error) {
    console.error('Successful payment processing failed:', error?.description || error?.stack || error);
    if (intent) {
      try {
        await db.update(depositIntents).set({ status: 'needs_review', updatedAt: new Date() })
          .where(eq(depositIntents.id, intent.id)).run();
        await updateWalletTransaction(intent.transactionId, 'needs_review', chargeId || null);
      } catch (recordError) {
        console.error('Could not mark paid deposit for review:', recordError?.description || recordError);
      }
    }
    await notifyAdmins('🚨 A Telegram Stars receipt could not be fully processed.\nUser: ' + userId + '\nPayload: ' + payload.slice(0, 60) + '\nCharge: ' + chargeId.slice(0, 28) + '\nReview the payment before making any manual wallet adjustment.');
    try {
      await sendRich(message.chat.id, { blocks: [
        { type: 'heading', size: 1, text: '⚠️ Payment received — review required' },
        { type: 'paragraph', text: 'Telegram confirmed your payment. The wallet update needs administrator review; please do not pay again. Contact @roexe for assistance.' },
      ] });
    } catch {}
    return true;
  }
}

async function depositChargeRecord(transaction) {
  const intent = await db.select().from(depositIntents)
    .where(eq(depositIntents.transactionId, Number(transaction.id))).get();
  const intentCharge = String(intent?.telegramChargeId || '').trim();
  const transactionCharge = String(transaction.reference || '').trim();
  const chargeId = intentCharge || (transactionCharge && !/^Deposit #/i.test(transactionCharge) ? transactionCharge : '');
  return { intent, chargeId };
}

export async function adminRefundsMessage(page = 0) {
  const safePage = Math.max(0, Math.min(1000, Number(page) || 0));
  const all = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.kind, 'deposit'))
    .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id)).all();
  const eligible = [];
  for (const item of all) {
    if (item.status !== 'completed' || Number(item.points) <= 0) continue;
    const charge = await depositChargeRecord(item);
    if (charge.chargeId) eligible.push(item);
  }
  const start = safePage * 6;
  const visible = eligible.slice(start, start + 6);
  const blocks = [
    { type: 'heading', size: 1, text: '↩️ Stars refunds' },
    { type: 'paragraph', text: 'Select a completed deposit. A refund is available only while the credited USD balance remains in the customer wallet.' },
    { type: 'divider' },
  ];
  if (!visible.length) blocks.push({ type: 'paragraph', text: 'No refundable deposits are available on this page.' });
  for (const item of visible) {
    const { chargeId } = await depositChargeRecord(item);
    blocks.push({ type: 'paragraph', text: '#' + item.id + ' · User ' + item.userId + '\n' + item.stars + ' Stars · ' + item.points + ' USD balance\nCharge: ' + chargeId.slice(0, 28) });
    blocks.push({ type: 'buttons', buttons: [{ text: 'Review refund #' + item.id, callback_data: 'ps:admin:refund:' + item.id, style: 'danger' }] });
  }
  const nav = [];
  if (safePage > 0) nav.push({ text: '‹ Previous', callback_data: 'ps:admin:refunds:' + (safePage - 1) });
  if (start + 6 < eligible.length) nav.push({ text: 'Next ›', callback_data: 'ps:admin:refunds:' + (safePage + 1) });
  if (nav.length) blocks.push({ type: 'buttons', buttons: nav });
  blocks.push({ type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] });
  return { blocks };
}

export async function refundPreviewMessage(transactionId) {
  const item = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.id, Number(transactionId))).get();
  if (!item || item.kind !== 'deposit' || item.status !== 'completed') {
    return { blocks: [
      { type: 'heading', size: 1, text: '↩️ Refund unavailable' },
      { type: 'paragraph', text: 'This transaction is not an eligible confirmed Stars deposit.' },
      { type: 'buttons', buttons: [{ text: '‹ Refunds', callback_data: 'ps:admin:refunds', style: 'link' }] },
    ] };
  }
  const { chargeId } = await depositChargeRecord(item);
  if (!chargeId) return { blocks: [
    { type: 'heading', size: 1, text: '↩️ Refund unavailable' },
    { type: 'paragraph', text: 'The original Telegram charge ID is missing from this deposit record. No wallet funds were reserved and no refund request was sent. Reconcile the original successful_payment receipt first.' },
    { type: 'buttons', buttons: [{ text: '‹ Refunds', callback_data: 'ps:admin:refunds', style: 'link' }] },
  ] };
  const balanceRow = await db.select({ total: sum(walletLedger.amount) })
    .from(walletLedger)
    .where(eq(walletLedger.userId, Number(item.userId))).get();
  const balance = Number(balanceRow?.total || 0);
  const enoughPoints = balance >= Number(item.points);
  const blocks = [
    { type: 'heading', size: 1, text: '⚠️ Review Stars refund' },
    { type: 'table', caption: 'Deposit #' + item.id, is_bordered: true, is_compact: true, cells: [
      [{ text: 'Field', is_header: true }, { text: 'Value', is_header: true }],
      [{ text: 'Customer' }, { text: String(item.userId) }],
      [{ text: 'Original payment' }, { text: Number(item.stars) + ' Stars' }],
      [{ text: 'Points to reverse' }, { text: '$' + Number(item.points) }],
      [{ text: 'Current wallet balance' }, { text: '$' + balance }],
      [{ text: 'Telegram charge ID' }, { text: chargeId.slice(0, 40) }],
    ] },
    { type: 'paragraph', text: enoughPoints
      ? 'The customer currently has enough funds for the full wallet reversal.'
      : 'Refund is blocked because the customer has spent some of the credited funds. Available balance: $' + balance + '. Required: $' + item.points + '.' },
    { type: 'details', summary: 'What happens when you confirm?', blocks: [
      { type: 'list', items: [
        { blocks: [{ type: 'paragraph', text: 'Telegram is asked to refund the original Stars charge.' }] },
        { blocks: [{ type: 'paragraph', text: 'The credited USD wallet balance is reversed in the wallet ledger.' }] },
        { blocks: [{ type: 'paragraph', text: 'The original deposit and refund are retained in transaction history.' }] },
      ] },
    ] },
  ];
  if (enoughPoints) blocks.push({ type: 'buttons', buttons: [{ text: 'Confirm full refund', callback_data: 'ps:admin:refund:confirm:' + item.id, style: 'danger' }] });
  blocks.push({ type: 'buttons', buttons: [{ text: '‹ Back to refunds', callback_data: 'ps:admin:refunds', style: 'link' }] });
  return { blocks };
}
export async function refundStarsDeposit(transactionId, adminId) {
  const original = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.id, Number(transactionId))).get();
  if (!original || original.kind !== 'deposit' || Number(original.stars) <= 0) {
    throw new Error('This is not a valid Telegram Stars deposit.');
  }
  if (original.status === 'refunded') return { refunded: true, duplicate: true };
  if (original.status !== 'completed') throw new Error('Only confirmed, unrefunded deposits can be refunded.');
  const { intent: sourceIntent, chargeId } = await depositChargeRecord(original);
  console.log('Stars refund charge lookup:', sourceIntent?.telegramChargeId ? 'deposit_intent' : 'wallet_reference', 'length=' + chargeId.length);
  if (!chargeId) {
    throw new Error('The original Telegram charge ID is missing. No points were reserved and Telegram was not called. The payment receipt must be reconciled first.');
  }

  let refundTransaction = await createWalletTransaction({
    userId: original.userId,
    kind: 'refund',
    title: 'Telegram Stars refund',
    points: -Number(original.points),
    stars: Number(original.stars),
    reference: 'Deposit #' + original.id,
    idempotencyKey: 'refund:' + original.id,
  });
  if (refundTransaction.status === 'completed') return { refunded: true, duplicate: true };

  // A previous version marked every Telegram 400 response as failed, including
  // CHARGE_ALREADY_REFUNDED. Permit a controlled retry of failed attempts with
  // a fresh ledger idempotency key; never retry processing/needs_review states.
  if (refundTransaction.status === 'failed') {
    const retry = await db.run(
      'UPDATE wallet_transactions SET status = :pending, reference = :reference, updated_at = unixepoch() WHERE id = :id AND status = :failed',
      {
        ':pending': 'pending',
        ':reference': 'Deposit #' + original.id + ' · retry pending',
        ':id': refundTransaction.id,
        ':failed': 'failed',
      },
    );
    if (Number(retry?.rowsAffected) !== 1) {
      throw new Error('Another administrator is already retrying this refund.');
    }
    refundTransaction = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.id, refundTransaction.id)).get();
  }
  if (refundTransaction.status !== 'pending') {
    throw new Error('A previous refund attempt is still being processed or needs reconciliation. Do not retry it.');
  }

  const attemptId = Math.random().toString(36).slice(2, 12);
  await updateWalletTransaction(refundTransaction.id, 'pending', 'Deposit #' + original.id + ' · attempt ' + attemptId);
  const lock = await db.run(
    'UPDATE wallet_transactions SET status = :processing, updated_at = unixepoch() WHERE id = :id AND status = :pending',
    { ':processing': 'processing', ':id': refundTransaction.id, ':pending': 'pending' },
  );
  if (Number(lock?.rowsAffected) !== 1) {
    throw new Error('Another administrator is already processing this refund.');
  }

  let debit;
  try {
    debit = await debitWalletPoints({
      userId: original.userId,
      transactionId: refundTransaction.id,
      amount: Number(original.points),
      kind: 'stars_refund_hold',
      idempotencyKey: 'refund-hold:' + original.id + ':' + attemptId,
    });
  } catch (error) {
    await updateWalletTransaction(refundTransaction.id, 'needs_review');
    await notifyAdmins('🚨 Refund wallet hold failed\nAdmin: ' + adminId + '\nCustomer: ' + original.userId + '\nDeposit: #' + original.id + '\nError: ' + String(error?.description || error?.message || error).slice(0, 220));
    throw new Error('The wallet could not safely reserve the funds for this refund. Administrator review is required.');
  }
  if (!debit.debited) {
    await updateWalletTransaction(refundTransaction.id, 'pending');
    throw new Error('Refund blocked: the customer has spent some of the credited USD balance. Restore the required balance before retrying.');
  }

  let telegramConfirmed = false;
  let telegramAlreadyRefunded = false;
  try {
    const result = await api.refundStarPayment({
      user_id: Number(original.userId),
      telegram_payment_charge_id: chargeId,
    });
    telegramConfirmed = result === true;
    if (!telegramConfirmed) throw new Error('Telegram did not confirm the refund.');
  } catch (error) {
    const description = String(error?.description || error?.message || '');
    const code = Number(error?.code || 0);
    if (/CHARGE_ALREADY_REFUNDED/i.test(description)) {
      telegramConfirmed = true;
      telegramAlreadyRefunded = true;
    } else if (code >= 400 && code < 500) {
      await creditWalletPoints({
        userId: original.userId,
        transactionId: refundTransaction.id,
        amount: Number(original.points),
        kind: 'refund_hold_release',
        idempotencyKey: 'refund-release:' + original.id + ':' + attemptId,
      });
      await updateWalletTransaction(refundTransaction.id, 'failed');
      const reason = description ? ' Telegram response: ' + description.slice(0, 220) : '';
      throw new Error('Telegram rejected the refund. The wallet hold has been released.' + reason);
    } else {
      await updateWalletTransaction(refundTransaction.id, 'needs_review');
      await notifyAdmins('🚨 Refund needs reconciliation\nAdmin: ' + adminId + '\nCustomer: ' + original.userId + '\nDeposit: #' + original.id + '\nTelegram method: ' + String(error?.method || 'refundStarPayment') + '\nError: ' + description.slice(0, 220) + '\nThe wallet reversal remains held. Check Telegram Stars transactions before retrying.');
      throw new Error('Telegram refund status is uncertain. The points remain held for administrator review; do not retry yet.');
    }
  }

  if (!telegramConfirmed) {
    await updateWalletTransaction(refundTransaction.id, 'needs_review');
    throw new Error('Telegram refund status could not be confirmed. Administrator review is required.');
  }

  try {
    await db.update(walletTransactions).set({ status: 'refunded', updatedAt: new Date() })
      .where(eq(walletTransactions.id, original.id)).run();
    await updateWalletTransaction(refundTransaction.id, 'completed', 'Deposit #' + original.id);
    if (sourceIntent?.id) {
      await db.update(depositIntents).set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(depositIntents.id, Number(sourceIntent.id))).run();
    } else {
      await db.update(depositIntents).set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(depositIntents.telegramChargeId, chargeId)).run();
    }
  } catch (error) {
    await updateWalletTransaction(refundTransaction.id, 'needs_review');
    await notifyAdmins('🚨 Telegram refunded Stars, but local refund reconciliation failed.\nAdmin: ' + adminId + '\nCustomer: ' + original.userId + '\nDeposit: #' + original.id + '\nError: ' + String(error?.description || error?.message || error).slice(0, 220) + '\nManually reconcile local transaction status; do not call refundStarPayment again.');
    throw new Error('Telegram refund was accepted, but local records need administrator reconciliation. Do not retry.');
  }

  try {
    await api.sendMessage({
      chat_id: Number(original.userId),
      text: '↩️ Your Telegram Stars payment has been refunded. ' + original.stars + ' Stars were returned and ' + original.points + ' USD balance was reversed.',
    });
  } catch (notifyError) {
    console.error('Refund customer notification failed:', notifyError?.description || notifyError?.message || notifyError);
  }
  await notifyAdmins('↩️ Stars refund completed\nAdmin: ' + adminId + '\nCustomer: ' + original.userId + '\nDeposit: #' + original.id + '\nStars: ' + original.stars + (telegramAlreadyRefunded ? '\nTelegram reported that this charge was already refunded; local records were reconciled.' : ''));
  return { refunded: true, duplicate: telegramAlreadyRefunded };
}

export async function adminPaymentsMessage(filter = 'confirmed', page = 0) {
  const filters = {
    confirmed: { title: 'Confirmed payments', statuses: ['completed'] },
    review: { title: 'Payments needing review', statuses: ['needs_review', 'processing'] },
    refunded: { title: 'Refunded payments', statuses: ['refunded'] },
    failed: { title: 'Failed payments', statuses: ['failed'] },
  };
  const selected = filters[filter] || filters.confirmed;
  const safePage = Math.max(0, Math.min(1000, Number(page) || 0));
  const deposits = await db.select().from(walletTransactions)
    .where(eq(walletTransactions.kind, 'deposit'))
    .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
    .all();
  const matching = deposits.filter(item => selected.statuses.includes(item.status) && item.reference);
  const visible = matching.slice(safePage * 6, safePage * 6 + 6);
  const blocks = [
    { type: 'heading', size: 1, text: '⭐ ' + selected.title },
    { type: 'paragraph', text: 'Only Telegram-confirmed payment records are treated as paid deposits. Unpaid invoice attempts are not shown here.' },
    { type: 'buttons', buttons: [
      { text: 'Confirmed', callback_data: 'ps:admin:payments:confirmed:0', style: filter === 'confirmed' ? 'primary' : 'link' },
      { text: 'Review', callback_data: 'ps:admin:payments:review:0', style: filter === 'review' ? 'primary' : 'link' },
    ] },
    { type: 'buttons', buttons: [
      { text: 'Refunded', callback_data: 'ps:admin:payments:refunded:0', style: filter === 'refunded' ? 'primary' : 'link' },
      { text: 'Failed', callback_data: 'ps:admin:payments:failed:0', style: filter === 'failed' ? 'primary' : 'link' },
    ] },
    { type: 'divider' },
  ];
  if (!visible.length) blocks.push({ type: 'paragraph', text: 'No payment records in this section.' });
  else {
    blocks.push({ type: 'table', caption: 'Payment ledger · newest first', is_bordered: false, is_striped: true, is_compact: true, cells: [
      [
        { text: 'ID', is_header: true, align: 'left' },
        { text: 'Customer', is_header: true, align: 'right' },
        { text: 'Stars', is_header: true, align: 'right' },
        { text: 'USD', is_header: true, align: 'right' },
        { text: 'Status', is_header: true, align: 'right' },
      ],
      ...visible.map(item => [
        { text: '#' + item.id, align: 'left' },
        { text: String(item.userId), align: 'right' },
        { text: Number(item.stars).toLocaleString('en-IN'), align: 'right' },
        { text: '$' + Number(item.points).toLocaleString('en-US'), align: 'right' },
        { text: item.status.replace('_', ' '), align: 'right' },
      ]),
    ] });
    if (filter === 'confirmed') {
      for (const item of visible) blocks.push({ type: 'buttons', buttons: [{ text: 'Review refund #' + item.id, callback_data: 'ps:admin:refund:' + item.id, style: 'danger' }] });
    }
  }
  const nav = [];
  if (safePage > 0) nav.push({ text: '‹ Newer', callback_data: 'ps:admin:payments:' + filter + ':' + (safePage - 1) });
  if ((safePage + 1) * 6 < matching.length) nav.push({ text: 'Older ›', callback_data: 'ps:admin:payments:' + filter + ':' + (safePage + 1) });
  if (nav.length) blocks.push({ type: 'buttons', buttons: nav });
  blocks.push({ type: 'buttons', buttons: [{ text: '‹ Administrator panel', callback_data: 'ps:admin', style: 'link' }] });
  return { blocks };
}