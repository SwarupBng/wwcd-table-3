import type { EntryMode } from '../types';

/** Most finishes a lobby can have: every player except the winner can be finished once. */
export function maxFinishes(lobbyPlayers: number): number {
  return Math.max(0, lobbyPlayers - 1);
}

/** Values that appear more than once (blanks are ignored). */
export function duplicateValues(values: Array<number | null>): Set<number> {
  const seen = new Set<number>();
  const dup = new Set<number>();
  for (const v of values) {
    if (v === null) continue;
    if (seen.has(v)) dup.add(v);
    else seen.add(v);
  }
  return dup;
}

/**
 * Total finishes entered for a match. In rank mode the numbers typed are finish counts; in points
 * mode they are finish points, so they are divided by the points per finish. Returns null when that
 * cannot be worked out (points mode with 0 points per finish).
 */
export function totalFinishes(entries: number[], mode: EntryMode, finishValue: number): number | null {
  const sum = entries.reduce((a, b) => a + b, 0);
  if (mode === 'rank') return sum;
  if (finishValue <= 0) return null;
  return sum / finishValue;
}
