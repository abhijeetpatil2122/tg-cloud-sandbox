import { table, integer, text, sql } from 'sdk/db';
export const usageStats = table('idpull_usage_stats', {
  id: integer('id').primaryKey(),
  inspections: integer('inspections').notNull().default(0),
  privateInspections: integer('private_inspections').notNull().default(0),
  guestInspections: integer('guest_inspections').notNull().default(0),
  newUsers: integer('new_users').notNull().default(0),
});
export const trackedUsers = table('idpull_tracked_users', {
  userId: integer('user_id').primaryKey(),
  firstSeen: integer('first_seen', {mode:'timestamp'}).notNull().default(sql`(unixepoch())`),
  lastSeen: integer('last_seen', {mode:'timestamp'}).notNull().default(sql`(unixepoch())`),
});
export const settings = table('idpull_settings', {
  key: text('key').primaryKey(), value: text('value').notNull(),
});
