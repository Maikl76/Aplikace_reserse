import { useEffect, useMemo, useState } from 'react';
import { castVote1, mergeProject, patchRecord } from '../lib/db';
import { hasStep } from '../lib/reviewTypes';
import { isDouble, reviewerName, stage1Stats, state1, vote1Of } from '../lib/reviewers';
import type { RecordItem, Screen1 } from '../lib/types';
import { normTitle, stripDiacritics } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Field, Notice, TextArea, TextInput } from '../ui';
import { Highlighted, RecordHead, RecordLinks } from './common';
import { ConflictCard, ReviewerBar, useReviewer, type ReviewView } from './reviewerUi';

const LABELS1: Record<Screen1, string> = { pending: 'čeká', include: 'zařadit', maybe: 'možná', exclude: 'vyřadit' };

type Filter = Screen1 | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Čeká' },
  { id: 'include', label: 'Zařazeno' },
  { id: 'maybe', label: 'Možná' },
  { id: 'exclude', label: 'Vyřazeno' },
  { id: 'all', label: 'Vše' },
];
const PAGE = 100;

export default function Screen1Step({ project, records }: StepProps) {
  const twoStage = hasStep(project.type, 'screen2');
  const active = useMemo(() => records.filter((r) => !r.duplicateOf), [records]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'random' | 'title' | 'year'>('random');
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ReviewView>('screen');
  // Při dvou hodnotitelích pracuje každý se svými rozhodnutími; výsledné vzniká až shodou.
  const double = isDouble(project);
  const { me, setMe, fixed } = useReviewer(project);
  const mine = (r: RecordItem): Screen1 => (double ? vote1Of(r, me) : r.screen1);

  const list = useMemo(() => {
    const q = stripDiacritics(query.trim().toLowerCase());
    const own = (r: RecordItem): Screen1 => (double ? vote1Of(r, me) : r.screen1);
    let out = active.filter((r) => (filter === 'all' || own(r) === filter) && (!q || stripDiacritics(`${r.title} ${r.abstract} ${r.authors.map((a) => a.family).join(' ')}`.toLowerCase()).includes(q)));
    if (sort === 'title') out = [...out].sort((a, b) => normTitle(a.title).localeCompare(normTitle(b.title)));
    if (sort === 'year') out = [...out].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return out;
  }, [active, filter, query, sort, double, me]);

  const current = list.find((r) => r.id === selected) ?? list[0] ?? null;
  const index = current ? list.indexOf(current) : -1;
  const counts = (s: Screen1) => active.filter((r) => mine(r) === s).length;
  const decided = active.length - counts('pending');
  const conflictView = double && !fixed && view === 'conflicts';

  const go = (delta: number) => {
    const next = list[index + delta];
    if (next) setSelected(next.id);
  };
  const decide = async (r: RecordItem, value: Screen1) => {
    // Po rozhodnutí přejdeme na další záznam v seznamu (rozhodnutý může ze seznamu zmizet).
    const next = list[index + 1] ?? list[index - 1] ?? null;
    const before = mine(r);
    const after = before === value ? 'pending' : value;
    if (double) await castVote1(project, r.id, me, after);
    else await patchRecord(r.id, { screen1: after });
    if (before !== value) setSelected(next?.id ?? null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || !current || conflictView) return;
      const key = e.key.toLowerCase();
      if (key === 'z') decide(current, 'include');
      else if (key === 'm' && twoStage) decide(current, 'maybe');
      else if (key === 'v') decide(current, 'exclude');
      else if (key === 'j' || e.key === 'ArrowDown') go(1);
      else if (key === 'k' || e.key === 'ArrowUp') go(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (active.length === 0) return <Empty title="Zatím nejsou žádné záznamy k třídění">Nejprve stáhněte nebo nahrajte výsledky v kroku Vyhledávání.</Empty>;

  const p = project.protocol;
  const mineState = current ? mine(current) : 'pending';
  return (
    <div className="stack">
      {double ? <ReviewerBar project={project} stats={stage1Stats(records, project.team)} me={me} setMe={setMe} fixed={fixed} view={view} setView={setView} stageLabel="třídění podle abstraktu" /> : null}
      {conflictView ? <Conflicts1 project={project} records={active} twoStage={twoStage} /> : null}
      {conflictView ? null : (
      <>
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <span>
            {double ? `${reviewerName(project.team, me)}: posouzeno ` : 'Posouzeno '}
            <strong>{decided}</strong> z {active.length} záznamů
          </span>
          <span className="small muted">
            zařazeno {counts('include')}
            {twoStage ? ` · možná ${counts('maybe')}` : ''} · vyřazeno {counts('exclude')}
          </span>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={decided} aria-valuemin={0} aria-valuemax={active.length}>
          <i style={{ width: `${(100 * decided) / active.length}%` }} />
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="small">Kritéria a zvýrazňovaná slova</summary>
          <div className="grid2" style={{ marginTop: 10 }}>
            <div className="small">
              <h4 style={{ marginBottom: 4 }}>Kritéria zařazení</h4>
              <div style={{ whiteSpace: 'pre-wrap' }}>{p.include.trim() || 'Nejsou vyplněna – doplňte je v kroku Protokol.'}</div>
              <h4 style={{ margin: '10px 0 4px' }}>Kritéria vyřazení</h4>
              <div style={{ whiteSpace: 'pre-wrap' }}>{p.exclude.trim() || '–'}</div>
            </div>
            <div className="stack">
              <Field label="Zvýraznit zeleně" hint="Slova oddělená čárkou; hvězdička nahrazuje koncovku.">
                <TextInput value={p.highlightInclude} placeholder="adolescen*, random*, exercise" onCommit={(highlightInclude) => mergeProject(project.id, 'protocol', { highlightInclude })} />
              </Field>
              <Field label="Zvýraznit červeně" hint="Slova, která obvykle znamenají vyřazení.">
                <TextInput value={p.highlightExclude} placeholder="protocol, animal*, elderly" onCommit={(highlightExclude) => mergeProject(project.id, 'protocol', { highlightExclude })} />
              </Field>
            </div>
          </div>
        </details>
      </div>

      <div className="row">
        <div className="row" role="group" aria-label="Filtr záznamů">
          {FILTERS.filter((f) => twoStage || f.id !== 'maybe').map((f) => (
            <button
              key={f.id}
              type="button"
              className={`btn small ${filter === f.id ? 'active' : ''}`}
              onClick={() => {
                setFilter(f.id);
                setSelected(null);
                setPage(1);
              }}
            >
              {f.label} {f.id === 'all' ? active.length : counts(f.id)}
            </button>
          ))}
        </div>
        <span className="grow" />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Pořadí záznamů" style={{ width: 'auto' }}>
          <option value="random">Pořadí: náhodné</option>
          <option value="title">Pořadí: podle názvu</option>
          <option value="year">Pořadí: od nejnovějších</option>
        </select>
        <input type="search" placeholder="Hledat v záznamech…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 220 }} aria-label="Hledat v záznamech" />
      </div>

      {list.length === 0 ? (
        filter === 'pending' && !query ? (
          <Notice kind="good">
            {double
              ? fixed
                ? 'Všechny záznamy máte posouzené. Stáhněte svá rozhodnutí tlačítkem nahoře a pošlete je zpět.'
                : `${reviewerName(project.team, me)} má všechny záznamy posouzené. Až dokončí i druhý hodnotitel, vyřešte na záložce Neshody rozdílná rozhodnutí.`
              : `Všechny záznamy jsou posouzeny. ${twoStage ? 'Pokračujte posouzením plných textů.' : 'Pokračujte extrakcí dat.'}`}
          </Notice>
        ) : (
          <Empty title="Žádný záznam neodpovídá filtru" />
        )
      ) : (
        <div className="split">
          <div>
            <div className="list" role="listbox" aria-label="Záznamy">
              {list.slice(0, page * PAGE).map((r) => (
                <button key={r.id} type="button" role="option" aria-selected={r.id === current?.id} className={`list-item ${r.id === current?.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>
                  <span className={`dot ${mine(r)}`} />
                  <span>
                    {r.title || 'Bez názvu'}
                    <span className="meta">{[r.authors[0]?.family, r.year, r.source].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ))}
            </div>
            {list.length > page * PAGE ? (
              <button type="button" className="btn small" style={{ marginTop: 8 }} onClick={() => setPage(page + 1)}>
                Zobrazit dalších {Math.min(PAGE, list.length - page * PAGE)}
              </button>
            ) : null}
          </div>

          {current ? (
            <article className="card" key={current.id}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="small muted">
                  Záznam {index + 1} z {list.length} · {current.source}
                  {current.pubType ? ` · ${current.pubType.split(';')[0]}` : ''}
                </span>
                <RecordLinks r={current} />
              </div>
              <RecordHead r={current} />
              <div className="abstract" style={{ margin: '14px 0' }}>
                {current.abstract ? <Highlighted text={current.abstract} include={p.highlightInclude} exclude={p.highlightExclude} /> : <span className="muted">Záznam nemá abstrakt. Při pochybnosti ho ponechte k posouzení plného textu.</span>}
              </div>
              {current.keywords.length ? <div className="small muted">Klíčová slova: {current.keywords.join(', ')}</div> : null}
              <div className="decide" style={{ margin: '16px 0 12px' }}>
                <button type="button" className={`btn ${mineState === 'include' ? 'on-include' : ''}`} aria-pressed={mineState === 'include'} onClick={() => decide(current, 'include')}>
                  Zařadit <kbd>Z</kbd>
                </button>
                {twoStage ? (
                  <button type="button" className={`btn ${mineState === 'maybe' ? 'on-maybe' : ''}`} aria-pressed={mineState === 'maybe'} onClick={() => decide(current, 'maybe')}>
                    Možná <kbd>M</kbd>
                  </button>
                ) : null}
                <button type="button" className={`btn ${mineState === 'exclude' ? 'on-exclude' : ''}`} aria-pressed={mineState === 'exclude'} onClick={() => decide(current, 'exclude')}>
                  Vyřadit <kbd>V</kbd>
                </button>
                <span className="grow" />
                <button type="button" className="btn ghost" onClick={() => go(-1)} disabled={index <= 0}>
                  ↑ Předchozí
                </button>
                <button type="button" className="btn ghost" onClick={() => go(1)} disabled={index >= list.length - 1}>
                  ↓ Další
                </button>
              </div>
              <Field label="Poznámka k záznamu">
                <TextArea value={current.notes} rows={2} onCommit={(notes) => patchRecord(current.id, { notes })} />
              </Field>
            </article>
          ) : null}
        </div>
      )}
      </>
      )}
    </div>
  );
}

/** Záznamy, u kterých se hodnotitelé rozešli, s volbou výsledného rozhodnutí. */
function Conflicts1({ project, records, twoStage }: { project: StepProps['project']; records: RecordItem[]; twoStage: boolean }) {
  const team = project.team;
  const conflicts = records.filter((r) => state1(r, team.reviewers) === 'conflict').sort((a, b) => Number(a.screen1 !== 'pending') - Number(b.screen1 !== 'pending'));
  if (conflicts.length === 0) {
    return <Empty title="Žádné neshody">Neshoda vznikne, když jeden hodnotitel záznam zařadí (nebo označí „možná“) a druhý ho vyřadí. Zobrazí se tu, jakmile záznam posoudí oba.</Empty>;
  }
  const options: { id: Screen1; label: string; cls: string }[] = [
    { id: 'include', label: 'Zařadit', cls: 'on-include' },
    ...(twoStage ? [{ id: 'maybe' as Screen1, label: 'Možná', cls: 'on-maybe' }] : []),
    { id: 'exclude', label: 'Vyřadit', cls: 'on-exclude' },
  ];
  return (
    <div className="stack">
      <Notice>Neshody řešte společně: přečtěte abstrakt, vraťte se ke kritériím a dohodněte se. Při pochybnosti záznam ponechte k posouzení plného textu.</Notice>
      {conflicts.map((r) => (
        <ConflictCard
          key={r.id}
          title={r.title}
          meta={[r.authors[0]?.family, r.year, r.journal].filter(Boolean).join(' · ')}
          abstract={r.abstract}
          resolved={r.screen1 !== 'pending'}
          votes={team.reviewers.map((x) => ({ name: reviewerName(team, x.id), text: LABELS1[vote1Of(r, x.id)] }))}
        >
          <div className="decide">
            <span className="small" style={{ fontWeight: 600 }}>Výsledné rozhodnutí:</span>
            {options.map((o) => (
              <button key={o.id} type="button" className={`btn small ${r.screen1 === o.id ? o.cls : ''}`} aria-pressed={r.screen1 === o.id} onClick={() => patchRecord(r.id, { screen1: r.screen1 === o.id ? 'pending' : o.id })}>
                {o.label}
              </button>
            ))}
          </div>
        </ConflictCard>
      ))}
    </div>
  );
}
