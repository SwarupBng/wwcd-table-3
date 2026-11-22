import type { TiebreakKey, Tournament } from '../types';

/** Running totals for one team through a set of played matches. */
export interface Aggregate {
  teamId: string;
  /** position of the team in the entered team list, the last-resort tiebreaker */
  order: number;
  matches: number;
  wwcd: number;
  finishPoints: number;
  placementPoints: number;
  total: number;
  /** index of the match after which the running total first equalled the current total (-1 if still 0) */
  reachedAt: number;
}

export interface StandingRow extends Aggregate {
  rank: number;
  /** places climbed (positive) or dropped (negative) since the previous played match, null if none */
  movement: number | null;
  /** points earned in the most recent played match, null when only one match has been played */
  gained: number | null;
  smash: boolean;
  winner: boolean;
}

export interface Standings {
  rows: StandingRow[];
  playedCount: number;
  lastPlayedIndex: number | null;
  threshold: number | null;
  smashActive: boolean;
  winnerTeamId: string | null;
  winnerMatchIndex: number | null;
}

export interface MatchRow {
  rank: number;
  teamId: string;
  order: number;
  placement: number | null;
  wwcd: boolean;
  finishPoints: number;
  placementPoints: number;
  total: number;
}

/** Indexes of matches (up to and including `upto`) that have results entered. */
export function playedIndexes(t: Tournament, upto: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= upto && i < t.matches.length; i++) {
    if (t.matches[i].results) out.push(i);
  }
  return out;
}

export function aggregate(t: Tournament, upto: number): Aggregate[] {
  const played = playedIndexes(t, upto);
  return t.teams.map((team, order) => {
    const a: Aggregate = {
      teamId: team.id,
      order,
      matches: 0,
      wwcd: 0,
      finishPoints: 0,
      placementPoints: 0,
      total: 0,
      reachedAt: -1,
    };
    for (const mi of played) {
      const r = t.matches[mi].results!.find((x) => x.teamId === team.id);
      if (!r) continue;
      a.matches += 1;
      if (r.wwcd) a.wwcd += 1;
      a.finishPoints += r.finishPoints;
      a.placementPoints += r.placementPoints;
      const pts = r.finishPoints + r.placementPoints;
      a.total += pts;
      // totals never go down, so the total was first reached at the last match that added points
      if (pts > 0) a.reachedAt = mi;
    }
    return a;
  });
}

function compareKey(a: Aggregate, b: Aggregate, key: TiebreakKey): number {
  switch (key) {
    case 'wwcd':
      return b.wwcd - a.wwcd;
    case 'finish':
      return b.finishPoints - a.finishPoints;
    case 'placement':
      return b.placementPoints - a.placementPoints;
    case 'reachedFirst':
      return a.reachedAt - b.reachedAt;
  }
}

/** Sort by total points, then by the tiebreakers in the given order, then by entry order. */
export function sortAggregates(rows: Aggregate[], order: TiebreakKey[]): Aggregate[] {
  return [...rows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    for (const key of order) {
      const d = compareKey(a, b, key);
      if (d !== 0) return d;
    }
    return a.order - b.order;
  });
}

/**
 * Smash threshold: the leader's total after the day before the smash day, plus the extra points.
 * Returns null if the rule is off, or if that day's last match has no results yet.
 */
export function smashThreshold(t: Tournament): number | null {
  const s = t.smash;
  if (!s.enabled || s.startDay < 2) return null;
  let last = -1;
  t.matches.forEach((m, i) => {
    if (m.day === s.startDay - 1) last = i;
  });
  if (last < 0 || !t.matches[last].results) return null;
  const rows = sortAggregates(aggregate(t, last), t.tiebreakers);
  if (rows.length === 0) return null;
  return rows[0].total + s.extraPoints;
}

/**
 * The first team that wins a chicken dinner in a smash-day match while already at or above the
 * threshold before that match started.
 */
export function findSmashWinner(
  t: Tournament,
  upto: number,
  threshold: number | null,
): { teamId: string; matchIndex: number } | null {
  if (threshold === null) return null;
  const totals = new Map<string, number>(t.teams.map((x) => [x.id, 0]));
  for (let i = 0; i <= upto && i < t.matches.length; i++) {
    const m = t.matches[i];
    if (!m.results) continue;
    if (m.day >= t.smash.startDay) {
      const w = m.results.find((r) => r.wwcd && (totals.get(r.teamId) ?? 0) >= threshold);
      if (w) return { teamId: w.teamId, matchIndex: i };
    }
    for (const r of m.results) {
      totals.set(r.teamId, (totals.get(r.teamId) ?? 0) + r.placementPoints + r.finishPoints);
    }
  }
  return null;
}

/** Overall standings as they stood after the last played match at or before `upto`. */
export function computeStandings(t: Tournament, upto: number, withMovement = true): Standings {
  const played = playedIndexes(t, upto);
  if (played.length === 0) {
    return {
      rows: [],
      playedCount: 0,
      lastPlayedIndex: null,
      threshold: null,
      smashActive: false,
      winnerTeamId: null,
      winnerMatchIndex: null,
    };
  }
  const last = played[played.length - 1];
  const threshold = smashThreshold(t);
  let sorted = sortAggregates(aggregate(t, last), t.tiebreakers);

  const win = findSmashWinner(t, last, threshold);
  if (win) {
    const winnerRow = sorted.find((r) => r.teamId === win.teamId)!;
    sorted = [winnerRow, ...sorted.filter((r) => r.teamId !== win.teamId)];
  }

  let prevRank: Map<string, number> | null = null;
  if (withMovement && played.length > 1) {
    const prev = computeStandings(t, played[played.length - 2], false);
    prevRank = new Map(prev.rows.map((r) => [r.teamId, r.rank]));
  }

  const smashActive = threshold !== null && t.matches[last].day >= t.smash.startDay;
  const gainOf = new Map(
    (t.matches[last].results ?? []).map((r) => [r.teamId, r.placementPoints + r.finishPoints] as const),
  );
  const rows: StandingRow[] = sorted.map((a, i) => ({
    ...a,
    rank: i + 1,
    movement: prevRank ? (prevRank.get(a.teamId) ?? i + 1) - (i + 1) : null,
    gained: played.length > 1 ? (gainOf.get(a.teamId) ?? 0) : null,
    smash: smashActive && a.total >= (threshold as number),
    winner: win?.teamId === a.teamId,
  }));

  return {
    rows,
    playedCount: played.length,
    lastPlayedIndex: last,
    threshold,
    smashActive,
    winnerTeamId: win?.teamId ?? null,
    winnerMatchIndex: win?.matchIndex ?? null,
  };
}

/** The table for a single match, or null if no results were entered for it. */
export function computeMatchTable(t: Tournament, matchIndex: number): MatchRow[] | null {
  const m = t.matches[matchIndex];
  if (!m || !m.results) return null;
  const orderOf = new Map(t.teams.map((x, i) => [x.id, i]));
  const rows = m.results
    .filter((r) => orderOf.has(r.teamId))
    .map((r) => ({
      teamId: r.teamId,
      order: orderOf.get(r.teamId)!,
      placement: r.placement,
      wwcd: r.wwcd,
      finishPoints: r.finishPoints,
      placementPoints: r.placementPoints,
      total: r.finishPoints + r.placementPoints,
    }));
  rows.sort(
    (a, b) =>
      b.total - a.total ||
      Number(b.wwcd) - Number(a.wwcd) ||
      b.finishPoints - a.finishPoints ||
      b.placementPoints - a.placementPoints ||
      a.order - b.order,
  );
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
