# IdPullBot project instructions

- Inspect full Telegram Message and raw Update using the handler context, not a narrow BotBuilder field allowlist.
- Private chat: HTML <pre><code class="language-js"> output split safely into chunks, then a shareable Telegraph link.
- Guest mode: use guest_message and answerGuestQuery; respond only with a minimal Telegraph link/button.
- Keep share-user/share-chat keyboard, ID copy buttons, aggregate stats, and admin ID 1314643983.
- Do not implement inline queries or persist raw message bodies.
- Runtime imports only from documented SDK modules; relative project imports end in .js.
- Telegraph access token is configured in `tgcloud/lib/config.js`; article publishing does not depend on settings-table writes. The database-backed `/settelegraph` path is retained only as a fallback if the config token is empty.
- Never commit credentials. Database migration is separate and requires explicit approval.
- Keep auto-deploy disabled until the first intentional deployment and live Telegram testing are complete.
