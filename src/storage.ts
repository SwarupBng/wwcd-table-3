import type { Tournament } from './types';

/**
 * All persistence lives in this file. To move to a hosted backend later (Firebase, Supabase),
 * replace these functions and leave the rest of the app alone.
 */
const KEY = 'wwcd-table:v1';

function isTournament(x: unknown): x is Tournament {
  const t = x as Tournament;
  return (
    !!t &&
    typeof t.id === 'string' &&
    typeof t.name === 'string' &&
    Array.isArray(t.teams) &&
    Array.isArray(t.matches) &&
    Array.isArray(t.tiebreakers) &&
    !!t.preset &&
    !!t.smash
  );
}

/** Fills in fields that older saved tournaments do not have. */
export function normalize(t: Tournament): Tournament {
  const teams = t.teams.map((x, i) => ({ ...x, slot: typeof x.slot === 'number' ? x.slot : i + 1 }));
  return {
    ...t,
    teams,
    lobbyPlayers: typeof t.lobbyPlayers === 'number' ? t.lobbyPlayers : teams.length * 4,
  };
}

export function loadTournaments(): Tournament[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data.filter(isTournament).map(normalize) : [];
  } catch {
    return [];
  }
}

/** Returns false if the browser refused to store the data (for example it is full). */
export function saveTournaments(list: Tournament[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** The text of a "copy" file holding every tournament. */
export function serializeCopy(list: Tournament[]): string {
  return JSON.stringify(
    { app: 'wwcd-table', version: 1, exportedAt: new Date().toISOString(), tournaments: list },
    null,
    2,
  );
}

/** Reads a "copy" file. Throws an Error with a plain message if it is not one. */
export function parseCopy(text: string): Tournament[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a saved copy.');
  }
  const list = Array.isArray(data) ? data : (data as { tournaments?: unknown })?.tournaments;
  if (!Array.isArray(list)) throw new Error('That file is not a saved copy.');
  const ok = list.filter(isTournament).map(normalize);
  if (ok.length === 0) throw new Error('No tournaments were found in that file.');
  return ok;
}
