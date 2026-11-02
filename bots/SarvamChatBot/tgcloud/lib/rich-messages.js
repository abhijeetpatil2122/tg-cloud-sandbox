export function startMessage(configured, webSearchEnabled) {
  const blocks = [
    { type: 'heading', size: 1, text: 'SarvamChatBot' },
    { type: 'paragraph', text: 'A private AI assistant powered by Sarvam 105B, with streamed Telegram Rich Messages and live web search when needed.' },
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
      { type: 'paragraph', text: 'You are ready. Send a message and the answer will stream as it is generated.' },
    );
  }

  blocks.push(
    { type: 'paragraph', text: webSearchEnabled
      ? 'Live web search is enabled for current facts and news.'
      : 'Live web search is not configured yet. The bot owner can enable it with /setsearchkey.' },
    { type: 'paragraph', text: 'Available commands: /help, /setkey, /setsearchkey, /reset' },
    { type: 'footer', text: 'Private chats only · Sarvam 105B' },
  );
  return { blocks };
}

export function helpMessage(configured, webSearchEnabled) {
  return {
    blocks: [
      { type: 'heading', size: 2, text: 'How to use SarvamChatBot' },
      { type: 'list', items: [
        { text: 'Send a message to chat with the AI.' },
        { text: 'Use the Stop button on a streaming draft to stop generation.' },
        { text: 'Use /reset to clear your saved conversation history.' },
        { text: 'The bot owner can use /setkey YOUR_SARVAM_API_KEY to configure or rotate Sarvam.' },
        { text: 'The bot owner can use /setsearchkey YOUR_TAVILY_API_KEY to enable live web search.' },
      ] },
      { type: 'divider' },
      { type: 'paragraph', text: configured
        ? 'Sarvam is configured.'
        : 'Sarvam is not configured yet. The first user to set the key becomes its configuration owner.' },
      { type: 'paragraph', text: webSearchEnabled
        ? 'Live web search is enabled. Current news and changing facts can be checked against online sources.'
        : 'Live web search is currently disabled. Configure a Tavily key to enable it.' },
      { type: 'footer', text: 'This version responds only in private chats. Guest Mode and groups are not enabled.' },
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
