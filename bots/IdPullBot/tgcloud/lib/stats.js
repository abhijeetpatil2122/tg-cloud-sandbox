import { db } from 'sdk';
import { eq, sql } from 'sdk/db';
import { usageStats, trackedUsers } from '../schema.js';
export async function recordInspection(userId, mode) {
  await db.insert(usageStats).values({id:1,inspections:1,privateInspections:mode==='private'?1:0,guestInspections:mode==='guest'?1:0})
    .onConflictDoUpdate({target:usageStats.id,set:{
      inspections:sql`${usageStats.inspections}+1`,
      privateInspections:sql`${usageStats.privateInspections}+${mode==='private'?1:0}`,
      guestInspections:sql`${usageStats.guestInspections}+${mode==='guest'?1:0}`,
    }}).run();
  if(Number.isSafeInteger(userId)&&userId>0) await db.insert(trackedUsers).values({userId})
    .onConflictDoUpdate({target:trackedUsers.userId,set:{lastSeen:sql`(unixepoch())`}}).run();
}
export async function registerStart(userId) {
  if(!Number.isSafeInteger(userId)||userId<=0) return false;
  const old=await db.select().from(trackedUsers).where(eq(trackedUsers.userId,userId)).get();
  await db.insert(trackedUsers).values({userId}).onConflictDoUpdate({target:trackedUsers.userId,set:{lastSeen:sql`(unixepoch())`}}).run();
  if(old) return false;
  await db.insert(usageStats).values({id:1,newUsers:1}).onConflictDoUpdate({target:usageStats.id,set:{newUsers:sql`${usageStats.newUsers}+1`}}).run();
  return true;
}
export async function getStats() {
  const [s,u]=await Promise.all([db.select().from(usageStats).where(eq(usageStats.id,1)).get(),db.$count(trackedUsers)]);
  return {inspections:s?.inspections||0,privateInspections:s?.privateInspections||0,guestInspections:s?.guestInspections||0,newUsers:s?.newUsers||0,uniqueUsers:u||0};
}
