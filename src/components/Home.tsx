import { useRef, useState } from 'react';
import type { Tournament } from '../types';
import { playedIndexes } from '../logic/standings';

interface Props {
  tournaments: Tournament[];
  storageWarning: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSaveCopy: () => void;
  onLoadCopy: (text: string) => string | null;
}

export function Home({ tournaments, storageWarning, onCreate, onOpen, onDelete, onSaveCopy, onLoadCopy }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const err = onLoadCopy(text);
    setMessage(err ? { kind: 'error', text: err } : { kind: 'ok', text: 'Loaded your saved copy.' });
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <h1 className="brand">WWCD Table</h1>
          <p className="muted">Points tables for BGMI and PUBG Mobile tournaments</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreate}>
          + Create tournament
        </button>
      </header>

      {storageWarning && (
        <div className="alert alert-error">
          Your browser would not save the latest changes (its storage may be full). Use "Save a copy" below to keep a
          backup.
        </div>
      )}
      {message && <div className={`alert ${message.kind === 'ok' ? 'alert-ok' : 'alert-error'}`}>{message.text}</div>}

      {tournaments.length === 0 ? (
        <div className="card empty-card">
          <h2>No tournaments yet</h2>
          <p>Create one, add the team names, and start entering match results.</p>
          <button type="button" className="btn btn-primary" onClick={onCreate}>
            Create your first tournament
          </button>
        </div>
      ) : (
        <ul className="t-list">
          {[...tournaments]
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((t) => {
              const played = playedIndexes(t, t.matches.length - 1).length;
              return (
                <li key={t.id} className="card t-item">
                  <button type="button" className="t-main" onClick={() => onOpen(t.id)}>
                    <strong>{t.name}</strong>
                    <span className="muted">
                      {t.game === 'PUBG' ? 'PUBG Mobile' : 'BGMI'} · {t.teams.length} teams · {played} out of{' '}
                      {t.matches.length} matches played
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      if (window.confirm(`Delete "${t.name}" and all its results? This cannot be undone.`)) {
                        onDelete(t.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      <footer className="home-foot">
        <p className="muted">Your data is saved on this device only. Save a copy to be safe or to move it elsewhere.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={onSaveCopy} disabled={tournaments.length === 0}>
            Save a copy
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Load a copy
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </footer>
    </div>
  );
}
