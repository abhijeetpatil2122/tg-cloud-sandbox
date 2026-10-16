import { table, integer, text, sql } from 'sdk/db';

export const demoNotes = table('demo_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  note: text('note').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
});
