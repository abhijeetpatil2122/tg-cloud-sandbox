import { table, integer, text, sql } from 'sdk/db';

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
