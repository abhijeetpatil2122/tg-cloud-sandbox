// Telegram widgets are offline QuickJS documents: <=32 KB HTML, <=4 KB zlib-9,
// and <=1024 UTF-8 bytes for chat_data.
const bytes = (value) => new TextEncoder().encode(value).length;
const short = (value, max) => String(value ?? '').slice(0, max);

export function serializeProfileWidgetData(profile, widgetMessageId = null) {
  const state = {
    name: short(profile.name, 64), username: short(profile.username, 32),
    total: Number(profile.total) || 0, average: profile.average ?? '—',
    verdictTotal: Number(profile.verdictTotal) || 0,
    likes: Number(profile.likes) || 0, dislikes: Number(profile.dislikes) || 0,
    rank: Number(profile.rank) || 0,
    widgetMessageId: Number(widgetMessageId) || 0,
    verdicts: (profile.verdicts || []).map(x => ({label:short(x.label,30),count:Number(x.count)||0})),
    categories: (profile.categories || []).map(x => ({label:short(x.label,35),count:Number(x.count)||0})),
    recent: (profile.recent || []).slice(0,5).map(x => ({
      title:short(x.title,70),year:x.year,rating:x.rating,
      category:short(x.category,25),link:/^https:\/\/t\.me\//.test(x.link||'')?x.link:''
    }))
  };
  let encoded = JSON.stringify(state);
  while (bytes(encoded) > 1024 && state.recent.length) { state.recent.pop(); encoded = JSON.stringify(state); }
  while (bytes(encoded) > 1024 && state.categories.length) { state.categories.pop(); encoded = JSON.stringify(state); }
  while (bytes(encoded) > 1024 && state.verdicts.length) { state.verdicts.pop(); encoded = JSON.stringify(state); }
  if (bytes(encoded) > 1024) {
    state.name = short(state.name,24); state.username = short(state.username,16);
    encoded = JSON.stringify(state);
  }
  if (bytes(encoded) > 1024) throw new Error('Widget chat_data exceeds 1024 bytes');
  return encoded;
}

export function buildProfileWidgetHtml() {
  return String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--tg-theme-text-color);--muted:var(--tg-theme-hint-color);--surface:var(--tg-theme-secondary-bg-color);--accent:var(--tg-theme-accent-text-color,var(--tg-theme-link-color));--line:var(--tg-theme-section-separator-color)}
