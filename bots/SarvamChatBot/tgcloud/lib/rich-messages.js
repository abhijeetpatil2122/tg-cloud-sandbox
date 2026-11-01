export function startMessage(configured) {
  const blocks = [
    { type: 'heading', size: 1, text: 'SarvamChatBot' },
    { type: 'paragraph', text: 'A private AI assistant powered by Sarvam AI, with live Rich Message streaming.' },
  ];

  if (!configured) {
    blocks.push(
      { type: 'divider' },
      { type: 'paragraph', text: 'The assistant is not configured yet. Set the Sarvam API key with:' },
      { type: 'preformatted', language: 'text', text: '/setkey YOUR_SARVAM_API_KEY' },
    );
  } else {
    blocks.push(
      { type: 'divider' },
      { type: 'paragraph', text: 'You are ready. Send me a message and I will stream the answer as it is generated.' },
    );
  }

  blocks.push(
    { type: 'paragraph', text: 'Available commands: /help, /setkey, /reset' },
    { type: 'footer', text: 'Private chats only · Sarvam 105B' },
  );
  return { blocks };
}

export function helpMessage(configured) {
  return {
    blocks: [
      { type: 'heading', size: 2, text: 'How to use SarvamChatBot' },
      { type: 'list', items: [
        { text: 'Send any text message to chat with the AI.' },
        { text: 'Use /reset to clear your conversation history.' },
        { text: 'Use /setkey YOUR_SARVAM_API_KEY to configure or rotate the Sarvam key.' },
      ] },
      { type: 'divider' },
      { type: 'paragraph', text: configured
        ? 'Sarvam is configured. Only the original configuration owner can change the API key.'
        : 'Sarvam is not configured yet. The first user to set the key becomes its configuration owner.' },
      { type: 'footer', text: 'This version responds only in private chats.' },
    ],
  };
}

export function errorMessage(text) {
  return {
    blocks: [
      { type: 'paragraph', text },
      { type: 'footer', text: 'Please try again in a moment.' },
    ],
  };
}
