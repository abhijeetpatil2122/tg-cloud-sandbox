import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { communityConfig, categoryTopics } from '../schema.js';
import { categories, getCategory, isAdmin } from './config.js';

const CONFIG_ID = 1;

async function getConfig() {
  return db.select().from(communityConfig)
    .where(eq(communityConfig.id, CONFIG_ID))
    .get();
}

async function sendToMessageContext(message, text) {
  const params = {
    chat_id: message.chat.id,
    text,
  };
  if (Number.isInteger(message.message_thread_id)) {
    params.message_thread_id = message.message_thread_id;
  }
  await api.sendMessage(params);
}

async function sendRichToMessageContext(message, blocks) {
  const params = { chat_id: message.chat.id, rich_message: { blocks } };
  if (Number.isInteger(message.message_thread_id)) params.message_thread_id = message.message_thread_id;
  return api.sendRichMessage(params);
}

async function getForumCreator(chatId) {
  const administrators = await api.getChatAdministrators({ chat_id: chatId });
  return administrators.find((member) => member.status === 'creator')?.user ?? null;
}

async function verifyBotAdmin(chatId) {
  const bot = await api.getMe();
  const member = await api.getChatMember({ chat_id: chatId, user_id: bot.id });
  return member.status === 'administrator' || member.status === 'creator';
}

export async function connectForum(message) {
  if (message.chat.type !== 'supergroup') {
    await sendToMessageContext(message, 'Run /connect inside the forum supergroup you want to use.');
    return;
  }

  const chat = await api.getChat({ chat_id: message.chat.id });
  if (chat.is_forum !== true) {
    await sendToMessageContext(message, 'This group does not have Topics enabled. Enable Topics and try again.');
    return;
  }

  const creator = await getForumCreator(message.chat.id);
  if (!creator || creator.id !== message.from?.id) {
    await sendToMessageContext(message, 'Only the forum group creator can connect this group to ReviewTVBot.');
    return;
  }

  if (!(await verifyBotAdmin(message.chat.id))) {
    await sendToMessageContext(message, 'Please make ReviewTVBot an administrator in this group, then run /connect again.');
    return;
  }

  const existing = await getConfig();
  if (existing?.enabled && existing.chatId !== message.chat.id) {
    await sendToMessageContext(message, 'Another forum is already connected. Disconnect it first before connecting a different group.');
    return;
  }
  if (existing && existing.ownerId !== creator.id) {
    await sendToMessageContext(message, 'The saved forum owner does not match this group creator. Ask the configured owner to resolve the connection first.');
    return;
  }

  await db.insert(communityConfig).values({
    id: CONFIG_ID,
    chatId: message.chat.id,
    chatTitle: chat.title ?? message.chat.title ?? 'Review forum',
    ownerId: creator.id,
    enabled: true,
    connectedAt: new Date(),
  }).onConflictDoUpdate({
    target: communityConfig.id,
    set: {
      chatId: message.chat.id,
      chatTitle: chat.title ?? message.chat.title ?? 'Review forum',
      ownerId: creator.id,
      enabled: true,
      connectedAt: new Date(),
    },
  }).run();

  return sendRichToMessageContext(message, [
    { type: 'heading', size: 1, text: '✓ Forum Connected' },
    { type: 'paragraph', text: ['ReviewTVBot is connected to ', { type: 'bold', text: chat.title ?? message.chat.title ?? 'this forum' }, '.'] },
    { type: 'paragraph', text: 'Map each review category from its own forum topic. The topic key must be sent from inside the topic it belongs to.' },
    { type: 'divider' },
    { type: 'heading', size: 3, text: 'Review topic keys' },
    { type: 'list', items: categories.map((category) => ({ blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: category.label }, ' — ', { type: 'code', text: category.key }] }] })) },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Leaderboard' }, ' — ', { type: 'code', text: 'leaderboard' }] },
    { type: 'footer', text: 'Topic mappings can be changed later by the forum owner.' },
  ]);
}

