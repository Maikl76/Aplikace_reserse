import { useMemo, useState } from 'react';
import { studyLabels } from '../lib/analysis';
import { mergeEffect, mergeRecord, patchProject, patchRecord } from '../lib/db';
import { includedRecords } from '../lib/flow';
import { unitOf } from '../lib/manuscript/build';
import { REVIEW_TYPES } from '../lib/reviewTypes';
import { MEASURES, backTransform, computeEffect } from '../lib/stats/effects';
import type { FieldDef, Measure, OutcomeDef, RecordItem } from '../lib/types';
import { download, fmt, slug, uid } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Field, Notice, TextArea, TextInput } from '../ui';
import { RecordLinks } from './common';

const KIND_LABELS: Record<FieldDef['kind'], string> = { text: 'text', number: 'číslo', category: 'kategorie' };
const Z = 1.959963984540054;

export default function ExtractStep({ project, records }: StepProps) {
  const included = useMemo(() => includedRecords(records, project.type), [records, project.type]);
  const labels = useMemo(() => studyLabels(included), [included]);
  const ordered = useMemo(() => [...included].sort((a, b) => (labels.get(a.id) ?? '').localeCompare(labels.get(b.id) ?? '', 'cs')), [included, labels]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'form' | 'table'>('form');
  const withMeta = REVIEW_TYPES[project.type].synthesis.includes('meta');
  const umbrella = project.type === 'umbrella';
  const unit = unitOf(project);
  const current = ordered.find((r) => r.id === selected) ?? ordered[0] ?? null;

  const filled = (r: RecordItem) => project.fields.filter((f) => (r.extraction[f.id] ?? '').trim()).length;

  const csv = () => {
    const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [['Studie', 'Název', ...project.fields.map((f) => f.label)], ...ordered.map((r) => [labels.get(r.id) ?? '', r.title, ...project.fields.map((f) => r.extraction[f.id] ?? '')])];
    download(`${slug(project.title)}-extrakce.csv`, '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  };

  return (
    <div className="stack">
      <FormEditor project={project} withMeta={withMeta} />

      {ordered.length === 0 ? (
        <Empty title={`Zatím nejsou zařazeny žádné ${unit}`}>Formulář si můžete připravit předem. Údaje půjde vyplňovat, jakmile při třídění zařadíte první {unit === 'studie' ? 'studii' : unit === 'přehledy' ? 'přehled' : 'zdroj'}.</Empty>
      ) : (
        <>
          <div className="row">
            <div className="row" role="group" aria-label="Zobrazení">
              <button type="button" className={`btn small ${view === 'form' ? 'active' : ''}`} onClick={() => setView('form')}>
                Vyplňování
              </button>
              <button type="button" className={`btn small ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>
                Souhrnná tabulka
              </button>
            </div>
            <span className="grow" />
            <button type="button" className="btn small" onClick={csv}>
              Stáhnout tabulku (CSV)
            </button>
          </div>

          {view === 'table' ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Studie</th>
                    {project.fields.map((f) => (
                      <th key={f.id}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((r) => (
                    <tr key={r.id}>
                      <td className="nowrap">
                        <button type="button" className="btn small ghost" style={{ padding: 0 }} onClick={() => { setSelected(r.id); setView('form'); }}>
                          {labels.get(r.id)}
                        </button>
                      </td>
                      {project.fields.map((f) => (
                        <td key={f.id} className={f.kind === 'number' ? 'num' : ''}>
                          {r.extraction[f.id]?.trim() || <span className="muted">–</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="split">
              <div className="list" role="listbox" aria-label="Zařazené studie">
                {ordered.map((r) => (
                  <button key={r.id} type="button" role="option" aria-selected={r.id === current?.id} className={`list-item ${r.id === current?.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>
                    <span className={`dot ${filled(r) === project.fields.length && project.fields.length > 0 ? 'include' : filled(r) > 0 ? 'maybe' : ''}`} />
                    <span>
                      {labels.get(r.id)}
                      <span className="meta">
                        vyplněno {filled(r)} z {project.fields.length} polí
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {current ? (
                <article className="card" key={current.id}>
                  <div className="row between" style={{ marginBottom: 6 }}>
                    <h3 style={{ margin: 0 }}>{labels.get(current.id)}</h3>
                    <RecordLinks r={current} />
                  </div>
                  <p className="small muted">{current.title}</p>
                  <div className="stack">
                    {project.fields.map((f) => (
                      <Field key={f.id} label={f.label} hint={f.hint || undefined}>
                        {f.kind === 'text' ? (
                          <TextArea value={current.extraction[f.id] ?? ''} rows={2} onCommit={(v) => mergeRecord(current.id, 'extraction', { [f.id]: v })} />
                        ) : (
                          <>
                            <TextInput value={current.extraction[f.id] ?? ''} list={f.kind === 'category' ? `values-${f.id}` : undefined} inputMode={f.kind === 'number' ? 'decimal' : undefined} onCommit={(v) => mergeRecord(current.id, 'extraction', { [f.id]: v })} style={{ maxWidth: 420 }} />
                            {f.kind === 'category' ? (
                              <datalist id={`values-${f.id}`}>
                                {[...new Set(ordered.flatMap((r) => (r.extraction[f.id] ?? '').split(';').map((x) => x.trim())).filter(Boolean))].map((v) => (
                                  <option key={v} value={v} />
                                ))}
                              </datalist>
                            ) : null}
                          </>
                        )}
                      </Field>
                    ))}

                    {withMeta && project.outcomes.length > 0 ? (
                      <div>
                        <h4 style={{ margin: '6px 0 8px' }}>Data pro metaanalýzu</h4>
                        <div className="stack">
                          {project.outcomes.map((o) => (
                            <EffectForm key={o.id} record={current} outcome={o} />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {umbrella ? (
                      <Field label="Primární studie zahrnuté v tomto přehledu" hint="Jedna na řádek ve tvaru „První autor rok“, např. „Novák 2019“. Stejnou studii pište ve všech přehledech stejně – z těchto seznamů se počítá překryv.">
                        <TextArea value={current.primaryStudies} rows={6} mono onCommit={(primaryStudies) => patchRecord(current.id, { primaryStudies })} />
                      </Field>
                    ) : null}

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

/** Zadání čísel jednoho výstupu s okamžitým výpočtem velikosti účinku. */
function EffectForm({ record, outcome }: { record: RecordItem; outcome: OutcomeDef }) {
  const m = MEASURES[outcome.measure];
  const raw = record.effects[outcome.id] ?? {};
  const res = computeEffect(outcome.measure, raw);
  const sh = (v: number) => fmt(backTransform(outcome.measure, v), 2);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <strong>{outcome.name || 'Výstup bez názvu'}</strong>
        <span className="pill">{m.short}</span>
      </div>
      <div className="grid3">
        {m.inputs.map((inp) => (
          <Field key={inp.id} label={inp.label}>
            <TextInput value={raw[inp.id] ?? ''} inputMode="decimal" onCommit={(v) => mergeEffect(record.id, outcome.id, { [inp.id]: v })} />
          </Field>
        ))}
      </div>
      <div className="small" style={{ marginTop: 8 }}>
        {res.ok ? (
          <span>
            Spočtený efekt: <strong>{m.short} = {sh(res.effect.yi)}</strong> (95% CI {sh(res.effect.yi - Z * Math.sqrt(res.effect.vi))} až {sh(res.effect.yi + Z * Math.sqrt(res.effect.vi))}){res.effect.note ? ` · ${res.effect.note}` : ''}
          </span>
        ) : (
          <span className="muted">{res.error}</span>
        )}
      </div>
    </div>
  );
}

/** Úprava polí formuláře a výstupů metaanalýzy. */
function FormEditor({ project, withMeta }: { project: StepProps['project']; withMeta: boolean }) {
  const fields = project.fields;
  const saveFields = (next: FieldDef[]) => patchProject(project.id, { fields: next });
  const outcomes = project.outcomes;
  const saveOutcomes = (next: OutcomeDef[]) => patchProject(project.id, { outcomes: next });
  const move = (i: number, d: number) => {
    const next = [...fields];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    saveFields(next);
  };

  return (
    <section className="card">
      <details open={fields.length === 0 || (withMeta && outcomes.length === 0)}>
        <summary>Formulář pro extrakci ({fields.length} polí{withMeta ? `, výstupů pro metaanalýzu: ${outcomes.length}` : ''})</summary>
        <p className="small muted" style={{ marginTop: 8 }}>
          Formulář upravte dřív, než začnete vyplňovat. Typ „kategorie“ použijte pro krátké hodnoty, které se budou sčítat nebo sloužit jako podskupiny (design, země). Více hodnot v jedné buňce oddělte středníkem.
        </p>
        <div className="stack">
          {fields.map((f, i) => (
            <div key={f.id} className="row top">
              <span className="grow" style={{ flexBasis: 200 }}>
                <TextInput value={f.label} ariaLabel="Název pole" placeholder="Název pole" onCommit={(label) => saveFields(fields.map((x) => (x.id === f.id ? { ...x, label } : x)))} />
              </span>
              <select value={f.kind} aria-label="Typ pole" style={{ width: 130 }} onChange={(e) => saveFields(fields.map((x) => (x.id === f.id ? { ...x, kind: e.target.value as FieldDef['kind'] } : x)))}>
                {(Object.keys(KIND_LABELS) as FieldDef['kind'][]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <span className="grow" style={{ flexBasis: 240 }}>
                <TextInput value={f.hint} ariaLabel="Nápověda k poli" placeholder="Nápověda (nepovinná)" onCommit={(hint) => saveFields(fields.map((x) => (x.id === f.id ? { ...x, hint } : x)))} />
              </span>
              <button type="button" className="btn small ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Posunout výš">
                ↑
              </button>
              <button type="button" className="btn small ghost" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Posunout níž">
                ↓
              </button>
              <button type="button" className="btn small ghost danger" onClick={() => window.confirm(`Odebrat pole „${f.label}“? Vyplněné hodnoty zůstanou uložené, ale nebudou se zobrazovat.`) && saveFields(fields.filter((x) => x.id !== f.id))}>
                Odebrat
              </button>
            </div>
          ))}
          <div>
            <button type="button" className="btn small" onClick={() => saveFields([...fields, { id: uid(), label: '', kind: 'text', hint: '' }])}>
              Přidat pole
            </button>
          </div>
        </div>

        {withMeta ? (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ marginBottom: 6 }}>Výstupy pro metaanalýzu</h4>
            <p className="small muted">Pro každý výstup zvolte míru účinku podle toho, jaká čísla studie uvádějí. Míru volte předem a pro všechny studie stejnou.</p>
            <div className="stack">
              {outcomes.map((o) => (
                <div key={o.id}>
                  <div className="row top">
                    <span className="grow" style={{ flexBasis: 220 }}>
                      <TextInput value={o.name} ariaLabel="Název výstupu" placeholder="Název výstupu, např. Příznaky deprese" onCommit={(name) => saveOutcomes(outcomes.map((x) => (x.id === o.id ? { ...x, name } : x)))} />
                    </span>
                    <select value={o.measure} aria-label="Míra účinku" style={{ width: 340 }} onChange={(e) => saveOutcomes(outcomes.map((x) => (x.id === o.id ? { ...x, measure: e.target.value as Measure } : x)))}>
                      {Object.values(MEASURES).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn small ghost danger" onClick={() => window.confirm(`Odebrat výstup „${o.name}“?`) && saveOutcomes(outcomes.filter((x) => x.id !== o.id))}>
                      Odebrat
                    </button>
                  </div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {MEASURES[o.measure].explain}
                  </div>
                </div>
              ))}
              {outcomes.length === 0 ? <Notice>Zatím není definován žádný výstup. Bez něj nelze metaanalýzu spočítat.</Notice> : null}
              <div>
                <button type="button" className="btn small" onClick={() => saveOutcomes([...outcomes, { id: uid(), name: '', measure: 'SMD', note: '' }])}>
                  Přidat výstup
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </details>
    </section>
  );
}
