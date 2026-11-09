import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const source = readFileSync(new URL('../tgcloud/lib/profile_widget.js', import.meta.url), 'utf8');
const match = source.match(/return String\\.raw`([\\s\\S]*?)`;/);
if (!match) throw new Error('Could not locate the profile widget HTML template.');

const html = match[1];
const htmlBytes = Buffer.byteLength(html, 'utf8');
const compressedBytes = deflateSync(Buffer.from(html, 'utf8'), { level: 9 }).byteLength;

console.log(`ReviewTV profile widget: ${htmlBytes} bytes HTML; ${compressedBytes} bytes zlib-compressed.`);
if (htmlBytes < 1 || htmlBytes > 32768) throw new Error('Widget HTML must be between 1 and 32768 UTF-8 bytes.');
if (compressedBytes > 4096) throw new Error('Widget HTML exceeds Telegram’s 4096-byte compressed limit.');
if (html.includes('\\0')) throw new Error('Widget HTML contains a NUL character.');
