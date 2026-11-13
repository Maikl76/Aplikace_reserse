import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { createProject, db, importBackup } from '../lib/db';
import { createDemoProject } from '../lib/demo';
import { REVIEW_TYPES, TYPE_ORDER, stepsOf } from '../lib/reviewTypes';
import type { ReviewType } from '../lib/types';
import { formatDate } from '../lib/util';
import { Empty, Notice, href, navigate } from '../ui';

export default function Home() {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<ReviewType | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    if (!type) return;
    const p = await createProject(type, title);
    navigate('p', p.id);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    try {
      const p = await importBackup(JSON.parse(await file.text()));
      navigate('p', p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Soubor se nepodařilo načíst.');
    }
  };

  return (
    <main className="page">
      <div className="hero">
        <h1>Od výzkumné otázky k hotovému přehledu, krok za krokem</h1>
        <p>
          Aplikace vás provede tvorbou přehledové studie: řekne, co je v každém kroku potřeba udělat a proč, spočítá a nakreslí, co spočítat a nakreslit jde, a z vašich rozhodnutí sestaví podklad pro text práce.
          Rozhodnutí zůstávají na vás.
        </p>
      </div>

      {creating ? (
        <section className="card">
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2>Nový přehled</h2>
            <a href={href('napoveda', 'typy')}>Nevíte, který typ zvolit?</a>
          </div>
          <div className="type-grid" role="radiogroup" aria-label="Typ přehledu">
            {TYPE_ORDER.map((id) => {
              const t = REVIEW_TYPES[id];
              return (
                <button key={id} type="button" role="radio" aria-checked={type === id} className={`type-card ${type === id ? 'sel' : ''}`} onClick={() => setType(id)}>
                  <h3>{t.name}</h3>
                  <div className="small muted">{t.tagline}</div>
                  <ul>
                    {t.whenToUse.slice(0, 2).map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
          {type ? (
            <div style={{ marginTop: 16 }}>
              <Notice>
                <strong>{REVIEW_TYPES[type].name}.</strong> {REVIEW_TYPES[type].description} {REVIEW_TYPES[type].notFor} Standard: {REVIEW_TYPES[type].standard.name}. Počet kroků: {stepsOf(type).length}.
              </Notice>
            </div>
          ) : null}
          <div className="row" style={{ marginTop: 16 }}>
            <input type="text" className="grow" placeholder="Pracovní název přehledu" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Název přehledu" onKeyDown={(e) => e.key === 'Enter' && create()} />
            <button type="button" className="btn primary" disabled={!type} onClick={create}>
              Založit přehled
            </button>
            <button type="button" className="btn ghost" onClick={() => setCreating(false)}>
              Zrušit
            </button>
          </div>
        </section>
      ) : (
        <div className="row" style={{ marginBottom: 18 }}>
          <button type="button" className="btn primary" onClick={() => setCreating(true)}>
            Nový přehled
          </button>
          <button type="button" className="btn" onClick={async () => navigate('p', (await createDemoProject()).id)}>
            Otevřít ukázkový projekt
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Načíst zálohu
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
        </div>
      )}
      {error ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind="bad">{error}</Notice>
        </div>
      ) : null}

      <h2 style={{ margin: '30px 0 12px' }}>Moje přehledy</h2>
      {projects && projects.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {projects.map((p) => {
            const steps = stepsOf(p.type);
            const done = steps.filter((s) => p.done[s.id]).length;
            return (
              <a key={p.id} className="project-row" href={href('p', p.id)}>
                <div className="grow">
                  <div className="name">{p.title}</div>
                  <div className="small muted">
                    {REVIEW_TYPES[p.type].name} · upraveno {formatDate(p.updatedAt)}
                  </div>
                </div>
                {p.demo ? <span className="pill">ukázka</span> : null}
                <div style={{ width: 150 }}>
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    Hotovo {done} z {steps.length} kroků
                  </div>
                  <div className="progress">
                    <i style={{ width: `${(100 * done) / steps.length}%` }} />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <Empty title="Zatím tu žádný přehled není">Založte nový, nebo si aplikaci nejdřív projděte na ukázkovém projektu s hotovou metaanalýzou.</Empty>
      )}

      <p className="small muted" style={{ marginTop: 22 }}>
        Všechna data zůstávají jen ve vašem prohlížeči na tomto počítači. Průběžně si proto stahujte zálohu projektu – slouží i k přenosu na jiný počítač.
      </p>
    </main>
  );
}
