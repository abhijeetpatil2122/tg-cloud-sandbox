import { api } from 'sdk';

const HELP = `BotZoneBot — Rich Message playground

Try these commands:
/richdemo — HTML formatting and links
/richmd — Rich Markdown example
/richlayout — lists, quotes and tables
/richblocks — block-oriented message example
/richdraft — draft-style message example
/richmedia — media markup examples
/richbuttons — button/callback notes
/richentities — entities, links and spoilers
/help — show this menu

Responses use Telegram's sendRichMessage API.`;

const htmlDemo = `
<h1>BotZoneBot Rich Message Lab</h1>
<p>A playground for <b>Telegram Rich Messages</b>.</p>
<hr/>
<h2>Inline formatting</h2>
<p><b>Bold</b> · <i>Italic</i> · <u>Underline</u> · <s>Strikethrough</s> · <code>inline code</code> · <mark>Marked highlight</mark> · <sub>subscript</sub> · <sup>superscript</sup> · <tg-spoiler>spoiler text</tg-spoiler></p>
<p>Nested formatting: <b>bold with <i>italic</i> and <u>underline</u></b>.</p>
<h2>Headings and paragraphs</h2>
<h3>Heading 3</h3>
<p>Paragraphs keep content readable. Visit the <a href="https://core.telegram.org/bots/api">Telegram Bot API</a>.</p>
<h2>Code</h2>
<pre><code>const message = "Hello, Telegram!";</code></pre>
<h2>Quote</h2>
<blockquote>Rich messages can combine text, structure, and interactive content.</blockquote>
<h2>Lists</h2>
<ul><li>Readable formatting</li><li>Nested inline styles</li><li>Links and entities</li></ul>
<p>Try <code>/richlayout</code>, <code>/richmd</code>, and <code>/richentities</code> for more examples.</p>`;

const markdownDemo = `# Rich Markdown
This response uses **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.

## Links
[Telegram Bot API](https://core.telegram.org/bots/api)

## Lists
- First item
- Second item
  - Nested item

> A quoted line

Inline code: `const answer = 42`.`;

const layoutDemo = `
<h1>Layout showcase</h1>
<h2>Ordered list</h2>
<ol><li>Plan the message</li><li>Structure the content</li><li>Deploy and test</li></ol>
<h2>Unordered list</h2>
<ul><li>Inline formatting</li><li>Links</li><li>Quotes</li></ul>
<h2>Block quote</h2>
<blockquote>A clear layout makes long messages easier to scan.</blockquote>
<h2>Table</h2>
<table><tr><th>Feature</th><th>Example</th></tr><tr><td>Bold</td><td><b>Important</b></td></tr><tr><td>Code</td><td><code>const x = 1</code></td></tr></table>
<h2>Details</h2>
<details><summary>Show more</summary><p>Expandable content keeps secondary information out of the way.</p></details>`;

const mediaDemo = `
<h1>Media markup</h1>
<p>Rich Messages can contain media blocks when supported by the message format. Use real Telegram file IDs or URLs when adding media to your bot.</p>
<ul><li>Photo or figure</li><li>Video and audio</li><li>Documents</li><li>Collage or slideshow</li><li>Location/map</li></ul>
<p>This text-only sample avoids sending placeholder media that would fail at runtime.</p>`;

const entitiesDemo = `
<h1>Entities and links</h1>
<p><a href="https://t.me/">Telegram link</a> · <a href="mailto:demo@example.com">Email link</a> · <a href="tel:+1234567890">Phone link</a></p>
<p>Inline entities: #RichMessages · $TON · @BotFather · /help</p>
<p>Spoiler: <tg-spoiler>hidden text</tg-spoiler></p>
<p>Marked text: <mark>highlighted content</mark></p>`;

const buttonsDemo = `
<h1>Interactive messages</h1>
<p>Inline buttons are rendered from Rich Message button blocks. Their callback data is handled by <code>handlers/callback_query.js</code>.</p>
<p>Use the callback handler as the target for button interactions, and always answer callback queries promptly so Telegram clients stop showing the loading indicator.</p>`;

const blocksDemo = `
<h1>Block-oriented messages</h1>
<p>Rich Message content can be assembled from structured blocks instead of one HTML string.</p>
<ul><li>Heading and paragraph blocks</li><li>List and quote blocks</li><li>Table and details blocks</li><li>Buttons and media blocks</li></ul>
<p>Use the HTML and Markdown commands in this starter to test text rendering while you build structured blocks.</p>`;

const draftDemo = `
<h1>Draft-style message</h1>
<p>For a streaming workflow, send an initial Rich Message and edit it as the result becomes available.</p>
<blockquote>Keep each edit small and stop updating once the final result has been delivered.</blockquote>`;

async function sendHtml(chatId, html) {
  return api.sendRichMessage({
    chat_id: chatId,
    rich_message: { html },
  });
}

export default async function (message) {
  const chatId = message?.chat?.id;
  if (!chatId) return;

  const text = (message.text ?? '').trim();
  const command = (text.split(/\s+/, 1)[0] ?? '').split('@')[0].toLowerCase();

  switch (command) {
    case '/start':
      return sendHtml(chatId, `
<h1>Welcome to BotZoneBot 👋</h1>
<p>Your Rich Message playground is ready.</p>
<p>Try <code>/richdemo</code> for a formatting showcase or <code>/help</code> for all commands.</p>`);
    case '/help':
      return sendHtml(chatId, `<h1>BotZoneBot Help</h1><pre>${HELP.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</pre>`);
    case '/richdemo':
      return sendHtml(chatId, htmlDemo);
    case '/richmd':
      return api.sendRichMessage({
        chat_id: chatId,
        rich_message: { markdown: markdownDemo },
      });
    case '/richlayout':
      return sendHtml(chatId, layoutDemo);
    case '/richblocks':
      return sendHtml(chatId, blocksDemo);
    case '/richdraft':
      return sendHtml(chatId, draftDemo);
    case '/richmedia':
      return sendHtml(chatId, mediaDemo);
    case '/richbuttons':
      return sendHtml(chatId, buttonsDemo);
    case '/richentities':
      return sendHtml(chatId, entitiesDemo);
    default:
      return;
  }
}
