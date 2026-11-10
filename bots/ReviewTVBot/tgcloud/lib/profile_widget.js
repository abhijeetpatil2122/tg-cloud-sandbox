// ReviewTV profile dashboard. Self-contained Telegram Widget profile 1 HTML.
const utf8 = value => new TextEncoder().encode(value).length;
const cut = (value, limit) => Array.from(String(value ?? '')).slice(0, limit).join('');

export function serializeProfileWidgetData(profile) {
  const styleCode = value => value === 'success' ? 's' : value === 'danger' ? 'd' : 'p';
  const state = {
    n: cut(profile.name, 42), u: cut(profile.username, 24),
    t: Number(profile.total) || 0, a: profile.average ?? '—',
    v: Number(profile.verdictTotal) || 0, l: Number(profile.likes) || 0,
    d: Number(profile.dislikes) || 0, r: Number(profile.rank) || 0,
    c: (profile.categories || []).map(x => Number(x.count) || 0),
    q: (profile.verdicts || []).map(x => Number(x.count) || 0),
    i: (profile.recent || []).slice(0, 5).map(x => ({
      t: cut(x.title, 42), y: x.year || 0, e: x.endYear || 0,
      r: Number(x.rating) || 0, s: styleCode(x.style),
      c: cut(x.category, 18), v: cut(x.verdict, 20), q: styleCode(x.verdictStyle),
      x: x.hasSpoilers ? '' : cut(String(x.excerpt || '').replace(/\\s+/g, ' ').trim(), 58),
      p: Boolean(x.hasSpoilers),
      k: /^https:\/\/t\.me\/[A-Za-z0-9_/-]+$/i.test(String(x.link || '')) ? x.link : ''
    }))
  };
  let encoded = JSON.stringify(state);
  if (utf8(encoded) > 1024) {
    for (const item of state.i) {
      item.t = cut(item.t, 34);
      item.c = cut(item.c, 14);
      item.v = cut(item.v, 16);
      item.x = cut(item.x, 42);
    }
    encoded = JSON.stringify(state);
  }
  if (utf8(encoded) > 1024) {
    for (const item of state.i) item.k = '';
    encoded = JSON.stringify(state);
  }
  while (utf8(encoded) > 1024 && state.i.length > 2) {
    state.i.pop();
    encoded = JSON.stringify(state);
  }
  if (utf8(encoded) > 1024) throw new Error('Widget chat_data exceeds 1024 UTF-8 bytes');
  return encoded;
}

