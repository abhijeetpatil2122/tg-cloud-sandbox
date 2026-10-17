export function escapeHtml(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
export function reportFor(message,update,mode) {
  const target=message?.reply_to_message||message?.external_reply||message;\n  return {inspector:'IdPullBot',mode,target_selection:message?.reply_to_message?'replied-to message':message?.external_reply?'external replied-to message':'invoking message',target_message:target,current_message:message,raw_update:update||null};
}
export function stringifyReport(report){return JSON.stringify(report,null,2);}
function chunks(s){
  const out=[];let cur='',n=0;
  for(const c of String(s)){const e=escapeHtml(c);if(cur&&n+e.length>3400){out.push(cur);cur='';n=0;}cur+=c;n+=e.length;}
  if(cur||!out.length)out.push(cur);return out;
}
export async function sendReport(api,chatId,text,replyId){
  const parts=chunks(text);
  for(let i=0;i<parts.length;i++){
    const p={chat_id:chatId,text:'<pre><code class="language-js">'+escapeHtml(parts[i])+'</code></pre>',parse_mode:'HTML'};
    if(i===0&&Number.isSafeInteger(replyId)&&replyId>0)p.reply_parameters={message_id:replyId,allow_sending_without_reply:true};
    await api.sendMessage(p);
  }
}
export function shareKeyboard(){
  const user=(text,id,extra={})=>({text,request_users:{request_id:id,user_is_bot:extra.bot,user_is_premium:extra.premium,max_quantity:extra.max||1,request_name:true,request_username:true,request_photo:true}});
  const chat=(text,id,extra={})=>({text,request_chat:{request_id:id,chat_is_channel:!!extra.channel,chat_is_forum:extra.forum,chat_is_created:extra.created,user_administrator_rights:extra.admin,request_title:true,request_username:true,request_photo:true}});
  return {keyboard:[
    [user('User',1),chat('Channel',2,{channel:true})],
    [chat('Group',3),chat('Forum',4,{forum:true})],
    [user('Bot',5,{bot:true,max:10}),user('Premium',6,{premium:true})],
    [chat('Owner Group',7,{created:true}),chat('Owner Channel',8,{channel:true,created:true})],
    [chat('Admin Group',9,{admin:{can_manage_chat:true}}),chat('Admin Channel',10,{channel:true,admin:{can_manage_chat:true}})]
  ],resize_keyboard:true,is_persistent:true,input_field_placeholder:'Share a user or chat'};
}
