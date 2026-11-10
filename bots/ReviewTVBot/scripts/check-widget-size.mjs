import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';
import { buildProfileWidgetHtml, serializeProfileWidgetData } from '../tgcloud/lib/profile_widget.js';

const html = buildProfileWidgetHtml();
const htmlBuffer = Buffer.from(html, 'utf8');
const htmlBytes = htmlBuffer.byteLength;
const compressedBytes = Number(execFileSync('python3', [
  '-c',
  'import sys,zlib; print(len(zlib.compress(sys.stdin.buffer.read(), 9)))'
], { input: htmlBuffer, encoding: 'utf8' }).trim());

console.log(`ReviewTV widget: ${htmlBytes} UTF-8 bytes HTML; ${compressedBytes} bytes zlib level 9 (Telegram's compressor).`);
if (htmlBytes < 1 || htmlBytes > 32768) throw new Error('Widget HTML must be between 1 and 32768 UTF-8 bytes.');
if (compressedBytes > 3800) throw new Error('Widget is too close to Telegram’s 4096-byte compressed limit; keep at least 296 bytes of headroom.');
if (html.includes(String.fromCharCode(0))) throw new Error('Widget HTML contains a NUL character.');

const script = html.match(/<script>([\\s\\S]*?)<\\/script>/);
const style = html.match(/<style>([\\s\\S]*?)<\\/style>/);
if (!script || !style) throw new Error('Inline JavaScript and CSS are both required.');
new Script(script[1]);

const required = [
  'id="avatar"', 'id="average"', 'id="total"', 'id="likes"', 'id="dislikes"',
  'id="tab0"', 'id="tab1"', 'id="tab2"', 'id="tab3"', 'id="content"',
  'class="hero"', 'class="tabs"', 'class="reviewlist"', 'class="poster"',
  'class="excerpt"', 'class="viewpost"', 'class="pager"',
  'onclick="switchTab(', 'onclick="changePage(', 'onclick="openPost(',
  "impactOccurred('heavy')", 'openTelegramLink', 'W.chatData', 'W.ready()',
  '@keyframes rise', '@keyframes grow', 'prefers-reduced-motion'
];
for (const marker of required) {
  if (!html.includes(marker)) throw new Error(`Widget is missing required UI or interaction marker: ${marker}`);
}
for (const forbidden of ['<input', '<textarea', '<select', 'overflow:auto', 'overflow:scroll', 'https://fonts.googleapis.com']) {
  if (html.includes(forbidden)) throw new Error(`Widget contains unsupported or forbidden feature: ${forbidden}`);
}

const categories = ['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'];
const verdicts = ['Absolute Cinema','Go for It','Timepass','Skip It'];
const sample = serializeProfileWidgetData({
  name: 'ReviewTV Member 🇮🇳', username: 'reviewer_test', total: 128, average: '8.6',
  verdictTotal: 92, likes: 420, dislikes: 12, rank: 3,
  categories: categories.map((label, i) => ({ label, count: 20 - i })),
  verdicts: verdicts.map((label, i) => ({ label, count: 30 - i, style: i === 0 ? 'success' : i === 3 ? 'danger' : 'primary' })),
  recent: Array.from({ length: 5 }, (_, i) => ({
    title: 'A sample movie title with a longer name ' + i, year: 2024, rating: 8,
    style: 'success', category: categories[i], verdict: verdicts[i % 4],
    verdictStyle: i === 0 ? 'success' : i === 3 ? 'danger' : 'primary',
    excerpt: 'A thoughtful review excerpt that gives a real preview of the published review content.',
    hasSpoilers: i === 4, link: 'https://t.me/review_tv/12345'
  }))
});
const stateBytes = Buffer.byteLength(sample, 'utf8');
const data = JSON.parse(sample);
if (stateBytes > 1024) throw new Error(`Serialized profile chat_data is ${stateBytes} bytes; Telegram allows 1024.`);
if (data.i.length !== 5) throw new Error('All five recent review cards must fit in the sample profile state.');
if (!data.i[0].x || data.i[4].x !== '' || data.i[4].p !== true) throw new Error('Review excerpts and spoiler protection were not serialized correctly.');
if (data.i[0].c !== 0 || data.i[1].c !== 1 || data.i[0].v !== 0 || data.i[1].v !== 1) throw new Error('Recent card category/verdict indexes do not match the display labels.');
if (data.c.length !== 8 || data.q.length !== 4 || data.c[0] !== 20 || data.q[0] !== 30) throw new Error('Category or verdict chart data is incomplete or out of order.');
console.log(`Profile chat_data: ${stateBytes}/1024 bytes; ${data.i.length} recent cards; category/verdict indexes verified.`);