export function buildProfileWidgetHtml() {
  return String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font-family:system-ui,sans-serif;color:var(--tg-theme-text-color);--m:var(--tg-theme-subtitle-text-color,var(--tg-theme-hint-color));--s:var(--tg-theme-secondary-bg-color);--l:var(--tg-theme-section-separator-color,var(--tg-theme-hint-color));--a:var(--tg-theme-accent-text-color,var(--tg-theme-link-color)}
*{box-sizing:border-box}body{margin:0;padding:9px 11px 13px;background:transparent;color:var(--tg-theme-text-color);font-size:var(--tg-text-font-size,14px);line-height:1.35}button{font:inherit;touch-action:manipulation;cursor:pointer}button:active{transform:scale(.96)}
.head,.row,.stats,.tabs,.review,.foot,.pager{display:flex;align-items:center}.head{gap:9px;margin:1px 0 10px;animation:in .4s both}.avatar{width:44px;height:44px;flex:none;display:grid;place-items:center;border-radius:14px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);font-size:20px;font-weight:900;animation:pop .5s both}.who,.detail{flex:1;min-width:0}.k,.muted{font-size:9px;letter-spacing:.1em;font-weight:850;color:var(--m)}.name{font-size:16px;font-weight:850;line-height:1.2;overflow-wrap:anywhere;margin-top:3px}.handle,.meta,.label,.page{font-size:9px;color:var(--m);margin-top:3px}.rank{padding:6px 8px;border:1px solid var(--l);border-radius:9px;color:var(--a);font-size:9px;font-weight:850;white-space:nowrap}
.hero,.panel,.tabs{border:1px solid var(--l);border-radius:14px;background:var(--s)}.hero{padding:12px;margin-bottom:9px;animation:in .45s both}.row{justify-content:space-between;gap:7px}.ratingline{display:flex;align-items:center;gap:9px;margin:8px 0 11px}.ring{width:52px;height:52px;flex:none;border:4px solid var(--tg-theme-button-color);border-right-color:var(--l);border-radius:50%;display:grid;place-items:center;animation:ring .7s both}.score{font-size:19px;font-weight:900;transform:rotate(30deg)}.scorehint{font-size:10px;color:var(--m);margin-top:3px}.stats{border-top:1px solid var(--l);padding-top:9px}.stat{flex:1;min-width:0}.stat+.stat{border-left:1px solid var(--l);margin-left:8px;padding-left:8px}.num{font-size:16px;font-weight:900}.label{white-space:nowrap;margin-top:1px}
.tabs{gap:3px;padding:3px;margin:0 0 9px}.tabs button{flex:1;min-width:0;border:0;border-radius:9px;background:transparent;color:var(--m);padding:8px 1px;font-size:9px;font-weight:850}.tabs button.active{background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}
.panel{padding:11px 12px}.item{margin-bottom:10px}.itemhead{display:flex;justify-content:space-between;gap:8px;font-size:10px;margin-bottom:5px}.track{height:6px;border-radius:9px;background:var(--tg-theme-bg-color);overflow:hidden}.fill{height:100%;border-radius:9px;background:var(--tg-theme-button-color);animation:grow .8s both}
.tag.success{color:var(--tg-theme-button-text-color);background:var(--tg-theme-button-color);border-color:var(--tg-theme-button-color)}.tag.danger{color:var(--tg-theme-destructive-text-color,var(--m));border-color:var(--tg-theme-destructive-text-color,var(--l))}.tag.primary{color:var(--a);border-color:var(--a)}
.review{gap:8px;align-items:stretch;padding:9px 0;border-bottom:1px solid var(--l);animation:in .3s both}.cover{width:45px;min-height:72px;flex:none;border:1px solid var(--l);border-radius:9px;background:var(--tg-theme-bg-color);display:flex;flex-direction:column;align-items:center;justify-content:center}.cover b{font-size:20px;color:var(--a);line-height:1}.title{font-size:11px;font-weight:900;line-height:1.3;overflow-wrap:anywhere}.tag{flex:none;padding:4px 6px;border:1px solid var(--l);border-radius:7px;font-size:9px;font-weight:900}.excerpt{font-size:9px;line-height:1.4;margin-top:5px;overflow-wrap:anywhere}.foot{justify-content:space-between;gap:5px;margin-top:6px}.verdict{font-size:8px;font-weight:900;color:var(--a)}.open{border:1px solid var(--l);border-radius:8px;background:var(--s);color:var(--a);font-size:8px;font-weight:900;padding:6px 8px}.pager{justify-content:space-between;gap:8px;margin-top:8px}
@keyframes in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes pop{from{opacity:0;transform:scale(.8) rotate(-8deg)}to{opacity:1;transform:none}}@keyframes ring{from{transform:rotate(-30deg) scale(.7)}to{transform:rotate(-30deg) scale(1)}}@keyframes grow{from{width:0}to{width:var(--w)}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
</style></head><body>
<header class="head"><div class="avatar" id="avatar">R</div><div class="who"><div class="k">REVIEWTV · MEMBER CARD</div><div class="name" id="name">Reviewer</div><div class="handle" id="handle">Community reviewer</div></div><div class="rank" id="rank">MEMBER</div></header>
<section class="hero"><div class="row"><span class="muted">YOUR REVIEW SCORE</span><span class="muted">ALL TIME</span></div><div class="ratingline"><div class="ring"><span class="score" id="average">—</span></div><div><div class="muted">AVERAGE RATING</div><div class="scorehint"><b id="totalcaption">0 reviews</b> published by you</div></div></div><div class="stats"><div class="stat"><div class="num" id="total">0</div><div class="label">Reviews</div></div><div class="stat"><div class="num" id="likes">0</div><div class="label">Likes received</div></div><div class="stat"><div class="num" id="dislikes">0</div><div class="label">Dislikes</div></div></div></section>
<nav class="tabs"><button id="tab0" class="active" onclick="setTab(0)">Overview</button><button id="tab1" onclick="setTab(1)">Categories</button><button id="tab2" onclick="setTab(2)">Verdicts</button><button id="tab3" onclick="setTab(3)">Recent</button></nav><section id="content"></section>
<script>
var W=window.TelegramWidget,D={},tab=0,page=0,lastHaptic=0,C=['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'],V=['Absolute Cinema','Go for It','Timepass','Skip It'];
function $(x){return document.getElementById(x)}
function heavy(){var t=Date.now();if(t-lastHaptic<120)return;lastHaptic=t;try{if(W&&W.HapticFeedback&&typeof W.HapticFeedback.impactOccurred==='function')W.HapticFeedback.impactOccurred('heavy')}catch(e){}}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function sty(v){return v==='s'?'success':v==='d'?'danger':'primary'}
function cats(){return C.map(function(n,i){return {n:n,c:Number(D.c[i])||0}}).filter(function(x){return x.c>0})}
function verdicts(){return V.map(function(n,i){return {n:n,c:Number(D.q[i])||0,s:i<2?'success':i===3?'danger':'primary'}}).filter(function(x){return x.c>0})}
function empty(a,b){return '<div class="empty"><b>'+esc(a)+'</b>'+esc(b)+'</div>'}
function bars(a){if(!a.length)return empty('Nothing here yet','Publish a few reviews and your breakdown will appear.');var max=Math.max.apply(null,a.map(function(x){return x.c}).concat([1]));return '<div class="panel stagger">'+a.map(function(x){var w=Math.round(x.c/max*100);return '<div class="item"><div class="itemhead"><span>'+esc(x.n)+'</span><b>'+x.c+'</b></div><div class="track"><div class="fill" style="width:'+w+'%;--w:'+w+'%"></div></div></div>'}).join('')+'</div>'}
function overview(){return '<div class="view"><div class="row" style="margin:0 1px 7px"><b style="font-size:11px">Your activity</b><span class="muted">'+D.v+' VERDICT REVIEWS</span></div>'+bars(cats())+'</div>'}
function verdictView(){var a=verdicts().map(function(x){return {n:x.n,c:x.c}});return bars(a)}
function recent(){var a=D.i||[],size=2,pages=Math.max(1,Math.ceil(a.length/size)),p=Math.min(page,pages-1),items=a.slice(p*size,p*size+size);if(!a.length)return empty('No reviews published yet','Your newest reviews will show up here once you publish.');return '<div class="view"><div class="row" style="margin:0 1px 7px"><b style="font-size:11px">Latest reviews</b><span class="muted">'+(p*size+1)+'–'+(p*size+items.length)+' OF '+a.length+'</span></div><div class="panel stagger">'+items.map(function(x){var mark=Array.from(x.t||'R')[0]||'R';return '<article class="review"><div class="cover"><b>'+esc(mark.toLocaleUpperCase())+'</b><small>REVIEW</small></div><div class="detail"><div class="row" style="align-items:flex-start"><b class="title">'+esc(x.t)+(x.y?' ('+x.y+(x.e?'–'+x.e:'')+')':'')+'</b><span class="tag '+sty(x.s)+'">★ '+(x.r||'—')+'/10</span></div><div class="meta">'+esc(x.c||'Review')+(x.p?' · SPOILERS':'')+'</div><div class="excerpt">'+(x.p?'Spoiler-protected review. Open the full post to read it.':(x.x?esc(x.x):'No review excerpt available.'))+'</div><div class="foot"><span class="verdict '+sty(x.q)+'">'+(x.v?esc(x.v):'')+'</span>'+(x.k?'<button class="open" data-link="'+esc(x.k)+'" onclick="openReview(this)">VIEW POST ↗</button>':'')+'</div></div></article>'}).join('')+'</div>'+(pages>1?'<div class="pager"><button onclick="move(-1)" '+(p===0?'disabled':'')+'>‹ PREV</button><span class="page">'+(p+1)+' / '+pages+'</span><button onclick="move(1)" '+(p===pages-1?'disabled':'')+'>NEXT ›</button></div>':'')+'</div>'}
function draw(){var c=$('content');c.innerHTML=tab===1?'<div class="view"><div class="row" style="margin:0 1px 7px"><b style="font-size:11px">Reviews by category</b><span class="muted">ALL TIME</span></div>'+bars(cats())+'</div>':tab===2?verdictView():tab===3?recent():overview();for(var i=0;i<4;i++)$('tab'+i).classList.toggle('active',i===tab)}
function setTab(n){heavy();if(n===tab)return;tab=n;page=0;draw()}
function move(n){heavy();page=Math.max(0,page+n);draw()}
function openReview(b){heavy();var u=b.getAttribute('data-link');if(u&&/^https:\/\/t\.me\/[A-Za-z0-9_/-]+$/i.test(u)&&W.openTelegramLink)W.openTelegramLink(u)}
function load(){try{var s=JSON.parse(W.chatData||'{}');D={n:s.n||'',u:s.u||'',t:s.t||0,a:s.a||'—',v:s.v||0,l:s.l||0,d:s.d||0,r:s.r||0,c:s.c||[],q:s.q||[],i:s.i||[]}}catch(e){D={c:[],q:[],i:[]}}var n=D.n||W.viewer&&W.viewer.first_name||'Reviewer';$('name').textContent=n;$('handle').textContent=D.u?'@'+D.u:'ReviewTV member';$('avatar').textContent=(Array.from(n)[0]||'R').toLocaleUpperCase();$('rank').textContent=D.r?'#'+D.r+' REVIEWER':'MEMBER';$('average').textContent=D.a;$('totalcaption').textContent=D.t+' reviews';draw()}
document.addEventListener('pointerup',function(e){var n=e.target;while(n&&n!==document){if(n.tagName==='BUTTON'){if(!n.disabled)heavy();return}n=n.parentNode}});
load();if(W&&W.ready)W.ready();
</script></body></html>`;
}