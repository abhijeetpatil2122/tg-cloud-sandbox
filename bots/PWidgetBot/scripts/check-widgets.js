import { deflateSync } from 'node:zlib';
import { CATEGORIES, getDemo } from '../tgcloud/lib/catalog.js';
import { buildWidgetHtml } from '../tgcloud/lib/widget_factory.js';

const MAX_HTML_BYTES = 32 * 1024;
const MAX_COMPRESSED_BYTES = 4 * 1024;
let checked = 0;

for (const category of CATEGORIES) {
  for (const id of category.demos) {
    const demo = getDemo(id);
    if (!demo) throw new Error(`Missing demo metadata: ${id}`);
    const html = buildWidgetHtml(demo.id, demo.title, demo.description);
    const bytes = Buffer.byteLength(html, 'utf8');
    const compressedBytes = deflateSync(Buffer.from(html, 'utf8'), { level: 9 }).length;
    if (bytes > MAX_HTML_BYTES || compressedBytes > MAX_COMPRESSED_BYTES) {
      throw new Error(`${id}: HTML ${bytes} bytes, compressed ${compressedBytes} bytes (limits: ${MAX_HTML_BYTES}/${MAX_COMPRESSED_BYTES})`);
    }
    checked += 1;
    console.log(`OK ${id}: ${bytes} B HTML / ${compressedBytes} B compressed`);
  }
}

console.log(`Validated ${checked} widget templates.`);
