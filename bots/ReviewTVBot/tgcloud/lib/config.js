export const ADMIN_IDS = [8469987057, 1314643983];

export const categories = [
  { key: 'hollywood_movies', label: 'Hollywood Movies' },
  { key: 'bollywood_movies', label: 'Bollywood Movies' },
  { key: 'south_indian_movies', label: 'South Indian Movies' },
  { key: 'other_regional_movies', label: 'Other Regional Movies' },
  { key: 'tv_shows', label: 'TV Shows & Series' },
  { key: 'anime', label: 'Anime' },
];

export const publicCommands = [
  { command: 'start', description: 'Welcome message and main menu' },
  { command: 'help', description: 'Show available commands' },
  { command: 'howtouse', description: 'Learn how to submit a review' },
  { command: 'review', description: 'Write and publish a review' },
  { command: 'myreviews', description: 'View your published reviews' },
  { command: 'cancel', description: 'Cancel your current draft' },
];


export function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

export function getCategory(key) {
  return categories.find((category) => category.key === key) ?? null;
}
