import type { Match, Team } from '../types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function buildMatches(days: number, matchesPerDay: number): Match[] {
  const out: Match[] = [];
  let index = 0;
  for (let d = 1; d <= days; d++) {
    for (let n = 1; n <= matchesPerDay; n++) {
      out.push({ index: index++, day: d, number: n, map: '', results: null });
    }
  }
  return out;
}

export function newTeam(slot: number): Team {
  return { id: uid(), name: '', slot, logoMode: 'initials' };
}

/** Squads of 4 by default; the admin can change the lobby size. */
export function defaultLobbyPlayers(teamCount: number): number {
  return teamCount * 4;
}

/** "Team Soul" becomes "TS", "Godlike" becomes "GO". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Stable color for a team's initials logo. */
export function teamHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'tournament'
  );
}

/** "Day 2 · Match 3", or just "Match 3" for a single-day tournament. */
export function matchLabel(m: Match, days: number): string {
  return days <= 1 ? `Match ${m.number}` : `Day ${m.day} · Match ${m.number}`;
}
