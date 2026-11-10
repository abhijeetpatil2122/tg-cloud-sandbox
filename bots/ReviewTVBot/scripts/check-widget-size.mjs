import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { buildProfileWidgetHtml, serializeProfileWidgetData } from '../tgcloud/lib/profile_widget.js';
import { buildProfileWidget2Html, serializeProfileWidget2Data } from '../tgcloud/lib/profile_widget2.js';
const html=buildProfileWidgetHtml(),bytes=Buffer.from(html,'utf8'),htmlBytes=bytes.byteLength;
const compressedBytes=Number(execFileSync('python3',['-c','import sys,zlib; print(len(zlib.compress(sys.stdin.buffer.read(),9)))'],{input:bytes,encoding:'utf8'}).trim());
console.log('ReviewTV widget: '+htmlBytes+' UTF-8 bytes HTML; '+compressedBytes+' bytes zlib level 9.');
if(!htmlBytes||htmlBytes>32768)throw new Error('Widget HTML exceeds Telegram’s 32768-byte limit.');
if(compressedBytes>3800)throw new Error('Widget must retain at least 296 bytes below Telegram’s 4096-byte compressed limit.');
if(html.includes(String.fromCharCode(0)))throw new Error('Widget HTML contains a NUL character.');
const script=html.match(/<script>([\s\S]*?)<\/script>/i);
if(!script)throw new Error('Inline widget script is missing.');
if(!html.startsWith('<style>#root{')||!html.includes('</style><div id="root">')||!html.endsWith('</div>'))throw new Error('Widget must be a bare fragment with its stylesheet at the top level.');
if(/^\s*<!doctype|^\s*<html|^\s*<head|^\s*<body/i.test(html))throw new Error('Widget must not start with a document wrapper.');
const styleStart=html.indexOf('<style>'),styleEnd=html.indexOf('</style>');
if(styleStart<0||styleEnd<0||styleEnd<=styleStart)throw new Error('Inline widget stylesheet is missing.');
const css=html.slice(styleStart+7,styleEnd);
function checkCssBalance(source){
 const stack=[],slash=String.fromCharCode(92);let quote='',comment=false;
 for(let i=0;i<source.length;i++){
  const c=source[i],n=source[i+1];
  if(comment){if(c==='*'&&n==='/'){comment=false;i++}continue}
  if(quote){if(c===quote&&source[i-1]!==slash)quote='';continue}
  if(c==='/'&&n==='*'){comment=true;i++;continue}
  if(c==="'"||c==='"'){quote=c;continue}
  if(c==='('||c==='['||c==='{')stack.push(c);
  else if(c===')'||c===']'||c==='}'){
   const open=stack.pop(),want=c===')'?'(':c===']'?'[':'{';
   if(open!==want)throw new Error('Widget CSS has an unmatched '+c+' at byte '+i+'.');
  }
 }
 if(quote||comment||stack.length)throw new Error('Widget CSS contains an unclosed string, comment or bracket: '+stack.join(''));
}
checkCssBalance(css);
if(css.split('{').length<35||!css.includes('--danger:var(--tg-theme-destructive-text-color);')||!css.includes('.tabs button.active')||!css.includes('.review'))throw new Error('Widget CSS is missing valid theme or layout rules.');
new Script(script[1]);
const required=['window.TelegramWidget','W.chatData',"impactOccurred('heavy')",'openTelegramLink','function switchTab(','function changePage(','function openPost(','class="hero"','class="metrics"','class="recent"','--tg-theme-secondary-bg-color','--tg-theme-text-color','--tg-theme-hint-color','--tg-theme-button-color','--tg-theme-button-text-color'];
for(const marker of required)if(!html.includes(marker))throw new Error('Missing widget feature: '+marker);
for(const forbidden of ['<input','<textarea','<select','fetch(','XMLHttpRequest','WebSocket','<script src=','<link rel=','overflow:auto','overflow:scroll'])if(html.includes(forbidden))throw new Error('Unsupported widget feature: '+forbidden);
const categories=['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'];
const verdicts=['Absolute Cinema','Go for It','Timepass','Skip It'];
const sample=serializeProfileWidgetData({name:'ReviewTV Member 🇮🇳',username:'reviewer_test',total:128,average:'8.6',verdictTotal:92,likes:420,dislikes:12,rank:3,categories:categories.map((label,i)=>({label,count:20-i})),verdicts:verdicts.map((label,i)=>({label,count:30-i})),recent:Array.from({length:5},(_,i)=>({title:'A sample movie title with a longer name '+i,year:2024,rating:8,style:'success',link:'https://t.me/review_tv/12345'}))});
const state=JSON.parse(sample),stateBytes=Buffer.byteLength(sample,'utf8');
if(stateBytes>1024)throw new Error('Profile chat_data exceeds Telegram’s 1024-byte limit.');
if(state.i.length!==5)throw new Error('Expected the five latest profile reviews.');
if(state.i[0].t!=='A sample movie title with a longer name 0'||state.i[0].r!==8||state.i[0].k!=='https://t.me/review_tv/12345')throw new Error('Recent review fields differ from /profile.');
for(const key of ['x','p','c','v'])if(key in state.i[0])throw new Error('Recent review contains non-profile field '+key+'.');
if(state.c.length!==8||state.q.length!==4||state.c[0]!==20||state.q[0]!==30)throw new Error('Category/verdict breakdown is incomplete.');
if(!html.includes('size=2')||!html.includes('a.slice(start,start+size)'))throw new Error('Recent reviews must paginate two items at a time.');
console.log('Profile chat_data: '+stateBytes+'/1024 bytes; five recent reviews; two per page; profile fields verified.');


