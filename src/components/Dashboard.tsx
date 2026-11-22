import { useRef, useState } from 'react';
import { toJpeg, toPng } from 'html-to-image';
import type { ThemeId, Tournament } from '../types';
import { THEMES } from '../presets';
import { playedIndexes } from '../logic/standings';
import { matchLabel, slugify } from '../logic/tournament';
import { downloadDataUrl } from '../imageUtils';
import { StandingsSheet, type SheetView } from './StandingsSheet';

interface Props {
  tournament: Tournament;
  matchIndex: number;
  view: SheetView;
  onSelect: (matchIndex: number, view: SheetView) => void;
  onTheme: (theme: ThemeId) => void;
  onBack: () => void;
  onEdit: () => void;
  onEnter: (matchIndex: number) => void;
}

export function Dashboard({ tournament: t, matchIndex, view, onSelect, onTheme, onBack, onEdit, onEnter }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // after the last match: false shows the "+N" table first, true shows the clean final table
  const [finalView, setFinalView] = useState(false);

  const match = t.matches[matchIndex];
  const day = match.day;
  const dayMatches = t.matches.filter((m) => m.day === day);
  const playedTotal = playedIndexes(t, t.matches.length - 1).length;
  const hasData = view === 'overall' ? playedIndexes(t, matchIndex).length > 0 : !!match.results;
  const singleDay = t.days <= 1;
  const hasPrev = matchIndex > 0;
  const hasNext = matchIndex < t.matches.length - 1;
  const isFinalMatch = matchIndex === t.matches.length - 1 && !!match.results;
  const showFinal = view === 'overall' && isFinalMatch && finalView;

  function pickDay(d: number) {
    const first = t.matches.find((m) => m.day === d)!;
    onSelect(first.index, view);
  }

  async function download() {
    const node = sheetRef.current;
    if (!node || !hasData) return;
    setBusy(true);
    setError('');
    try {
      const options = {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: format === 'jpeg' ? '#ffffff' : undefined,
        // the sheet is centered on screen with auto margins; without this the image is shifted and cropped
        style: { margin: '0' },
      };
      const url =
        format === 'png' ? await toPng(node, options) : await toJpeg(node, { ...options, quality: 0.95 });
      const part =
        view === 'overall'
          ? showFinal
            ? 'final-standings'
            : `overall-after-match-${playedIndexes(t, matchIndex).length}`
          : singleDay
            ? `match-${match.number}`
            : `day-${match.day}-match-${match.number}`;
      downloadDataUrl(url, `${slugify(t.name)}-${part}.${format === 'png' ? 'png' : 'jpg'}`);
    } catch {
      setError('Could not create the image. Try again, or try a different logo if you uploaded a large one.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page-wide">
      <div className="page-head">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Tournaments
        </button>
        <div className="grow">
          <h1>{t.name}</h1>
          <span className="muted">
            {t.game === 'PUBG' ? 'PUBG Mobile' : 'BGMI'} · {t.teams.length} teams · {playedTotal} out of{' '}
            {t.matches.length} matches played
          </span>
        </div>
        <button type="button" className="btn" onClick={onEdit}>
          Settings
        </button>
      </div>

      <div className="card nav-card">
        {!singleDay && (
          <div className="tabs" role="tablist" aria-label="Days">
            {Array.from({ length: t.days }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === day}
                className={`tab ${d === day ? 'tab-active' : ''}`}
                onClick={() => pickDay(d)}
              >
                Day {d}
              </button>
            ))}
          </div>
        )}
        <div className="match-buttons">
          {dayMatches.map((m) => (
            <button
              key={m.index}
              type="button"
              className={`match-btn ${m.index === matchIndex ? 'match-btn-active' : ''} ${m.results ? 'has-results' : ''}`}
              onClick={() => onSelect(m.index, view)}
              title={m.results ? 'Results entered' : 'No results yet'}
            >
              M{m.number}
              {m.results && <span className="dot" />}
            </button>
          ))}
        </div>

        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Table type">
            <button
              type="button"
              className={view === 'match' ? 'seg-active' : ''}
              onClick={() => onSelect(matchIndex, 'match')}
            >
              Match table
            </button>
            <button
              type="button"
              className={view === 'overall' ? 'seg-active' : ''}
              onClick={() => onSelect(matchIndex, 'overall')}
            >
              Overall standings
            </button>
          </div>
          {view === 'overall' && isFinalMatch && (
            <div className="segmented" role="group" aria-label="Final table">
              <button type="button" className={!finalView ? 'seg-active' : ''} onClick={() => setFinalView(false)}>
                With points gained
              </button>
              <button type="button" className={finalView ? 'seg-active' : ''} onClick={() => setFinalView(true)}>
                Final
              </button>
            </div>
          )}
          <button type="button" className="btn btn-primary" onClick={() => onEnter(matchIndex)}>
            {match.results ? 'Edit results' : 'Enter results'} · {singleDay ? '' : `Day ${match.day} `}M{match.number}
          </button>
        </div>
      </div>

      <div className="card export-card">
        <div className="theme-picker" role="group" aria-label="Theme">
          <span className="muted">Theme</span>
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              className={`chip ${t.theme === th.id ? 'chip-active' : ''}`}
              onClick={() => onTheme(th.id)}
            >
              {th.label}
            </button>
          ))}
        </div>
        <div className="download">
          <select value={format} onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg')} aria-label="Image format">
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={download} disabled={!hasData || busy}>
            {busy ? 'Creating image…' : 'Download image'}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="map-caption">
        <strong>{matchLabel(match, t.days)}</strong>
        {match.map && <span> · {match.map}</span>}
        <span className="muted">
          {' '}
          ({matchIndex + 1} of {t.matches.length})
        </span>
      </div>

      <div className="sheet-stage">
        <button
          type="button"
          className="nav-arrow"
          onClick={() => onSelect(matchIndex - 1, view)}
          disabled={!hasPrev}
          aria-label="Previous match"
          title="Previous match"
        >
          ‹
        </button>
        <div className="sheet-wrap">
          <StandingsSheet ref={sheetRef} tournament={t} view={view} matchIndex={matchIndex} theme={t.theme} final={showFinal} />
        </div>
        <button
          type="button"
          className="nav-arrow"
          onClick={() => onSelect(matchIndex + 1, view)}
          disabled={!hasNext}
          aria-label="Next match"
          title="Next match"
        >
          ›
        </button>
      </div>
    </div>
  );
}
