# Telegram Serverless SDK reference

This project uses Telegram Serverless CLI 0.2.x. The authoritative, current SDK reference is the official [Telegram Serverless documentation](https://core.telegram.org/bots/serverless.md), especially its **Projects & modules**, **Database**, **SDK**, and **CLI reference** sections.

## Runtime imports and layout

All deployed JavaScript belongs under `tgcloud/`. Update handlers are flat files in `tgcloud/handlers/`; shared modules belong in `tgcloud/lib/`; the schema is `tgcloud/schema.js`.

Use the built-in SDK and relative imports for project modules:

```js
import { api, db } from 'sdk';
import { eq, table, integer, text, sql } from 'sdk/db';
import { someHelper } from '../lib/some-helper.js';
```

Runtime modules execute in Telegram's isolated V8 environment. Do not import Node built-ins or arbitrary npm packages. Every database operation is asynchronous and must be awaited.

## Handler signature

The default export receives the update payload as its first argument. For `handlers/message.js`, that is the Telegram `Message` object. The second argument is the per-invocation context; the full update is available as `ctx.update`.

```js
import { api } from 'sdk';

export default async function (message) {
  await api.sendMessage({
    chat_id: message.chat.id,
    text: 'Hello',
  });
}
```

## Bot API calls

Call Bot API methods through `api` using the Bot API's snake_case parameter names. For example:

```js
await api.getChat({ chat_id: chatId });
await api.getChatAdministrators({ chat_id: chatId });
await api.getChatMember({ chat_id: chatId, user_id: botId });
await api.sendMessage({
  chat_id: chatId,
  message_thread_id: topicId,
  text: 'A message in the configured forum topic',
});
```

The SDK returns the unwrapped Bot API result and throws on API errors. Catch expected errors at the user-facing boundary and return clear messages; do not expose raw exception details.

## Database and migrations

Declare tables as named exports from `tgcloud/schema.js` using the `sdk/db` schema DSL. Use the documented query builder and await every operation.

Deploying `schema.js` does not apply its schema changes. The separate `npx tgcloud migrate` command applies migrations. Review schema changes and obtain explicit approval before migrating; migrations must never be part of an automated deployment.

## Useful commands

```sh
npm install
npx tgcloud status
npx tgcloud run handlers/message '{ chat: { id: 1 }, text: "/start" }'
npx tgcloud push
npx tgcloud migrate
```

Do not run `push` or `migrate` as part of routine validation. For ReviewTVBot, production deployment and database migration require explicit approval.
