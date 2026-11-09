// Telegram sendWidget: HTML <= 32768 UTF-8 bytes and <= 4096 bytes after zlib level 9.
// chat_data <= 1024 UTF-8 bytes. The widget runs offline in QuickJS.
const bytes = (value) => new TextEncoder().encode(value).length;
const short = (value, max) => String(value ?? '').slice(0, max);

export function serializeProfileWidgetData(profile) {
  const state = {
    name: short(profile.name, 64),
    username: short(profile.username, 32),
    total: Number(profile.total) || 0,
    average: profile.average ?? '—',
    verdictTotal: Number(profile.verdictTotal) || 0,
    likes: Number(profile.likes) || 0,
    dislikes: Number(profile.dislikes) || 0,
    rank: Number(profile.rank) || 0,
    verdicts: (profile.verdicts || []).map(x => ({label:short(x.label,30),count:Number(x.count)||0})),
    categories: (profile.categories || []).map(x => ({label:short(x.label,35),count:Number(x.count)||0})),
    recent: (profile.recent || []).slice(0,5).map(x => ({
      title:short(x.title,70), year:x.year, rating:x.rating,
      category:short(x.category,25), link:/^https:\/\/t\.me\//.test(x.link||'')?x.link:''
    }))
  };
  // Remove optional detail first, never discard core metrics.
  let encoded = JSON.stringify(state);
  while (bytes(encoded) > 1024 && state.recent.length) {
    state.recent.pop(); encoded = JSON.stringify(state);
  }
  while (bytes(encoded) > 1024 && state.categories.length) {
    state.categories.pop(); encoded = JSON.stringify(state);
  }
  while (bytes(encoded) > 1024 && state.verdicts.length) {
    state.verdicts.pop(); encoded = JSON.stringify(state);
  }
  if (bytes(encoded) > 1024) {
    state.name = short(state.name, 24);
    state.username = short(state.username, 16);
    encoded = JSON.stringify(state);
  }
  if (bytes(encoded) > 1024) throw new Error('Widget chat_data exceeds 1024 bytes');
  return encoded;
}

