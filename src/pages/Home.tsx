import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { createDesignProject, createProject, db, importBackup } from '../lib/db';
import { createDemoProject, createNetworkDemo } from '../lib/demo';
import { createDesignDemo } from '../lib/design/demo';
import { fileSaveSupported, storageStatus, type StorageStatus } from '../lib/storage';
import { REVIEW_TYPES, TYPE_ORDER, stepsOf } from '../lib/reviewTypes';
import type { ReviewType } from '../lib/types';
import { formatDate } from '../lib/util';
import { Empty, Notice, href, navigate } from '../ui';
import { kindLabel, stepsOfProject } from './ProjectPage';

export default function Home() {
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);
  const [creating, setCreating] = useState<null | 'review' | 'design'>(null);
  const [type, setType] = useState<ReviewType | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  useEffect(() => {
    void storageStatus().then(setStorage);
  }, []);

  const create = async () => {
    if (!type) return;
    const p = await createProject(type, title);
    navigate('p', p.id);
  };
  const createDesign = async () => navigate('p', (await createDesignProject(title)).id);
  const start = (what: 'review' | 'design') => {
    setTitle('');
    setCreating(what);
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
          Druhý průvodce pomůže navrhnout aplikaci a rozhodnout, kde poběží. Rozhodnutí zůstávají na vás.
        </p>
      </div>

      {creating === 'design' ? (
        <section className="card">
          <h2 style={{ marginBottom: 6 }}>Nový návrh aplikace</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Průvodce vede od záměru přes požadavky a vlastnosti aplikace k volbě typu řešení a místa provozu. U každé možnosti ukáže důsledky, které se projeví až po obhajobě. Rešerši k němu nepotřebujete.
          </p>
          <div className="row">
            <input type="text" className="grow" placeholder="Pracovní název aplikace" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Název aplikace" onKeyDown={(e) => e.key === 'Enter' && createDesign()} autoFocus />
            <button type="button" className="btn primary" onClick={createDesign}>
              Založit návrh
            </button>
            <button type="button" className="btn ghost" onClick={() => setCreating(null)}>
              Zrušit
            </button>
          </div>
        </section>
      ) : creating === 'review' ? (
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
            <button type="button" className="btn ghost" onClick={() => setCreating(null)}>
              Zrušit
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="start-grid">
            <section className="card">
              <h2>Přehled literatury</h2>
              <p className="muted">Narativní, mapující nebo systematický přehled, metaanalýza a zastřešující přehled: od otázky přes vyhledávání a třídění po text práce.</p>
              <div className="row">
                <button type="button" className="btn primary" onClick={() => start('review')}>
                  Nový přehled
                </button>
                <button type="button" className="btn" onClick={async () => navigate('p', (await createDemoProject()).id)}>
                  Ukázka: metaanalýza
                </button>
                <button type="button" className="btn" onClick={async () => navigate('p', (await createNetworkDemo()).id)}>
                  Ukázka: síťová metaanalýza
                </button>
              </div>
            </section>
            <section className="card">
              <h2>Návrh aplikace</h2>
              <p className="muted">Co má aplikace umět, jaký typ řešení zvolit, kde poběží a kdo se o ni postará po obhajobě. Každá možnost je popsána i s důsledky. Lze použít samostatně, bez rešerše.</p>
              <div className="row">
                <button type="button" className="btn primary" onClick={() => start('design')}>
                  Nový návrh aplikace
                </button>
                <button type="button" className="btn" onClick={async () => navigate('p', (await createDesignDemo()).id)}>
                  Ukázka: návrh aplikace
                </button>
              </div>
            </section>
          </div>
          <div className="row" style={{ margin: '14px 0 18px' }}>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              Načíst zálohu
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </div>
        </>
      )}
      {error ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind="bad">{error}</Notice>
        </div>
      ) : null}

      <h2 style={{ margin: '30px 0 12px' }}>Moje projekty</h2>
      {projects && projects.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {projects.map((p) => {
            const steps = stepsOfProject(p);
            const done = steps.filter((s) => p.done[s.id]).length;
            return (
              <a key={p.id} className="project-row" href={href('p', p.id)}>
                <div className="grow">
                  <div className="name">{p.title}</div>
                  <div className="small muted">
                    {kindLabel(p)} · upraveno {formatDate(p.updatedAt)}
                  </div>
                </div>
                {p.demo ? <span className="pill">ukázka</span> : null}
                {p.reviewerCopy ? <span className="pill">kopie pro 2. hodnotitele</span> : null}
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
        <Empty title="Zatím tu žádný projekt není">Založte nový přehled nebo návrh aplikace, případně si aplikaci nejdřív projděte na některé z ukázek.</Empty>
      )}

      <section className="card" style={{ marginTop: 22 }}>
        <h3>Kde jsou moje data</h3>
        <ul className="small" style={{ marginBottom: 0 }}>
          <li>
            <strong>Vše se ukládá samo</strong> do úložiště tohoto prohlížeče. Po zavření karty, vypnutí počítače i po týdnech najdete projekt tam, kde jste skončili.
          </li>
          <li>
            Data neopouštějí váš počítač. Proto je neuvidíte v jiném prohlížeči ani na jiném počítači a zmizí, pokud v prohlížeči smažete data stránek nebo pracujete v anonymním okně.
          </li>
          <li>
            Pojistkou je <strong>záloha projektu</strong> (tlačítko v levém panelu projektu); slouží i k přenosu na jiný počítač.{' '}
            {fileSaveSupported() ? 'V tomto prohlížeči lze navíc zapnout průběžné ukládání do souboru – třeba ve složce synchronizované s cloudem.' : 'V prohlížečích Chrome a Edge lze navíc zapnout průběžné ukládání do souboru na disku.'}
          </li>
          {storage ? (
            <li className="muted">
              {storage.persisted === true ? 'Prohlížeč potvrdil trvalé úložiště: data sám nesmaže ani při nedostatku místa na disku.' : storage.persisted === false ? 'Prohlížeč zatím nepotvrdil trvalé úložiště; při velkém nedostatku místa na disku by mohl data stránek uvolnit. Záloha tomu předejde.' : 'Prohlížeč nesděluje, zda je úložiště trvalé.'}
              {storage.usage != null && storage.usage > 0 ? ` Využito ${storage.usage > 1048576 ? `${(storage.usage / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(storage.usage / 1024))} kB`}.` : ''}
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
