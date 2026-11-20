import { db } from 'sdk';
import { desc, eq } from 'sdk/db';
import { serviceOrders } from '../schema.js';

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(Number(value || 0) * 1000);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(value) {
  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    in_progress: 'In progress',
    completed: 'Completed',
    partial: 'Partially completed',
    canceled: 'Cancelled',
    cancelled: 'Cancelled',
    failed: 'Failed',
    needs_review: 'Under review',
    refunded: 'Refunded',
  };
  return labels[String(value || '').toLowerCase()] || 'Processing';
}

export async function myOrdersMessage(userId, page = 0) {
  const safePage = Math.max(0, Math.min(1000, Number(page) || 0));
  const rows = await db.select().from(serviceOrders)
    .where(eq(serviceOrders.userId, Number(userId)))
    .orderBy(desc(serviceOrders.createdAt), desc(serviceOrders.id))
    .limit(6)
    .offset(safePage * 6)
    .all();

  const blocks = [
    { type: 'heading', size: 1, text: '📦 My orders' },
    { type: 'paragraph', text: 'Your recent service orders and delivery updates.' },
    { type: 'divider' },
  ];
  if (!rows.length && safePage === 0) blocks.push({ type: 'paragraph', text: 'You have not placed an order yet.' });
  else if (!rows.length) blocks.push({ type: 'paragraph', text: 'There are no more orders on this page.' });

  for (const item of rows) {
    blocks.push({ type: 'paragraph', text: 'Order #' + item.id + ' · ' + item.serviceName + '\n' + Number(item.quantity).toLocaleString('en-IN') + ' units · ' + Number(item.points).toLocaleString('en-IN') + ' Portal Points\nStatus: ' + statusLabel(item.providerStatus || item.status) + '\n' + formatDate(item.createdAt) });
    blocks.push({ type: 'buttons', buttons: [{ text: 'View order #' + item.id, callback_data: 'ps:order:' + item.id }] });
    blocks.push({ type: 'divider' });
  }

  const nav = [];
  if (safePage > 0) nav.push({ text: '‹ Newer', callback_data: 'ps:orders:' + (safePage - 1) });
  if (rows.length === 6) nav.push({ text: 'Older ›', callback_data: 'ps:orders:' + (safePage + 1) });
  if (nav.length) blocks.push({ type: 'buttons', buttons: nav });
  blocks.push({ type: 'buttons', buttons: [{ text: '‹ Main menu', callback_data: 'ps:home', style: 'link' }] });
  return { blocks };
}

export async function orderDetailsMessage(userId, orderId) {
  const item = await db.select().from(serviceOrders)
    .where(eq(serviceOrders.id, Number(orderId))).get();
  if (!item || Number(item.userId) !== Number(userId)) {
    return { blocks: [
      { type: 'heading', size: 1, text: 'Order not found' },
      { type: 'paragraph', text: 'This order does not exist or does not belong to your account.' },
      { type: 'buttons', buttons: [{ text: '‹ My orders', callback_data: 'ps:orders', style: 'link' }] },
    ] };
  }

  return { blocks: [
    { type: 'heading', size: 1, text: '📦 Order #' + item.id },
    { type: 'paragraph', text: item.serviceName + '\nQuantity: ' + Number(item.quantity).toLocaleString('en-IN') + '\nCharged: ' + Number(item.points).toLocaleString('en-IN') + ' Portal Points\nStatus: ' + statusLabel(item.providerStatus || item.status) + '\nCreated: ' + formatDate(item.createdAt) },
    { type: 'paragraph', text: 'Target: ' + String(item.target).slice(0, 180) },
    { type: 'paragraph', text: 'Keep this order ID when contacting support.' },
    { type: 'buttons', buttons: [
      { text: '💬 Order support', callback_data: 'ps:support:payment' },
      { text: '‹ My orders', callback_data: 'ps:orders', style: 'link' },
    ] },
  ] };
}
