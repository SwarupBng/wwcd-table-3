import { forwardRef } from 'react';
import type { ThemeId, Tournament } from '../types';
import { computeMatchTable, computeStandings } from '../logic/standings';
import { TeamLogo } from './TeamLogo';

export type SheetView = 'overall' | 'match';

interface Props {
  tournament: Tournament;
  view: SheetView;
  matchIndex: number;
  theme: ThemeId;
  /** the clean final table: no "+N" gains, bigger podium rows */
  final?: boolean;
}

function Move({ value }: { value: number | null }) {
  if (value === null) return <span className="mv mv-none" />;
  if (value > 0) return <span className="mv mv-up">▲{value}</span>;
  if (value < 0) return <span className="mv mv-down">▼{-value}</span>;
  return <span className="mv mv-same">–</span>;
}

/** Chicken leg with a multiplication sign and the count, e.g. "🍗 × 2". */
function Chicken({ count }: { count: number }) {
  if (count === 0) return <span className="chicken-none">0</span>;
  return (
    <span className="chicken">
      <span className="chicken-icon" role="img" aria-label="chicken dinner">
        🍗
      </span>
      <span className="chicken-x">×</span>
      <span className="chicken-n">{count}</span>
    </span>
  );
}

function rowClass(rank: number, extra = ''): string {
  return `row ${rank <= 3 ? `row-${rank}` : 'row-n'}${extra}`;
}

/** The table that is shown on screen and exported as an image. */
export const StandingsSheet = forwardRef<HTMLDivElement, Props>(function StandingsSheet(
  { tournament: t, view, matchIndex, theme, final = false },
  ref,
) {
  const teamById = new Map(t.teams.map((x) => [x.id, x]));
  const showLogos = t.teams.some((x) => x.logoMode !== 'none');
  const match = t.matches[matchIndex];
  const standings = view === 'overall' ? computeStandings(t, matchIndex) : null;
  const table = view === 'match' ? computeMatchTable(t, matchIndex) : null;
  const hasData = view === 'overall' ? (standings?.playedCount ?? 0) > 0 : !!table;
  const multiDay = t.days > 1;

  let title = 'Overall Standings';
  let stage = '';
  if (view === 'overall' && standings && standings.lastPlayedIndex !== null) {
    const day = t.matches[standings.lastPlayedIndex].day;
    if (final) {
      title = 'Final Standings';
      stage = `All ${t.matches.length} Matches Played`;
    } else {
      stage = `${standings.playedCount} out of ${t.matches.length} Matches Played${multiDay ? ` · Day ${day}` : ''}`;
    }
  } else if (view === 'match' && match) {
    title = 'Match Standings';
    stage = `${multiDay ? `Day ${match.day} · ` : ''}Match ${match.number}${match.map ? ` · ${match.map}` : ''}`;
  }

  const winnerTeam = standings?.winnerTeamId ? teamById.get(standings.winnerTeamId) : undefined;
  const footerParts: string[] = [];
  if (standings?.smashActive && standings.threshold !== null) {
    footerParts.push(`Smash point: ${standings.threshold} pts`);
  }
  if (t.footerText.trim()) footerParts.push(t.footerText.trim());

  return (
    <div ref={ref} className={`sheet theme-${theme}${final ? ' is-final' : ''}`}>
      <div className="sheet-head">
        <div className="logo-slot">{t.logo && <img src={t.logo} alt="" />}</div>
        <div className="titles">
          <div className="event">{t.name}</div>
          <h2 className="title">{title}</h2>
          {stage && <div className="stage">{stage}</div>}
        </div>
        <div className="logo-slot logo-slot-right">
          {t.organizerLogo && <img src={t.organizerLogo} alt="" />}
        </div>
      </div>

      {!hasData && <div className="sheet-empty">No results yet</div>}

      {hasData && view === 'overall' && standings && (
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="c-rank">#</th>
              <th className="c-team">Team</th>
              <th className="num">Matches</th>
              <th className="num">WWCD</th>
              <th className="num">Place Pts</th>
              <th className="num">Finish Pts</th>
              <th className="num total">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((r) => {
              const team = teamById.get(r.teamId)!;
              return (
                <tr key={r.teamId} className={rowClass(r.rank, r.winner ? ' is-winner' : '')}>
                  <td className="c-rank">
                    <span className="rk">{r.rank}</span>
                    <Move value={r.movement} />
                  </td>
                  <td className="c-team">
                    <div className="team">
                      {showLogos && <TeamLogo team={team} size={30} />}
                      <span className="tn">{team.name}</span>
                      {r.winner ? (
                        <span className="tag tag-win">WINNER</span>
                      ) : r.smash ? (
                        <span className="tag tag-smash">SMASH</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="num">{r.matches}</td>
                  <td className="num">
                    <Chicken count={r.wwcd} />
                  </td>
                  <td className="num">{r.placementPoints}</td>
                  <td className="num">{r.finishPoints}</td>
                  <td className="num total">
                    <span className="tot">
                      {r.total}
                      {!final && r.gained !== null && <span className="gain">+{r.gained}</span>}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {hasData && view === 'match' && table && (
        <table className="sheet-table">
          <thead>
            <tr>
              <th className="c-rank">#</th>
              <th className="c-team">Team</th>
              <th className="num">WWCD</th>
              <th className="num">Place Pts</th>
              <th className="num">Finish Pts</th>
              <th className="num total">Total</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) => {
              const team = teamById.get(r.teamId)!;
              return (
                <tr key={r.teamId} className={rowClass(r.rank)}>
                  <td className="c-rank">
                    <span className="rk">{r.rank}</span>
                  </td>
                  <td className="c-team">
                    <div className="team">
                      {showLogos && <TeamLogo team={team} size={30} />}
                      <span className="tn">{team.name}</span>
                    </div>
                  </td>
                  <td className="num">
                    <Chicken count={r.wwcd ? 1 : 0} />
                  </td>
                  <td className="num">{r.placementPoints}</td>
                  <td className="num">{r.finishPoints}</td>
                  <td className="num total">{r.total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {winnerTeam && (
        <div className="winner-banner">
          🏆 {winnerTeam.name} win the tournament with a chicken dinner from the smash point
        </div>
      )}
      {footerParts.length > 0 && <div className="sheet-foot">{footerParts.join('  ·  ')}</div>}
    </div>
  );
});
