import { useEffect, useMemo, useState } from 'react';
import { mergeProject, patchRecord } from '../lib/db';
import { hasStep } from '../lib/reviewTypes';
import type { RecordItem, Screen1 } from '../lib/types';
import { normTitle, stripDiacritics } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Field, Notice, TextArea, TextInput } from '../ui';
import { Highlighted, RecordHead, RecordLinks } from './common';

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

  const list = useMemo(() => {
    const q = stripDiacritics(query.trim().toLowerCase());
    let out = active.filter((r) => (filter === 'all' || r.screen1 === filter) && (!q || stripDiacritics(`${r.title} ${r.abstract} ${r.authors.map((a) => a.family).join(' ')}`.toLowerCase()).includes(q)));
    if (sort === 'title') out = [...out].sort((a, b) => normTitle(a.title).localeCompare(normTitle(b.title)));
    if (sort === 'year') out = [...out].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return out;
  }, [active, filter, query, sort]);

  const current = list.find((r) => r.id === selected) ?? list[0] ?? null;
  const index = current ? list.indexOf(current) : -1;
  const counts = (s: Screen1) => active.filter((r) => r.screen1 === s).length;
  const decided = active.length - counts('pending');

  const go = (delta: number) => {
    const next = list[index + delta];
    if (next) setSelected(next.id);
  };
  const decide = async (r: RecordItem, value: Screen1) => {
    // Po rozhodnutí přejdeme na další záznam v seznamu (rozhodnutý může ze seznamu zmizet).
    const next = list[index + 1] ?? list[index - 1] ?? null;
    await patchRecord(r.id, { screen1: r.screen1 === value ? 'pending' : value });
    if (r.screen1 !== value) setSelected(next?.id ?? null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey || !current) return;
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
  return (
    <div className="stack">
      <div className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <span>
            Posouzeno <strong>{decided}</strong> z {active.length} záznamů
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
          <Notice kind="good">Všechny záznamy jsou posouzeny. {twoStage ? 'Pokračujte posouzením plných textů.' : 'Pokračujte extrakcí dat.'}</Notice>
        ) : (
          <Empty title="Žádný záznam neodpovídá filtru" />
        )
      ) : (
        <div className="split">
          <div>
            <div className="list" role="listbox" aria-label="Záznamy">
              {list.slice(0, page * PAGE).map((r) => (
                <button key={r.id} type="button" role="option" aria-selected={r.id === current?.id} className={`list-item ${r.id === current?.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>
                  <span className={`dot ${r.screen1}`} />
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
                <button type="button" className={`btn ${current.screen1 === 'include' ? 'on-include' : ''}`} aria-pressed={current.screen1 === 'include'} onClick={() => decide(current, 'include')}>
                  Zařadit <kbd>Z</kbd>
                </button>
                {twoStage ? (
                  <button type="button" className={`btn ${current.screen1 === 'maybe' ? 'on-maybe' : ''}`} aria-pressed={current.screen1 === 'maybe'} onClick={() => decide(current, 'maybe')}>
                    Možná <kbd>M</kbd>
                  </button>
                ) : null}
                <button type="button" className={`btn ${current.screen1 === 'exclude' ? 'on-exclude' : ''}`} aria-pressed={current.screen1 === 'exclude'} onClick={() => decide(current, 'exclude')}>
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
    </div>
  );
}
