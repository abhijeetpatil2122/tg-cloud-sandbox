import { api } from 'sdk';

const HELP = 'BotZoneBot — Rich Message playground\n\n' +
  '/richdemo — HTML formatting showcase\n' +
  '/richmd — Rich Markdown showcase\n' +
  '/richlayout — lists, quotes, tables, details and math\n' +
  '/richblocks — structured InputRichBlock API example\n' +
  '/richdraft — private-chat streaming draft lifecycle\n' +
  '/richmedia — collage, slideshow and map markup\n' +
  '/richbuttons — real Rich Message callback buttons\n' +
  '/richentities — links, references, entities and spoilers\n' +
  '/help — show this menu';

const HTML_DEMO =
  '<h1>BotZoneBot Rich Message Lab</h1>' +
  '<p>A hands-on showcase of <b>Telegram Rich Messages</b>.</p><hr/>' +
  '<h2>Inline formatting</h2>' +
  '<p><b>Bold</b> · <i>Italic</i> · <u>Underline</u> · <s>Strikethrough</s> · ' +
  '<code>inline code</code> · <mark>Marked highlight</mark> · <sub>subscript</sub> · ' +
  '<sup>superscript</sup> · <tg-spoiler>spoiler text</tg-spoiler></p>' +
  '<p>Nested styles: <b>bold with <i>italic</i> and <u>underline</u></b>.</p>' +
  '<h2>Headings and links</h2><h3>Heading level 3</h3>' +
  '<p>Read the <a href="https://core.telegram.org/bots/api">official Bot API docs</a>.</p>' +
  '<h2>Code</h2><pre><code>const message = "Hello, Telegram!";\nconsole.log(message);</code></pre>' +
  '<h2>Lists</h2><ul><li>Readable structure</li><li>Nested inline styles</li><li>Links and entities</li></ul>' +
  '<h2>Quote</h2><blockquote>Rich messages combine text, structure and interactive content.<cite>BotZoneBot</cite></blockquote>' +
  '<p>Continue with <code>/richlayout</code>, <code>/richblocks</code> and <code>/richbuttons</code>.</p>';

const MARKDOWN_DEMO =
  '# Rich Markdown\n\n' +
  'This uses **bold**, *italic*, __underline__, ~~strikethrough~~, ==marked text== and ||spoilers||.\n\n' +
  '## Links and code\n' +
  '[Telegram Bot API](https://core.telegram.org/bots/api)\n\n' +
  '`const answer = 42`\n\n' +
  '```javascript\nconst message = "Rich Markdown";\nconsole.log(message);\n```\n\n' +
  '## Lists\n- First item\n- Second item\n  - Nested item\n\n' +
  '> A quoted line\n> A second line\n\n' +
  '## Table\n| Feature | Status |\n|:--|--:|\n| Markdown | **Supported** |\n| Marked | ==Highlight== |';

const LAYOUT_DEMO =
  '<h1>Layout showcase</h1><h2>Lists</h2>' +
  '<ol><li>Plan the message</li><li>Structure the content</li><li>Deploy and test</li></ol>' +
  '<ul><li>Inline formatting</li><li>Links</li><li>Quotes</li></ul>' +
  '<h2>Quotes</h2><blockquote>Block quotation with a credit.<cite>Example author</cite></blockquote>' +
  '<blockquote expandable>This quotation is collapsible.<br/>Additional lines appear when expanded.<cite>Example author</cite></blockquote>' +
  '<aside>Pull quote, centered for emphasis.<cite>BotZoneBot</cite></aside>' +
  '<h2>Tables</h2><table bordered striped compact><caption>Rich table example</caption>' +
  '<tr><th>Feature</th><th>Example</th></tr><tr><td>Bold</td><td><b>Important</b></td></tr>' +
  '<tr><td>Code</td><td><code>const x = 1</code></td></tr></table>' +
  '<h2>Details</h2><details><summary>Show more</summary><p>Expandable content with <b>formatting</b> and a <a href="https://t.me/">link</a>.</p></details>' +
  '<h2>Formula</h2><p>Inline math: <tg-math>a^2+b^2=c^2</tg-math></p>' +
  '<tg-math-block>E = mc^2</tg-math-block><footer>End of layout showcase</footer>';

const ENTITY_DEMO =
  '<h1>Entities and references</h1>' +
  '<p><a href="https://t.me/">Telegram</a> · <a href="mailto:demo@example.com">email link</a> · ' +
  '<a href="tel:+1234567890">phone link</a> · <a href="tg://user?id=777000">user mention</a></p>' +
  '<p>Auto-detected examples: #RichMessages · $TON · @BotFather · /help · demo@example.com</p>' +
  '<p>Spoiler: <tg-spoiler>tap to reveal</tg-spoiler> · Marked: <mark>highlighted text</mark></p>' +
  '<p><a name="chapter-start"></a><b>Anchor target</b> · <a href="#chapter-start">jump to this section</a></p>' +
  '<p><tg-reference name="note-1">Referenced phrase</tg-reference> · <a href="#note-1">jump to reference</a></p>' +
  '<p>Date/time entity example: <tg-time unix="1791864000" format="wDT">example time</tg-time></p>';

const MEDIA_DEMO =
  '<h1>Media blocks</h1>' +
  '<p>These examples use Telegram-hosted public media URLs rather than fake file IDs.</p>' +
  '<tg-collage><img src="https://telegram.org/img/t_logo.png"/><img src="https://telegram.org/img/t_logo.png"/>' +
  '<figcaption>Two-image collage example<cite>Telegram logo</cite></figcaption></tg-collage>' +
  '<tg-slideshow><img src="https://telegram.org/img/t_logo.png"/><img src="https://telegram.org/img/t_logo.png"/>' +
  '<figcaption>Slideshow example</figcaption></tg-slideshow>' +
  '<h2>Map</h2><tg-map lat="41.9028" long="12.4964" zoom="10"/>' +
  '<p>Media URL availability and rendering can vary by Telegram client.</p>';