export async function setCategoryTopic(message, categoryKey) {
  const isLeaderboard = categoryKey === 'leaderboard';
  const category = isLeaderboard ? { key: 'leaderboard', label: 'Leaderboard' } : getCategory(categoryKey);
  if (!category) {
    return sendRichToMessageContext(message, [
      { type: 'heading', size: 2, text: 'Unknown Topic Key' },
      { type: 'paragraph', text: 'Choose one of the supported keys below and send the command again from its matching topic.' },
      { type: 'list', items: categories.map((item) => ({ blocks: [{ type: 'paragraph', text: [{ type: 'bold', text: item.label }, ' — ', { type: 'code', text: item.key }] }] })) },
      { type: 'paragraph', text: [{ type: 'bold', text: 'Leaderboard' }, ' — ', { type: 'code', text: 'leaderboard' }] },
    ]);
  }

  const config = await getConfig();
  if (!config?.enabled) {
    await sendToMessageContext(message, 'No forum is connected yet. Run /connect in your forum supergroup first.');
    return;
  }
  if (message.chat.id !== config.chatId) {
    await sendToMessageContext(message, 'This is not the connected ReviewTVBot forum.');
    return;
  }
  if (message.from?.id !== config.ownerId) {
    await sendToMessageContext(message, 'Only the configured forum owner can change category topics.');
    return;
  }
  if (message.chat.type !== 'supergroup' || !Number.isInteger(message.message_thread_id)) {
    await sendToMessageContext(message, 'Send /settopic from inside the forum topic you want to assign. It cannot be set from the General topic or a private chat.');
    return;
  }

  await db.insert(categoryTopics).values({
    categoryKey: category.key,
    chatId: config.chatId,
    topicId: message.message_thread_id,
    configuredBy: message.from.id,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: categoryTopics.categoryKey,
    set: {
      chatId: config.chatId,
      topicId: message.message_thread_id,
      configuredBy: message.from.id,
      updatedAt: new Date(),
    },
  }).run();

  return sendRichToMessageContext(message, [
    { type: 'heading', size: 2, text: '✓ Topic Saved' },
    { type: 'paragraph', text: [{ type: 'bold', text: category.label }, ' is now mapped to topic ', { type: 'code', text: String(message.message_thread_id) }, '.'] },
    { type: 'footer', text: 'This topic is ready for review publishing.' },
  ]);
}

export async function showSettings(message) {
  const config = await getConfig();
  if (!config) {
    await sendToMessageContext(message, 'ReviewTVBot has not been connected to a forum yet. Run /connect as the forum creator.');
    return;
  }
  if (!isAdmin(message.from?.id) && message.from?.id !== config.ownerId) {
    await sendToMessageContext(message, 'This command is available only to a configured administrator.');
    return;
  }

  const mappings = await db.select().from(categoryTopics).all();
  const rows = categories.map((category) => {
    const mapping = mappings.find((item) => item.categoryKey === category.key && item.chatId === config.chatId);
    return [
      { text: category.label, align: 'left' },
      { text: mapping ? String(mapping.topicId) : '—', align: 'right' },
    ];
  });
  const leaderboardMapping = mappings.find((item) => item.categoryKey === 'leaderboard' && item.chatId === config.chatId);
  rows.push([{ text: 'Leaderboard', align: 'left' }, { text: leaderboardMapping ? String(leaderboardMapping.topicId) : '—', align: 'right' }]);

  return sendRichToMessageContext(message, [
    { type: 'heading', size: 1, text: '⚙️ Forum Settings' },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Forum: ' }, config.chatTitle] },
    { type: 'paragraph', text: [{ type: 'bold', text: 'Status: ' }, config.enabled ? 'Connected ✅' : 'Disconnected'] },
    { type: 'table', cells: [
      [{ text: 'Topic', is_header: true, align: 'left' }, { text: 'Topic ID', is_header: true, align: 'right' }],
      ...rows,
    ], is_striped: true, caption: 'Configured forum topics' },
    { type: 'footer', text: 'Topic mapping is restricted to the forum owner.' },
  ]);
}

export async function disconnectForum(message, confirmation) {
  const config = await getConfig();
  if (!config || (!isAdmin(message.from?.id) && message.from?.id !== config.ownerId)) {
    await sendToMessageContext(message, 'This command is available only to a configured administrator.');
    return;
  }
  if (confirmation !== 'confirm') {
    return sendRichToMessageContext(message, [
      { type: 'heading', size: 2, text: '⚠️ Pause review publishing?' },
      { type: 'paragraph', text: 'The bot will stop publishing new reviews. Your forum connection and topic mappings will remain saved.' },
      { type: 'paragraph', text: ['To proceed, send ', { type: 'code', text: '/disconnect confirm' }, '.'] },
      { type: 'footer', text: 'No changes have been made yet.' },
    ]);
  }

  await db.update(communityConfig)
    .set({ enabled: false })
    .where(eq(communityConfig.id, CONFIG_ID))
    .run();

  return sendRichToMessageContext(message, [
    { type: 'heading', size: 2, text: '✓ Publishing Paused' },
    { type: 'paragraph', text: 'Review publishing is disabled. Your forum connection and topic mappings have been kept.' },
  ]);
}
