import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Tournament, TeamResult } from '../types';
import { defaultPreset, DEFAULT_TIEBREAKERS } from '../presets';
import { buildMatches } from '../logic/tournament';
import { StandingsSheet } from './StandingsSheet';

function sample(): Tournament {
  const teams = ['Team Soul', 'GodLike Esports', 'Orangutan'].map((name, i) => ({
    id: `t${i}`,
    name,
    slot: i + 1,
    logoMode: 'initials' as const,
  }));
  const matches = buildMatches(1, 3);
  const res = (rows: Array<[number, number, boolean]>): TeamResult[] =>
    rows.map(([pp, fp, w], i) => ({ teamId: `t${i}`, placement: null, placementPoints: pp, finishPoints: fp, wwcd: w }));
  matches[0].results = res([[10, 5, true], [6, 2, false], [5, 0, false]]);
  matches[1].results = res([[0, 1, false], [10, 4, true], [6, 3, false]]);
  matches[1].map = 'Erangel';
  return {
    id: 'x',
    name: 'Sample Cup',
    game: 'BGMI',
    days: 1,
    matchesPerDay: 3,
    lobbyPlayers: 12,
    entryMode: 'points',
    preset: defaultPreset(),
    tiebreakers: [...DEFAULT_TIEBREAKERS],
    smash: { enabled: false, startDay: 3, extraPoints: 10 },
    teams,
    matches,
    theme: 'amaze',
    footerText: '@samplecup',
    createdAt: '',
    updatedAt: '',
  };
}

describe('StandingsSheet', () => {
  it('renders the overall table with logos, movement arrows and the stage label', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={1} theme="amaze" />,
    );
    expect(html).toContain('Overall Standings');
    expect(html).toContain('2 out of 3 Matches Played');
    expect(html).not.toContain('Day 1'); // single-day tournament: no day label
    expect(html).not.toContain('>Slot<'); // slots are for the admin only, never in the tables
    expect(html).toContain('GodLike Esports');
    expect(html).toContain('▲1'); // GodLike climbed from 2nd to 1st
    expect(html).toContain('▼1'); // Team Soul dropped from 1st to 2nd
    expect(html).toContain('row-1');
    expect(html).toContain('row-3');
    expect(html).toContain('TS'); // initials logo for Team Soul
    expect(html).toContain('@samplecup');
  });

  it('renders the column order: matches, chicken dinners, placement points, finish points, total', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={1} theme="amaze" />,
    );
    const order = ['>Team<', '>Matches<', '>WWCD<', '>Place Pts<', '>Finish Pts<', '>Total<'].map((s) => html.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('shows the chicken dinner count as a chicken leg with a multiplication sign', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={1} theme="amaze" />,
    );
    expect(html).toContain('🍗');
    expect(html).toMatch(/×<\/span><span class="chicken-n">1</);
  });

  it('shows a plain 0, with no chicken, for teams without a chicken dinner', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={1} theme="amaze" />,
    );
    expect(html).toContain('<span class="chicken-none">0</span>');
    expect(html.match(/chicken-icon/g)?.length).toBe(2); // only the two teams with a dinner
  });

  it('shows points gained in the latest match beside the total, but not after the first match', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={1} theme="amaze" />,
    );
    expect(html).toContain('<span class="gain">+14</span>'); // GodLike
    expect(html).toContain('<span class="gain">+1</span>'); // Team Soul
    const first = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={0} theme="amaze" />,
    );
    expect(first).not.toContain('class="gain"');
  });

  it('shows +0 for a team that scored nothing in the latest match', () => {
    const t = sample();
    t.matches[1].results = t.matches[1].results!.map((r) =>
      r.teamId === 't2' ? { ...r, placementPoints: 0, finishPoints: 0 } : r,
    );
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={t} view="overall" matchIndex={1} theme="amaze" />,
    );
    expect(html).toContain('<span class="gain">+0</span>');
  });

  it('the final version has no gains and is marked for bigger podium rows', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="overall" matchIndex={1} theme="amaze" final />,
    );
    expect(html).toContain('Final Standings');
    expect(html).toContain('is-final');
    expect(html).not.toContain('class="gain"');
  });

  it('shows the day only when the tournament has more than one day', () => {
    const t = sample();
    const two = { ...t, days: 2, matches: t.matches.map((m, i) => ({ ...m, day: i < 2 ? 1 : 2 })) };
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={two} view="overall" matchIndex={1} theme="amaze" />,
    );
    expect(html).toContain('2 out of 3 Matches Played · Day 1');
  });

  it('renders a match table with its map', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="match" matchIndex={1} theme="bmic" />,
    );
    expect(html).toContain('Match Standings');
    expect(html).toContain('Erangel');
    expect(html).toContain('theme-bmic');
  });

  it('shows an empty message for a match without results', () => {
    const html = renderToStaticMarkup(
      <StandingsSheet tournament={sample()} view="match" matchIndex={2} theme="india" />,
    );
    expect(html).toContain('No results yet');
  });
});
