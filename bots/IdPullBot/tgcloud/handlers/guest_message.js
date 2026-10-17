import { api } from 'sdk';
import { recordInspection } from '../lib/stats.js';
import { reportFor,stringifyReport,escapeHtml } from '../lib/inspect.js';
import { createArticle } from '../lib/telegraph.js';
export default async function(message,ctx){
 const id=message?.guest_query_id;if(!id)return;
 const report=stringifyReport(reportFor(message,ctx?.update||{guest_message:message},'guest'));
 try{await recordInspection(message.from?.id||message.guest_bot_caller_user?.id,'guest');}catch{console.error('IdPullBot guest stats unavailable.');}
 let result;
 try{
  const title='IdPullBot Debug — '+(message.chat?.title||message.chat?.username||'Guest chat')+' — '+String(message.message_id||'unknown');
  const url=await createArticle(title,report);
  result={type:'article',id:'idpull-'+String(message.message_id||'0'),title:'Message debug report',description:'Open the full message inspection in Telegraph.',input_message_content:{message_text:'Message inspected. <a href="'+escapeHtml(url)+'">Open the full debug report</a>.',parse_mode:'HTML'},reply_markup:{inline_keyboard:[[{text:'Open debug article',url}]]}};
 }catch{
  result={type:'article',id:'idpull-unavailable-'+String(message.message_id||'0'),title:'Debug report unavailable',input_message_content:{message_text:'IdPullBot could not create the report link. Please open @idpullbot in a private chat and try again.'}};
 }
 await api.answerGuestQuery({guest_query_id:id,result});
}
