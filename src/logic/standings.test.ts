import { describe, expect, it } from 'vitest';
import type { Tournament, TeamResult } from '../types';
import { defaultPreset, DEFAULT_TIEBREAKERS } from '../presets';
import { computeMatchTable, computeStandings, smashThreshold } from './standings';

/** [placementPoints, finishPoints, wwcd?] per team, in team order */
type Row = [number, number, boolean?];

function build(
  teamNames: string[],
  matches: Array<{ day: number; rows: Row[] | null }>,
  extra: Partial<Tournament> = {},
): Tournament {
  const teams = teamNames.map((name, i) => ({ id: `t${i}`, name, slot: i + 1, logoMode: 'initials' as const }));
  return {
    id: 'x',
    name: 'Test Cup',
    game: 'BGMI',
    days: 3,
    matchesPerDay: 1,
    lobbyPlayers: teamNames.length * 4,
    entryMode: 'points',
    preset: defaultPreset(),
    tiebreakers: [...DEFAULT_TIEBREAKERS],
    smash: { enabled: false, startDay: 3, extraPoints: 10 },
    teams,
    matches: matches.map((m, index) => ({
      index,
      day: m.day,
      number: 1,
      map: '',
      results: m.rows
        ? m.rows.map(
            ([pp, fp, w], i): TeamResult => ({
              teamId: `t${i}`,
              placement: null,
              placementPoints: pp,
              finishPoints: fp,
              wwcd: !!w,
            }),
          )
        : null,
    })),
    theme: 'amaze',
    footerText: '',
    createdAt: '',
    updatedAt: '',
    ...extra,
  };
}

const names = (t: Tournament, upto: number) =>
  computeStandings(t, upto).rows.map((r) => t.teams.find((x) => x.id === r.teamId)!.name);

