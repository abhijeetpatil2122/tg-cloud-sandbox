import { api } from 'sdk';

const HELP = `BotZoneBot — Rich Message playground

Try these commands:
/richdemo — comprehensive Rich HTML showcase
/richmd — Rich Markdown showcase
/richlayout — headings, lists, quotes, tables, details, formulas
/richblocks — explicit InputRichBlock API demo\n/richdraft — streaming draft demo (private chat)\n/richmedia — media, figures, collage, slideshow and map
/richbuttons — rich inline buttons
/richentities — inline entities, references, date/time and formulas
/help — this menu

All examples use Telegram's sendRichMessage API.`;

const htmlDemo = `
<h1>BotZoneBot Rich Message Lab</h1>
<p>A comprehensive showcase of <b>Rich Messages</b> using Telegram's official HTML-style format.</p>
<hr/>
<h2>1. Inline formatting</h2>
<p><b>Bold</b> · <i>Italic</i> · <u>Underline</u> · <s>Strikethrough</s> · <code>inline code()</code> · <mark>Marked highlight</mark> · <sub>subscript</sub> · <sup>superscript</sup> · <tg-spoiler>spoiler text</tg-spoiler></p>
<p>Nested: <b>bold with <i>italic</i> and <u>underline</u></b>. Alternate tags: <strong>strong</strong>, <em>emphasis</em>, <ins>inserted</ins>, <del>deleted</del>, <strike>strike</strike>.</p>
<h2>2. Headings and paragraphs</h2>
<h1>Heading 1</h1><h2>Heading 2</h2><h3>Heading 3</h3><h4>Heading 4</h4><h5>Heading 5</h5><h6>Heading 6</h6>
<p>Paragraph one with a <a href="https://core.telegram.org/bots/api">Bot API link</a>. Paragraphs form the main text blocks.</p>
<h2>3. Links and detected entities</h2>
<p><a href="https://t.me/">Telegram URL</a> · <a href="mailto:demo@example.com">email link</a> · <a href="tel:+1234567890">phone link</a> · <a href="tg://user?id=777000">user mention link</a></p>
<p>Autodetected examples: #RichMessages · $TON · @BotFather · /help · https://t.me/ · demo@example.com · +1 234 567 8901.</p>
<h2>4. Custom emoji, date/time and math</h2>
<p>Custom emoji (client/account support may vary): <tg-emoji emoji-id="5368324170671202286">👍</tg-emoji></p>
<p>Telegram date/time: <t...[truncated]<tg-button-row align="left"><tg-button type="web_app" url="https://telegram.org" style="primary">Web App button example</tg-button></tg-button-row>
<h2>12. Footer and finish</h2>
<footer>BotZoneBot · Rich Message test suite · Rich HTML</footer>
<hr/>
<p>Use <code>/richmd</code>, <code>/richlayout</code>, <code>/richmedia</code>, <code>/richbuttons</code> and <code>/richentities</code> for focused tests.</p>
`;

const markdownDemo = `# Rich Markdown demo

This message tests **bold**, __bold__, *italic*, _italic_, ~~strikethrough~~, ==marked text==, ||spoiler||, and \`inline code\`.

## Links and inline entities
[Telegram](https://telegram.org) · [Email](mailto:demo@example.com) · [Phone](tel:+1234567890) · [User mention](tg://user?id=777000)

Custom emoji: ![thumbs up](tg://emoji?id=5368324170671202286)
Date/time: ![sample time](tg://time?unix=1791850000&format=wDT)
Math: $x^2 + y^2 = z^2$

### Headings
#### Heading 4
##### Heading 5
###### Heading 6

## Lists
- Unordered one
- Unordered two with **bold**
- [ ] Checklist pending
- [x] Checklist done

1. Ordered one
2. Ordered two

## Code
\`\`\`javascript
const message = 'Rich Markdown';
console.log(message);
\`\`\`

## Quote
> First line of a quotation
>
> Second line of a quotation

---

## Table
| Feature | Result |
|:--|--:|
| Markdown | **Supported** |
| Marked | ==Highlight== |
| Spoiler | ||Hidden|| |

## Details and media containers
<details>
<summary>Expandable Markdown section</summary>

Markdown inside details: **bold**, lists, and links.

- Optional item A
- Optional item B
</details>

## Collage / slideshow syntax
These containers require real reachable media URLs; use /richmedia for a live media test.
`;

