import { api } from 'sdk';
import { getStats,recordInspection,registerStart } from '../lib/stats.js';
import { reportFor,stringifyReport,sendReport,shareKeyboard,escapeHtml } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';
const ADMIN=1314643983;
const cmd=t=>String(t||'').trim().split(/\s+/)[0].split('@')[0].toLowerCase();
async function help(chatId){await api.sendMessage({chat_id:chatId,text:'<b>IdPullBot</b>\nSend any message here to inspect its full Telegram message and raw update. Reply to a message with /id to inspect that replied-to message. Reports are chunked into JavaScript-style code blocks, followed by a shareable Telegraph link.\n\nUse the keyboard to share users and chats. In supported groups, invoke @idpullbot by replying to a message for a minimal guest-mode report link.\n/stats — private aggregate statistics (admin only).',parse_mode:'HTML',reply_markup:shareKeyboard()});}
async function start(m){
 const u=m.from||{},name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'there';let fresh=false;
 try{fresh=await registerStart(u.id);}catch{console.error('IdPullBot stats not ready; apply the reviewed migration.');}
 await api.sendMessage({chat_id:m.chat.id,text:'Welcome '+escapeHtml(name)+' to IdPullBot.\n\nSend any message to inspect its complete Telegram data, or reply to a message with /id. The report ends with a shareable Telegraph article link.',parse_mode:'HTML'});
 if(m.chat?.type==='private') await api.sendMessage({chat_id:m.chat.id,text:'Share a user or chat to get its available ID.',reply_markup:shareKeyboard()});
 if(fresh)try{await api.sendMessage({chat_id:ADMIN,text:'New IdPullBot user: '+name+'\nID: '+String(u.id||'unknown')+(u.username?'\nUsername: @'+u.username:'')});}catch{}
}
async function privateInspect(m,ctx){
 if(m.chat?.type!=='private')return;
 const text=stringifyReport(reportFor(m,ctx?.update||{message:m},'private'));
 try{await recordInspection(m.from?.id,'private');}catch{console.error('IdPullBot stats unavailable.');}
 await sendReport(api,m.chat.id,text,m.message_id);
 try{
  const title='IdPullBot Debug — '+(m.chat.username||m.chat.first_name||'Private chat')+' — '+String(m.message_id||'unknown');
  const url=await createArticle(title,text);
  await api.sendMessage({chat_id:m.chat.id,text:'Shareable report: '+url,reply_markup:{inline_keyboard:[[{text:'Open Telegraph article',url}]]},disable_web_page_preview:true});
 }catch{
  console.error('IdPullBot Telegraph article creation failed.');
  await api.sendMessage({chat_id:m.chat.id,text:'Debug chunks were sent, but the Telegraph article failed. Ensure the Serverless schema migration has been applied.'});
 }
}
async function sharedUsers(m){
 const s=m.users_shared,users=Array.isArray(s.users)?s.users:[],ids=users.map(u=>u.user_id);
 const details=users.map(u=>{
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Name not provided';
  return '• '+escapeHtml(name)+(u.username?' (@'+escapeHtml(u.username)+')':'')+' — <code>'+u.user_id+'</code>';
 });
 await api.sendMessage({chat_id:m.chat.id,text:'<b>Shared users</b>\nRequest ID: <code>'+s.request_id+'</code>\n'+(details.length?details.join('\n'):'No user IDs returned')+'\n\nTelegram only returns the user details available in the share event.',parse_mode:'HTML',reply_markup:ids.length?{inline_keyboard:ids.map(id=>[{text:'Copy '+id,copy_text:{text:String(id)}}])}:undefined});
}
async function sharedChat(m){
 const s=m.chat_shared,id=s.chat_id;
 await api.sendMessage({chat_id:m.chat.id,text:'<b>Shared chat</b>\nRequest ID: <code>'+s.request_id+'</code>\nChat ID: <code>'+id+'</code>\nTelegram may not include title or username in this share event.',parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'Copy chat ID',copy_text:{text:String(id)}}]]}});
}
export default async function(message,ctx){
 if(message?.users_shared)return sharedUsers(message);
 if(message?.chat_shared)return sharedChat(message);
 const c=cmd(message?.text);
 if(c==='/start')return start(message);
 if(c==='/help'||c==='/about')return help(message);
 if(c==='/stats'){
  if(message.chat?.type!=='private'||message.from?.id!==ADMIN)return;
  try{const s=await getStats();await api.sendMessage({chat_id:message.chat.id,text:'<b>IdPullBot stats</b>\nInspections: <code>'+s.inspections+'</code>\nPrivate: <code>'+s.privateInspections+'</code>\nGuest: <code>'+s.guestInspections+'</code>\nTracked users: <code>'+s.uniqueUsers+'</code>\nNew users: <code>'+s.newUsers+'</code>',parse_mode:'HTML'});}
  catch{await api.sendMessage({chat_id:message.chat.id,text:'Stats are unavailable until the Serverless database migration is applied.'});}
  return;
 }
 return privateInspect(message,ctx);
}
