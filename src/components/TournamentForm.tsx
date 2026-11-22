import { useEffect, useState } from 'react';
import type { EntryMode, Game, Team, TiebreakKey, Tournament } from '../types';
import {
  ALL_TIEBREAK_KEYS,
  DEFAULT_PLACEMENT_POINTS,
  DEFAULT_TIEBREAKERS,
  TIEBREAK_LABELS,
} from '../presets';
import { buildMatches, defaultLobbyPlayers, newTeam, uid } from '../logic/tournament';
import { fileToLogo } from '../imageUtils';
import { TeamLogo } from './TeamLogo';

interface Props {
  /** when given, the form edits this tournament instead of creating a new one */
  initial?: Tournament;
  onSubmit: (t: Tournament) => void;
  onCancel: () => void;
}

const ORDINALS = Array.from({ length: 16 }, (_, i) => {
  const n = i + 1;
  const s = ['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0];
  return `${n}${s}`;
});

function intInRange(s: string, min: number, max: number): number | null {
  const t = s.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
}

export function TournamentForm({ initial, onSubmit, onCancel }: Props) {
  const editing = !!initial;
  const hasResults = !!initial?.matches.some((m) => m.results);

  const [name, setName] = useState(initial?.name ?? '');
  const [game, setGame] = useState<Game>(initial?.game ?? 'BGMI');
  const [teamCountStr, setTeamCountStr] = useState(String(initial?.teams.length ?? 16));
  const [daysStr, setDaysStr] = useState(String(initial?.days ?? 3));
  const [perDayStr, setPerDayStr] = useState(String(initial?.matchesPerDay ?? 6));
  const [entryMode, setEntryMode] = useState<EntryMode>(initial?.entryMode ?? 'rank');
  const [teams, setTeams] = useState<Team[]>(() =>
    initial ? initial.teams.map((x) => ({ ...x })) : Array.from({ length: 16 }, (_, i) => newTeam(i + 1)),
  );
  const [pasteText, setPasteText] = useState('');
  const [lobbyStr, setLobbyStr] = useState(String(initial?.lobbyPlayers ?? defaultLobbyPlayers(16)));
  // once the admin types a lobby size, stop following the team count
  const [lobbyTouched, setLobbyTouched] = useState(editing);

  const [smashEnabled, setSmashEnabled] = useState(initial?.smash.enabled ?? false);
  const [smashStartStr, setSmashStartStr] = useState(String(initial?.smash.startDay ?? 3));
  const [smashExtraStr, setSmashExtraStr] = useState(String(initial?.smash.extraPoints ?? 10));

  const [tbOrder, setTbOrder] = useState<TiebreakKey[]>(() => {
    const active = initial?.tiebreakers ?? DEFAULT_TIEBREAKERS;
    return [...active, ...ALL_TIEBREAK_KEYS.filter((k) => !active.includes(k))];
  });
  const [tbEnabled, setTbEnabled] = useState<Record<TiebreakKey, boolean>>(() => {
    const active = initial?.tiebreakers ?? DEFAULT_TIEBREAKERS;
    return {
      wwcd: active.includes('wwcd'),
      finish: active.includes('finish'),
      reachedFirst: active.includes('reachedFirst'),
      placement: active.includes('placement'),
    };
  });

  const [placementStr, setPlacementStr] = useState<string[]>(() =>
    (initial?.preset.placementPoints ?? DEFAULT_PLACEMENT_POINTS).map(String),
  );
  const [finishValueStr, setFinishValueStr] = useState(String(initial?.preset.finishValue ?? 1));

  const [logo, setLogo] = useState<string | undefined>(initial?.logo);
  const [organizerLogo, setOrganizerLogo] = useState<string | undefined>(initial?.organizerLogo);
  const [footerText, setFooterText] = useState(initial?.footerText ?? '');
  const [errors, setErrors] = useState<string[]>([]);

  // keep the team table in step with the team count while creating
  useEffect(() => {
    if (editing) return;
    const n = intInRange(teamCountStr, 2, 64);
    if (n === null) return;
    setTeams((prev) =>
      prev.length === n
        ? prev
        : n > prev.length
          ? [...prev, ...Array.from({ length: n - prev.length }, (_, k) => newTeam(prev.length + k + 1))]
          : prev.slice(0, n),
    );
    if (!lobbyTouched) setLobbyStr(String(defaultLobbyPlayers(n)));
  }, [teamCountStr, editing, lobbyTouched]);

  const daysNum = intInRange(daysStr, 1, 10) ?? 1;
  const smashPossible = daysNum >= 2;

  function updateTeam(i: number, patch: Partial<Team>) {
    setTeams((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function onTeamLogo(i: number, file: File | undefined) {
    if (!file) return;
    try {
      const data = await fileToLogo(file, 128);
      updateTeam(i, { logo: data, logoMode: 'upload' });
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  }

  async function onEventLogo(which: 'logo' | 'organizer', file: File | undefined) {
    if (!file) return;
    try {
      const data = await fileToLogo(file, 256);
      if (which === 'logo') setLogo(data);
      else setOrganizerLogo(data);
    } catch (e) {
      setErrors([(e as Error).message]);
    }
  }

  function applyPaste() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setTeams((prev) => {
      const next = [...prev];
      lines.forEach((line, i) => {
        if (next[i]) next[i] = { ...next[i], name: line };
        else next.push({ ...newTeam(next.length + 1), name: line });
      });
      return next;
    });
    setTeamCountStr((c) => String(Math.max(lines.length, intInRange(c, 2, 64) ?? 0)));
    setPasteText('');
  }

  function moveTb(i: number, dir: -1 | 1) {
    setTbOrder((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];

    if (!name.trim()) errs.push('Give the tournament a name.');
    const days = intInRange(daysStr, 1, 10);
    const perDay = intInRange(perDayStr, 1, 20);
    if (days === null) errs.push('Days must be a number from 1 to 10.');
    if (perDay === null) errs.push('Matches per day must be a number from 1 to 20.');
    if (!editing && intInRange(teamCountStr, 2, 64) === null) errs.push('Number of teams must be from 2 to 64.');

    const seen = new Set<string>();
    const seenSlots = new Map<number, string>();
    teams.forEach((tm, i) => {
      const n = tm.name.trim();
      if (!n) errs.push(`Team ${i + 1} needs a name.`);
      else if (seen.has(n.toLowerCase())) errs.push(`"${n}" is entered twice.`);
      seen.add(n.toLowerCase());

      const label = n || `Team ${i + 1}`;
      if (!Number.isInteger(tm.slot) || tm.slot < 1) {
        errs.push(`${label} needs a slot number (1 or higher).`);
      } else {
        const other = seenSlots.get(tm.slot);
        if (other) errs.push(`${label} and ${other} both have slot ${tm.slot}.`);
        else seenSlots.set(tm.slot, label);
      }
    });

    const lobbyPlayers = intInRange(lobbyStr, 2, 200);
    if (lobbyPlayers === null) errs.push('Players in the lobby must be a number from 2 to 200.');
    else if (lobbyPlayers < teams.length) errs.push('The lobby cannot have fewer players than there are teams.');

    const placementPoints = placementStr.map((s) => intInRange(s, 0, 1000));
    if (placementPoints.some((p) => p === null)) errs.push('Every placement point value must be a whole number.');
    const finishValue = intInRange(finishValueStr, 0, 1000);
    if (finishValue === null) errs.push('Points per finish must be a whole number.');

    const smashActive = smashEnabled && smashPossible;
    const smashStart = intInRange(smashStartStr, 2, Math.max(2, days ?? 2));
    const smashExtra = intInRange(smashExtraStr, 0, 1000);
    if (smashActive) {
      if (smashStart === null || (days !== null && smashStart > days)) {
        errs.push('The smash rule must start on a day from 2 up to the last day.');
      }
      if (smashExtra === null) errs.push('Smash extra points must be a whole number.');
    }

    const tiebreakers = tbOrder.filter((k) => tbEnabled[k]);

    setErrors(errs);
    if (errs.length > 0 || days === null || perDay === null || finishValue === null || lobbyPlayers === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const now = new Date().toISOString();
    const cleanTeams = teams.map((tm) => ({
      ...tm,
      name: tm.name.trim(),
      logo: tm.logoMode === 'upload' ? tm.logo : undefined,
    }));
    const preset = { placementPoints: placementPoints as number[], finishValue };
    const smash = {
      enabled: smashActive,
      startDay: smashStart ?? 3,
      extraPoints: smashExtra ?? 10,
    };

    if (initial) {
      const structureChanged = days !== initial.days || perDay !== initial.matchesPerDay;
      onSubmit({
        ...initial,
        name: name.trim(),
        game,
        days,
        matchesPerDay: perDay,
        lobbyPlayers,
        entryMode,
        preset,
        tiebreakers,
        smash,
        teams: cleanTeams,
        matches: !hasResults && structureChanged ? buildMatches(days, perDay) : initial.matches,
        logo,
        organizerLogo,
        footerText,
        updatedAt: now,
      });
    } else {
      onSubmit({
        id: uid(),
        name: name.trim(),
        game,
        days,
        matchesPerDay: perDay,
        lobbyPlayers,
        entryMode,
        preset,
        tiebreakers,
        smash,
        teams: cleanTeams,
        matches: buildMatches(days, perDay),
        theme: 'amaze',
        logo,
        organizerLogo,
        footerText,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          ← Back
        </button>
        <h1>{editing ? 'Tournament settings' : 'Create tournament'}</h1>
      </div>

      <form onSubmit={submit} className="stack">
        {errors.length > 0 && (
          <div className="alert alert-error">
            <strong>Please fix this first:</strong>
            <ul>
              {errors.map((er, i) => (
                <li key={i}>{er}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="card">
          <h2>Basics</h2>
          <div className="grid">
            <label className="field wide">
              <span>Tournament name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BMIC 2026" />
            </label>
            <label className="field">
              <span>Game</span>
              <select value={game} onChange={(e) => setGame(e.target.value as Game)}>
                <option value="BGMI">BGMI</option>
                <option value="PUBG">PUBG Mobile</option>
              </select>
            </label>
            <label className="field">
              <span>Number of teams</span>
              <input
                inputMode="numeric"
                value={teamCountStr}
                disabled={editing}
                onChange={(e) => setTeamCountStr(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Players in each lobby</span>
              <input
                inputMode="numeric"
                value={lobbyStr}
                onChange={(e) => {
                  setLobbyTouched(true);
                  setLobbyStr(e.target.value);
                }}
              />
            </label>
            <label className="field">
              <span>Days</span>
              <input
                inputMode="numeric"
                value={daysStr}
                disabled={hasResults}
                onChange={(e) => setDaysStr(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Matches per day</span>
              <input
                inputMode="numeric"
                value={perDayStr}
                disabled={hasResults}
                onChange={(e) => setPerDayStr(e.target.value)}
              />
            </label>
            <label className="field">
              <span>How you enter results</span>
              <select
                value={entryMode}
                disabled={hasResults}
                onChange={(e) => setEntryMode(e.target.value as EntryMode)}
              >
                <option value="rank">Placement rank + finishes (points worked out)</option>
                <option value="points">Placement points + finish points</option>
              </select>
            </label>
          </div>
          <p className="hint">
            The lobby size (for example 40 for 10 squads of 4) sets the most finishes a match can have: one less than
            the number of players. Set it to 1 day for a single-day tournament and the day labels disappear.
          </p>
          {hasResults && (
            <p className="hint">Days, matches and entry mode are locked once results have been entered.</p>
          )}
        </section>

        <section className="card">
          <h2>Teams</h2>
          <p className="hint">
            The slot number is each team's slot in the in-game lobby. Results are entered in slot order to make it
            quicker; slots are never shown on the tables.
          </p>
          {!editing && (
            <details className="paste">
              <summary>Paste a list of team names</summary>
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'One team per line\nTeam Soul\nGodLike Esports'}
              />
              <button type="button" className="btn" onClick={applyPaste}>
                Fill the table
              </button>
            </details>
          )}
          <div className="table-scroll">
            <table className="entry-table team-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Slot</th>
                  <th className="left">Team name</th>
                  <th className="left">Logo</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((tm, i) => (
                  <tr key={tm.id}>
                    <td>{i + 1}</td>
                    <td>
                      <input
                        className="num-input slot-input"
                        inputMode="numeric"
                        aria-label={`Slot for team ${i + 1}`}
                        value={tm.slot > 0 ? String(tm.slot) : ''}
                        onChange={(e) => updateTeam(i, { slot: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      />
                    </td>
                    <td className="left">
                      <input
                        className="text-input"
                        value={tm.name}
                        onChange={(e) => updateTeam(i, { name: e.target.value })}
                        placeholder={`Team ${i + 1}`}
                      />
                    </td>
                    <td className="left">
                      <div className="logo-pick">
                        <TeamLogo team={tm} size={26} />
                        <select
                          value={tm.logoMode}
                          onChange={(e) => updateTeam(i, { logoMode: e.target.value as Team['logoMode'] })}
                        >
                          <option value="initials">Initials</option>
                          <option value="upload">Upload</option>
                          <option value="none">None</option>
                        </select>
                        {tm.logoMode === 'upload' && (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => onTeamLogo(i, e.target.files?.[0])}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Tiebreakers</h2>
          <p className="hint">
            When teams have the same total points, these decide the order, top to bottom. Untick one to skip it.
          </p>
          <ol className="tb-list">
            {tbOrder.map((key, i) => (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={tbEnabled[key]}
                    onChange={(e) => setTbEnabled((prev) => ({ ...prev, [key]: e.target.checked }))}
                  />
                  {TIEBREAK_LABELS[key]}
                </label>
                <span className="tb-btns">
                  <button type="button" className="btn btn-small" onClick={() => moveTb(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => moveTb(i, 1)}
                    disabled={i === tbOrder.length - 1}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <h2>Smash rule</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={smashEnabled && smashPossible}
              disabled={!smashPossible}
              onChange={(e) => setSmashEnabled(e.target.checked)}
            />
            Use the smash rule
          </label>
          {!smashPossible && <p className="hint">The smash rule needs at least 2 days.</p>}
          {smashEnabled && smashPossible && (
            <div className="grid">
              <label className="field">
                <span>Starts on day</span>
                <input inputMode="numeric" value={smashStartStr} onChange={(e) => setSmashStartStr(e.target.value)} />
              </label>
              <label className="field">
                <span>Extra points over the previous day's leader</span>
                <input inputMode="numeric" value={smashExtraStr} onChange={(e) => setSmashExtraStr(e.target.value)} />
              </label>
              <p className="hint wide">
                The smash point is the leader's total after the day before, plus these extra points. A team at or above
                it that then wins a chicken dinner wins the tournament.
              </p>
            </div>
          )}
        </section>

        <section className="card">
          <details>
            <summary>
              <strong>Points table</strong> (placement and finish points)
            </summary>
            <div className="preset-grid">
              {placementStr.map((v, i) => (
                <label key={i} className="field small">
                  <span>{ORDINALS[i]}</span>
                  <input
                    inputMode="numeric"
                    value={v}
                    onChange={(e) =>
                      setPlacementStr((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                  />
                </label>
              ))}
            </div>
            <label className="field small-wide">
              <span>Points per finish</span>
              <input inputMode="numeric" value={finishValueStr} onChange={(e) => setFinishValueStr(e.target.value)} />
            </label>
          </details>
        </section>

        <section className="card">
          <h2>Branding (optional)</h2>
          <div className="grid">
            <div className="field">
              <span>Tournament logo</span>
              <div className="logo-pick">
                {logo && <img className="preview-logo" src={logo} alt="" />}
                <input type="file" accept="image/*" onChange={(e) => onEventLogo('logo', e.target.files?.[0])} />
                {logo && (
                  <button type="button" className="btn btn-small" onClick={() => setLogo(undefined)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div className="field">
              <span>Organizer logo</span>
              <div className="logo-pick">
                {organizerLogo && <img className="preview-logo" src={organizerLogo} alt="" />}
                <input type="file" accept="image/*" onChange={(e) => onEventLogo('organizer', e.target.files?.[0])} />
                {organizerLogo && (
                  <button type="button" className="btn btn-small" onClick={() => setOrganizerLogo(undefined)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
            <label className="field wide">
              <span>Footer line on images (social handles, sponsor, etc.)</span>
              <input value={footerText} onChange={(e) => setFooterText(e.target.value)} placeholder="@yourhandle" />
            </label>
          </div>
        </section>

        <div className="actions">
          <button type="submit" className="btn btn-primary">
            {editing ? 'Save settings' : 'Create tournament'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
