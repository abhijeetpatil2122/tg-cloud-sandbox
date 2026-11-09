function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

export function getInitialState(id) {
  if (id === 'shared_poll') return { votes: [0, 0, 0], total: 0 };
  if (id === 'reaction_counter') return { count: 0 };
  if (id === 'live_dashboard') return { visitors: 128, tasks: 7, progress: 64 };
  if (id === 'leaderboard') return { myScore: 72, scores: [{ name: 'Alex', score: 120 }, { name: 'Sam', score: 95 }, { name: 'You', score: 72 }] };
  if (id === 'quick_quiz') return { answered: false, correct: 0 };
  if (id === 'clicker') return { count: 0 };
  if (id === 'rating') return { rating: 0 };
  if (id === 'progress_tracker') return { progress: 25 };
  if (id === 'number_guess') return { attempts: 0, result: '' };
  return {};
}

const STYLE = `
:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;padding:12px;font-family:system-ui,sans-serif;color:var(--tg-theme-text-color);background:transparent}
h2{font-size:18px;margin:0 0 5px;font-weight:700}p{margin:5px 0;color:var(--tg-theme-hint-color);font-size:13px;line-height:1.4}
.card{background:var(--tg-theme-secondary-bg-color);border-radius:14px;padding:12px;margin:10px 0}
.row{display:flex;gap:8px;align-items:center}.between{justify-content:space-between}
button{border:0;border-radius:10px;padding:10px 12px;background:var(--tg-theme-button-color);color:var(--tg-theme-button-text-color);font:600 13px system-ui;cursor:pointer;min-height:38px}
button.secondary{background:var(--tg-theme-secondary-bg-color);color:var(--tg-theme-text-color);border:1px solid var(--tg-theme-section-separator-color)}
button:disabled{opacity:.45}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.full{width:100%}
.big{font-size:30px;font-weight:750;letter-spacing:-1px}.muted{color:var(--tg-theme-hint-color);font-size:12px}.accent{color:var(--tg-theme-link-color)}
.bar{height:8px;background:var(--tg-theme-section-separator-color);border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:var(--tg-theme-button-color);border-radius:99px}
.option{display:block;width:100%;text-align:left;margin:7px 0}.status{font-size:12px;min-height:18px;color:var(--tg-theme-hint-color);margin-top:8px}
.small{font-size:11px}.pill{display:inline-block;padding:4px 8px;border-radius:99px;background:var(--tg-theme-secondary-bg-color);font-size:11px}
`;

