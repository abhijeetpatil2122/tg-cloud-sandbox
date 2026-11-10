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
 return String.raw`<style>body{font:13px/1.4 system-ui,sans-serif;color:var(--tg-theme-text-color);color-scheme:light dark;--m:var(--tg-theme-hint-color);--l:var(--tg-theme-section-separator-color,var(--m));--s:var(--tg-theme-secondary-bg-color,var(--tg-theme-bg-color));--a:var(--tg-theme-accent-text-color,var(--tg-theme-link-color));--b:var(--tg-theme-button-color);--bt:var(--tg-theme-button-text-color);--d:var(--tg-theme-destructive-text-color,var(--tg-theme-link-color)}*{box-sizing:border-box}body{margin:0;padding:11px 12px 12px}button{font:inherit;touch-action:manipulation;cursor:pointer}button:active{transform:scale(.97)}
.top,.heroMain,.head,.barTop,.review,.pager{display:flex;align-items:center;gap:9px}.top{margin-bottom:10px}.avatar{width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:12px;background:var(--b);color:var(--bt);font-size:17px;font-weight:900}.identity,.reviewInfo{flex:1;min-width:0}.eyebrow{font-size:9px;letter-spacing:1px;font-weight:850;color:var(--m)}.name{font-size:15px;font-weight:850;overflow-wrap:anywhere}.username{font-size:10px;color:var(--m)}
.hero,.list,.review{border:1px solid var(--l);border-radius:12px;background:var(--s)}.hero{padding:11px;margin-bottom:10px}.heroMain{justify-content:space-between}.scoreLabel,.publishedLabel,.metricLabel{font-size:10px;color:var(--m)}.score{font-size:26px;font-weight:900;line-height:1.2;font-variant-numeric:tabular-nums}.score small{font-size:11px;color:var(--m)}.published{text-align:right}.publishedValue{font-size:23px;font-weight:900;font-variant-numeric:tabular-nums}.divider{height:1px;background:var(--l);margin:10px 0}.metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.metric{min-width:0;padding:8px 9px;border:1px solid var(--l);border-radius:10px;background:var(--tg-theme-bg-color)}.metricValue{font-size:16px;font-weight:850;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}.metricLabel{margin-top:1px}
.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:3px;padding:4px;border:1px solid var(--l);border-radius:11px;background:var(--s);margin-bottom:9px}.tabs button{min-width:0;padding:8px 1px;border:0;border-radius:8px;background:transparent;color:var(--m);font-size:10px;font-weight:800;white-space:nowrap;transition:background .16s,color .16s,transform .12s}.tabs button.active{background:var(--b);color:var(--bt)}
.screen{transition:opacity .16s ease-out}.head{justify-content:space-between;margin:0 1px 8px}.headTitle{font-size:13px;font-weight:850}.meta{font-size:9px;color:var(--m);font-weight:800;text-align:right}.list{padding:2px 10px}.barRow{padding:8px 0;border-bottom:1px solid var(--l)}.barRow:last-child{border:0}.barTop{justify-content:space-between;margin-bottom:5px}.barName{font-size:11px;font-weight:700;overflow-wrap:anywhere}.barCount{font-size:11px;font-weight:850;font-variant-numeric:tabular-nums}.track{height:5px;border-radius:8px;background:var(--tg-theme-bg-color);overflow:hidden}.fill{height:100%;border-radius:8px;background:var(--a)}
.verdictRow{display:flex;align-items:center;justify-content:space-between;padding:10px 2px;border-bottom:1px solid var(--l)}.verdictRow:last-child{border:0}.verdictName{font-size:12px;font-weight:750}.count{min-width:34px;padding:5px 8px;border-radius:8px;background:var(--tg-theme-bg-color);text-align:center;font-size:12px;font-weight:850}.s{color:var(--a)}.d{color:var(--d)}.p{color:var(--tg-theme-link-color)}
.recent{display:flex;flex-direction:column;gap:7px}.review{padding:9px}.index{width:27px;height:27px;flex:none;display:grid;place-items:center;border-radius:8px;background:var(--tg-theme-bg-color);color:var(--m);font-size:10px;font-weight:850}.title{font-size:11px;font-weight:800;line-height:1.35;overflow-wrap:anywhere}.year{font-size:9px;color:var(--m);margin-top:3px}.rating{min-width:49px;padding:7px 6px;border:1px solid var(--l);border-radius:8px;background:var(--tg-theme-bg-color);font-size:10px;font-weight:850;text-align:center;white-space:nowrap}.ratingBtn{color:var(--tg-theme-link-color);transition:transform .12s}.pager{justify-content:space-between;margin-top:9px}.pager button{min-width:78px;padding:8px 9px;border:1px solid var(--l);border-radius:9px;background:var(--s);color:var(--tg-theme-link-color);font-size:10px;font-weight:850;transition:transform .12s}.pager button:disabled{opacity:.35}.page{font-size:10px;color:var(--m);font-weight:750}.empty{padding:17px 12px;border:1px dashed var(--l);border-radius:11px;text-align:center;color:var(--m);font-size:11px}.empty b{display:block;margin-bottom:4px;color:var(--tg-theme-text-color);font-size:13px}
.</style><body>
<header class="top"><div class="avatar" id="avatar">R</div><div class="identity"><div class="eyebrow">REVIEWTV · PROFILE</div><div class="name" id="name">Reviewer</div><div class="username" id="username"></div></div><div class="rank" id="rank">—</div></header>
<nav class="tabs"><button id="tab0" class="active" onclick="switchTab(0)">Overview</button><button id="tab1" onclick="switchTab(1)">Categories</button><button id="tab2" onclick="switchTab(2)">Verdicts</button><button id="tab3" onclick="switchTab(3)">Recent</button></nav>
<main id="content"></main>
<script>
var W=window.TelegramWidget||null,D={},T=0,P=0,C=['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'],V=['Absolute Cinema','Go for It','Timepass','Skip It'];
function id(x){return document.getElementById(x)}
function buzz(){try{if(W&&W.HapticFeedback)W.HapticFeedback.impactOccurred('heavy')}catch(e){}}
function esc(x){return String(x==null?'':x).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function first(x){try{return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(x))[0].segment}catch(e){return Array.from(x)[0]||'R'}}
function rows(names,counts){return names.map(function(n,i){return {n:n,c:Number(counts[i])||0,i:i}}).filter(function(x){return x.c>0})}
function shell(title,meta,body){return '<section class="screen"><div class="head"><b class="headTitle">'+title+'</b><span class="meta">'+meta+'</span></div>'+body+'</section>'}
function overview(){
 var m=[['Verdict-based reviews',D.v],['👍 Received',D.l],['👎 Received',D.d],['Leaderboard',D.r?'#'+D.r:'Not in top 20']];
 return '<section class="screen"><div class="hero"><div class="heroMain"><div><div class="scoreLabel">Average score (older reviews)</div><div class="score">'+esc(D.a)+(D.a==='—'?'':'<small> / 10</small>')+'</div></div><div class="published"><div class="publishedLabel">Published reviews</div><div class="publishedValue">'+D.t+'</div></div></div><div class="divider"></div><div class="metrics">'+m.map(function(x){return '<div class="metric"><div class="metricValue">'+esc(x[1])+'</div><div class="metricLabel">'+esc(x[0])+'</div></div>'}).join('')+'</div></div></section>';
}
function categories(){
 var a=rows(C,D.c).sort(function(x,y){return y.c-x.c}),max=Math.max(1,...a.map(function(x){return x.c}));
 if(!a.length)return shell('Reviews by category','0 CATEGORIES','<div class="empty"><b>No category activity yet</b>Your breakdown appears after publishing reviews.</div>');
 return shell('Reviews by category',a.length+' CATEGORIES','<div class="list">'+a.map(function(x){return '<div class="barRow"><div class="barTop"><span class="barName">'+esc(x.n)+'</span><b class="barCount">'+x.c+'</b></div><div class="track"><div class="fill" style="width:'+Math.max(2,x.c/max*100)+'%"></div></div></div>'}).join('')+'</div>');
}
function verdicts(){
 var a=rows(V,D.q);if(!a.length)return shell('Review verdicts','0 VERDICTS','<div class="empty"><b>No verdicts yet</b>Choose a verdict when publishing a review to see it here.</div>');
 return shell('Review verdicts',a.length+' VERDICTS','<div class="list">'+a.map(function(x){return '<div class="verdictRow"><span class="verdictName">'+esc(x.n)+'</span><b class="count '+(x.i===3?'d':x.i===2?'p':'s')+'">'+x.c+'</b></div>'}).join('')+'</div>');
}
function recent(){
 var a=D.i||[],size=2,pages=Math.max(1,Math.ceil(a.length/size));P=Math.max(0,Math.min(P,pages-1));
 if(!a.length)return shell('Recent reviews','0 REVIEWS','<div class="empty"><b>No reviews published yet</b>Your latest reviews will appear here.</div>');
 var start=P*size,items=a.slice(start,start+size);
 var cards=items.map(function(x,i){var n=start+i,r=Number(x.r)||0,s=x.s||'p',label=r?'★ '+r+'/10':'Not rated',rating=x.k?'<button class="rating ratingBtn '+s+'" onclick="openPost('+n+')">'+label+'</button>':'<span class="rating '+s+'">'+label+'</span>',year=x.y?(x.y+(x.e?' — '+x.e:'')):'';return '<article class="review"><span class="index">'+(n+1)+'</span><div class="reviewInfo"><div class="title">'+esc(x.t)+'</div>'+(year?'<div class="year">'+esc(year)+'</div>':'')+'</div>'+rating+'</article>'}).join('');
 return shell('Recent reviews',(start+1)+'–'+(start+items.length)+' OF '+a.length,'<div class="recent">'+cards+'</div>'+(pages>1?'<div class="pager"><button onclick="changePage(-1)" '+(P===0?'disabled':'')+'>‹ Previous</button><span class="page">'+(P+1)+' / '+pages+'</span><button onclick="changePage(1)" '+(P===pages-1?'disabled':'')+'>Next ›</button></div>':''));
}
function render(){id('content').innerHTML=T===1?categories():T===2?verdicts():T===3?recent():overview();for(var i=0;i<4;i++)id('tab'+i).classList.toggle('active',i===T)}
function switchTab(n){buzz();T=n;P=0;render()}
function changePage(n){buzz();P=Math.max(0,P+n);render()}
function openPost(n){buzz();var u=D.i[n]&&D.i[n].k;if(u&&W&&W.openTelegramLink)try{W.openTelegramLink(u)}catch(e){}}
function load(){
 var p={};try{p=JSON.parse(W&&W.chatData||'{}')}catch(e){}
 D={n:p.n||'Telegram user',u:p.u||'',t:Number(p.t)||0,a:p.a||'—',v:Number(p.v)||0,l:Number(p.l)||0,d:Number(p.d)||0,r:Number(p.r)||0,c:Array.isArray(p.c)?p.c:[],q:Array.isArray(p.q)?p.q:[],i:Array.isArray(p.i)?p.i:[]};
 id('name').textContent=D.n;id('username').textContent=D.u?'@'+D.u:'';id('avatar').textContent=first(D.n);render();try{if(W&&W.ready)W.ready()}catch(e){}
}
try{load()}catch(e){id('content').innerHTML='<div class="empty"><b>Profile unavailable</b>Close this message and send /widgetdemo again.</div>'}
</script></body>`;
}