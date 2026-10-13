# Runtime SDK notes for RichDocsBot

This project runs on Telegram Serverless. Official reference: https://core.telegram.org/bots/serverless

## Imports and handlers
- Import Telegram's built-in API client with import { api } from 'sdk'.
- Import outbound HTTP with import { fetch } from 'sdk'.
- Telegram calls use snake_case Bot API parameters, e.g. api.answerInlineQuery({ inline_query_id, results }).
- Bot API errors throw; catch expected errors and log only safe diagnostic information. Never log credentials.

## Inline Rich Message results
Inline articles can use this shape:

~~~js
{
  type: 'article',
  id: 'method:sendMessage',
  title: 'sendMessage',
  description: 'Use this method to send text messages.',
  input_message_content: {
    rich_message: {
      blocks: [
        { type: 'heading', size: 2, text: 'sendMessage' },
        { type: 'paragraph', text: 'Method description.' },
        {
          type: 'table',
          cells: [
            [{ text: 'Parameter', is_header: true }, { text: 'Type', is_header: true }],
            [{ text: 'chat_id' }, { text: 'Integer or String' }],
          ],
          is_bordered: true,
          is_striped: true,
          is_compact: true,
        },
      ],
    },
  },
}
~~~

InputRichMessage supports exactly one of html, markdown, or blocks. For documentation, prefer blocks so tables, headings, lists, and links use native Rich Message components. A table's cells value is an array of rows, each containing cell objects. Rich text URL objects use { type: 'url', text, url }.

## Outbound HTTP
Use the SDK's fetch-compatible client:

~~~js
const response = await fetch('https://corefork.telegram.org/bots/api.json');
if (!response.ok) throw new Error('Schema request failed: ' + response.status);
const schema = await response.json();
~~~

Do not assume a Serverless isolate persists between invocations. Module-level caching is only a best-effort optimization.