describe('overall standings', () => {
  const t = build(
    ['A', 'B', 'C'],
    [
      { day: 1, rows: [[10, 5, true], [6, 2], [5, 0]] },
      { day: 1, rows: [[0, 1], [10, 0, true], [6, 3]] },
    ],
  );

  it('adds up every column', () => {
    const s = computeStandings(t, 1);
    const b = s.rows.find((r) => r.teamId === 't1')!;
    expect(b).toMatchObject({ matches: 2, wwcd: 1, finishPoints: 2, placementPoints: 16, total: 18 });
    expect(s.playedCount).toBe(2);
  });

  it('sorts by total, highest first', () => {
    expect(names(t, 1)).toEqual(['B', 'A', 'C']);
    expect(computeStandings(t, 1).rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('keeps the standings as they stood after each match', () => {
    expect(names(t, 0)).toEqual(['A', 'B', 'C']);
    expect(computeStandings(t, 0).rows.map((r) => r.total)).toEqual([15, 8, 5]);
  });

  it('shows no movement after the first match', () => {
    expect(computeStandings(t, 0).rows.every((r) => r.movement === null)).toBe(true);
  });

  it('reports points gained in the latest match, and nothing after the first', () => {
    expect(computeStandings(t, 0).rows.every((r) => r.gained === null)).toBe(true);
    const rows = computeStandings(t, 1).rows;
    expect(rows.find((r) => r.teamId === 't0')!.gained).toBe(1);
    expect(rows.find((r) => r.teamId === 't1')!.gained).toBe(10);
    expect(rows.find((r) => r.teamId === 't2')!.gained).toBe(9);
  });

  it('shows how many places each team climbed or dropped', () => {
    const rows = computeStandings(t, 1).rows;
    expect(rows.find((r) => r.teamId === 't1')!.movement).toBe(1); // B: 2nd to 1st
    expect(rows.find((r) => r.teamId === 't0')!.movement).toBe(-1); // A: 1st to 2nd
    expect(rows.find((r) => r.teamId === 't2')!.movement).toBe(0); // C: unchanged
  });

  it('returns nothing when no match has results', () => {
    const empty = build(['A', 'B'], [{ day: 1, rows: null }]);
    const s = computeStandings(empty, 0);
    expect(s.rows).toEqual([]);
    expect(s.playedCount).toBe(0);
  });

  it('skips matches without results and compares with the last played match', () => {
    const gap = build(
      ['A', 'B'],
      [
        { day: 1, rows: [[10, 0, true], [0, 0]] },
        { day: 1, rows: null },
        { day: 1, rows: [[0, 0], [10, 5, true]] },
      ],
    );
    const s = computeStandings(gap, 2);
    expect(s.playedCount).toBe(2);
    expect(s.rows[0].teamId).toBe('t1');
    expect(s.rows[0].movement).toBe(1);
  });

  it('recalculates when a past match is edited', () => {
    const edited = build(
      ['A', 'B', 'C'],
      [
        { day: 1, rows: [[0, 0], [10, 5, true], [5, 0]] }, // match 1 corrected
        { day: 1, rows: [[0, 1], [10, 0, true], [6, 3]] },
      ],
    );
    expect(names(edited, 1)).toEqual(['B', 'C', 'A']);
  });
});

describe('tiebreakers', () => {
  it('chicken dinners come first, even over more finish points', () => {
    const t = build(['A', 'B'], [{ day: 1, rows: [[0, 10], [10, 0, true]] }]);
    expect(names(t, 0)).toEqual(['B', 'A']);
  });

  it('then finish points', () => {
    const t = build(['A', 'B'], [{ day: 1, rows: [[6, 4], [2, 8]] }]);
    expect(names(t, 0)).toEqual(['B', 'A']);
  });

  it('then whoever reached the total first', () => {
    // B is entered first, so entry order would put B ahead; A reached 10 in match 1, B in match 2
    const t = build(
      ['B', 'A'],
      [
        { day: 1, rows: [[0, 0], [0, 10]] },
        { day: 1, rows: [[0, 10], [0, 0]] },
      ],
    );
    expect(names(t, 1)).toEqual(['A', 'B']);
  });

  it('falls back to entry order when nothing separates the teams', () => {
    const t = build(['A', 'B'], [{ day: 1, rows: [[5, 5], [5, 5]] }]);
    expect(names(t, 0)).toEqual(['A', 'B']);
  });

  it('follows a custom tiebreaker order', () => {
    const t = build(['A', 'B'], [{ day: 1, rows: [[6, 4], [2, 8]] }], { tiebreakers: ['placement'] });
    expect(names(t, 0)).toEqual(['A', 'B']);
  });
});

describe('smash rule', () => {
  // Day 2 leader finishes on 30, so with +10 the threshold is 40
  const matches: Array<{ day: number; rows: Row[] | null }> = [
    { day: 1, rows: [[10, 10], [5, 5]] }, // A 20, B 10
    { day: 2, rows: [[6, 4], [10, 5, true]] }, // A 30, B 25
    { day: 3, rows: [[10, 12, true], [0, 0]] }, // A 52 but was only on 30 before this match
    { day: 3, rows: [[10, 2, true], [0, 0]] }, // A was on 52 (>= 40) and wins a chicken dinner
  ];
  const t = build(['A', 'B'], matches, { smash: { enabled: true, startDay: 3, extraPoints: 10 } });

  it('sets the threshold from the day 2 leader plus the extra points', () => {
    expect(smashThreshold(t)).toBe(40);
  });

  it('has no threshold when the rule is off', () => {
    expect(smashThreshold({ ...t, smash: { ...t.smash, enabled: false } })).toBeNull();
  });

  it('has no threshold until the previous day is finished', () => {
    const pending = build(['A', 'B'], [{ day: 1, rows: [[10, 0], [0, 0]] }, { day: 2, rows: null }, { day: 3, rows: null }], {
      smash: { enabled: true, startDay: 3, extraPoints: 10 },
    });
    expect(smashThreshold(pending)).toBeNull();
  });

  it('is not active before the smash day', () => {
    const s = computeStandings(t, 1);
    expect(s.smashActive).toBe(false);
    expect(s.rows.some((r) => r.smash)).toBe(false);
  });

  it('tags teams that reached the threshold, without a winner yet', () => {
    const s = computeStandings(t, 2);
    expect(s.smashActive).toBe(true);
    expect(s.winnerTeamId).toBeNull(); // crossing and winning in the same match does not count
    expect(s.rows.find((r) => r.teamId === 't0')!.smash).toBe(true);
    expect(s.rows.find((r) => r.teamId === 't1')!.smash).toBe(false);
  });

  it('crowns a team that wins a chicken dinner after reaching the threshold', () => {
    const s = computeStandings(t, 3);
    expect(s.winnerTeamId).toBe('t0');
    expect(s.winnerMatchIndex).toBe(3);
    expect(s.rows[0]).toMatchObject({ teamId: 't0', winner: true });
  });

  it('does not crown a team below the threshold that wins a chicken dinner', () => {
    const low = build(
      ['A', 'B'],
      [
        { day: 1, rows: [[10, 10], [5, 5]] },
        { day: 2, rows: [[6, 4], [10, 5, true]] },
        { day: 3, rows: [[0, 0], [10, 2, true]] }, // B was on 25, below 40
      ],
      { smash: { enabled: true, startDay: 3, extraPoints: 10 } },
    );
    expect(computeStandings(low, 2).winnerTeamId).toBeNull();
  });
});

describe('match table', () => {
  it('sorts one match by total, then chicken dinner, then finish points', () => {
    const t = build(['A', 'B', 'C'], [{ day: 1, rows: [[5, 5], [10, 0, true], [4, 6]] }]);
    const rows = computeMatchTable(t, 0)!;
    expect(rows.map((r) => r.teamId)).toEqual(['t1', 't2', 't0']); // B wwcd, C more finishes than A
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('returns null for a match without results', () => {
    const t = build(['A'], [{ day: 1, rows: null }]);
    expect(computeMatchTable(t, 0)).toBeNull();
  });
});
