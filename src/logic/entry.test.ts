import { describe, expect, it } from 'vitest';
import { duplicateValues, maxFinishes, totalFinishes } from './entry';
import { normalize } from '../storage';
import type { Tournament } from '../types';

describe('maxFinishes', () => {
  it('is one less than the players in the lobby', () => {
    expect(maxFinishes(40)).toBe(39);
    expect(maxFinishes(64)).toBe(63);
    expect(maxFinishes(0)).toBe(0);
  });
});

describe('duplicateValues', () => {
  it('finds repeated values and ignores blanks', () => {
    expect([...duplicateValues([1, 2, 2, null, null, 5, 5, 5])].sort()).toEqual([2, 5]);
  });
  it('returns nothing when every value is different', () => {
    expect(duplicateValues([1, 2, 3, null]).size).toBe(0);
  });
});

describe('totalFinishes', () => {
  it('adds up finish counts in rank mode', () => {
    expect(totalFinishes([10, 20, 9], 'rank', 1)).toBe(39);
  });
  it('converts finish points back to finishes in points mode', () => {
    expect(totalFinishes([10, 20, 9], 'points', 1)).toBe(39);
    expect(totalFinishes([20, 40], 'points', 2)).toBe(30);
  });
  it('cannot tell when a finish is worth 0 points', () => {
    expect(totalFinishes([5], 'points', 0)).toBeNull();
  });
  it('a lobby of 40 allows 39 finishes but not 40', () => {
    const max = maxFinishes(40);
    expect(totalFinishes([39], 'rank', 1)! > max).toBe(false);
    expect(totalFinishes([40], 'rank', 1)! > max).toBe(true);
  });
});

describe('normalize (older saved tournaments)', () => {
  it('adds slots in entry order and a squad-of-4 lobby size', () => {
    const old = {
      id: 'a',
      name: 'Old Cup',
      teams: [
        { id: 't0', name: 'A', logoMode: 'initials' },
        { id: 't1', name: 'B', logoMode: 'initials' },
      ],
      matches: [],
      tiebreakers: [],
      preset: {},
      smash: {},
    } as unknown as Tournament;
    const n = normalize(old);
    expect(n.teams.map((x) => x.slot)).toEqual([1, 2]);
    expect(n.lobbyPlayers).toBe(8);
  });
  it('keeps slots and lobby size that are already there', () => {
    const t = {
      teams: [{ id: 't0', name: 'A', slot: 7, logoMode: 'initials' }],
      lobbyPlayers: 52,
    } as unknown as Tournament;
    const n = normalize(t);
    expect(n.teams[0].slot).toBe(7);
    expect(n.lobbyPlayers).toBe(52);
  });
});
