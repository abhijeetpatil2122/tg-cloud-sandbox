import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { communityConfig, categoryTopics } from '../schema.js';
import { categories, getCategory } from './config.js';

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

  await sendToMessageContext(
    message,
    [
      'ReviewTVBot is connected to this forum.',
      '',
      'Next, configure each category from its own topic. Open a topic and send:',
      '/settopic category_key',
      '',
      ...categories.map((category) => `• ${category.label}: ${category.key}`),
      '',
      'The command must be sent inside the topic it should map to.'
    ].join('\n')
  );
}

export async function setCategoryTopic(message, categoryKey) {
  const category = getCategory(categoryKey);
  if (!category) {
    await sendToMessageContext(
      message,
      `Unknown category. Valid keys: ${categories.map((item) => item.key).join(', ')}`
    );
    return;
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

  await sendToMessageContext(
    message,
    `Topic saved for ${category.label}. Topic ID: ${message.message_thread_id}`
  );
}

export async function showSettings(message) {
  const config = await getConfig();
  if (!config) {
    await sendToMessageContext(message, 'ReviewTVBot has not been connected to a forum yet. Run /connect as the forum creator.');
    return;
  }
  if (message.from?.id !== config.ownerId) {
    await sendToMessageContext(message, 'This command is available only to the configured forum owner.');
    return;
  }

  const mappings = await db.select().from(categoryTopics).all();
  const lines = categories.map((category) => {
    const mapping = mappings.find((item) => item.categoryKey === category.key && item.chatId === config.chatId);
    return `${mapping ? '✓' : '—'} ${category.label}: ${mapping ? mapping.topicId : 'Not configured'}`;
  });

  await sendToMessageContext(
    message,
    [
      'ReviewTVBot forum settings',
      `Forum: ${config.chatTitle}`,
      `Chat ID: ${config.chatId}`,
      `Status: ${config.enabled ? 'Connected' : 'Disconnected'}`,
      '',
      ...lines,
      '',
      'To configure a mapping, open the relevant topic and send /settopic followed by its category key.'
    ].join('\n')
  );
}

export async function disconnectForum(message) {
  const config = await getConfig();
  if (!config || message.from?.id !== config.ownerId) {
    await sendToMessageContext(message, 'Only the configured forum owner can disconnect the destination.');
    return;
  }

  await db.update(communityConfig)
    .set({ enabled: false })
    .where(eq(communityConfig.id, CONFIG_ID))
    .run();

  await sendToMessageContext(message, 'The ReviewTVBot forum destination has been disconnected. Existing topic mappings have been kept.');
}
