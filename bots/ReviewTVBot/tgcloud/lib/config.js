export const categories = [
  { key: 'hollywood_movies', label: 'Hollywood Movies' },
  { key: 'bollywood_movies', label: 'Bollywood Movies' },
  { key: 'south_indian_movies', label: 'South Indian Movies' },
  { key: 'other_regional_movies', label: 'Other Regional Movies' },
  { key: 'tv_shows', label: 'TV Shows & Series' },
  { key: 'anime', label: 'Anime' },
];

export function getCategory(key) {
  return categories.find((category) => category.key === key) ?? null;
}
