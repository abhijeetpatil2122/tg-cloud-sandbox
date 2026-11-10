// ReviewTV profile dashboard — Telegram Widget profile 1.
// The widget is intentionally self-contained: no network, external assets, or widget queries.
const utf8 = value => { let size = 0; for (const character of String(value ?? '')) { const code = character.codePointAt(0); size += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4; } return size; };
const cut = (value, limit) => Array.from(String(value ?? '')).slice(0, limit).join('');
const CATEGORY_LABELS = ['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'];
const VERDICT_LABELS = ['Absolute Cinema','Go for It','Timepass','Skip It'];

export function serializeProfileWidgetData(profile) {
  const styleCode = value => value === 'success' ? 's' : value === 'danger' ? 'd' : 'p';
  const countBy = (items, label) => Math.max(0, Number(items?.find(item => item.label === label)?.count) || 0);
  const state = {
    n: cut(profile.name || 'Reviewer', 42),
    u: cut(profile.username, 24),
    t: Math.max(0, Number(profile.total) || 0),
    a: cut(profile.average ?? '—', 5),
    v: Math.max(0, Number(profile.verdictTotal) || 0),
    l: Math.max(0, Number(profile.likes) || 0),
    d: Math.max(0, Number(profile.dislikes) || 0),
    r: Math.max(0, Number(profile.rank) || 0),
    c: CATEGORY_LABELS.map(label => countBy(profile.categories, label)),
    q: VERDICT_LABELS.map(label => countBy(profile.verdicts, label)),
    i: (profile.recent || []).slice(0, 5).map(item => ({
      t: cut(item.title, 42), y: Number(item.year) || 0, e: Number(item.endYear) || 0,
      r: Number(item.rating) || 0, s: styleCode(item.style),
      c: CATEGORY_LABELS.indexOf(item.category), v: VERDICT_LABELS.indexOf(item.verdict),
      x: item.hasSpoilers ? '' : cut(String(item.excerpt || '').replace(/\s+/g, ' ').trim(), 58),
      p: Boolean(item.hasSpoilers),
      k: /^https:\/\/t\.me\/[A-Za-z0-9_/-]+$/i.test(String(item.link || '')) ? item.link : ''
    }))
  };
  let encoded = JSON.stringify(state);
  const compact = () => { encoded = JSON.stringify(state); };
  if (utf8(encoded) > 1024) {
    state.n = cut(state.n, 28);
    for (const item of state.i) { item.t = cut(item.t, 30); item.x = cut(item.x, 34); }
    compact();
  }
  if (utf8(encoded) > 1024) {
    for (const item of state.i) item.k = '';
    compact();
  }
  while (utf8(encoded) > 1024 && state.i.length > 1) {
    state.i.pop();
    compact();
  }
  if (utf8(encoded) > 1024) throw new Error('Profile widget chat_data exceeds Telegram’s 1024-byte limit.');
  return encoded;
}

