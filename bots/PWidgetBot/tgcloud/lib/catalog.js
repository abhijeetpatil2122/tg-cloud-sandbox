export const CATEGORIES = [
  { id: 'interactive', title: 'Interactive Widgets', description: 'Polls, quizzes, feedback, counters, and stateful interactions.', demos: ['shared_poll', 'quick_quiz', 'rating', 'clicker', 'reaction_counter', 'progress_tracker'] },
  { id: 'games', title: 'Mini Games', description: 'Small games that run directly inside a Telegram message.', demos: ['number_guess', 'tic_tac_toe', 'memory_game'] },
  { id: 'dashboards', title: 'Dashboards & Data', description: 'Compact data displays and shared live state examples.', demos: ['live_dashboard', 'leaderboard', 'countdown'] },
  { id: 'utilities', title: 'Everyday Utilities', description: 'Useful small tools with no external webpage required.', demos: ['calculator', 'random_picker', 'tip_calculator'] },
  { id: 'wallet', title: 'TON & Wallet', description: 'Telegram wallet card, signed-data, and transaction-query demonstrations.', demos: ['wallet_card', 'wallet_sign', 'wallet_transaction'] },
  { id: 'developer', title: 'Developer Lab', description: 'Understand the widget runtime, query round-trips, and message/shared state.', demos: ['basic_widget', 'theme_demo', 'query_roundtrip', 'message_state', 'shared_state', 'api_reference'] },
];

const DEMOS = [
  ['shared_poll', 'Shared Poll', 'Vote and see shared results update.', true, true],
  ['quick_quiz', 'Quick Quiz', 'Answer a question and receive instant feedback.', false, true],
  ['rating', 'Rating Widget', 'Submit a one-tap rating.', false, true],
  ['clicker', 'Clicker', 'Increment a per-message score.', false, true],
  ['reaction_counter', 'Reaction Counter', 'Explore a shared counter.', true, true],
  ['progress_tracker', 'Progress Tracker', 'Update a progress value.', false, true],
  ['number_guess', 'Number Guess', 'Guess a hidden number.', false, true],
  ['tic_tac_toe', 'Tic-tac-toe', 'Play a local two-player game inside the widget.', false, false],
  ['memory_game', 'Memory Match', 'Match pairs in a compact local game.', false, false],
  ['live_dashboard', 'Live Dashboard', 'A compact dashboard with bot-owned state.', true, true],
  ['leaderboard', 'Leaderboard', 'Explore shared ranking data.', true, true],
  ['countdown', 'Countdown', 'A live countdown widget.', false, false],
  ['calculator', 'Calculator', 'A compact calculator.', false, false],
  ['random_picker', 'Random Picker', 'Pick a random option.', false, false],
  ['tip_calculator', 'Tip Calculator', 'Calculate a tip and split.', false, false],
  ['wallet_card', 'Wallet Card', 'Request the Telegram TON wallet card.', false, true],
  ['wallet_sign', 'Wallet Signed Data', 'Demonstrate a wallet-signed data query.', false, true],
  ['wallet_transaction', 'Wallet Transaction', 'Show transaction notification data when supplied by Telegram.', false, true],
  ['basic_widget', 'Basic HTML Widget', 'A minimal self-contained widget.', false, false],
  ['theme_demo', 'Theme-aware Widget', 'Inspect Telegram theme values.', false, false],
  ['query_roundtrip', 'Query Round-trip', 'Send a request to the bot and display its response.', false, true],
  ['message_state', 'Message State', 'Update chat_data for this widget message.', false, true],
  ['shared_state', 'Shared State', 'Update public_data for a shared widget.', true, true],
  ['api_reference', 'Widget API Reference', 'Explore the main Bot API widget methods.', false, false],
].map(([id, title, description, shared, queries]) => ({ id, title, description, shared, queries }));

export function getCategory(id) {
  return CATEGORIES.find((category) => category.id === id) || null;
}

export function getDemo(id) {
  return DEMOS.find((demo) => demo.id === id) || null;
}
