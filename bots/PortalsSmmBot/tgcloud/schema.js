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