export function buildProfileWidgetHtml() {
  return String.raw`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font-family:system-ui,sans-serif;color:var(--tg-theme-text-color);--muted:var(--tg-theme-hint-color);--panel:var(--tg-theme-secondary-bg-color);--accent:var(--tg-theme-link-color);--line:var(--tg-theme-section-separator-color)}
*{box-sizing:border-box}body{margin:0;padding:12px;font-size:13px}.head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:var(--panel);color:var(--accent);font-weight:800;font-size:18px}.identity{flex:1;min-width:0}.name{font-size:17px;font-weight:750;overflow-wrap:anywhere}.muted{color:var(--muted);font-size:11px}.hero,.panel{background:var(--panel);border-radius:13px;padding:13px;margin-bottom:11px}.score{font-size:28px;font-weight:800;margin:4px 0}.stats,.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.value{font-size:17px;font-weight:750}.label{font-size:10px;color:var(--muted)}.tabs{display:flex;gap:4px;margin:11px 0}.tabs button{flex:1;min-width:0;padding:9px 2px;font-size:11px;border:0;border-radius:8px;background:var(--panel);color:var(--tg-theme-text-color)}.tabs .active{background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}.row{display:flex;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--line)}.row:last-child{border:0}.row span:first-child{overflow-wrap:anywhere}.row strong{white-space:nowrap}.bar{height:5px;background:var(--tg-theme-bg-color);border-radius:8px;margin-top:5px}.fill{height:100%;background:var(--tg-theme-button-color);border-radius:8px}.item{margin-bottom:10px}.item:last-child{margin-bottom:0}.link{color:var(--accent)}button{cursor:pointer}.refresh{width:100%;padding:10px;border:0;border-radius:9px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);font-weight:700}.sub{font-size:11px;color:var(--muted);margin:0 0 9px}
</style></head><body>
<header class="head"><div class="avatar" id="avatar">R</div><div class="identity"><div class="name" id="name">Reviewer</div><div class="muted" id="handle">ReviewTV member</div><div class="muted" id="rank"></div></div></header>
<section class="hero"><div class="muted">Average rating</div><div class="score" id="average">— / 10</div><div class="stats"><div><div class="value" id="total">0</div><div class="label">Reviews</div></div><div><div class="value" id="likes">0</div><div class="label">Likes</div></div><div><div class="value" id="dislikes">0</div><div class="label">Dislikes</div></div></div></section>
<nav class="tabs" id="tabs"><button data-tab="overview" class="active">Overview</button><button data-tab="categories">Categories</button><button data-tab="verdicts">Verdicts</button><button data-tab="recent">Recent</button></nav>
<section id="content" class="panel"></section><button id="refresh" class="refresh">Refresh profile</button>
<script>
var W=window.TelegramWidget, d={}, tab='overview';
function e(id){return document.getElementById(id)}
function safe(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function rows(items){if(!items.length)return '<p class="muted">Nothing to show yet.</p>';var max=Math.max.apply(null,items.map(function(x){return Number(x.count)||0}).concat([1]));return items.map(function(x){return '<div class="item"><div class="row"><span>'+safe(x.label)+'</span><strong>'+safe(x.count)+'</strong></div><div class="bar"><div class="fill" style="width:'+Math.round((Number(x.count)||0)/max*100)+'%"></div></div></div>'}).join('')}
function render(){
var html='';
if(tab==='overview')html='<div class="row"><span>Published reviews</span><strong>'+safe(d.total||0)+'</strong></div><div class="row"><span>Reviews with verdicts</span><strong>'+safe(d.verdictTotal||0)+'</strong></div><div class="row"><span>Leaderboard rank</span><strong>'+(d.rank?'#'+safe(d.rank):'Not ranked')+'</strong></div>';
if(tab==='categories')html=rows(d.categories||[]);
if(tab==='verdicts')html=rows(d.verdicts||[]);
if(tab==='recent')html=(d.recent||[]).length?(d.recent||[]).map(function(x){return '<div class="row"><span><strong>'+safe(x.title)+'</strong><div class="muted">'+safe(x.category)+(x.year?' · '+safe(x.year):'')+'</div></span><strong>'+safe(x.rating)+'/10</strong></div>'+(x.link?'<button class="link" data-url="'+safe(x.link)+'">Open review</button>':'')}).join(''):'<p class="muted">No recent reviews yet.</p>';
e('content').innerHTML=html;
Array.from(e('tabs').children).forEach(function(b){b.classList.toggle('active',b.getAttribute('data-tab')===tab)});
}
function load(){try{d=JSON.parse(W.chatData||'{}')}catch(err){d={}}
e('name').textContent=d.name||'Reviewer';e('handle').textContent=d.username?'@'+d.username:'ReviewTV member';
e('avatar').textContent=(d.name||'R').trim().slice(0,1).toUpperCase();
e('rank').textContent=d.rank?'#'+d.rank+' Reviewer':'Reviewer';
e('average').textContent=(d.average||'—')+' / 10';e('total').textContent=d.total||0;e('likes').textContent=d.likes||0;e('dislikes').textContent=d.dislikes||0;render()}
e('tabs').addEventListener('click',function(ev){var b=ev.target;if(b&&b.getAttribute('data-tab')){tab=b.getAttribute('data-tab');render()}});
e('content').addEventListener('click',function(ev){var u=ev.target&&ev.target.getAttribute('data-url');if(u&&/^https:\/\/t\.me\//.test(u))W.openTelegramLink(u)});
e('refresh').addEventListener('click',function(){W.openTelegramLink('https://t.me/ReviewTvBot?start=widgetdemo')});
W.onEvent('chatDataChanged',load);load();W.ready();
</script></body></html>`;
}
