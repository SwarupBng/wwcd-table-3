import { useMemo, useRef, useState } from 'react';
import type { Tournament, TeamResult } from '../types';
import { MAPS } from '../presets';
import { matchLabel } from '../logic/tournament';
import { duplicateValues, maxFinishes, totalFinishes } from '../logic/entry';
import { TeamLogo } from './TeamLogo';

interface Props {
  tournament: Tournament;
  matchIndex: number;
  onSave: (matchIndex: number, results: TeamResult[], map: string) => void;
  onClear: (matchIndex: number) => void;
  onCancel: () => void;
}

interface RowState {
  placement: string; // rank entry mode
  points: string; // placement points, points entry mode
  finish: string; // finishes (rank mode) or finish points (points mode)
  wwcd: boolean; // chicken dinner, points entry mode
}

interface Parsed {
  value: number | null; // null when blank
  invalid: boolean;
}

function parse(s: string): Parsed {
  const t = s.trim();
  if (t === '') return { value: null, invalid: false };
  if (!/^\d+$/.test(t)) return { value: null, invalid: true };
  return { value: Number(t), invalid: false };
}

export function ResultsEntry({ tournament: t, matchIndex, onSave, onClear, onCancel }: Props) {
  const match = t.matches[matchIndex];
  const rankMode = t.entryMode === 'rank';
  const { placementPoints, finishValue } = t.preset;
  const firstPlacePoints = placementPoints[0] ?? 0;
  const formRef = useRef<HTMLFormElement>(null);

  const [map, setMap] = useState(match.map);
  const [errors, setErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const team of t.teams) {
      const r = match.results?.find((x) => x.teamId === team.id);
      init[team.id] = {
        placement: r && r.placement !== null ? String(r.placement) : '',
        points: r ? String(r.placementPoints) : '',
        finish: r
          ? rankMode
            ? String(finishValue > 0 ? Math.round(r.finishPoints / finishValue) : 0)
            : String(r.finishPoints)
          : '',
        wwcd: r ? r.wwcd : false,
      };
    }
    return init;
  });

  function setRow(id: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function onPointsChange(id: string, value: string) {
    setRows((prev) => {
      const row = prev[id];
      const wasFirst = parse(row.points).value === firstPlacePoints && firstPlacePoints > 0;
      const isFirst = parse(value).value === firstPlacePoints && firstPlacePoints > 0;
      // tick the chicken dinner box when the 1st place points are typed, untick if that is undone
      const wwcd = isFirst ? true : wasFirst ? false : row.wwcd;
      return { ...prev, [id]: { ...row, points: value, wwcd } };
    });
  }

  /** What each team would score, for the live preview. */
  const preview = useMemo(() => {
    const out: Record<string, { pp: number; fp: number }> = {};
    for (const team of t.teams) {
      const row = rows[team.id];
      const fin = parse(row.finish).value ?? 0;
      if (rankMode) {
        const rank = parse(row.placement).value;
        out[team.id] = {
          pp: rank !== null && rank >= 1 ? (placementPoints[rank - 1] ?? 0) : 0,
          fp: fin * finishValue,
        };
      } else {
        out[team.id] = { pp: parse(row.points).value ?? 0, fp: fin };
      }
    }
    return out;
  }, [rows, rankMode, placementPoints, finishValue, t.teams]);

  // the entry grid follows slot order, which is how the admin reads the in-game lobby
  const ordered = useMemo(() => [...t.teams].sort((a, b) => a.slot - b.slot), [t.teams]);

  const maxFin = maxFinishes(t.lobbyPlayers);
  const finTotal = totalFinishes(
    t.teams.map((team) => parse(rows[team.id].finish).value ?? 0),
    t.entryMode,
    finishValue,
  );
  const overLimit = finTotal !== null && finTotal > maxFin;

  const rankDup = rankMode
    ? duplicateValues(t.teams.map((team) => parse(rows[team.id].placement).value))
    : new Set<number>();
  const wwcdTicked = !rankMode ? t.teams.filter((team) => rows[team.id].wwcd).length : 0;

  function moveDown(e: React.KeyboardEvent<HTMLInputElement>, col: string, rowIdx: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const next = formRef.current?.querySelector<HTMLInputElement>(
      `input[data-col="${col}"][data-row="${rowIdx + 1}"]`,
    );
    if (next) {
      next.focus();
      next.select();
    } else {
      formRef.current?.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    const results: TeamResult[] = [];
    const seenRanks = new Map<number, string>();

    for (const team of t.teams) {
      const row = rows[team.id];
      const label = team.name || 'A team';
      const fin = parse(row.finish);
      if (fin.invalid) errs.push(`${label}: finish ${rankMode ? 'count' : 'points'} must be a whole number.`);

      if (rankMode) {
        const rank = parse(row.placement);
        if (rank.invalid || rank.value === null || rank.value < 1 || rank.value > t.teams.length) {
          errs.push(`${label}: enter a placement between 1 and ${t.teams.length}.`);
          continue;
        }
        const dup = seenRanks.get(rank.value);
        if (dup) errs.push(`${label} and ${dup} both have placement ${rank.value}.`);
        seenRanks.set(rank.value, label);
        results.push({
          teamId: team.id,
          placement: rank.value,
          placementPoints: placementPoints[rank.value - 1] ?? 0,
          finishPoints: (fin.value ?? 0) * finishValue,
          wwcd: rank.value === 1,
        });
      } else {
        const pts = parse(row.points);
        if (pts.invalid) errs.push(`${label}: placement points must be a whole number.`);
        results.push({
          teamId: team.id,
          placement: null,
          placementPoints: pts.value ?? 0,
          finishPoints: fin.value ?? 0,
          wwcd: row.wwcd,
        });
      }
    }

    if (!rankMode && results.filter((r) => r.wwcd).length > 1) {
      errs.push('Only one team can win the chicken dinner in a match.');
    }
    if (overLimit) {
      errs.push(
        `Total finishes (${Number.isInteger(finTotal) ? finTotal : finTotal?.toFixed(1)}) is more than a lobby of ${t.lobbyPlayers} players allows (${maxFin} at most).`,
      );
    }

    setErrors(errs);
    if (errs.length === 0) onSave(matchIndex, results, map.trim());
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          ← Back
        </button>
        <h1>
          {match.results ? 'Edit' : 'Enter'} results · {matchLabel(match, t.days)}
        </h1>
      </div>

      <form ref={formRef} onSubmit={submit} className="card">
        <div className="field-row">
          <label className="field">
            <span>Map (optional)</span>
            <input value={map} onChange={(e) => setMap(e.target.value)} list="map-list" placeholder="Erangel" />
            <datalist id="map-list">
              {MAPS.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          <p className="hint">
            {rankMode
              ? 'Type each team\'s placement (1, 2, 3...) and number of finishes. Points are worked out for you.'
              : 'Type placement points and finish points for each team. Press Enter to jump to the next team.'}
          </p>
        </div>

        <div className={`finish-meter ${overLimit ? 'bad shake' : ''}`} role="status">
          <span>
            Finishes entered:{' '}
            <strong>
              {finTotal === null ? '–' : Number.isInteger(finTotal) ? finTotal : finTotal.toFixed(1)} / {maxFin}
            </strong>
          </span>
          <span className="muted">
            {overLimit
              ? `Too many: a lobby of ${t.lobbyPlayers} players can have at most ${maxFin} finishes.`
              : `A lobby of ${t.lobbyPlayers} players can have at most ${maxFin}.`}
          </span>
        </div>

        {errors.length > 0 && (
          <div className="alert alert-error">
            <strong>Please fix this before saving:</strong>
            <ul>
              {errors.map((er, i) => (
                <li key={i}>{er}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="table-scroll">
          <table className="entry-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th className="left">Team</th>
                {rankMode ? (
                  <>
                    <th>Placement</th>
                    <th>Finishes</th>
                    <th>Place Pts</th>
                    <th>Finish Pts</th>
                  </>
                ) : (
                  <>
                    <th>Place Pts</th>
                    <th>Finish Pts</th>
                    <th>WWCD</th>
                  </>
                )}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((team, i) => {
                const row = rows[team.id];
                const p = preview[team.id];
                const rankVal = parse(row.placement).value;
                const rankBad = rankMode && rankVal !== null && (rankDup.has(rankVal) || rankVal < 1 || rankVal > t.teams.length);
                return (
                  <tr key={team.id}>
                    <td className="slot-cell">{team.slot}</td>
                    <td className="left">
                      <div className="team-cell">
                        <TeamLogo team={team} size={26} />
                        <span>{team.name}</span>
                      </div>
                    </td>
                    {rankMode ? (
                      <>
                        <td>
                          <input
                            className={`num-input ${rankBad ? 'bad shake' : ''}`}
                            aria-invalid={rankBad}
                            title={rankBad ? 'This placement is repeated or out of range' : undefined}
                            inputMode="numeric"
                            data-col="placement"
                            data-row={i}
                            value={row.placement}
                            onChange={(e) => setRow(team.id, { placement: e.target.value })}
                            onKeyDown={(e) => moveDown(e, 'placement', i)}
                          />
                        </td>
                        <td>
                          <input
                            className={`num-input ${overLimit ? 'bad shake' : ''}`}
                            aria-invalid={overLimit}
                            inputMode="numeric"
                            data-col="finish"
                            data-row={i}
                            value={row.finish}
                            onChange={(e) => setRow(team.id, { finish: e.target.value })}
                            onKeyDown={(e) => moveDown(e, 'finish', i)}
                          />
                        </td>
                        <td className="calc">{p.pp}</td>
                        <td className="calc">{p.fp}</td>
                      </>
                    ) : (
                      <>
                        <td>
                          <input
                            className="num-input"
                            inputMode="numeric"
                            data-col="points"
                            data-row={i}
                            value={row.points}
                            onChange={(e) => onPointsChange(team.id, e.target.value)}
                            onKeyDown={(e) => moveDown(e, 'points', i)}
                          />
                        </td>
                        <td>
                          <input
                            className={`num-input ${overLimit ? 'bad shake' : ''}`}
                            aria-invalid={overLimit}
                            inputMode="numeric"
                            data-col="finish"
                            data-row={i}
                            value={row.finish}
                            onChange={(e) => setRow(team.id, { finish: e.target.value })}
                            onKeyDown={(e) => moveDown(e, 'finish', i)}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            className={row.wwcd && wwcdTicked > 1 ? 'bad-check shake' : ''}
                            title={row.wwcd && wwcdTicked > 1 ? 'Only one team can win the chicken dinner' : undefined}
                            checked={row.wwcd}
                            onChange={(e) => setRow(team.id, { wwcd: e.target.checked })}
                            aria-label={`${team.name} chicken dinner`}
                          />
                        </td>
                      </>
                    )}
                    <td className="calc strong">{p.pp + p.fp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary">
            Save results
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          {match.results && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (window.confirm('Clear all results for this match? Later tables will be recalculated.')) {
                  onClear(matchIndex);
                }
              }}
            >
              Clear this match
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
