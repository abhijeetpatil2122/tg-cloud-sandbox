import { deflateSync } from 'node:zlib';
import { buildProfileWidgetHtml, serializeProfileWidgetData } from '../tgcloud/lib/profile_widget.js';

const html = buildProfileWidgetHtml();
const htmlBytes = Buffer.byteLength(html, 'utf8');
const compressedBytes = deflateSync(Buffer.from(html, 'utf8'), { level: 9 }).byteLength;
console.log(`ReviewTV profile widget: ${htmlBytes} bytes HTML; ${compressedBytes} bytes zlib-compressed.`);
if (htmlBytes < 1 || htmlBytes > 32768) throw new Error('Widget HTML must be between 1 and 32768 UTF-8 bytes.');
if (compressedBytes > 3800) throw new Error('Widget HTML is too close to Telegram’s 4096-byte compressed limit; keep a safety margin.');
if (html.includes(String.fromCharCode(0))) throw new Error('Widget HTML contains a NUL character.');

for (const required of ["impactOccurred('heavy')", 'onclick="setTab(', 'onclick="changePage(', 'class="cover"', 'class="excerpt"', 'class="open-review"']) {
  if (!html.includes(required)) throw new Error(`Widget is missing required interaction or design feature: ${required}`);
}

const sample = serializeProfileWidgetData({
  name: 'ReviewTV Member', username: 'reviewer_test', total: 128, average: '8.6',
  verdictTotal: 92, likes: 420, dislikes: 12, rank: 3,
  categories: ['Hollywood Movies','Bollywood Movies','South Indian Movies','Other Regional Movies','International Movies','TV Shows & Series','K/C/J Dramas','Anime'].map((label, i) => ({ label, count: 20 - i })),
  verdicts: [{label:'Absolute Cinema',count:22,style:'success'},{label:'Go for It',count:30,style:'primary'},{label:'Timepass',count:25,style:'primary'},{label:'Skip It',count:15,style:'danger'}],
  recent: Array.from({length:5}, (_, i) => ({
    title:'A sample movie title with a longer name ' + i, year:2024, rating:8, style:'success',
    category:'Hollywood Movies', verdict:'Absolute Cinema', verdictStyle:'success',
    excerpt:'A thoughtful review excerpt that gives a real preview of the published review content.',
    hasSpoilers:false, link:'https://t.me/review_tv/12345'
  }))
});
if (Buffer.byteLength(sample, 'utf8') > 1024) throw new Error('Serialized profile chat_data exceeds Telegram’s 1024-byte limit.');
const data = JSON.parse(sample);
if (data.i.length !== 5 || !data.i[0].x) throw new Error('Recent review cards must preserve five entries and review excerpts in the size-limit fixture.');
if (!data.i.some(item => item.p === false)) throw new Error('Recent review spoiler state was not serialized.');
console.log(`Profile chat_data: ${Buffer.byteLength(sample, 'utf8')} bytes; ${data.i.length} recent cards retained.`);
