// Stav uložení projektu v postranním panelu: úložiště prohlížeče, záloha a průběžné ukládání do souboru.

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { exportBackup } from '../lib/db';
import { ago, fileSaveSupported, lastBackup, linkFile, linkedFile, markBackup, regrantFile, saveToFile, unlinkFile, type SaveResult } from '../lib/storage';
import type { Project, RecordItem } from '../lib/types';
import { download, slug } from '../lib/util';

export default function SaveBox({ project, records }: { project: Project; records: RecordItem[] }) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<SaveResult | 'saving' | null>(null);
  const backupAt = useLiveQuery(() => lastBackup(project.id), [project.id, tick]);
  const link = useLiveQuery(() => linkedFile(project.id), [project.id, tick]);
  const supported = fileSaveSupported();
  const first = useRef(true);

  // Průběžné ukládání: několik vteřin po poslední změně zapíše projekt do propojeného souboru.
  useEffect(() => {
    if (!link || link.permission !== 'granted') return;
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      setState('saving');
      setState(await saveToFile(project.id));
      setTick((t) => t + 1);
    }, 3000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, records, link?.permission, link?.name]);

  const backup = async () => {
    download(`${slug(project.title)}-zaloha.json`, JSON.stringify(await exportBackup(project.id), null, 1), 'application/json');
    await markBackup(project.id);
    setTick((t) => t + 1);
  };
  const connect = async () => {
    try {
      if (await linkFile(project.id, `${slug(project.title)}.json`)) setState('saved');
    } catch {
      setState('error');
    }
    setTick((t) => t + 1);
  };
  const regrant = async () => {
    if (await regrantFile(project.id)) setState(await saveToFile(project.id));
    setTick((t) => t + 1);
  };

  const stale = !backupAt || new Date(project.updatedAt).getTime() - new Date(backupAt).getTime() > 7 * 86400000;
  return (
    <div className="savebox">
      <div className="small">
        <strong>Uložení</strong>
      </div>
      <div className="small muted">Změny se ukládají samy do tohoto prohlížeče a zůstanou tu i po zavření.</div>
      {link ? (
        <div className="small" style={{ marginTop: 6 }}>
          Soubor <strong>{link.name}</strong>:{' '}
          {link.permission !== 'granted' ? 'čeká na povolení zápisu' : state === 'saving' ? 'ukládám…' : state === 'error' ? 'zápis se nezdařil' : `uloženo ${backupAt ? ago(backupAt) : ''}`}
        </div>
      ) : (
        <div className="small" style={{ marginTop: 6 }}>
          Záloha v souboru: {backupAt ? ago(backupAt) : 'zatím žádná'}
          {stale && backupAt ? <span className="muted"> – od té doby přibyly změny</span> : null}
        </div>
      )}
      <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
        {link && link.permission !== 'granted' ? (
          <button type="button" className="btn small primary" onClick={regrant}>
            Obnovit ukládání do souboru
          </button>
        ) : null}
        <button type="button" className="btn small" onClick={backup}>
          Stáhnout zálohu projektu
        </button>
        {supported ? (
          link ? (
            <button
              type="button"
              className="btn small ghost"
              onClick={async () => {
                await unlinkFile(project.id);
                setState(null);
                setTick((t) => t + 1);
              }}
            >
              Odpojit soubor
            </button>
          ) : (
            <button type="button" className="btn small" onClick={connect} title="Projekt se bude průběžně zapisovat do souboru, který zvolíte – třeba ve složce synchronizované s cloudem.">
              Průběžně ukládat do souboru
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