const layoutDemo = `<h1>Rich layout test</h1><p>Focused test for structured blocks and document layout.</p><h2>List styles</h2><ul><li>Bullet A</li><li>Bullet B</li></ul><ol><li>Numbered A</li><li>Numbered B</li></ol><ol start="4" type="i"><li>Roman numeral item</li><li>Next item</li></ol><h2>Table variants</h2><table><tr><th>Default</th><th>Table</th></tr><tr><td>Cell A</td><td>Cell B</td></tr></table><table bordered striped><caption>Bordered striped</caption><tr><th>Item</th><th>Value</th></tr><tr><td>Alpha</td><td>1</td></tr><tr><td>Beta</td><td>2</td></tr></table><table compact><caption>Compact table</caption><tr><th>Left</th><th>Right</th></tr><tr><td align="left">Left aligned</td><td align="right">Right aligned</td></tr></table><h2>Quotes and details</h2><blockquote>Block quote example<cite>Author</cite></blockquote><blockquote expandable>Expandable quote content.<br/>Additional hidden lines.<cite>Author</cite></blockquote><aside>Pull quote example<cite>Author</cite></aside><details><summary>Collapsed details</summary><p>Details body with <b>formatted</b> text.</p></details><details open><summary>Open details</summary><p>Expanded by default.</p></details><h2>Formula blocks</h2><p>Inline <tg-math>a^2+b^2=c^2</tg-math></p><tg-math-block>\\sum_{n=1}^{\\infty} \\frac{1}{n^2}=\\frac{\\pi^2}{6}</tg-math-block><footer>End of layout tests</footer>`;

const mediaDemo = `<h1>Rich media test</h1><p>Media tags use publicly reachable HTTP(S) URLs. Telegram's renderer may vary by client.</p><h2>Photo</h2><figure><img src="https://telegram.org/img/t_logo.png"/><figcaption>Telegram logo<cite>telegram.org</cite></figcaption></figure><h2>Video</h2><figure><video src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"></video><figcaption>Sample flower video</figcaption></figure><h2>Audio</h2><figure><audio src="https://int...[truncated]    switch (command) {
      case '/start':
      case '/help':
        await api.sendMessage({ chat_id: message.chat.id, text: HELP });
        return;
      case '/richdemo':
        await sendRich(message.chat.id, htmlDemo);
        return;
      case '/richmd':
        await api.sendRichMessage({ chat_id: message.chat.id, rich_message: { markdown: markdownDemo } });
        return;
      case '/richdraft':
        await api.sendRichMessageDraft({
          chat_id: message.chat.id,
          draft_id: message.message_id || 1,
          rich_message: { html: '<tg-thinking>Testing a streamed Rich Message draft…</tg-thinking>' },
          can_stop: true,
          keep_on_stop: true,
        });
        await api.sendRichMessage({
          chat_id: message.chat.id,
          rich_message: { html: '<h2>Draft finalized</h2><p>The temporary draft was followed by this persistent Rich Message.</p><footer>BotZoneBot · /richdraft</footer>' },
        });
        return;
      case '/richlayout':
        await sendRich(message.chat.id, layoutDemo);
        return;
      case '/richblocks':
        await api.sendRichMessage({ chat_id: message.chat.id, rich_message: { blocks: blocksDemo } });
        return;
      case '/richmedia':
        await sendRich(message.chat.id, mediaDemo);
        return;
      case '/richbuttons':
        await sendRich(message.chat.id, buttonsDemo);
        return;
      case '/richentities':
        await sendRich(message.chat.id, entitiesDemo);
        return;
      default:
        if (message.text.startsWith('/')) {
          await api.sendMessage({ chat_id: message.chat.id, text: 'Unknown command. Send /help to see the Rich Message test commands.' });
        }
    }
  } catch (error) {
    console.error('BotZoneBot command failed:', command, error);
    await api.sendMessage({ chat_id: message.chat.id, text: `The ${command} test failed. Telegram returned an error; check the Serverless run logs for details.` });
  }
}
