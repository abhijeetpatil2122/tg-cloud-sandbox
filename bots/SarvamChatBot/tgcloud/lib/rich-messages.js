export function startMessage(configured, webSearchEnabled) {
  const blocks = [
    { type: 'heading', size: 1, text: 'SarvamChatBot' },
    { type: 'paragraph', text: 'A private AI assistant powered by Sarvam 105B, with streamed Telegram Rich Messages and live web search when needed.' },
  ];

  if (!configured) {
    blocks.push(
      { type: 'divider' },
      { type: 'paragraph', text: 'The assistant is not ready yet. The bot owner needs to finish its setup before it can answer.' },
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
      : 'Live web search is not configured yet.' },
    { type: 'paragraph', text: 'Open the command menu for usage and setup options.' },
    { type: 'footer', text: 'Private chats only · Sarvam 105B' },
  );
  return { blocks };
}

export function helpMessage(configured, webSearchEnabled) {
  return {
    blocks: [
      { type: 'heading', size: 2, text: 'How to use SarvamChatBot' },
      { type: 'list', items: [
        { blocks: [{ type: 'paragraph', text: 'Send a message to chat with the AI.' }] },
        { blocks: [{ type: 'paragraph', text: 'Use the Stop button on a streaming draft to stop generation.' }] },
        { blocks: [{ type: 'paragraph', text: 'If a long answer is interrupted, send “continue” to carry on from the saved partial answer.' }] },
        { blocks: [{ type: 'paragraph', text: '/help — show these usage instructions.' }] },
        { blocks: [{ type: 'paragraph', text: '/reset — clear your saved conversation history and release a stuck generation.' }] },
        { blocks: [{ type: 'paragraph', text: 'Owner only: /setkey YOUR_SARVAM_API_KEY — configure or rotate the AI key.' }] },
        { blocks: [{ type: 'paragraph', text: 'Owner only: /setsearchkey YOUR_TAVILY_API_KEY — enable or rotate live search.' }] },
      ] },
      { type: 'divider' },
      { type: 'paragraph', text: configured
        ? 'Sarvam is configured.'
        : 'Sarvam is not configured yet. The first user to set the key becomes its configuration owner.' },
      { type: 'paragraph', text: webSearchEnabled
        ? 'Live web search is enabled. Current news and changing facts can be checked against online sources.'
        : 'Live web search is currently disabled. Configure a Tavily key to enable it.' },
      { type: 'footer', text: 'The assistant currently works in private chats only.' },
    ],
  };
}

export function errorMessage(text) {
  return {
    blocks: [{ type: 'paragraph', text }],
  };
}
