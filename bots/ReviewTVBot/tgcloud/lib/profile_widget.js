export function serializeProfileWidgetData(profile) {
  const state = {
    name: profile.name,
    username: profile.username,
    total: profile.total,
    average: profile.average,
    verdictTotal: profile.verdictTotal,
    likes: profile.likes,
    dislikes: profile.dislikes,
    rank: profile.rank,
    verdicts: profile.verdicts,
    categories: profile.categories,
    recent: profile.recent,
  };
  let encoded = JSON.stringify(state);
  const byteLength = (value) => new TextEncoder().encode(value).length;
  while (byteLength(encoded) > 1000 && state.recent.length) {
    state.recent.pop();
    encoded = JSON.stringify(state);
  }
  if (byteLength(encoded) > 1000) {
    state.categories = state.categories.slice(0, 4);
    state.verdicts = state.verdicts.slice(0, 2);
    encoded = JSON.stringify(state);
  }
  if (byteLength(encoded) > 1024) throw new Error('Profile data is too large for a Telegram widget.');
  return encoded;
}

export function buildProfileWidgetHtml() {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;padding:12px;color:var(--tg-theme-text-color);background:var(--tg-theme-bg-color)}
.header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.avatar{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);font-size:18px;font-weight:700}
.name{font-size:17px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
.handle{font-size:12px;color:var(--tg-theme-hint-color);margin-top:3px}
.rank{margin-left:auto;white-space:nowrap;border-radius:20px;padding:6px 9px;background:var(--tg-theme-secondary-bg-color);font-size:12px;font-weight:650}
.tabs{display:flex;gap:6px;overflow:hidden;margin:0 0 12px}
.tabs button{flex:1;min-width:0;padding:8px 3px;border:0;border-radius:9px;background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color);font:600 11px system-ui}
.tabs button.active{background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color)}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.card{padding:11px;border-radius:11px;background:var(--tg-theme-secondary-bg-color);min-width:0}
.value{font-size:21px;font-weight:750;line-height:1.2}
.label{font-size:11px;color:var(--tg-theme-hint-color);margin-top:4px}
.section-title{font-size:14px;font-weight:700;margin:2px 0 10px}
.row{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12px;margin:0 0 5px}
.muted{color:var(--tg-theme-hint-color)}
.track{height:6px;border-radius:8px;background:var(--tg-theme-secondary-bg-color);overflow:hidden;margin:0 0 12px}
.fill{height:100%;border-radius:8px;background:var(--tg-theme-button-color)}
.pill{display:inline-block;padding:5px 8px;border-radius:20px;background:var(--tg-theme-secondary-bg-color);font-size:11px;margin:0 5px 7px 0}
.review{padding:10px 0;border-bottom:1px solid var(--tg-theme-section-separator-color)}
.review:last-child{border:0}
.review-title{font-size:13px;font-weight:650;line-height:1.35}
.review-meta{font-size:11px;color:var(--tg-theme-hint-color);margin-top:4px}
.empty{font-size:12px;color:var(--tg-theme-hint-color);padding:14px 4px;text-align:center}
.actions{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
.refresh{border:0;border-radius:9px;padding:8px 12px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);font:600 12px system-ui}
.status{font-size:11px;color:var(--tg-theme-hint-color)}
.footer{font-size:10px;color:var(--tg-theme-hint-color);margin-top:12px;text-align:center}
@media(prefers-reduced-motion:no-preference){.card,.fill{transition:all .18s ease}}
</style></head><body>
<div class="header"><div class="avatar" id="avatar">R</div><div style="min-width:0"><div class="name" id="name">Reviewer</div><div class="handle" id="handle"></div></div><div class="rank" id="rank">Unranked</div></div>
<div class="tabs" id="tabs"><button class="active" data-tab="overview">Overview</button><button data-tab="categories">Categories</button><button data-tab="verdicts">Verdicts</button><button data-tab="recent">Recent</button></div>
<div id="content"></div>
<div class="actions"><span class="status" id="status">Profile demo</span><button class="refresh" id="refresh">↻ Refresh</button></div>
<div class="footer">ReviewTV · Profile widget preview</div>
<script>
const W=window.TelegramWidget;
let data={};
let current='overview';
const el=(id)=>document.getElementById(id);
const esc=(value)=>String(value==null?'':value).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function initials(name){return String(name||'R').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'R'}
function overview(){
 return '<div class="grid">'+
  '<div class="card"><div class="value">'+esc(data.total)+'</div><div class="label">Published reviews</div></div>'+
  '<div class="card"><div class="value">'+esc(data.average==='—'?'—':data.average+'/10')+'</div><div class="label">Average score</div></div>'+
  '<div class="card"><div class="value">'+esc(data.verdictTotal)+'</div><div class="label">Verdict-based reviews</div></div>'+
  '<div class="card"><div class="value">👍 '+esc(data.likes)+'</div><div class="label">Likes received</div></div>'+
  '<div class="card"><div class="value">👎 '+esc(data.dislikes)+'</div><div class="label">Dislikes received</div></div>'+
  '<div class="card"><div class="value">'+esc(data.rank?'#'+data.rank:'—')+'</div><div class="label">Leaderboard · Top 20</div></div>'+
 '</div>';
}
function categories(){
 const items=data.categories||[];
 if(!items.length)return '<div class="empty">No published reviews by category yet.</div>';
 const max=Math.max(1,...items.map(x=>x.count));
 return '<div class="section-title">Reviews by category</div>'+items.map(x=>'<div class="row"><span>'+esc(x.label)+'</span><strong>'+esc(x.count)+'</strong></div><div class="track"><div class="fill" style="width:'+Math.round(x.count/max*100)+'%"></div></div>').join('');
}
function verdicts(){
 const items=data.verdicts||[];
 if(!items.length)return '<div class="empty">No verdicts selected yet.</div>';
 return '<div class="section-title">Review verdicts</div>'+items.map(x=>'<span class="pill">'+esc(x.label)+' · '+esc(x.count)+'</span>').join('');
}
function recent(){
 const items=data.recent||[];
 if(!items.length)return '<div class="empty">No reviews published yet. Start with your first review!</div>';
 return '<div class="section-title">Latest published reviews</div>'+items.map(x=>'<div class="review"><div class="review-title">'+esc(x.title)+(x.year?' ('+esc(x.year)+(x.endYear?' — '+esc(x.endYear):'')+')':'')+'</div><div class="review-meta">'+esc(x.category)+' · ★ '+esc(x.rating)+'/10'+(x.verdict?' · '+esc(x.verdict):'')+'</div></div>').join('');
}
function render(){
 el('name').textContent=data.name||'Telegram user';
 el('handle').textContent=data.username?'@'+data.username:'ReviewTV reviewer';
 el('avatar').textContent=initials(data.name);
 el('rank').textContent=data.rank?'#'+data.rank+' Reviewer':'Not in top 20';
 el('content').innerHTML=current==='categories'?categories():current==='verdicts'?verdicts():current==='recent'?recent():overview();
 Array.from(el('tabs').children).forEach(button=>button.className=button.getAttribute('data-tab')===current?'active':'');
}
try{data=JSON.parse(W.chatData||'{}')}catch(e){data={}}
render();
Array.from(el('tabs').children).forEach(button=>button.addEventListener('click',()=>{current=button.getAttribute('data-tab');render();if(W.HapticFeedback)W.HapticFeedback.selectionChanged()}));
el('refresh').addEventListener('click',()=>{
 el('status').textContent='Refreshing…';
 W.request('refresh').then(answer=>{
  try{const refreshed=JSON.parse(answer.result||'{}');if(refreshed.error){el('status').textContent=refreshed.error;return}data=refreshed;current='overview';render();el('status').textContent='Updated just now'}
  catch(e){el('status').textContent='Could not read updated profile'}
 },error=>{el('status').textContent='Refresh failed: '+(error.code||'ERROR')});
});
W.ready();
</script></body></html>`;
}
