import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const telegram = window.Telegram?.WebApp;

function callEndpoint(name, input) {
  return new Promise((resolve, reject) => {
    const call = window.Telegram?.WebApp?.Serverless?.call;
    if (typeof call !== 'function') {
      reject(new Error('Telegram Serverless Mini App API is unavailable. Open this app inside Telegram after deploying it with the current tgcloud CLI.'));
      return;
    }

    const callback = (error, result) => {
      if (error) {
        const detail = error.parameters?.code ? ` (${error.parameters.code})` : '';
        reject(new Error(`${error.message || 'Backend request failed'}${detail}`));
        return;
      }
      resolve(result);
    };

    if (input === undefined) call(name, callback);
    else call(name, input, callback);
  });
}

function formatDate(unixSeconds) {
  if (!unixSeconds) return 'Just now';
  return new Date(unixSeconds * 1000).toLocaleString();
}

function App() {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [notes, setNotes] = useState([]);
  const [notesError, setNotesError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    telegram?.ready();
    telegram?.expand();

    callEndpoint('getDemoStatus')
      .then(setStatus)
      .catch((error) => setStatusError(error.message));

    refreshNotes();
  }, []);

  async function refreshNotes() {
    setNotesError('');
    try {
      const result = await callEndpoint('listDemoNotes');
      setNotes(result.notes || []);
    } catch (error) {
      setNotesError(error.message);
    }
  }

  async function saveNote(event) {
    event.preventDefault();
    const cleanNote = note.trim();
    if (!cleanNote || saving) return;

    setSaving(true);
    setNotesError('');
    try {
      await callEndpoint('saveDemoNote', { note: cleanNote });
      setNote('');
      await refreshNotes();
    } catch (error) {
      setNotesError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const displayName = status?.user?.first_name || telegram?.initDataUnsafe?.user?.first_name || 'there';

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">TC</div>
        <div>
          <p className="eyebrow">TELEGRAM SERVERLESS</p>
          <h1>Mini App Lab</h1>
        </div>
        <span className="live-pill"><span /> Demo</span>
      </header>

      <section className="hero">
        <p className="eyebrow">END-TO-END EXAMPLE</p>
        <h2>Hello, {displayName}.</h2>
        <p className="hero-copy">A real Mini App frontend, authenticated backend endpoints, and persistent data — deployed together on Telegram.</p>
        <div className="hero-meta">
          <span className="status-dot" />
          {status ? 'Connected to the Serverless backend' : statusError ? 'Backend connection needs attention' : 'Connecting to backend…'}
        </div>
      </section>

      {statusError && (
        <section className="notice error" role="alert">
          <strong>Backend connection failed</strong>
          <p>{statusError}</p>
          <p>Confirm that the project is deployed and open this page from Telegram.</p>
        </section>
      )}

      <section className="grid">
        <article className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">01 / VERIFIED CONTEXT</p>
              <h3>Telegram identity</h3>
            </div>
            <span className="icon-badge">ID</span>
          </div>
          {status?.user ? (
            <dl className="details">
              <div><dt>Name</dt><dd>{[status.user.first_name, status.user.last_name].filter(Boolean).join(' ')}</dd></div>
              <div><dt>Username</dt><dd>{status.user.username ? `@${status.user.username}` : 'Not set'}</dd></div>
              <div><dt>User ID</dt><dd className="mono">{status.user.id}</dd></div>
              <div><dt>Server time</dt><dd>{new Date(status.serverTime).toLocaleTimeString()}</dd></div>
            </dl>
          ) : <p className="muted">Waiting for verified user details from the backend.</p>}
          <p className="card-footnote">Identity comes from the server-verified <code>ctx.initData</code>, not a user ID sent by the browser.</p>
        </article>

        <article className="card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">02 / API ROUND TRIP</p>
              <h3>Backend health</h3>
            </div>
            <span className="icon-badge">API</span>
          </div>
          <div className="metric">{status ? '200' : statusError ? 'ERR' : '…'}</div>
          <p className="muted">{status ? 'getDemoStatus endpoint responded successfully.' : statusError || 'Waiting for endpoint response.'}</p>
          <div className="endpoint-label"><span className="method">POST</span><code>/api/getDemoStatus</code></div>
        </article>
      </section>

      <section className="card notes-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">03 / DATABASE ROUND TRIP</p>
            <h3>Your private demo notes</h3>
          </div>
          <span className="count-pill">{notes.length} / 10</span>
        </div>
        <p className="muted">Notes are stored in this bot's SQLite database and filtered by your verified Telegram user ID.</p>
        <form onSubmit={saveNote} className="note-form">
          <label htmlFor="note">Add a note</label>
          <div className="input-row">
            <input id="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Try saving a note…" />
            <button type="submit" disabled={!note.trim() || saving}>{saving ? 'Saving…' : 'Save note'}</button>
          </div>
          <div className="input-help">{note.length} / 200 characters</div>
        </form>

        {notesError && (
          <div className="notice warning" role="status">
            <strong>Notes API needs setup</strong>
            <p>{notesError}</p>
            <p>After deploying the schema, run <code>npx tgcloud migrate</code> and confirm the demo_notes table creation.</p>
            <button className="secondary-button" type="button" onClick={refreshNotes}>Try again</button>
          </div>
        )}

        {notes.length > 0 ? (
          <ul className="notes-list">
            {notes.map((item) => (
              <li key={item.id}>
                <span className="note-bullet" />
                <div><p>{item.note}</p><time>{formatDate(item.createdAt)}</time></div>
              </li>
            ))}
          </ul>
        ) : !notesError ? <p className="empty-state">Your saved notes will appear here.</p> : null}
      </section>

      <footer className="footer">
        <span>Telegram Serverless · Vite + React</span>
        <span>Frontend + API + database</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
