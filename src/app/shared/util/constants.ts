export const STAT_MAX_VALUES: Record<string, number> = {
  hp: 255,
  attack: 190,
  defense: 250,
  'special-attack': 194,
  'special-defense': 250,
  speed: 200,
};

export const STAT_IV_MIN = 0;
export const STAT_IV_MAX = 31;
export const STAT_EV_MIN = 0;
export const STAT_EV_MAX = 252;
export const STAT_TOTAL_EV_MAX = 510;
export const STAT_LABELS: Record<string, string> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Sp. Atk.',
  'special-defense': 'Sp. Def.',
  speed: 'Speed',
};
