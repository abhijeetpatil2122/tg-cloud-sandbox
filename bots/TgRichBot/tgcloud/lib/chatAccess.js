import { api } from 'sdk';

export const SUPPORTED_CHAT_TYPES = new Set(['channel', 'group', 'supergroup']);

export async function assertBotCanSend(chat, me) {
  const member = await api.getChatMember({ chat_id: chat.id, user_id: me.id });

  if (chat.type === 'channel') {
    if (!['administrator', 'creator'].includes(member.status)) {
      throw new Error('The bot must be an administrator in this channel.');
    }
    if (member.status === 'administrator' && member.can_post_messages !== true) {
      throw new Error('The bot needs the "Post messages" permission in this channel.');
    }
    return;
  }

  if (!['member', 'administrator', 'creator'].includes(member.status)) {
    throw new Error('The bot must be a member of this group.');
  }
  if (member.status === 'member' && member.can_send_messages === false) {
    throw new Error('The bot is restricted from sending messages in this group.');
  }
}
