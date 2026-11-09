export const CATEGORIES = [
  { id: 'interactive', title: 'Interactive Widgets', description: 'Polls, quizzes, feedback, counters, and local interactions.', demos: ['shared_poll', 'quick_quiz', 'rating', 'clicker', 'reaction_counter', 'progress_tracker'] },
  { id: 'games', title: 'Mini Games', description: 'Small games that run directly inside a Telegram message.', demos: ['number_guess', 'tic_tac_toe', 'memory_game'] },
  { id: 'dashboards', title: 'Dashboards & Data', description: 'Compact data displays and local sample data.', demos: ['live_dashboard', 'leaderboard', 'countdown'] },
  { id: 'utilities', title: 'Everyday Utilities', description: 'Useful small tools with no external webpage required.', demos: ['calculator', 'random_picker', 'tip_calculator'] },
  { id: 'wallet', title: 'TON & Wallet', description: 'Telegram wallet API references and transaction-query concepts.', demos: ['wallet_card', 'wallet_sign', 'wallet_transaction'] },
  { id: 'developer', title: 'Developer Lab', description: 'Understand the widget runtime, query protocol, and message/shared state APIs.', demos: ['basic_widget', 'theme_demo', 'query_roundtrip', 'message_state', 'shared_state', 'api_reference'] },
];

const DEMOS = [
  ['shared_poll', 'Shared Poll', 'Vote and see the local results update.', true, true],
  ['quick_quiz', 'Quick Quiz', 'Answer a question and receive instant feedback.', false, true],
  ['rating', 'Rating Widget', 'Submit a one-tap rating.', false, true],
  ['clicker', 'Clicker', 'Increment a per-message score.', false, true],
  ['reaction_counter', 'Reaction Counter', 'Explore a local counter.', true, true],
  ['progress_tracker', 'Progress Tracker', 'Update a progress value.', false, true],
  ['number_guess', 'Number Guess', 'Guess a hidden number.', false, true],
  ['tic_tac_toe', 'Tic-tac-toe', 'Play a local two-player game inside the widget.', false, false],
  ['memory_game', 'Memory Match', 'Match pairs in a compact local game.', false, false],
  ['live_dashboard', 'Live Dashboard', 'A compact dashboard with local sample data.', true, true],
  ['leaderboard', 'Leaderboard', 'Explore a local ranking example.', true, true],
  ['countdown', 'Countdown', 'A live countdown widget.', false, false],
  ['calculator', 'Calculator', 'A compact calculator.', false, false],
  ['random_picker', 'Random Picker', 'Pick a random option.', false, false],
  ['tip_calculator', 'Tip Calculator', 'Calculate a tip and split.', false, false],
  ['wallet_card', 'Wallet Card', 'Explore the Telegram TON wallet card query.', false, true],
  ['wallet_sign', 'Wallet Signed Data', 'Explore the wallet-signed data query.', false, true],
  ['wallet_transaction', 'Wallet Transaction', 'Explore the transaction notification query.', false, true],
  ['basic_widget', 'Basic HTML Widget', 'A minimal self-contained widget.', false, false],
  ['theme_demo', 'Theme-aware Widget', 'Inspect Telegram theme values.', false, false],
  ['query_roundtrip', 'Query Round-trip', 'Learn how widget requests are routed to a bot.', false, true],
  ['message_state', 'Message State', 'Preview message-scoped widget state.', false, true],
  ['shared_state', 'Shared State', 'Preview shared public widget state.', true, true],
  ['api_reference', 'Widget API Reference', 'Explore the main Bot API widget methods.', false, false],
].map(([id, title, description, shared, queries]) => ({ id, title, description, shared, queries }));

export function getCategory(id) {
  return CATEGORIES.find((category) => category.id === id) || null;
}

export function getDemo(id) {
  return DEMOS.find((demo) => demo.id === id) || null;
}
