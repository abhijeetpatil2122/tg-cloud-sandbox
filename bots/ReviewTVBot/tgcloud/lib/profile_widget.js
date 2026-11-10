// ReviewTV profile widget. The values and sections mirror /profile exactly.
const utf8=s=>{let n=0;for(const c of String(s??'')){const x=c.codePointAt(0);n+=x<128?1:x<2048?2:x<65536?3:4}return n};
const cut=(value,max)=>{const s=String(value??'');try{if(typeof Intl!=='undefined'&&Intl.Segmenter)return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s)).slice(0,max).map(x=>x.segment).join('')}catch(e){}return Array.from(s).slice(0,max).join('')};
const C=['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'];
const V=['Absolute Cinema','Go for It','Timepass','Skip It'];
export function serializeProfileWidgetData(p){
 const count=(items,label)=>Math.max(0,Number(items?.find(x=>x.label===label)?.count)||0);
 const style=s=>s==='success'?'s':s==='danger'?'d':'p';
 const state={
  n:cut(p.name||'Telegram user',42),u:cut(p.username,24),
  t:Math.max(0,Number(p.total)||0),a:cut(p.average??'—',5),
  v:Math.max(0,Number(p.verdictTotal)||0),l:Math.max(0,Number(p.likes)||0),
  d:Math.max(0,Number(p.dislikes)||0),r:Math.max(0,Number(p.rank)||0),
  c:C.map(x=>count(p.categories,x)),q:V.map(x=>count(p.verdicts,x)),
  i:(p.recent||[]).slice(0,5).map(x=>({
   t:cut(x.title,64),y:Number(x.year)||0,e:Number(x.endYear)||0,
   r:Number(x.rating)||0,s:style(x.style),
   k:typeof x.link==='string'&&x.link.length<=256&&/^https:\/\/t\.me\/[A-Za-z0-9_/-]+$/i.test(x.link)?x.link:''
  }))
 };
 let out=JSON.stringify(state);
 if(utf8(out)>1024){state.n=cut(state.n,28);for(const x of state.i)x.t=cut(x.t,42);out=JSON.stringify(state)}
 if(utf8(out)>1024){for(const x of state.i)x.k='';out=JSON.stringify(state)}
 if(utf8(out)>1024)throw new Error('Profile widget chat_data exceeds Telegram’s 1024-byte limit.');
 return out;
}
export function buildProfileWidgetHtml(){
 return String.raw`<!doctype html><html><head><style>
:root{font:13px/1.4 system-ui,sans-serif;color:var(--tg-theme-text-color);color-scheme:light dark;--muted:var(--tg-theme-hint-color);--line:var(--tg-theme-section-separator-color,var(--tg-theme-hint-color));--surface:var(--tg-theme-secondary-bg-color,var(--tg-theme-bg-color));--accent:var(--tg-theme-accent-text-color,var(--tg-theme-link-color));--link:var(--tg-theme-link-color);--button:var(--tg-theme-button-color);--buttonText:var(--tg-theme-button-text-color);--danger:var(--tg-theme-destructive-text-color,var(--tg-theme-link-color))}
*{box-sizing:border-box}body{margin:0;padding:11px 12px 12px}button{font:inherit;touch-action:manipulation;cursor:pointer}button:active{transform:scale(.97)}
.top{display:flex;align-items:center;gap:10px;margin-bottom:11px}.avatar{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:13px;background:var(--button);color:var(--buttonText);font-size:18px;font-weight:900}.identity{flex:1;min-width:0}.eyebrow{font-size:9px;font-weight:850;letter-spacing:1px;color:var(--muted)}.name{font-size:15px;font-weight:850;line-height:1.25;overflow-wrap:anywhere}.username{font-size:10px;color:var(--muted)}.rank{flex:none;padding:6px 8px;border:1px solid var(--line);border-radius:9px;color:var(--accent);font-size:9px;font-weight:850}
.hero{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface);margin-bottom:10px}.heroMain{display:flex;align-items:center;justify-content:space-between;gap:10px}.scoreLabel,.publishedLabel,.metricLabel{font-size:10px;color:var(--muted)}.score{font-size:27px;line-height:1.15;font-weight:900;letter-spacing:-.7px;font-variant-numeric:tabular-nums}.score small{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:0}.published{text-align:right}.publishedValue{font-size:24px;font-weight:900;font-variant-numeric:tabular-nums}.divider{height:1px;background:var(--line);margin:11px 0}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.metric{min-width:0;padding:9px 10px;border:1px solid var(--line);border-radius:11px;background:var(--tg-theme-bg-color)}.metricValue{font-size:17px;font-weight:850;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.metricLabel{margin-top:1px}
.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--surface);margin-bottom:10px}.tabs button{min-width:0;padding:8px 2px;border:0;border-radius:8px;background:transparent;color:var(--muted);font-size:10px;font-weight:800;white-space:nowrap;transition:background .18s,color .18s,transform .12s}.tabs button.active{background:var(--button);color:var(--buttonText)}
.heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 1px 8px}.headingTitle{font-size:13px;font-weight:850}.headingMeta{font-size:9px;font-weight:800;color:var(--muted);text-align:right}
.list{padding:3px 11px;border:1px solid var(--line);border-radius:13px;background:var(--surface)}.barRow{padding:9px 0;border-bottom:1px solid var(--line)}.barRow:last-child{border:0}.barTop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.barName{min-width:0;font-size:11px;font-weight:700;overflow-wrap:anywhere}.barCount{flex:none;font-size:11px;font-weight:850;font-variant-numeric:tabular-nums}.track{height:5px;border-radius:8px;background:var(--tg-theme-bg-color);overflow:hidden}.fill{height:100%;border-radius:8px;background:var(--accent);transform-origin:left;animation:grow .45s cubic-bezier(.2,.75,.25,1) both}
.verdictRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 2px;border-bottom:1px solid var(--line)}.verdictRow:last-child{border:0}.verdictName{font-size:12px;font-weight:750}.verdictCount{min-width:34px;text-align:center;padding:5px 8px;border-radius:8px;background:var(--tg-theme-bg-color);font-size:12px;font-weight:850;font-variant-numeric:tabular-nums}.verdictCount.s{color:var(--accent)}.verdictCount.d{color:var(--danger)}.verdictCount.p{color:var(--link)}
.recentList{display:flex;flex-direction:column;gap:7px}.review{display:flex;align-items:center;gap:10px;min-width:0;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}.reviewIndex{width:29px;height:29px;flex:none;display:grid;place-items:center;border-radius:9px;background:var(--tg-theme-bg-color);color:var(--muted);font-size:10px;font-weight:850}.reviewInfo{flex:1;min-width:0}.reviewTitle{font-size:11px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}.reviewYear{font-size:9px;color:var(--muted);margin-top:3px}.rating{flex:none;min-width:51px;padding:7px 8px;border:1px solid var(--line);border-radius:9px;background:var(--tg-theme-bg-color);color:var(--link);font-size:10px;font-weight:850;text-align:center;font-variant-numeric:tabular-nums}.rating.s{color:var(--accent)}.rating.d{color:var(--danger)}button.rating{transition:transform .12s,border-color .18s}
.pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px}.pager button{min-width:82px;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--link);font-size:10px;font-weight:850;transition:transform .12s,background .18s}.pager button:disabled{opacity:.35}.page{font-size:10px;color:var(--muted);font-weight:750;font-variant-numeric:tabular-nums}.empty{padding:18px 12px;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--muted);font-size:11px}.empty b{display:block;margin-bottom:4px;color:var(--tg-theme-text-color);font-size:13px}.start{display:block;width:100%;margin-top:9px;padding:10px;border:0;border-radius:10px;background:var(--button);color:var(--buttonText);font-size:11px;font-weight:850}
.screen{animation:enter .2s ease-out both}@keyframes enter{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media(max-width:280px){body{padding:9px}.tabs button{font-size:9px}.metric{padding:8px}.review{gap:7px;padding:8px}.rating{min-width:45px;padding:6px 5px}}
@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style></head><body>
<header class="top"><div class="avatar" id="avatar">R</div><div class="identity"><div class="eyebrow">REVIEWTV · PROFILE</div><div class="name" id="name">Reviewer</div><div class="username" id="username"></div></div><div class="rank" id="rank">—</div></header>
<nav class="tabs"><button id="tab0" class="active" onclick="switchTab(0)">Overview</button><button id="tab1" onclick="switchTab(1)">Categories</button><button id="tab2" onclick="switchTab(2)">Verdicts</button><button id="tab3" onclick="switchTab(3)">Recent</button></nav>
<main id="content"></main>
<script>
var W=window.TelegramWidget||null,D={},tab=0,page=0;
var C=['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'],V=['Absolute Cinema','Go for It','Timepass','Skip It'];
function byId(id){return document.getElementById(id)}
function firstGrapheme(s){try{if(typeof Intl!=='undefined'&&Intl.Segmenter)return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(s))[0].segment}catch(e){}return Array.from(s)[0]||'R'}
function haptic(){try{if(W&&W.HapticFeedback&&W.HapticFeedback.impactOccurred)W.HapticFeedback.impactOccurred('heavy')}catch(e){}}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rows(labels,values){return labels.map(function(label,i){return {label:label,count:Number(values[i])||0,index:i}}).filter(function(x){return x.count>0})}
function section(title,meta,body){return '<div class="screen"><div class="heading"><span class="headingTitle">'+title+'</span><span class="headingMeta">'+meta+'</span></div>'+body+'</div>'}
function overview(){
 var metrics=[['Verdict-based reviews',D.v],['👍 Received',D.l],['👎 Received',D.d],['Leaderboard',D.r?'#'+D.r:'Not in top 20']];
 return '<div class="screen"><section class="hero"><div class="heroMain"><div><div class="scoreLabel">Average score (older reviews)</div><div class="score">'+esc(D.a)+(D.a==='—'?'':'<small> / 10</small>')+'</div></div><div class="published"><div class="publishedLabel">Published reviews</div><div class="publishedValue">'+D.t+'</div></div></div><div class="divider"></div><div class="metrics">'+metrics.map(function(x){return '<div class="metric"><div class="metricValue">'+esc(x[1])+'</div><div class="metricLabel">'+esc(x[0])+'</div></div>'}).join('')+'</div></section></div>';
}
function categoryView(){
 var items=rows(C,D.c).sort(function(a,b){return b.count-a.count}),max=Math.max(1,...items.map(function(x){return x.count}));
 if(!items.length)return section('Reviews by category','0 CATEGORIES','<div class="empty"><b>No category activity yet</b>Your category breakdown will appear after publishing reviews.</div>');
 var body='<div class="list">'+items.map(function(x){return '<div class="barRow"><div class="barTop"><span class="barName">'+esc(x.label)+'</span><b class="barCount">'+x.count+'</b></div><div class="track"><div class="fill" style="width:'+Math.max(2,x.count/max*100)+'%"></div></div></div>'}).join('')+'</div>';
 return section('Reviews by category',items.length+' CATEGORIES',body);
}
function verdictView(){
 var items=rows(V,D.q);
 if(!items.length)return section('Review verdicts','0 VERDICTS','<div class="empty"><b>No verdicts yet</b>Verdict counts appear when you choose one while publishing a review.</div>');
 return section('Review verdicts',items.length+' VERDICTS','<div class="list">'+items.map(function(x){var s=x.index===3?'d':x.index===2?'p':'s';return '<div class="verdictRow"><span class="verdictName">'+esc(x.label)+'</span><b class="verdictCount '+s+'">'+x.count+'</b></div>'}).join('')+'</div>');
}
function recentView(){
 var items=D.i||[],size=2,pages=Math.max(1,Math.ceil(items.length/size));page=Math.max(0,Math.min(page,pages-1));
 if(!items.length)return section('Recent reviews','0 REVIEWS','<div class="empty"><b>No reviews published yet</b>Your five latest reviews will appear here.</div><button class="start" onclick="startReview()">Write your first review</button>');
 var start=page*size,shown=items.slice(start,start+size);
 var cards=shown.map(function(x,i){
  var n=start+i,r=Number(x.r)||0,style=x.s||'p',label=r?'★ '+r+'/10':'Not rated';
  var rating=x.k?'<button class="rating '+style+'" onclick="openPost('+n+')">'+label+'</button>':'<span class="rating '+style+'">'+label+'</span>';
  var year=x.y?(x.y+(x.e?' — '+x.e:'')):'';
  return '<article class="review"><div class="reviewIndex">'+(n+1)+'</div><div class="reviewInfo"><div class="reviewTitle">'+esc(x.t)+'</div>'+(year?'<div class="reviewYear">'+esc(year)+'</div>':'')+'</div>'+rating+'</article>';
 }).join('');
 var range=(start+1)+'–'+(start+shown.length)+' OF '+items.length;
 return section('Recent reviews',range,'<div class="recentList">'+cards+'</div>'+(pages>1?'<div class="pager"><button onclick="changePage(-1)" '+(page===0?'disabled':'')+'>‹ Previous</button><span class="page">Page '+(page+1)+' / '+pages+'</span><button onclick="changePage(1)" '+(page===pages-1?'disabled':'')+'>Next ›</button></div>':''));
}
function render(){
 var target=byId('content');if(!target)return;
 target.innerHTML=tab===1?categoryView():tab===2?verdictView():tab===3?recentView():overview();
 for(var i=0;i<4;i++){var b=byId('tab'+i);if(b)b.classList.toggle('active',i===tab)}
}
function switchTab(next){haptic();tab=Math.max(0,Math.min(3,Number(next)||0));page=0;render()}
function changePage(step){haptic();page=Math.max(0,page+(Number(step)||0));render()}
function openPost(index){haptic();var x=D.i[index],url=x&&x.k;if(url&&W&&W.openTelegramLink)try{W.openTelegramLink(url)}catch(e){}}
function startReview(){haptic();if(W&&W.openTelegramLink)try{W.openTelegramLink('https://t.me/ReviewTvBot?start=review')}catch(e){}}
function load(){
 var p={};try{p=JSON.parse(W&&W.chatData||'{}')}catch(e){}
 D={n:p.n||'Telegram user',u:p.u||'',t:Number(p.t)||0,a:p.a||'—',v:Number(p.v)||0,l:Number(p.l)||0,d:Number(p.d)||0,r:Number(p.r)||0,c:Array.isArray(p.c)?p.c:[],q:Array.isArray(p.q)?p.q:[],i:Array.isArray(p.i)?p.i:[]};
 var name=D.n;byId('name').textContent=name;byId('username').textContent=D.u?'@'+D.u:'';byId('avatar').textContent=firstGrapheme(name);byId('rank').textContent=D.r?'#'+D.r+' RANK':'NOT IN TOP 20';
 render();try{if(W&&W.ready)W.ready()}catch(e){}
}
try{load()}catch(e){byId('content').innerHTML='<div class="empty"><b>Profile unavailable</b>Close this message and send /widgetdemo again.</div>'}
</script></body></html>`;
}