const BUTTONS_DEMO =
  '<h1>Rich Message buttons</h1>' +
  '<p>Press the callback button to test <code>handlers/callback_query.js</code>.</p>' +
  '<tg-button-row align="center">' +
  '<tg-button type="callback_data" data="richdemo:callback" style="primary">Test callback</tg-button>' +
  '<tg-button type="url" url="https://core.telegram.org/bots/api" style="success">Open Bot API</tg-button>' +
  '</tg-button-row>' +
  '<tg-button-row align="center"><tg-button type="copy_text" text="Hello from BotZoneBot">Copy sample text</tg-button>' +
  '<tg-button type="disabled">Disabled example</tg-button></tg-button-row>';

const BLOCKS_DEMO = [
  { type: 'heading', size: 1, text: 'Structured Rich Message blocks' },
  { type: 'paragraph', text: 'This message is sent through InputRichMessage.blocks, not HTML or Markdown.' },
  { type: 'divider' },
  { type: 'heading', size: 2, text: 'Checklist' },
  { type: 'list', items: [
    { blocks: [{ type: 'paragraph', text: 'Review the schema' }], has_checkbox: true, is_checked: true },
    { blocks: [{ type: 'paragraph', text: 'Test a handler' }], has_checkbox: true },
    { blocks: [{ type: 'paragraph', text: 'Deploy only after verification' }], has_checkbox: true }
  ] },
  { type: 'blockquote', blocks: [{ type: 'paragraph', text: 'Structured blocks can contain nested blocks.' }], credit: 'Telegram Rich Messages' },
  { type: 'table', is_bordered: true, is_striped: true, cells: [
    [{ text: 'Feature', is_header: true }, { text: 'Demo', is_header: true }],
    [{ text: 'Headings' }, { text: 'Yes' }],
    [{ text: 'Lists' }, { text: 'Checkboxes' }],
    [{ text: 'Tables' }, { text: 'Yes' }]
  ] },
  { type: 'details', summary: 'Expandable block', blocks: [{ type: 'paragraph', text: 'This content is nested inside a details block.' }] },
  { type: 'buttons', align: 'center', buttons: [
    { text: 'Test callback', callback_data: 'richdemo:callback', style: 'primary' },
    { text: 'Telegram docs', url: 'https://core.telegram.org/bots/api', style: 'success' }
  ] },
  { type: 'footer', text: 'End of structured block demo' }
];

async function sendHtml(chatId, html) {
  return api.sendRichMessage({ chat_id: chatId, rich_message: { html: html } });
}

export default async function (message) {
  const chatId = message && message.chat && message.chat.id;
  if (!chatId) return;

  const text = (message.text || '').trim();
  const command = (text.split(/\\s+/, 1)[0] || '').split('@')[0].toLowerCase();

  switch (command) {
    case '/start':
      return sendHtml(chatId, '<h1>Welcome to BotZoneBot 👋</h1>' +
        '<p>Your Rich Message playground is ready.</p>' +
        '<p>Try <code>/richdemo</code> for the formatting showcase or <code>/help</code> for all commands.</p>' +
        '<tg-button-row align="center"><tg-button type="callback_data" data="richdemo:callback" style="primary">Test callback</tg-button>' +
        '<tg-button type="url" url="https://core.telegram.org/bots/api">Bot API docs</tg-button></tg-button-row>');
    case '/help':
      return sendHtml(chatId, '<h1>BotZoneBot Help</h1><pre>' +
        HELP.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>');
    case '/richdemo':
      return sendHtml(chatId, HTML_DEMO);
    case '/richmd':
      return api.sendRichMessage({ chat_id: chatId, rich_message: { markdown: MARKDOWN_DEMO } });
    case '/richlayout':
      return sendHtml(chatId, LAYOUT_DEMO);
    case '/richblocks':
      return api.sendRichMessage({ chat_id: chatId, rich_message: { blocks: BLOCKS_DEMO } });
    case '/richdraft': {
      if (message.chat.type !== 'private') {
        return sendHtml(chatId, '<p><b>/richdraft</b> works in private chats only, as required by Telegram.</p>');
      }
      const draftId = (Math.floor(Date.now() / 1000) % 2147483646) + 1;
      await api.sendRichMessageDraft({
        chat_id: chatId, draft_id: draftId, can_stop: false,
        rich_message: { html: '<h2>Preparing the final message…</h2><tg-thinking>Thinking...</tg-thinking>' }
      });
      await api.sendRichMessageDraft({
        chat_id: chatId, draft_id: draftId, can_stop: false,
        rich_message: { html: '<h2>Draft update</h2><p>The response is being assembled. The final message will be saved next.</p>' }
      });
      return api.sendRichMessage({
        chat_id: chatId, rich_message: { html: '<h1>Draft complete</h1><p>The final Rich Message was sent and is now persistent in the chat.</p><p>Telegram draft previews are temporary, so a final send is required.</p>' }
      });
    }
    case '/richmedia':
      return sendHtml(chatId, MEDIA_DEMO);
    case '/richbuttons':
      return sendHtml(chatId, BUTTONS_DEMO);
    case '/richentities':
      return sendHtml(chatId, ENTITY_DEMO);
    default:
      return;
  }
}
