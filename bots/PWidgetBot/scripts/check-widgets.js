import { deflateSync } from 'node:zlib';
import { readdirSync } from 'node:fs';
import { CATEGORIES, getDemo } from '../tgcloud/lib/catalog.js';
import { buildWidgetHtml } from '../tgcloud/lib/widget_factory.js';

const ALLOWED_HANDLERS = new Set('message edited_message stopped_message_generation channel_post edited_channel_post business_connection business_message edited_business_message deleted_business_messages inline_query chosen_inline_result callback_query guest_message shipping_query pre_checkout_query purchased_paid_media subscription message_reaction message_reaction_count poll poll_answer my_chat_member chat_member chat_join_request chat_boost removed_chat_boost managed_bot'.split(' '));
for (const file of readdirSync(new URL('../tgcloud/handlers/', import.meta.url))) {
  if (!file.endsWith('.js')) continue;
  const name = file.slice(0, -3);
  if (!ALLOWED_HANDLERS.has(name)) throw new Error(`Unsupported Serverless handler module: ${name}`);
}

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
