export const ADMIN_IDS = [8469987057, 1314643983];

export const categories = [
  { key: 'hollywood_movies', label: 'Hollywood Movies' },
  { key: 'bollywood_movies', label: 'Bollywood Movies' },
  { key: 'south_indian_movies', label: 'South Indian Movies' },
  { key: 'other_regional_movies', label: 'Other Regional Movies' },
  { key: 'international_movies', label: 'International Movies' },
  { key: 'tv_shows', label: 'TV Shows & Series' },
  { key: 'k_c_j_dramas', label: 'K/C/J Dramas' },
  { key: 'anime', label: 'Anime' },
];

export const ratingVerdicts = [
  { key: 'absolute_cinema', label: 'Absolute Cinema', style: 'success', description: 'Exceptional — a must-watch.' },
  { key: 'go_for_it', label: 'Go for It', style: 'success', description: 'Worth watching — recommended.' },
  { key: 'timepass', label: 'Timepass', style: 'primary', description: 'An okay casual watch; keep expectations moderate.' },
  { key: 'skip_it', label: 'Skip It', style: 'danger', description: 'Not recommended.' },
];
export const getRatingVerdict = (key) => ratingVerdicts.find((item) => item.key === key) ?? null;

export function getNumericRatingStyle(rating) {
  const value = Number(rating);
  if (!Number.isInteger(value) || value < 1 || value > 10) return 'primary';
  if (value <= 4) return 'danger';
  if (value <= 7) return 'primary';
  return 'success';
}

export const publicCommands = [
  { command: 'start', description: 'Welcome message and main menu' },
  { command: 'help', description: 'Show available commands' },
  { command: 'howtouse', description: 'Learn how to submit a review' },
  { command: 'review', description: 'Write and publish a review' },
  { command: 'myreviews', description: 'View your published reviews' },
  { command: 'profile', description: 'View your reviewer profile and statistics' },
  { command: 'cancel', description: 'Cancel your current draft' },
];


export function isAdmin(userId) {
  return ADMIN_IDS.includes(Number(userId));
}

export function getCategory(key) {
  return categories.find((category) => category.key === key) ?? null;
}
