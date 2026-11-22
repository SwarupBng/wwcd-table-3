import type { Preset, ThemeId, TiebreakKey } from './types';

export const DEFAULT_PLACEMENT_POINTS = [10, 6, 5, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0];

export function defaultPreset(): Preset {
  return { placementPoints: [...DEFAULT_PLACEMENT_POINTS], finishValue: 1 };
}

export const DEFAULT_TIEBREAKERS: TiebreakKey[] = ['wwcd', 'finish', 'reachedFirst'];

export const TIEBREAK_LABELS: Record<TiebreakKey, string> = {
  wwcd: 'Chicken dinners',
  finish: 'Finish points',
  reachedFirst: 'Reached the total first',
  placement: 'Placement points',
};

export const ALL_TIEBREAK_KEYS: TiebreakKey[] = ['wwcd', 'finish', 'reachedFirst', 'placement'];

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'amaze', label: 'Esports Amaze (default)' },
  { id: 'bmic', label: 'Dark Blue & Orange' },
  { id: 'india', label: 'Beige Stripes' },
];

export const MAPS = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi', 'Rondo'];