*{box-sizing:border-box}body{margin:0;padding:12px 13px 18px;font-size:13px;background:var(--tg-theme-bg-color);color:var(--tg-theme-text-color)}
button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}.top{display:flex;align-items:center;gap:11px;margin:2px 0 15px}.avatar{width:48px;height:48px;flex:none;border-radius:16px;display:grid;place-items:center;background:var(--surface);color:var(--accent);font-size:19px;font-weight:800}.identity{flex:1;min-width:0}.name{font-size:17px;line-height:1.2;font-weight:760;letter-spacing:-.35px;overflow-wrap:anywhere}.handle{font-size:11px;color:var(--muted);margin-top:4px}.rank{display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:4px 8px;border-radius:99px;background:var(--surface);font-size:10px;font-weight:700;color:var(--accent)}.rank-dot{width:5px;height:5px;border-radius:50%;background:var(--accent)}
.refresh-icon{width:36px;height:36px;flex:none;border:1px solid var(--line);border-radius:50%;background:var(--surface);color:var(--accent);font-size:17px;display:grid;place-items:center}.hero{position:relative;overflow:hidden;padding:15px;border:1px solid var(--line);border-radius:18px;background:var(--surface);margin-bottom:12px}.hero-label{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:750}.hero-score{display:flex;align-items:baseline;gap:5px;margin:4px 0 13px}.score{font-size:34px;line-height:1;font-weight:820;letter-spacing:-1.5px}.outof{font-size:12px;color:var(--muted);font-weight:650}.hero-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;border-top:1px solid var(--line);padding-top:11px}.stat{min-width:0}.stat-value{font-size:17px;font-weight:760;letter-spacing:-.3px;font-variant-numeric:tabular-nums}.stat-label{font-size:10px;color:var(--muted);margin-top:3px}
.tabs{display:flex;gap:3px;padding:4px;border-radius:99px;background:var(--surface);border:1px solid var(--line);margin:0 0 12px}.tabs button{flex:1;min-width:0;border:0;border-radius:99px;padding:8px 2px;background:transparent;color:var(--muted);font-size:10px;font-weight:720;white-space:nowrap}.tabs button.active{background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:3px 1px 9px}.section-title{font-size:13px;font-weight:760;letter-spacing:-.15px}.section-note{font-size:10px;color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.card{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--surface);min-width:0}.card-kicker{font-size:10px;color:var(--muted)}.card-value{font-size:21px;font-weight:790;letter-spacing:-.6px;margin-top:5px}.card-foot{font-size:10px;color:var(--muted);margin-top:3px}
.panel{padding:12px 13px;border:1px solid var(--line);border-radius:15px;background:var(--surface)}.item{margin-bottom:12px}.item:last-child{margin-bottom:0}.item-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;margin-bottom:6px}.item-label{min-width:0;overflow-wrap:anywhere}.item-count{font-weight:760;font-variant-numeric:tabular-nums}.track{height:6px;border-radius:99px;background:var(--tg-theme-bg-color);overflow:hidden}.fill{height:100%;border-radius:99px;background:var(--tg-theme-button-color);min-width:2px}
.review{padding:10px 0;border-bottom:1px solid var(--line)}.review:first-child{padding-top:0}.review:last-child{border:0;padding-bottom:0}.review-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.review-title{font-size:12px;font-weight:720;line-height:1.35;overflow-wrap:anywhere}.rating{flex:none;padding:4px 7px;border-radius:99px;background:var(--tg-theme-bg-color);font-size:10px;font-weight:760;color:var(--accent)}.review-meta{font-size:10px;color:var(--muted);margin-top:4px}.review-link{border:0;background:transparent;color:var(--accent);padding:6px 0 0;font-size:10px;font-weight:720}.empty{padding:19px 8px;text-align:center;color:var(--muted);font-size:11px;line-height:1.5}.empty strong{display:block;color:var(--tg-theme-text-color);font-size:12px;margin-bottom:4px}.foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:11px 2px 0}.foot-note{font-size:9px;color:var(--muted)}.refresh-text{border:0;border-radius:99px;padding:7px 11px;background:var(--surface);color:var(--accent);font-size:10px;font-weight:740}
@media(prefers-reduced-motion:no-preference){.tabs button,.refresh-icon,.refresh-text{transition:background .15s ease,transform .15s ease}.refresh-icon:active,.refresh-text:active{transform:scale(.96)}}
</style></head><body>
<header class="top"><div class="avatar" id="avatar">R</div><div class="identity"><div class="name" id="name">Reviewer</div><div class="handle" id="handle">ReviewTV member</div><div class="rank"><span class="rank-dot"></span><span id="rank">Community reviewer</span></div></div><button class="refresh-icon" id="refresh-top" type="button" title="Refresh profile">↻</button></header>
<section class="hero"><div class="hero-label">Average rating</div><div class="hero-score"><span class="score" id="average">—</span><span class="outof">/ 10</span></div><div class="hero-grid"><div class="stat"><div class="stat-value" id="total">0</div><div class="stat-label">Reviews</div></div><div class="stat"><div class="stat-value" id="likes">0</div><div class="stat-label">Likes received</div></div><div class="stat"><div class="stat-value" id="dislikes">0</div><div class="stat-label">Dislikes</div></div></div></section>
<nav class="tabs" id="tabs"><button class="active" data-tab="overview" type="button">Overview</button><button data-tab="categories" type="button">Genres</button><button data-tab="verdicts" type="button">Verdicts</button><button data-tab="recent" type="button">Recent</button></nav>
<section id="content"></section><footer class="foot"><span class="foot-note">REVIEWTV · REVIEWER INSIGHTS</span><button class="refresh-text" id="refresh-bottom" type="button">↻ Refresh data</button></footer>
<script>
var W=window.TelegramWidget,d={},tab='overview',busy=false;
function el(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function empty(title,copy){return '<div class="panel empty"><strong>'+esc(title)+'</strong>'+esc(copy)+'</div>'}
function bars(items){if(!items.length)return empty('Nothing here yet','Your published activity will appear here.');var max=Math.max.apply(null,items.map(function(x){return Number(x.count)||0}).concat([1]));return '<div class="panel">'+items.map(function(x){var n=Number(x.count)||0;return '<div class="item"><div class="item-head"><span class="item-label">'+esc(x.label)+'</span><strong class="item-count">'+n+'</strong></div><div class="track"><div class="fill" style="width:'+Math.min(100,Math.round(n/max*100))+'%"></div></div></div>'}).join('')+'</div>'}
function overview(){return '<div class="section-head"><span class="section-title">Your activity</span><span class="section-note">All time</span></div><div class="cards"><div class="card"><div class="card-kicker">Verdict reviews</div><div class="card-value">'+esc(d.verdictTotal||0)+'</div><div class="card-foot">With a personal verdict</div></div><div class="card"><div class="card-kicker">Leaderboard</div><div class="card-value">'+(d.rank?'#'+esc(d.rank):'—')+'</div><div class="card-foot">'+(d.rank?'Top 20 reviewer':'Not ranked yet')+'</div></div></div><div class="section-head" style="margin-top:15px"><span class="section-title">Category breakdown</span><span class="section-note">Published</span></div>'+(d.categories&&d.categories.length?bars(d.categories.slice(0,5)):empty('Your journey starts here','Publish your first review to see your stats.'))}
function recent(){var list=d.recent||[];if(!list.length)return empty('No reviews yet','Your latest published reviews will show up here.');return '<div class="section-head"><span class="section-title">Latest reviews</span><span class="section-note">'+list.length+' shown</span></div><div class="panel">'+list.map(function(x){return '<article class="review"><div class="review-top"><div class="review-title">'+esc(x.title)+(x.year?' ('+esc(x.year)+')':'')+'</div><span class="rating">'+esc(x.rating)+'/10</span></div><div class="review-meta">'+esc(x.category)+'</div>'+(x.link?'<button class="review-link" data-url="'+esc(x.link)+'">Open published review ↗</button>':'')+'</article>'}).join('')+'</div>'}
function render(){var html=tab==='categories'?bars(d.categories||[]):tab==='verdicts'?bars(d.verdicts||[]):tab==='recent'?recent():overview();el('content').innerHTML=html;Array.from(el('tabs').children).forEach(function(b){b.classList.toggle('active',b.getAttribute('data-tab')===tab)})}
function load(){try{d=JSON.parse(W.chatData||'{}')}catch(e){d={}}el('name').textContent=d.name||'Reviewer';el('handle').textContent=d.username?'@'+d.username:'ReviewTV member';el('avatar').textContent=(d.name||'R').trim().slice(0,1).toUpperCase();el('rank').textContent=d.rank?'#'+d.rank+' Reviewer':'Community reviewer';el('average').textContent=d.average||'—';el('total').textContent=d.total||0;el('likes').textContent=d.likes||0;el('dislikes').textContent=d.dislikes||0;render();busy=false}
function refresh(){if(busy)return;busy=true;W.openTelegramLink('https://t.me/ReviewTvBot?start=widgetrefresh_'+String(d.widgetMessageId||0))}
el('tabs').addEventListener('click',function(ev){var b=ev.target;if(b&&b.getAttribute('data-tab')){tab=b.getAttribute('data-tab');render()}});
el('content').addEventListener('click',function(ev){var n=ev.target;var u=n&&n.getAttribute('data-url');if(u&&/^https:\/\/t\.me\//.test(u))W.openTelegramLink(u)});
el('refresh-top').addEventListener('click',refresh);el('refresh-bottom').addEventListener('click',refresh);
W.onEvent('chatDataChanged',load);load();W.ready();
</script></body></html>`;
}
