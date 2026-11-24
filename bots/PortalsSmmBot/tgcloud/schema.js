import { table, integer, text, boolean, sql } from 'sdk/db';

// Persistent administrator registry. The two bootstrap owners remain in config.js.
export const botAdmins = table('bot_admins', {
  userId: integer('user_id').primaryKey(),
  addedBy: integer('added_by').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// One pending admin-management input per initiating owner.
export const adminSessions = table('admin_sessions', {
  userId: integer('user_id').primaryKey(),
  action: text('action').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Customer-facing transaction record. Status changes are reflected here;
// completed point movements are also written to the append-only wallet ledger.
export const walletTransactions = table('wallet_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('pending'),
  title: text('title').notNull(),
  points: integer('points').notNull().default(0),
  stars: integer('stars').notNull().default(0),
  reference: text('reference'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// The financial source of truth. Rows are append-only and point amounts are
// signed integers: credits are positive and debits/reversals are negative.
export const walletLedger = table('wallet_ledger', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  transactionId: integer('transaction_id').notNull(),
  amount: integer('amount').notNull(),
  kind: text('kind').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});


// Supplier catalogue snapshot. Imported services remain disabled until an
// administrator reviews their Telegram scope and sets a customer price.
export const providerServices = table('provider_services', {
  serviceId: integer('service_id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  category: text('category'),
  rate: text('rate').notNull(),
  minQty: integer('min_qty').notNull(),
  maxQty: integer('max_qty').notNull(),
  refill: boolean('refill').notNull().default(false),
  cancel: boolean('cancel').notNull().default(false),
  isTelegram: boolean('is_telegram').notNull().default(false),
  enabled: boolean('enabled').notNull().default(false),
  customerPrice: integer('customer_price'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Pending Telegram Stars invoices. A payment is credited only after a
// matching successful_payment update has been verified.
export const depositIntents = table('deposit_intents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  payload: text('payload').notNull().unique(),
  stars: integer('stars').notNull(),
  points: integer('points').notNull(),
  transactionId: integer('transaction_id').notNull(),
  status: text('status').notNull().default('pending'),
  telegramChargeId: text('telegram_charge_id').unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// User-side conversation state for payment support intake.
export const userSessions = table('user_sessions', {
  userId: integer('user_id').primaryKey(),
  action: text('action').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const paymentSupportTickets = table('payment_support_tickets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  message: text('message').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

// Internal order history. Supplier IDs and status snapshots are kept separate
// from the customer's transaction ledger.
export const serviceOrders = table('service_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  serviceId: integer('service_id').notNull(),
  serviceName: text('service_name').notNull(),
  target: text('target').notNull(),
  quantity: integer('quantity').notNull(),
  points: integer('points').notNull(),
  status: text('status').notNull().default('pending'),
  providerOrderId: text('provider_order_id'),
  providerStatus: text('provider_status'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});
 
// Telegram user registry for audience statistics, referrals and moderation.
// User IDs are retained for bot operations; never store message contents here.
export const botUsers = table('bot_users', {
  userId: integer('user_id').primaryKey(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  languageCode: text('language_code'),
  isBot: boolean('is_bot').notNull().default(false),
  isBanned: boolean('is_banned').notNull().default(false),
  referredBy: integer('referred_by'),
  referralRewardedAt: integer('referral_rewarded_at', { mode: 'timestamp' }),
  firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastChatType: text('last_chat_type'),
});
