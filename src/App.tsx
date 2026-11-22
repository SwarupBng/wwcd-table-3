import { useEffect, useState } from 'react';
import type { ThemeId, TeamResult, Tournament } from './types';
import { loadTournaments, parseCopy, saveTournaments, serializeCopy } from './storage';
import { playedIndexes } from './logic/standings';
import { downloadText } from './imageUtils';
import { Home } from './components/Home';
import { TournamentForm } from './components/TournamentForm';
import { Dashboard } from './components/Dashboard';
import { ResultsEntry } from './components/ResultsEntry';
import type { SheetView } from './components/StandingsSheet';

type Screen =
  | { name: 'home' }
  | { name: 'create' }
  | { name: 'edit'; id: string }
  | { name: 'dashboard'; id: string }
  | { name: 'enter'; id: string; matchIndex: number };

interface Selection {
  matchIndex: number;
  view: SheetView;
}

function defaultSelection(t: Tournament): Selection {
  const played = playedIndexes(t, t.matches.length - 1);
  if (played.length === 0) return { matchIndex: 0, view: 'match' };
  return { matchIndex: played[played.length - 1], view: 'overall' };
}

export default function App() {
  const [tournaments, setTournaments] = useState<Tournament[]>(() => loadTournaments());
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [selection, setSelection] = useState<Selection>({ matchIndex: 0, view: 'match' });
  const [storageOk, setStorageOk] = useState(true);

  // auto-save every change
  useEffect(() => {
    setStorageOk(saveTournaments(tournaments));
  }, [tournaments]);

  const find = (id: string) => tournaments.find((t) => t.id === id);

  function replace(t: Tournament) {
    setTournaments((prev) => prev.map((x) => (x.id === t.id ? { ...t, updatedAt: new Date().toISOString() } : x)));
  }

  function open(id: string) {
    const t = find(id);
    if (!t) return;
    setSelection(defaultSelection(t));
    setScreen({ name: 'dashboard', id });
  }

  function saveCopy() {
    const day = new Date().toISOString().slice(0, 10);
    downloadText(serializeCopy(tournaments), `wwcd-table-copy-${day}.json`);
  }

  /** Returns an error message, or null on success. */
  function loadCopy(text: string): string | null {
    try {
      const incoming = parseCopy(text);
      setTournaments((prev) => {
        const ids = new Set(incoming.map((t) => t.id));
        return [...prev.filter((t) => !ids.has(t.id)), ...incoming];
      });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  function saveResults(id: string, matchIndex: number, results: TeamResult[], map: string) {
    const t = find(id);
    if (!t) return;
    replace({ ...t, matches: t.matches.map((m) => (m.index === matchIndex ? { ...m, results, map } : m)) });
    setSelection({ matchIndex, view: 'match' });
    setScreen({ name: 'dashboard', id });
  }

  function clearResults(id: string, matchIndex: number) {
    const t = find(id);
    if (!t) return;
    replace({ ...t, matches: t.matches.map((m) => (m.index === matchIndex ? { ...m, results: null } : m)) });
    setSelection({ matchIndex, view: 'match' });
    setScreen({ name: 'dashboard', id });
  }

  if (screen.name === 'create') {
    return (
      <TournamentForm
        onCancel={() => setScreen({ name: 'home' })}
        onSubmit={(t) => {
          setTournaments((prev) => [...prev, t]);
          setSelection({ matchIndex: 0, view: 'match' });
          setScreen({ name: 'dashboard', id: t.id });
        }}
      />
    );
  }

  if (screen.name === 'edit') {
    const t = find(screen.id);
    if (!t) return <Fallback onHome={() => setScreen({ name: 'home' })} />;
    return (
      <TournamentForm
        initial={t}
        onCancel={() => setScreen({ name: 'dashboard', id: t.id })}
        onSubmit={(updated) => {
          replace(updated);
          // the match grid can change shape if days or matches per day changed
          setSelection((s) => ({ ...s, matchIndex: Math.min(s.matchIndex, updated.matches.length - 1) }));
          setScreen({ name: 'dashboard', id: t.id });
        }}
      />
    );
  }

  if (screen.name === 'dashboard') {
    const t = find(screen.id);
    if (!t) return <Fallback onHome={() => setScreen({ name: 'home' })} />;
    const matchIndex = Math.min(selection.matchIndex, t.matches.length - 1);
    return (
      <Dashboard
        tournament={t}
        matchIndex={matchIndex}
        view={selection.view}
        onSelect={(mi, view) => setSelection({ matchIndex: mi, view })}
        onTheme={(theme: ThemeId) => replace({ ...t, theme })}
        onBack={() => setScreen({ name: 'home' })}
        onEdit={() => setScreen({ name: 'edit', id: t.id })}
        onEnter={(mi) => setScreen({ name: 'enter', id: t.id, matchIndex: mi })}
      />
    );
  }

  if (screen.name === 'enter') {
    const t = find(screen.id);
    if (!t) return <Fallback onHome={() => setScreen({ name: 'home' })} />;
    return (
      <ResultsEntry
        key={`${t.id}-${screen.matchIndex}`}
        tournament={t}
        matchIndex={screen.matchIndex}
        onSave={(mi, results, map) => saveResults(t.id, mi, results, map)}
        onClear={(mi) => clearResults(t.id, mi)}
        onCancel={() => setScreen({ name: 'dashboard', id: t.id })}
      />
    );
  }

  return (
    <Home
      tournaments={tournaments}
      storageWarning={!storageOk}
      onCreate={() => setScreen({ name: 'create' })}
      onOpen={open}
      onDelete={(id) => setTournaments((prev) => prev.filter((t) => t.id !== id))}
      onSaveCopy={saveCopy}
      onLoadCopy={loadCopy}
    />
  );
}

function Fallback({ onHome }: { onHome: () => void }) {
  return (
    <div className="page">
      <div className="card empty-card">
        <h2>That tournament could not be found</h2>
        <button type="button" className="btn btn-primary" onClick={onHome}>
          Back to tournaments
        </button>
      </div>
    </div>
  );
}
