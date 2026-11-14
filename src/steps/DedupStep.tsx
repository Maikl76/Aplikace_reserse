import { useState } from 'react';
import { db, patchProject } from '../lib/db';
import { findDuplicates, mergedFields, pickPrimary, type DupGroup } from '../lib/dedup';
import type { RecordItem } from '../lib/types';
import { plural } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Notice, Stat } from '../ui';
import { authorsShort, sourceLine } from './common';

const REASONS: Record<DupGroup['reason'], string> = { doi: 'stejné DOI', pmid: 'stejné PMID', title: 'shodný název', similar: 'podobný název' };
const keyOf = (ids: string[]) => [...ids].sort().join('|');

/**
 * Sloučí skupiny duplicit: v každé ponechá nejúplnější záznam, doplní mu chybějící údaje
 * a ostatní označí jako duplicity. Vše proběhne v jedné transakci, takže se i stovky
 * skupin sloučí naráz.
 */
async function mergeGroups(groups: RecordItem[][]) {
  const changes: { key: string; changes: Partial<RecordItem> }[] = [];
  for (const members of groups) {
    if (members.length < 2) continue;
    const primary = pickPrimary(members);
    const dups = members.filter((r) => r.id !== primary.id);
    const patch = mergedFields(primary, dups);
    if (Object.keys(patch).length) changes.push({ key: primary.id, changes: patch });
    for (const d of dups) changes.push({ key: d.id, changes: { duplicateOf: primary.id } });
  }
  await db.records.bulkUpdate(changes);
}

export default function DedupStep({ project, records }: StepProps) {
  const byId = new Map(records.map((r) => [r.id, r]));
  const dismissed = new Set(project.notDuplicates);
  const groups = findDuplicates(records).filter((g) => !dismissed.has(keyOf(g.ids)));
  const certain = groups.filter((g) => g.certain);
  const probable = groups.filter((g) => !g.certain);
  const merged = records.filter((r) => r.duplicateOf);
  const members = (g: DupGroup) => g.ids.map((id) => byId.get(id)!).filter(Boolean);

  const [busy, setBusy] = useState(false);
  const mergeAll = async () => {
    setBusy(true);
    try {
      await mergeGroups(certain.map(members));
    } finally {
      setBusy(false);
    }
  };
  const dismiss = (g: DupGroup) => patchProject(project.id, { notDuplicates: [...project.notDuplicates, keyOf(g.ids)] });

  if (records.length === 0) return <Empty title="Zatím nejsou žádné záznamy">Nejprve stáhněte nebo nahrajte výsledky v kroku Vyhledávání.</Empty>;

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Nalezené záznamy" value={records.length} />
        <Stat label="Odstraněné duplicity" value={merged.length} />
        <Stat label="Záznamy k třídění" value={records.length - merged.length} />
        <Stat label="Zbývá posoudit" value={groups.length} sub="skupin možných duplicit" />
      </div>

      {groups.length === 0 ? <Notice kind="good">Žádné další duplicity nebyly nalezeny. Můžete pokračovat tříděním.</Notice> : null}

      {certain.length > 0 ? (
        <section className="card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>Jisté shody ({certain.length})</h3>
              <span className="small muted">Stejné DOI, PMID nebo shodný název. Ponechá se úplnější záznam.</span>
            </div>
            <button type="button" className="btn primary" onClick={mergeAll} disabled={busy}>
              {busy ? 'Slučuji…' : 'Sloučit všechny jisté shody'}
            </button>
          </div>
          <details>
            <summary className="small">Zobrazit skupiny</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              {certain.slice(0, 200).map((g) => (
                <Group key={keyOf(g.ids)} group={g} members={members(g)} onMerge={() => mergeGroups([members(g)])} onDismiss={() => dismiss(g)} />
              ))}
              {certain.length > 200 ? <p className="small muted">Zobrazeno prvních 200 skupin.</p> : null}
            </div>
          </details>
        </section>
      ) : null}

      {probable.length > 0 ? (
        <section className="card">
          <h3 style={{ marginBottom: 2 }}>Pravděpodobné shody ({probable.length})</h3>
          <p className="small muted">Názvy se liší jen málo, nebo se shodují, ale záznamy mají různé DOI. Rozhodněte u každé dvojice. Pozor na konferenční abstrakt a pozdější článek, opravy a preprinty.</p>
          <div className="stack">
            {probable.slice(0, 100).map((g) => (
              <Group key={keyOf(g.ids)} group={g} members={members(g)} onMerge={() => mergeGroups([members(g)])} onDismiss={() => dismiss(g)} />
            ))}
            {probable.length > 100 ? <p className="small muted">Zobrazeno prvních 100 dvojic; další se objeví po vyřešení těchto.</p> : null}
          </div>
        </section>
      ) : null}

      {merged.length > 0 ? (
        <section className="card">
          <details>
            <summary>Odstraněné duplicity ({merged.length})</summary>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Odstraněný záznam</th>
                    <th>Zdroj</th>
                    <th>Ponechán záznam ze zdroje</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {merged.slice(0, 300).map((r) => (
                    <tr key={r.id}>
                      <td>{r.title}</td>
                      <td>{r.source}</td>
                      <td>{byId.get(r.duplicateOf!)?.source ?? '–'}</td>
                      <td>
                        <button type="button" className="btn small ghost" onClick={() => db.records.update(r.id, { duplicateOf: null })}>
                          Vrátit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function Group({ group, members, onMerge, onDismiss }: { group: DupGroup; members: RecordItem[]; onMerge: () => void; onDismiss: () => void }) {
  const keep = pickPrimary(members);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className={`pill ${group.certain ? 'good' : 'warn'}`}>
          {REASONS[group.reason]}
          {group.certain ? '' : ` · shoda ${Math.round(group.score * 100)} %`}
        </span>
        <span className="small muted">{plural(members.length, 'záznam', 'záznamy', 'záznamů')}</span>
        <span className="grow" />
        <button type="button" className="btn small" onClick={onMerge}>
          Sloučit
        </button>
        <button type="button" className="btn small ghost" onClick={onDismiss}>
          Nejsou duplicity
        </button>
      </div>
      {members.map((r) => (
        <div key={r.id} style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
          <div>
            {r.title} {r.id === keep.id ? <span className="pill accent">ponechá se</span> : null}
          </div>
          <div className="small muted">
            {[authorsShort(r, 3), sourceLine(r), r.doi ? `DOI ${r.doi}` : '', r.source].filter(Boolean).join(' · ')}
          </div>
        </div>
      ))}
    </div>
  );
}