function contentFor(id, title, description) {
  const intro = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p>`;
  const map = {
    shared_poll: `${intro}<div class="card"><b>Which widget category should we expand next?</b><div id="options"></div><div class="row between"><span class="muted" id="total">0 votes</span><span class="pill">Shared state</span></div></div><div class="status" id="status">Choose an option to vote.</div>`,
    quick_quiz: `${intro}<div class="card"><b>Which API method answers a widget request?</b><div id="options"></div><div class="status" id="status">One correct answer.</div></div>`,
    rating: `${intro}<div class="card"><b>How useful is this widget demo?</b><div class="row" id="stars"></div><div class="status" id="status">Tap a rating.</div></div>`,
    clicker: `${intro}<div class="card"><div class="muted">YOUR SCORE</div><div class="big" id="count">0</div><button id="tap" class="full">+1 Tap</button></div><div class="status" id="status">Each tap is sent to the bot.</div>`,
    reaction_counter: `${intro}<div class="card"><div class="row between"><span>Community reactions</span><b class="big" id="count">0</b></div><button id="react" class="full">Add reaction</button></div><div class="status" id="status">Shared public state.</div>`,
    progress_tracker: `${intro}<div class="card"><div class="row between"><b>Project progress</b><b id="value">25%</b></div><div class="bar"><i id="fill" style="width:25%"></i></div><div class="row" style="margin-top:12px"><button id="minus" class="secondary">−10</button><button id="plus">+10</button></div></div><div class="status" id="status">Progress is stored in chat_data.</div>`,
    number_guess: `${intro}<div class="card"><b>Guess a number from 1 to 5</b><div class="grid" id="choices"></div><div class="status" id="status">Try your luck.</div></div>`,
    tic_tac_toe: `${intro}<div class="card"><div class="row between"><b id="turn">X's turn</b><button class="secondary" id="reset">Reset</button></div><div class="grid" id="board" style="grid-template-columns:repeat(3,1fr);margin-top:10px"></div><div class="status" id="status">Local two-player demo.</div></div>`,
    memory_game: `${intro}<div class="card"><div class="row between"><b>Match the pairs</b><span id="moves" class="pill">0 moves</span></div><div class="grid" id="cards" style="margin-top:10px"></div><div class="status" id="status">Find all 4 pairs.</div></div>`,
    live_dashboard: `${intro}<div class="grid"><div class="card"><div class="muted">VISITORS</div><div class="big" id="visitors">128</div></div><div class="card"><div class="muted">OPEN TASKS</div><div class="big" id="tasks">7</div></div></div><div class="card"><div class="row between"><b>Completion</b><b id="progress">64%</b></div><div class="bar"><i id="fill" style="width:64%"></i></div><button id="refresh" class="full" style="margin-top:10px">Refresh demo data</button></div><div class="status" id="status">Shared dashboard state.</div>`,
    leaderboard: `${intro}<div class="card"><b>Widget Playground rankings</b><div id="scores"></div><button id="score" class="full">Add 10 points to me</button></div><div class="status" id="status">Shared public state.</div>`,
    countdown: `${intro}<div class="card"><div class="muted">NEXT DEMO DROP</div><div class="big" id="timer">00:15</div><p>Local countdown example.</p><button id="restart" class="secondary">Restart</button></div>`,
    calculator: `${intro}<div class="card"><div id="display" class="big">0</div><div class="grid" id="keys" style="margin-top:8px"></div></div>`,
    random_picker: `${intro}<div class="card"><p>Pick one at random</p><div class="big" id="picked">—</div><button id="pick" class="full">Pick for me</button></div>`,
    tip_calculator: `${intro}<div class="card"><b>Split a sample bill</b><p>Choose a preset bill, tip, and group size.</p><div class="row"><button class="secondary" data-bill="100">₹100</button><button class="secondary" data-bill="250">₹250</button><button class="secondary" data-bill="500">₹500</button></div><div class="row" style="margin-top:8px"><button class="secondary" data-tip="5">5%</button><button class="secondary" data-tip="10">10%</button><button class="secondary" data-tip="15">15%</button></div><div class="row" style="margin-top:8px"><button class="secondary" data-people="1">1 person</button><button class="secondary" data-people="2">2 people</button><button class="secondary" data-people="4">4 people</button></div><div class="big" id="result" style="margin-top:10px">₹55.00 each</div></div>`,
    wallet_card: `${intro}<div class="card"><b>Telegram TON Wallet</b><p>Request the wallet card through Telegram. The user approves the interaction in their client.</p><button id="wallet" class="full">Request wallet card</button><div class="status" id="status">No wallet data requested yet.</div></div><p class="small">Only public wallet metadata is shown. Never share recovery phrases or private keys.</p>`,
    wallet_sign: `${intro}<div class="card"><b>Wallet-signed data</b><p>Ask the supported wallet interface to sign a short demo payload. Review and approve it in Telegram.</p><button id="sign" class="full">Sign demo message</button><div class="status" id="status">Wallet approval is required.</div></div>`,
    wallet_transaction: `${intro}<div class="card"><b>Transaction notification</b><p>This example displays a transaction notification when Telegram supplies a sent-transaction query. It does not initiate a transfer.</p><div class="status" id="status">No transaction notification received.</div></div>`,
    basic_widget: `${intro}<div class="card"><div class="big">Hello, Widget.</div><p>This is a self-contained HTML document with inline styles and JavaScript.</p><span class="pill">No external resources</span></div>`,
    theme_demo: `${intro}<div class="card"><b>Current Telegram theme</b><div id="theme" class="status"></div><div class="grid"><div class="pill">Background</div><div class="pill">Text</div><div class="pill">Button</div><div class="pill">Hint</div></div></div>`,
    query_roundtrip: `${intro}<div class="card"><b>Request → Bot → Result</b><p>Tap to send a small request to PWidgetBot and display the bot's response.</p><button id="request" class="full">Send request</button><div class="status" id="status">Waiting for your action.</div></div>`,
    message_state: `${intro}<div class="card"><div class="muted">MESSAGE-SCOPED STATE</div><div class="big" id="count">0</div><button id="increment" class="full">Update chat_data</button></div><div class="status" id="status">This state belongs to this message.</div>`,
    shared_state: `${intro}<div class="card"><div class="muted">SHARED PUBLIC STATE</div><div class="big" id="count">0</div><button id="increment" class="full">Update public_data</button></div><div class="status" id="status">This example is sent as a shared widget.</div>`,
    api_reference: `${intro}<div class="card"><b>Bot API 10.4 widget methods</b><p>sendWidget · sendSharedWidget · answerWidgetQuery · editMessageWidgetData · editSharedWidgetData</p><hr/><b>Widget SDK</b><p>TelegramWidget.request · chatData · publicData · watchPublicData · wallet</p></div>`,
  };
  return map[id] || `${intro}<div class="card">Demo coming soon.</div>`;
}

