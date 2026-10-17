import { fetch, db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../schema.js';
const KEY='telegraph_access_token';
async function call(method,data) {
  const r=await fetch('https://api.telegra.ph/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  if(!r.ok) throw new Error('Telegraph HTTP '+r.status);
  const j=await r.json(); if(!j.ok) throw new Error('Telegraph API rejected request'); return j.result;
}
async function token() {
  const row=await db.select().from(settings).where(eq(settings.key,KEY)).get();
  if(row?.value) return row.value;
  const account=await call('createAccount',{short_name:'IdPullBot',author_name:'IdPullBot',author_url:'https://t.me/idpullbot'});
  if(!account?.access_token) throw new Error('Missing Telegraph access token');
  await db.insert(settings).values({key:KEY,value:account.access_token}).onConflictDoUpdate({target:settings.key,set:{value:account.access_token}}).run();
  return account.access_token;
}
export async function createArticle(title,report) {
  const t=await token(), limit=60000;
  const body=report.length>limit?report.slice(0,limit)+'\n[Article content truncated to fit Telegraph limits.]':report;
  const page=await call('createPage',{access_token:t,title:String(title||'Message Debug').slice(0,256),author_name:'IdPullBot',content:JSON.stringify([
    {tag:'h3',children:['IdPullBot Message Debug']},{tag:'pre',children:[body]}
  ]),return_content:false});
  if(!page?.url) throw new Error('Telegraph did not return URL');
  return page.url;
}