const html2=buildProfileWidget2Html(),bytes2=Buffer.from(html2,'utf8'),htmlBytes2=bytes2.byteLength;
const compressedBytes2=Number(execFileSync('python3',['-c','import sys,zlib; print(len(zlib.compress(sys.stdin.buffer.read(),9)))'],{input:bytes2,encoding:'utf8'}).trim());
console.log('ReviewTV /profile2 widget: '+htmlBytes2+' UTF-8 bytes HTML; '+compressedBytes2+' bytes zlib level 9.');
if(!htmlBytes2||htmlBytes2>32768)throw new Error('/profile2 widget HTML exceeds Telegram’s 32768-byte limit.');
if(compressedBytes2>3800)throw new Error('/profile2 widget must retain at least 296 bytes below Telegram’s 4096-byte compressed limit.');
if(html2.includes(String.fromCharCode(0)))throw new Error('/profile2 widget HTML contains a NUL character.');
if(!html2.startsWith('<style>#p2{')||!html2.includes('</style><div id="p2">')||!html2.endsWith('</script>'))throw new Error('/profile2 widget must be a bare fragment with inline style and script.');
if(html2.startsWith('<!doctype')||html2.startsWith('<html')||html2.startsWith('<head')||html2.startsWith('<body'))throw new Error('/profile2 widget must not start with a document wrapper.');
const script2Start=html2.indexOf('<script>'),script2End=html2.indexOf('</script>');
if(script2Start<0||script2End<0||script2End<=script2Start)throw new Error('/profile2 widget inline script is missing.');
const css2=html2.slice(html2.indexOf('<style>')+7,html2.indexOf('</style>'));
checkCssBalance(css2);
new Script(html2.slice(script2Start+8,script2End));
const required2=['window.TelegramWidget','tw?.chatData',"tw?.onEvent?.('chatDataChanged'","tw?.onEvent?.('themeChanged'","tw?.ready?.()",'localStorage.setItem','function p2tab(','function p2page(','function p2open(','class="mast"','REVIEW LEDGER','env(safe-area-inset-bottom)','--tg-theme-secondary-bg-color','--tg-theme-text-color','--tg-theme-hint-color','--tg-theme-link-color'];
for(const marker of required2)if(!html2.includes(marker))throw new Error('/profile2 widget is missing: '+marker);
for(const forbidden of ['<input','<textarea','<select','fetch(','XMLHttpRequest','WebSocket','<script src=','<link rel=','overflow:auto','overflow:scroll','100vh','100dvh','100svh','text-shadow','perspective','rotateY','@import'])if(html2.includes(forbidden))throw new Error('/profile2 widget uses unsupported feature: '+forbidden);
const sample2=serializeProfileWidget2Data({name:'ReviewTV Member 🇮🇳',username:'reviewer_test',total:128,average:'8.6',verdictTotal:92,likes:420,dislikes:12,rank:3,categories:categories.map((label,i)=>({label,count:20-i})),verdicts:verdicts.map((label,i)=>({label,count:30-i})),recent:Array.from({length:5},(_,i)=>({title:'A sample movie title with a longer name '+i,year:2024,endYear:2025,rating:8,verdict:verdicts[i%4],category:categories[i%8],link:'https://t.me/review_tv/12345'}))});
const state2=JSON.parse(sample2),stateBytes2=Buffer.byteLength(sample2,'utf8');
if(stateBytes2>1024)throw new Error('/profile2 chat_data exceeds Telegram’s 1024-byte limit.');
if(state2.i.length!==5||state2.c.length!==8||state2.q.length!==4)throw new Error('/profile2 sample data is missing recent reviews, categories or verdicts.');
if(state2.i[0].v!==0||state2.i[0].c!==0||state2.i[0].k!=='https://t.me/review_tv/12345')throw new Error('/profile2 recent review mapping is incomplete.');
console.log('/profile2 chat_data: '+stateBytes2+'/1024 bytes; five recent reviews; eight categories; four verdicts verified.');
