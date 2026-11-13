import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { attachFile, db, patchRecord } from '../lib/db';
import { fulltextQueue } from '../lib/flow';
import type { Fulltext, RecordItem } from '../lib/types';
import { lines } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Field, Notice, Seg, Stat, TextArea, TextInput } from '../ui';
import { RecordHead, RecordLinks } from './common';

type Filter = 'pending' | 'include' | 'exclude' | 'notRetrieved' | 'all';
const FILTER_LABELS: Record<Filter, string> = { pending: 'Čeká', include: 'Zařazeno', exclude: 'Vyřazeno', notRetrieved: 'Nezískáno', all: 'Vše' };

const stateOf = (r: RecordItem): Exclude<Filter, 'all'> => (r.fulltext === 'notRetrieved' ? 'notRetrieved' : r.screen2);

export default function Screen2Step({ project, records }: StepProps) {
  const queue = useMemo(() => fulltextQueue(records), [records]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [selected, setSelected] = useState<string | null>(null);
  const files = useLiveQuery(() => db.files.where('projectId').equals(project.id).toArray(), [project.id]) ?? [];

  const list = queue.filter((r) => filter === 'all' || stateOf(r) === filter);
  const current = list.find((r) => r.id === selected) ?? list[0] ?? null;
  const count = (f: Exclude<Filter, 'all'>) => queue.filter((r) => stateOf(r) === f).length;
  const reasons = lines(project.protocol.excludeReasons);
  const pending1 = records.filter((r) => !r.duplicateOf && r.screen1 === 'pending').length;

  if (queue.length === 0) return <Empty title="Zatím žádné záznamy k posouzení">Sem se dostanou záznamy, které jste při třídění podle abstraktu označili „Zařadit“ nebo „Možná“.</Empty>;

  const file = current ? files.find((f) => f.recordId === current.id) : undefined;
  const openFile = () => {
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="stack">
      {pending1 > 0 ? <Notice kind="warn">Třídění podle abstraktu ještě není dokončené – {pending1} záznamů čeká na rozhodnutí.</Notice> : null}
      <div className="stats">
        <Stat label="K posouzení celkem" value={queue.length} />
        <Stat label="Čeká" value={count('pending')} />
        <Stat label="Zařazeno" value={count('include')} />
        <Stat label="Vyřazeno" value={count('exclude')} />
        <Stat label="Nezískáno" value={count('notRetrieved')} />
      </div>
      <div className="row" role="group" aria-label="Filtr">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            className={`btn small ${filter === f ? 'active' : ''}`}
            onClick={() => {
              setFilter(f);
              setSelected(null);
            }}
          >
            {FILTER_LABELS[f]} {f === 'all' ? queue.length : count(f)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        filter === 'pending' ? (
          <Notice kind="good">Všechny plné texty jsou posouzeny. Pokračujte extrakcí dat.</Notice>
        ) : (
          <Empty title="Žádný záznam v této skupině" />
        )
      ) : (
        <div className="split">
          <div className="list" role="listbox" aria-label="Plné texty">
            {list.map((r) => (
              <button key={r.id} type="button" role="option" aria-selected={r.id === current?.id} className={`list-item ${r.id === current?.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>
                <span className={`dot ${stateOf(r) === 'notRetrieved' ? 'maybe' : stateOf(r)}`} />
                <span>
                  {r.title || 'Bez názvu'}
                  <span className="meta">
                    {[r.authors[0]?.family, r.year].filter(Boolean).join(' · ')}
                    {r.screen1 === 'maybe' ? ' · při třídění „možná“' : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {current ? (
            <article className="card" key={current.id}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="small muted">{current.source}</span>
                <RecordLinks r={current} />
              </div>
              <RecordHead r={current} />
              {current.abstract ? (
                <details style={{ margin: '12px 0' }}>
                  <summary className="small">Abstrakt</summary>
                  <p className="abstract" style={{ marginTop: 6 }}>
                    {current.abstract}
                  </p>
                </details>
              ) : null}

              <div className="stack" style={{ marginTop: 14 }}>
                <div>
                  <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                    Plný text
                  </div>
                  <div className="row">
                    <Seg<Fulltext>
                      ariaLabel="Stav plného textu"
                      value={current.fulltext}
                      options={[
                        { id: 'pending', label: 'Sháním' },
                        { id: 'retrieved', label: 'Získán' },
                        { id: 'notRetrieved', label: 'Nezískán' },
                      ]}
                      onChange={(fulltext) => patchRecord(current.id, { fulltext })}
                    />
                    {file ? (
                      <>
                        <button type="button" className="btn small" onClick={openFile}>
                          Otevřít {file.name.slice(0, 28)}
                        </button>
                        <button type="button" className="btn small ghost" onClick={() => db.files.delete(file.id)}>
                          Odebrat soubor
                        </button>
                      </>
                    ) : (
                      <label className="btn small">
                        Přiložit PDF
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          hidden
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            await attachFile(project.id, current.id, f);
                            if (current.fulltext === 'pending') await patchRecord(current.id, { fulltext: 'retrieved' });
                          }}
                        />
                      </label>
                    )}
                  </div>
                  {current.fulltext === 'notRetrieved' ? <p className="small muted" style={{ marginTop: 6 }}>Nezískané texty se v diagramu uvádějí zvlášť a o zařazení se u nich nerozhoduje.</p> : null}
                </div>

                {current.fulltext !== 'notRetrieved' ? (
                  <div>
                    <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                      Rozhodnutí podle plného textu
                    </div>
                    <div className="decide">
                      <button
                        type="button"
                        className={`btn ${current.screen2 === 'include' ? 'on-include' : ''}`}
                        aria-pressed={current.screen2 === 'include'}
                        onClick={() => patchRecord(current.id, { screen2: current.screen2 === 'include' ? 'pending' : 'include', fulltext: 'retrieved', excludeReason: '' })}
                      >
                        Zařadit do přehledu
                      </button>
                      <button
                        type="button"
                        className={`btn ${current.screen2 === 'exclude' ? 'on-exclude' : ''}`}
                        aria-pressed={current.screen2 === 'exclude'}
                        onClick={() => patchRecord(current.id, { screen2: current.screen2 === 'exclude' ? 'pending' : 'exclude', fulltext: 'retrieved' })}
                      >
                        Vyřadit
                      </button>
                    </div>
                  </div>
                ) : null}

                {current.screen2 === 'exclude' && current.fulltext !== 'notRetrieved' ? (
                  <div className="grid2">
                    <Field label="Důvod vyřazení" hint="Zvolte první nesplněné kritérium v pořadí z protokolu.">
                      <select value={reasons.includes(current.excludeReason) ? current.excludeReason : current.excludeReason ? '__other' : ''} onChange={(e) => patchRecord(current.id, { excludeReason: e.target.value === '__other' ? 'Jiný důvod' : e.target.value })}>
                        <option value="">– vyberte –</option>
                        {reasons.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        <option value="__other">Jiný důvod…</option>
                      </select>
                    </Field>
                    {current.excludeReason && !reasons.includes(current.excludeReason) ? (
                      <Field label="Jiný důvod" hint="Stejné důvody pište vždy stejně, aby se v diagramu sečetly.">
                        <TextInput value={current.excludeReason} onCommit={(excludeReason) => patchRecord(current.id, { excludeReason })} />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
                {current.screen2 === 'exclude' && !current.excludeReason ? <Notice kind="warn">U vyřazeného plného textu chybí důvod. PRISMA vyžaduje uvést ho u každého.</Notice> : null}

                <Field label="Poznámka">
                  <TextArea value={current.notes} rows={2} onCommit={(notes) => patchRecord(current.id, { notes })} />
                </Field>
              </div>
            </article>
          ) : null}
        </div>
      )}
    </div>
  );
}