const SCRIPT = `
const W=window.TelegramWidget, DEMO_ID=__DEMO_ID__;
const $=id=>document.getElementById(id);
const parse=(v,f={})=>{try{return v?JSON.parse(v):f}catch{return f}};
const getState=()=>parse(W.chatData||W.publicData,{});
const status=t=>{if($('status'))$('status').textContent=t};
const setText=(id,v)=>{if($(id))$(id).textContent=String(v)};
const stateToken=()=>{const s=getState();switch(DEMO_ID){
case 'shared_poll':return (s.votes||[0,0,0]).join(',');
case 'reaction_counter':case 'clicker':case 'message_state':case 'shared_state':return String(s.count||0);
case 'progress_tracker':return String(s.progress??25);
case 'live_dashboard':return [s.visitors??128,s.tasks??7,s.progress??64].join(',');
case 'leaderboard':return String(s.myScore??72);
case 'number_guess':return String(s.attempts||0);
default:return ''}};
const request=async(action)=>{try{const r=await W.request(action+'|'+stateToken());if(r&&r.result){const v=parse(r.result,null);status(v&&v.message?v.message:String(r.result));}return r}catch(e){status('Request failed: '+(e.code||e.message||'unavailable'));return null}};
const render=()=>{const s=getState();
if($('count'))setText('count',s.count||0);if($('total'))setText('total',(s.total||0)+' votes');
if($('visitors'))setText('visitors',s.visitors??128);if($('tasks'))setText('tasks',s.tasks??7);
if($('progress'))setText('progress',(s.progress??64)+'%');if($('fill'))$('fill').style.width=(s.progress??(DEMO_ID==='progress_tracker'?25:64))+'%';
if($('value'))setText('value',(s.progress??25)+'%');
if($('options')&&DEMO_ID==='shared_poll'&&s.votes){$('options').innerHTML=['Interactive','Games','Developer tools'].map((v,i)=>'<button class="option" data-vote="'+i+'">'+v+' · '+(s.votes[i]||0)+'</button>').join('')}
if($('options')&&DEMO_ID==='quick_quiz')$('options').innerHTML=['answerCallbackQuery','answerWidgetQuery','editMessageWidgetData'].map((v,i)=>'<button class="option" data-quiz="'+i+'">'+v+'</button>').join('');
if($('scores')&&s.scores){$('scores').innerHTML=s.scores.map((v,i)=>'<div class="row between" style="padding:7px 0"><span>'+(i+1)+'. '+v.name+'</span><b>'+v.score+'</b></div>').join('')}
};
if(W&&W.onEvent){W.onEvent('chatDataChanged',render);W.onEvent('publicDataChanged',render)}\nif(['shared_poll','reaction_counter','live_dashboard','leaderboard','shared_state'].includes(DEMO_ID)&&W&&typeof W.watchPublicData==='function')W.watchPublicData();\nrender();
if($('tap'))$('tap').onclick=()=>request('clicker:tap');
if($('react'))$('react').onclick=()=>request('reaction:add');
if($('plus'))$('plus').onclick=()=>request('progress:10');
if($('minus'))$('minus').onclick=()=>request('progress:-10');
if($('increment'))$('increment').onclick=()=>request('state:increment');
if($('score'))$('score').onclick=()=>request('leaderboard:score');
if($('refresh'))$('refresh').onclick=()=>request('dashboard:refresh');
if($('options'))$('options').onclick=e=>{const v=e.target.closest('[data-vote]');if(v)request('vote:'+v.dataset.vote);const q=e.target.closest('[data-quiz]');if(q)request('quiz:'+q.dataset.quiz)};
if($('stars')){$('stars').innerHTML=[1,2,3,4,5].map(n=>'<button data-rating="'+n+'">★ '+n+'</button>').join('');$('stars').onclick=e=>{const b=e.target.closest('[data-rating]');if(b)request('rating:'+b.dataset.rating)}}
if($('choices')){$('choices').innerHTML=[1,2,3,4,5].map(n=>'<button data-guess="'+n+'">'+n+'</button>').join('');$('choices').onclick=e=>{const b=e.target.closest('[data-guess]');if(b)request('guess:'+b.dataset.guess)}}
if($('request'))$('request').onclick=()=>request('demo:ping');
if($('wallet'))$('wallet').onclick=async()=>{try{const r=await W.request('wallet:card',{wallet:true});status(r?.result||'Wallet response received.')}catch(e){status('Wallet request: '+(e.code||e.message||'cancelled'))}};
if($('sign'))$('sign').onclick=async()=>{try{if(!W.wallet||typeof W.wallet.signData!=='function'){status('Wallet signing is not available in this client.');return}const r=await W.wallet.signData({type:'text',text:'PWidgetBot demo verification'},'wallet:sign');status(r?.result||'Signature response received.')}catch(e){status('Signing cancelled or unavailable: '+(e.code||e.message||''))}};
if($('theme')){const t=W.themeParams||{};$('theme').textContent='Scheme: '+(W.colorScheme||'unknown')+' · '+Object.keys(t).join(', ')}
if($('pick'))$('pick').onclick=()=>setText('picked',['Widget Lab','TON','Mini Games','Developer tools'][Math.floor(Math.random()*4)]);
if($('calc'))$('calc').onclick=()=>{};
if($('keys')){const keys=['7','8','9','÷','4','5','6','×','1','2','3','−','0','.','=','+'];let expr='';$('keys').innerHTML=keys.map(k=>'<button data-key="'+k+'" class="secondary">'+k+'</button>').join('');$('keys').onclick=e=>{const b=e.target.closest('[data-key]');if(!b)return;const k=b.dataset.key;if(k==='='){const m=expr.match(/^(-?\\d+(?:\\.\\d+)?)([+\\-*/])(-?\\d+(?:\\.\\d+)?)$/);if(!m){setText('display','Use two numbers');return}const a=Number(m[1]),c=Number(m[3]);const out=m[2]==='+'?a+c:m[2]==='-'?a-c:m[2]==='*'?a*c:c===0?'Error':a/c;expr=String(out)}else expr+=k;setText('display',expr||'0')}};
if($('restart')){let left=15;const tick=()=>{setText('timer','00:'+String(left).padStart(2,'0'));if(left>0)left--};tick();setInterval(tick,1000);$('restart').onclick=()=>{left=15;tick()}}
if($('reset')){let board=Array(9).fill(''),turn='X';const draw=()=>{$('board').innerHTML=board.map((v,i)=>'<button class="secondary" data-cell="'+i+'" style="height:54px;font-size:22px">'+v+'</button>').join('');setText('turn',turn+"'s turn")};draw();$('reset').onclick=()=>{board=Array(9).fill('');turn='X';status('Local two-player demo.');draw()};$('board').onclick=e=>{const b=e.target.closest('[data-cell]');if(!b||board[Number(b.dataset.cell)])return;board[Number(b.dataset.cell)]=turn;const wins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];const win=wins.some(a=>a.every(i=>board[i]===turn));if(win)status(turn+' wins!');else if(board.every(Boolean))status('Draw.');else turn=turn==='X'?'O':'X';draw()}};
if($('cards')){const vals=['●','▲','■','◆','★','♥','●','▲','■','◆','★','♥'].sort(()=>Math.random()-.5);let opened=[],matched=[],moves=0;$('cards').innerHTML=vals.map((v,i)=>'<button class="secondary" data-card="'+i+'">?</button>').join('');$('cards').onclick=e=>{const b=e.target.closest('[data-card]'),i=Number(b?.dataset.card);if(!b||opened.includes(i)||matched.includes(i)||opened.length===2)return;opened.push(i);b.textContent=vals[i];if(opened.length===2){moves++;setText('moves',moves+' moves');if(vals[opened[0]]===vals[opened[1]])matched.push(...opened);setTimeout(()=>{opened.forEach(j=>{if(!matched.includes(j))$('cards').querySelector('[data-card="'+j+'"]').textContent='?'});opened=[];if(matched.length===12)status('All pairs matched!')},450)}}}
if(DEMO_ID==='tip_calculator'){let bill=100,tip=10,people=2;const calc=()=>setText('result','₹'+((bill*(1+tip/100))/people).toFixed(2)+' each');document.body.onclick=e=>{const b=e.target.closest('[data-bill],[data-tip],[data-people]');if(!b)return;if(b.dataset.bill)bill=Number(b.dataset.bill);if(b.dataset.tip)tip=Number(b.dataset.tip);if(b.dataset.people)people=Number(b.dataset.people);calc()}}\nif(W&&W.ready)W.ready();
`;
export function buildWidgetHtml(id, title, description) {
  const body = contentFor(id, title, description);
  const script = SCRIPT.replace('__DEMO_ID__', JSON.stringify(id));
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + STYLE + '</style></head><body>' + body + '<script>' + script + '<\\/script></body></html>';
}
