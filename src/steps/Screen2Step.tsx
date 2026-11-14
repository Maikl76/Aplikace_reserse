import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { attachFile, castVote2, db, patchRecord } from '../lib/db';
import { fulltextQueue } from '../lib/flow';
import { isDouble, reasonMismatch, reviewerName, stage2Stats, state2, vote2Of } from '../lib/reviewers';
import type { Fulltext, RecordItem, Screen2 } from '../lib/types';
import { lines } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Field, Notice, Seg, Stat, TextArea, TextInput } from '../ui';
import { RecordHead, RecordLinks } from './common';
import { ConflictCard, ReviewerBar, useReviewer, type ReviewView } from './reviewerUi';

type Filter = 'pending' | 'include' | 'exclude' | 'notRetrieved' | 'all';
const FILTER_LABELS: Record<Filter, string> = { pending: 'Čeká', include: 'Zařazeno', exclude: 'Vyřazeno', notRetrieved: 'Nezískáno', all: 'Vše' };

const DECISION_LABELS: Record<Screen2, string> = { pending: 'čeká', include: 'zařadit', exclude: 'vyřadit' };

export default function Screen2Step({ project, records }: StepProps) {
  const queue = useMemo(() => fulltextQueue(records), [records]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ReviewView>('screen');
  const files = useLiveQuery(() => db.files.where('projectId').equals(project.id).toArray(), [project.id]) ?? [];
  // Při dvou hodnotitelích pracuje každý se svým rozhodnutím; výsledné vzniká až shodou.
  const double = isDouble(project);
  const { me, setMe, fixed } = useReviewer(project);
  const mine = (r: RecordItem): { decision: Screen2; reason: string } => (double ? vote2Of(r, me) : { decision: r.screen2, reason: r.excludeReason });
  const stateOf = (r: RecordItem): Exclude<Filter, 'all'> => (r.fulltext === 'notRetrieved' ? 'notRetrieved' : mine(r).decision);
  const setDecision = (r: RecordItem, decision: Screen2) => {
    const next = mine(r).decision === decision ? 'pending' : decision;
    if (double) return castVote2(project, r.id, me, { decision: next, reason: next === 'exclude' ? mine(r).reason : '' });
    return patchRecord(r.id, { screen2: next, fulltext: 'retrieved', ...(decision === 'include' ? { excludeReason: '' } : {}) });
  };
  const setReason = (r: RecordItem, reason: string) => (double ? castVote2(project, r.id, me, { decision: 'exclude', reason }) : patchRecord(r.id, { excludeReason: reason }));
  const conflictView = double && !fixed && view === 'conflicts';

  const list = queue.filter((r) => filter === 'all' || stateOf(r) === filter);
  const current = list.find((r) => r.id === selected) ?? list[0] ?? null;
  const count = (f: Exclude<Filter, 'all'>) => queue.filter((r) => stateOf(r) === f).length;
  const reasons = lines(project.protocol.excludeReasons);
  const pending1 = records.filter((r) => !r.duplicateOf && r.screen1 === 'pending').length;

  if (queue.length === 0) return <Empty title="Zatím žádné záznamy k posouzení">Sem se dostanou záznamy, které jste při třídění podle abstraktu označili „Zařadit“ nebo „Možná“.</Empty>;

  const file = current ? files.find((f) => f.recordId === current.id) : undefined;
  const my = current ? mine(current) : { decision: 'pending' as Screen2, reason: '' };
  const openFile = () => {
    if (!file) return;
    const url = URL.createObjectURL(file.blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="stack">
      {pending1 > 0 ? <Notice kind="warn">Třídění podle abstraktu ještě není dokončené – {pending1} záznamů čeká na rozhodnutí{double ? ' (nebo na vyřešení neshody)' : ''}.</Notice> : null}
      {double ? <ReviewerBar project={project} stats={stage2Stats(queue, project.team)} me={me} setMe={setMe} fixed={fixed} view={view} setView={setView} stageLabel="posouzení plných textů" /> : null}
      {conflictView ? <Conflicts2 project={project} queue={queue} reasons={reasons} /> : null}
      {conflictView ? null : (
      <>
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
          <Notice kind="good">
            {double
              ? fixed
                ? 'Všechny plné texty máte posouzené. Stáhněte svá rozhodnutí tlačítkem nahoře a pošlete je zpět.'
                : `${reviewerName(project.team, me)} má všechny plné texty posouzené. Až dokončí i druhý hodnotitel, vyřešte neshody.`
              : 'Všechny plné texty jsou posouzeny. Pokračujte extrakcí dat.'}
          </Notice>
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
                      <button type="button" className={`btn ${my.decision === 'include' ? 'on-include' : ''}`} aria-pressed={my.decision === 'include'} onClick={() => setDecision(current, 'include')}>
                        Zařadit do přehledu
                      </button>
                      <button type="button" className={`btn ${my.decision === 'exclude' ? 'on-exclude' : ''}`} aria-pressed={my.decision === 'exclude'} onClick={() => setDecision(current, 'exclude')}>
                        Vyřadit
                      </button>
                    </div>
                  </div>
                ) : null}

                {my.decision === 'exclude' && current.fulltext !== 'notRetrieved' ? (
                  <div className="grid2">
                    <Field label="Důvod vyřazení" hint="Zvolte první nesplněné kritérium v pořadí z protokolu.">
                      <select value={reasons.includes(my.reason) ? my.reason : my.reason ? '__other' : ''} onChange={(e) => setReason(current, e.target.value === '__other' ? 'Jiný důvod' : e.target.value)}>
                        <option value="">– vyberte –</option>
                        {reasons.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                        <option value="__other">Jiný důvod…</option>
                      </select>
                    </Field>
                    {my.reason && !reasons.includes(my.reason) ? (
                      <Field label="Jiný důvod" hint="Stejné důvody pište vždy stejně, aby se v diagramu sečetly.">
                        <TextInput value={my.reason} onCommit={(reason) => setReason(current, reason)} />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
                {my.decision === 'exclude' && !my.reason ? <Notice kind="warn">U vyřazeného plného textu chybí důvod. PRISMA vyžaduje uvést ho u každého.</Notice> : null}

                <Field label="Poznámka">
                  <TextArea value={current.notes} rows={2} onCommit={(notes) => patchRecord(current.id, { notes })} />
                </Field>
              </div>
            </article>
          ) : null}
        </div>
      )}
      </>
      )}
    </div>
  );
}

/** Plné texty, u kterých se hodnotitelé rozešli v rozhodnutí nebo v důvodu vyřazení. */
function Conflicts2({ project, queue, reasons }: { project: StepProps['project']; queue: RecordItem[]; reasons: string[] }) {
  const team = project.team;
  const assessable = queue.filter((r) => r.fulltext !== 'notRetrieved');
  const conflicts = assessable.filter((r) => state2(r, team.reviewers) === 'conflict').sort((a, b) => Number(a.screen2 !== 'pending') - Number(b.screen2 !== 'pending'));
  const mismatched = assessable.filter((r) => reasonMismatch(r, team.reviewers));
  if (conflicts.length === 0 && mismatched.length === 0) {
    return <Empty title="Žádné neshody">Neshoda vznikne, když jeden hodnotitel plný text zařadí a druhý vyřadí, nebo když ho vyřadí každý z jiného důvodu.</Empty>;
  }
  const voteText = (r: RecordItem, id: string) => {
    const v = vote2Of(r, id);
    return v.decision === 'exclude' && v.reason ? `vyřadit – ${v.reason}` : DECISION_LABELS[v.decision];
  };
  const reasonSelect = (r: RecordItem) => (
    <select value={r.excludeReason} onChange={(e) => patchRecord(r.id, { excludeReason: e.target.value })} aria-label="Výsledný důvod vyřazení" style={{ width: 'auto', maxWidth: 360 }}>
      <option value="">– důvod vyřazení –</option>
      {[...new Set([...reasons, ...team.reviewers.map((x) => vote2Of(r, x.id).reason).filter(Boolean)])].map((x) => (
        <option key={x} value={x}>
          {x}
        </option>
      ))}
    </select>
  );
  return (
    <div className="stack">
      <Notice>Neshody řešte společně nad plným textem a kritérii z protokolu. Výsledný důvod vyřazení se objeví ve vývojovém diagramu.</Notice>
      {conflicts.map((r) => (
        <ConflictCard key={r.id} title={r.title} meta={[r.authors[0]?.family, r.year, r.journal].filter(Boolean).join(' · ')} resolved={r.screen2 !== 'pending'} votes={team.reviewers.map((x) => ({ name: reviewerName(team, x.id), text: voteText(r, x.id) }))}>
          <div className="decide">
            <span className="small" style={{ fontWeight: 600 }}>Výsledné rozhodnutí:</span>
            <button type="button" className={`btn small ${r.screen2 === 'include' ? 'on-include' : ''}`} aria-pressed={r.screen2 === 'include'} onClick={() => patchRecord(r.id, { screen2: r.screen2 === 'include' ? 'pending' : 'include', excludeReason: '' })}>
              Zařadit do přehledu
            </button>
            <button
              type="button"
              className={`btn small ${r.screen2 === 'exclude' ? 'on-exclude' : ''}`}
              aria-pressed={r.screen2 === 'exclude'}
              onClick={() => patchRecord(r.id, r.screen2 === 'exclude' ? { screen2: 'pending', excludeReason: '' } : { screen2: 'exclude', excludeReason: team.reviewers.map((x) => vote2Of(r, x.id).reason).find(Boolean) ?? '' })}
            >
              Vyřadit
            </button>
            {r.screen2 === 'exclude' ? reasonSelect(r) : null}
          </div>
        </ConflictCard>
      ))}
      {mismatched.map((r) => (
        <ConflictCard key={r.id} title={r.title} meta={[r.authors[0]?.family, r.year, r.journal].filter(Boolean).join(' · ')} resolved={false} votes={team.reviewers.map((x) => ({ name: reviewerName(team, x.id), text: voteText(r, x.id) }))}>
          <div className="decide">
            <span className="small" style={{ fontWeight: 600 }}>Oba vyřadili, liší se důvod. Výsledný důvod:</span>
            {reasonSelect(r)}
          </div>
        </ConflictCard>
      ))}
    </div>
  );
}