export function buildProfileWidgetHtml() {
  return String.raw`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{font:12px/1.35 system-ui,sans-serif;color:var(--tg-theme-text-color);--m:var(--tg-theme-hint-color);--l:var(--tg-theme-section-separator-color,var(--m));--s:var(--tg-theme-secondary-bg-color,var(--tg-theme-bg-color));--a:var(--tg-theme-link-color);--b:var(--tg-theme-button-color);--bt:var(--tg-theme-button-text-color)}*{box-sizing:border-box}body{margin:0;padding:10px 11px}button{font:inherit;touch-action:manipulation}
.header,.scoreline,.review,.reviewtop,.pager,.sectionhead,.barhead{display:flex;align-items:center;gap:8px}.header{margin-bottom:10px;gap:10px}.avatar,.scorebox{display:grid;place-items:center;background:var(--b);color:var(--bt);font-weight:950}.avatar{width:43px;height:43px;flex:none;border-radius:14px;font-size:19px}.identity,.reviewbody{flex:1;min-width:0}.name{font-size:15px;font-weight:900;overflow-wrap:anywhere}.handle,.sub,.statlabel,.hint,.category,.page{color:var(--m);font-size:9px}
.hero,.panel,.review{border:1px solid var(--l);border-radius:13px;background:var(--s)}.hero{padding:12px;margin-bottom:9px}.herohead{display:flex;justify-content:space-between;color:var(--m);font-size:9px;font-weight:900}.scoreline{margin:10px 0}.scorebox{width:57px;height:57px;flex:none;border-radius:16px;font-size:19px}.score{font-weight:950}.scoremeta{font-size:11px;font-weight:850}.sub{margin-top:3px}.stats{display:flex;border-top:1px solid var(--l);padding-top:9px}.stat{flex:1;min-width:0}.stat+.stat{border-left:1px solid var(--l);padding-left:10px;margin-left:9px}.number{font-size:17px;font-weight:950}
.tabs{display:flex;gap:3px;padding:4px;border:1px solid var(--l);border-radius:12px;background:var(--s);margin-bottom:10px}.tabs button{flex:1;min-width:0;border:0;border-radius:8px;background:transparent;color:var(--m);padding:8px 1px;font-size:9px;font-weight:900}.tabs button.active{background:var(--b);color:var(--bt)}
.sectionhead,.barhead{justify-content:space-between}.sectionhead{margin:0 2px 7px}.sectiontitle{font-size:12px;font-weight:950}.hint{font-weight:850}.panel{padding:11px}.barrow{margin-bottom:10px}.barrow:last-child{margin:0}.barhead{font-size:10px;margin-bottom:5px}.track{height:7px;border-radius:8px;background:var(--tg-theme-bg-color);overflow:hidden}.fill{height:100%;background:var(--b)}
.reviewlist{display:flex;flex-direction:column;gap:7px}.review{padding:9px}.title{font-size:10px;font-weight:950;line-height:1.3;overflow-wrap:anywhere}.reviewtop{align-items:flex-start;justify-content:space-between}.rating{padding:4px 6px;border-radius:7px;background:var(--b);color:var(--bt);font-size:9px;font-weight:950}.pager{justify-content:space-between;margin-top:8px}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}</style></head><body>
<div class="header"><div class="avatar" id="avatar">R</div><div class="identity"><div class="eyebrow">REVIEWTV · YOUR PROFILE</div><div class="name" id="name">Reviewer</div><div class="handle" id="handle">Community member</div></div><div class="rank" id="rank">MEMBER</div></div>
<section class="hero"><div class="herohead"><span>REVIEWER OVERVIEW</span><span>ALL TIME</span></div><div class="scoreline"><div class="scorebox"><span class="score" id="average">—</span></div><div><div class="scoremeta">Average rating</div><div class="sub"><b id="totalcaption">0 reviews</b> published by you</div></div></div><div class="stats"><div class="stat"><div class="number" id="total">0</div><div class="statlabel">Reviews</div></div><div class="stat"><div class="number" id="likes">0</div><div class="statlabel">Likes received</div></div><div class="stat"><div class="number" id="dislikes">0</div><div class="statlabel">Dislikes</div></div></div></section>
<nav class="tabs"><button id="tab0" class="active" onclick="switchTab(0)">Overview</button><button id="tab1" onclick="switchTab(1)">Categories</button><button id="tab2" onclick="switchTab(2)">Verdicts</button><button id="tab3" onclick="switchTab(3)">Recent</button></nav>
<main id="content"><div class="empty"><b>Loading your dashboard</b>Your review activity will appear here.</div></main>
<script>
var W=window.TelegramWidget||null,D={c:[],q:[],i:[]},activeTab=0,currentPage=0;
var C=['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'],V=['Absolute Cinema','Go for It','Timepass','Skip It'];
function el(id){return document.getElementById(id)}
function buzz(){try{if(W&&W.HapticFeedback&&typeof W.HapticFeedback.impactOccurred==='function')W.HapticFeedback.impactOccurred('heavy')}catch(e){}}
function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function empty(title,desc){return '<div class="empty"><b>'+safe(title)+'</b>'+safe(desc)+'</div>'}
function categories(){return C.map(function(name,i){return {name:name,count:Number(D.c[i])||0}}).filter(function(x){return x.count>0})}
function verdicts(){return V.map(function(name,i){return {name:name,count:Number(D.q[i])||0}}).filter(function(x){return x.count>0})}
function bars(items){if(!items.length)return empty('Nothing to break down yet','Your insights will appear after you publish reviews.');var max=Math.max.apply(null,items.map(function(x){return x.count}).concat([1]));return '<div class="panel">'+items.map(function(x){var width=Math.max(3,Math.round(x.count/max*100));return '<div class="barrow"><div class="barhead"><span>'+safe(x.name)+'</span><b>'+x.count+'</b></div><div class="track"><div class="fill" style="width:'+width+'%"></div></div></div>'}).join('')+'</div>'}
function overview(){var cats=categories().sort(function(a,b){return b.count-a.count}),top=cats[0];return '<div class="sectionhead"><span class="sectiontitle">Your activity</span><span class="hint">'+(D.v||0)+' VERDICTS</span></div><div class="panel"><div class="insight"><span class="insightlabel">Most reviewed category</span><span class="insightvalue">'+(top?safe(top.name):'—')+'</span></div><div class="insight"><span class="insightlabel">Verdict reviews</span><span class="insightvalue">'+(D.v||0)+'</span></div><div class="insight"><span class="insightlabel">Community rank</span><span class="insightvalue">'+(D.r?'#'+D.r:'Not in top 20')+'</span></div></div><div class="sectionhead" style="margin-top:10px"><span class="sectiontitle">Top categories</span><span class="hint">YOUR REVIEWS</span></div>'+bars(cats.slice(0,4))}
function categoryView(){return '<div class="sectionhead"><span class="sectiontitle">Reviews by category</span><span class="hint">8 CATEGORIES</span></div>'+bars(categories().sort(function(a,b){return b.count-a.count}))}
function verdictView(){return '<div class="sectionhead"><span class="sectiontitle">Your verdicts</span><span class="hint">ALL TIME</span></div>'+bars(verdicts().sort(function(a,b){return b.count-a.count}))}
function recentView(){var items=D.i||[],size=3,pages=Math.max(1,Math.ceil(items.length/size)),p=Math.min(currentPage,pages-1),visible=items.slice(p*size,p*size+size);if(!items.length)return empty('No reviews published yet','Your latest posts will show up here after your first review.')+'<button class="cta" onclick="startReview()">WRITE YOUR FIRST REVIEW</button>';var cards=visible.map(function(x){var rating=Number(x.r)||0;return '<article class="review"><div class="reviewbody"><div class="reviewtop"><div class="title">'+safe(x.t)+(x.y?' ('+x.y+(x.e?'–'+x.e:'')+')':'')+'</div><span class="rating '+(x.s==='d'?'danger':'')+'">'+(rating?rating+'/10':'—')+'</span></div><div class="category">'+safe(C[x.c]||'Review')+(x.p?' · SPOILERS':'')+'</div><div class="excerpt">'+(x.p?'Spoiler-protected · open the post to read':(x.x?safe(x.x):'No excerpt available'))+'</div><div class="reviewfoot"><span class="verdict">'+(x.v>=0?safe(V[x.v]):'')+'</span>'+(x.k?'<button class="viewpost" onclick="openPost('+items.indexOf(x)+')">VIEW POST ↗</button>':'')+'</div></div></article>'}).join('');return '<div class="sectionhead"><span class="sectiontitle">Recent reviews</span><span class="hint">'+items.length+' TOTAL</span></div><div class="reviewlist">'+cards+'</div>'+(pages>1?'<div class="pager"><button onclick="changePage(-1)" '+(p===0?'disabled':'')+'>‹ PREV</button><span class="page">'+(p+1)+' / '+pages+'</span><button onclick="changePage(1)" '+(p===pages-1?'disabled':'')+'>NEXT ›</button></div>':'')}
function render(){var target=el('content');if(!target)return;target.innerHTML=activeTab===1?categoryView():activeTab===2?verdictView():activeTab===3?recentView():overview();for(var i=0;i<4;i++){var b=el('tab'+i);if(b)b.classList.toggle('active',i===activeTab)}}
function switchTab(index){buzz();activeTab=Math.max(0,Math.min(3,Number(index)||0));currentPage=0;render()}
function changePage(step){buzz();currentPage=Math.max(0,currentPage+(Number(step)||0));render()}
function openPost(index){buzz();var item=D.i[index],url=item&&item.k;if(url&&/^https:\/\/t\.me\/[A-Za-z0-9_/-]+$/i.test(url)&&W&&typeof W.openTelegramLink==='function'){try{W.openTelegramLink(url)}catch(e){}}}
function startReview(){buzz();if(W&&typeof W.openTelegramLink==='function'){try{W.openTelegramLink('https://t.me/ReviewTvBot?start=review')}catch(e){}}}
function loadProfile(){try{var parsed=JSON.parse(W&&W.chatData?W.chatData:'{}');D={n:parsed.n||'',u:parsed.u||'',t:Number(parsed.t)||0,a:parsed.a||'—',v:Number(parsed.v)||0,l:Number(parsed.l)||0,d:Number(parsed.d)||0,r:Number(parsed.r)||0,c:Array.isArray(parsed.c)?parsed.c:[],q:Array.isArray(parsed.q)?parsed.q:[],i:Array.isArray(parsed.i)?parsed.i:[]}}catch(e){D={n:'',u:'',t:0,a:'—',v:0,l:0,d:0,r:0,c:[],q:[],i:[]}}var name=D.n||(W&&W.viewer&&W.viewer.first_name)||'Reviewer';el('name').textContent=name;el('handle').textContent=D.u?'@'+D.u:'ReviewTV member';el('avatar').textContent=(Array.from(name)[0]||'R').toLocaleUpperCase();el('rank').textContent=D.r?'#'+D.r+' REVIEWER':'MEMBER';el('average').textContent=D.a;el('totalcaption').textContent=D.t+' reviews';el('total').textContent=D.t;el('likes').textContent=D.l;el('dislikes').textContent=D.d;render();try{if(W&&typeof W.ready==='function')W.ready()}catch(e){}}
try{loadProfile()}catch(error){var target=el('content');if(target)target.innerHTML='<div class="empty"><b>Dashboard could not load</b>Close this message and send /widgetdemo again.</div>'}
</script></body></html>`;
}
