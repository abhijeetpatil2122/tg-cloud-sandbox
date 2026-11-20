import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { FEATURES, WALLET } from './config.js';
import { depositIntents } from '../schema.js';
import { createWalletTransaction, creditWalletPoints, updateWalletTransaction } from './wallet.js';
import { sendRich } from './ui.js';
import { listAdmins } from './admins.js';

export const DEPOSIT_PACKAGES = [50, 100, 250, 500, 1000];

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
    { type: 'heading', size: 1, text: '⭐ Add Portal Points' },
    { type: 'paragraph', text: 'Pay with Telegram Stars. Every successfully paid Star credits 1 Portal Point to your wallet.' },
    { type: 'divider' },
    { type: 'paragraph', text: 'Choose a package:' },
    { type: 'buttons', buttons: [
      { text: '50 ⭐', callback_data: 'ps:deposit:50' },
      { text: '100 ⭐', callback_data: 'ps:deposit:100' },
      { text: '250 ⭐', callback_data: 'ps:deposit:250' },
    ] },
    { type: 'buttons', buttons: [
      { text: '500 ⭐', callback_data: 'ps:deposit:500' },
      { text: '1,000 ⭐', callback_data: 'ps:deposit:1000' },
    ] },
    { type: 'paragraph', text: 'Custom amount: send /deposit followed by the number of Stars (10–10,000).' },
    { type: 'footer', text: '⭐ Payments are processed by Telegram. Portal Points are non-cash store credit.' },
    { type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] },
  ] };
}

export async function createStarsInvoice(userId, chatId, stars) {
  const amount = Number(stars);
  if (!FEATURES.depositsEnabled) throw new Error('Stars deposits are not enabled yet.');
  if (!Number.isSafeInteger(amount) || amount < 10 || amount > 10000) {
    throw new Error('Choose an amount between 10 and 10,000 Stars.');
  }
  const points = amount * Number(WALLET.pointsPerPaidStar);
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
      title: 'Portal Points',
      description: amount + ' Telegram Stars add ' + points + ' Portal Points to your wallet.',
      payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: points + ' Portal Points', amount }],
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
    ok = Boolean(
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
      payment.currency === 'XTR' &&
      Number(payment.total_amount) === Number(intent.stars) &&
      Number(intent.points) === Number(intent.stars) * Number(WALLET.pointsPerPaidStar) &&
      chargeId
    );

    if (!valid) {
      if (intent) {
        await db.update(depositIntents).set({ status: 'needs_review', updatedAt: new Date() })
          .where(eq(depositIntents.id, intent.id)).run();
        await updateWalletTransaction(intent.transactionId, 'needs_review', chargeId || null);
      }
      await notifyAdmins('⚠️ Payment needs review\nUser: ' + userId + '\nPayload: ' + payload.slice(0, 60) + '\nStars: ' + (Number(payment.total_amount) || 0) + '\nReceipt did not match a pending deposit. No points were credited.');
      await sendRich(message.chat.id, { blocks: [
        { type: 'heading', size: 1, text: '⚠️ Payment under review' },
        { type: 'paragraph', text: 'Telegram confirmed a payment, but the deposit details need administrator review. Use /paysupport if you need help.' },
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
      { type: 'paragraph', text: intent.stars + ' Stars received\n' + intent.points + ' Portal Points ' + (credit.duplicate ? 'were already credited' : 'have been added') + ' to your wallet.' },
      { type: 'paragraph', text: 'Payment reference: ' + chargeId.slice(0, 28) },
      { type: 'buttons', buttons: [
        { text: '💼 Open wallet', callback_data: 'ps:wallet', style: 'primary' },
        { text: '🧾 Transaction history', callback_data: 'ps:history' },
      ] },
    ] });

    await notifyAdmins('⭐ Stars deposit confirmed\nUser: ' + userId + '\nStars: ' + intent.stars + '\nPortal Points: ' + intent.points + '\nTransaction: #' + intent.transactionId + '\nCharge: ' + chargeId);
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
        { type: 'paragraph', text: 'Telegram confirmed your payment. The wallet update needs administrator review; please do not pay again. Use /paysupport for assistance.' },
      ] });
    } catch {}
    return true;
  }
}
