import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { buildProfileWidgetHtml, serializeProfileWidgetData } from '../tgcloud/lib/profile_widget.js';

const html = buildProfileWidgetHtml();
const bytes = Buffer.from(html, 'utf8');
const htmlBytes = bytes.byteLength;
const compressedBytes = Number(execFileSync('python3', [
  '-c',
  'import sys,zlib; print(len(zlib.compress(sys.stdin.buffer.read(), 9)))'
], { input: bytes, encoding: 'utf8' }).trim());

console.log('ReviewTV widget: ' + htmlBytes + ' UTF-8 bytes HTML; ' + compressedBytes + ' bytes zlib level 9.');
if (!htmlBytes || htmlBytes > 32768) throw new Error('Widget HTML exceeds Telegram’s 32768-byte limit.');
if (compressedBytes > 3800) throw new Error('Widget is too close to Telegram’s 4096-byte compressed limit.');
if (html.includes(String.fromCharCode(0))) throw new Error('Widget HTML contains a NUL character.');

const script = html.match(/<script>([\s\S]*?)<\/script>/i);
const style = html.match(/<style>([\s\S]*?)<\/style>/i);
if (!script || !style) throw new Error('Inline JavaScript and CSS are required.');
new Script(script[1]);

const required = [
  'window.TelegramWidget', 'W.chatData',
  "impactOccurred('heavy')", 'openTelegramLink', 'prefers-reduced-motion',
  'id="tab0"', 'id="tab1"', 'id="tab2"', 'id="tab3"',
  'function switchTab(', 'function changePage(', 'function openPost(',
  'function startReview(', 'class="hero"', 'class="reviewlist"',
  '--tg-theme-bg-color', '--tg-theme-text-color', '--tg-theme-hint-color',
  '--tg-theme-button-color', '--tg-theme-button-text-color'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error('Missing widget feature: ' + marker);
}
for (const forbidden of ['<input', '<textarea', '<select', 'fetch(', 'XMLHttpRequest', 'WebSocket', '<script src=', '<link rel=', 'overflow:auto', 'overflow:scroll']) {
  if (html.includes(forbidden)) throw new Error('Unsupported widget feature found: ' + forbidden);
}

const categoryLabels = ['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'];
const verdictLabels = ['Absolute Cinema','Go for It','Timepass','Skip It'];
const sample = serializeProfileWidgetData({
  name: 'ReviewTV Member 🇮🇳', username: 'reviewer_test', total: 128, average: '8.6',
  verdictTotal: 92, likes: 420, dislikes: 12, rank: 3,
  categories: categoryLabels.map((label, i) => ({ label, count: 20 - i })),
  verdicts: verdictLabels.map((label, i) => ({ label, count: 30 - i })),
  recent: Array.from({ length: 5 }, (_, i) => ({
    title: 'A sample movie title with a longer name ' + i, year: 2024, rating: 8,
    style: 'success', category: categoryLabels[i], verdict: verdictLabels[i % 4],
    excerpt: 'A thoughtful review excerpt that previews the published review content.',
    hasSpoilers: i === 4, link: 'https://t.me/review_tv/12345'
  }))
});
const stateBytes = Buffer.byteLength(sample, 'utf8');
const data = JSON.parse(sample);
if (stateBytes > 1024) throw new Error('Profile chat_data exceeds Telegram’s 1024-byte limit.');
if (data.i.length !== 5) throw new Error('The five latest review cards should fit in the sample state.');
if (!data.i[0].x || data.i[4].x !== '' || data.i[4].p !== true) throw new Error('Review excerpt/spoiler serialization is incorrect.');
if (data.i[0].c !== 0 || data.i[1].c !== 1 || data.i[0].v !== 0 || data.i[1].v !== 1) throw new Error('Category/verdict indexes are incorrect.');
if (data.c.length !== 8 || data.q.length !== 4 || data.c[0] !== 20 || data.q[0] !== 30) throw new Error('Category or verdict breakdown is incomplete.');
console.log('Profile chat_data: ' + stateBytes + '/1024 bytes; ' + data.i.length + ' recent reviews; category/verdict indexes verified.');
