import { useMemo, useState } from 'react';
import { studyLabels } from '../lib/analysis';
import { mergeRecord, patchProject, patchRecord } from '../lib/db';
import { includedRecords } from '../lib/flow';
import { QUALITY_TOOLS, levelOf, qualityComplete, toolFor, type QLevel } from '../lib/quality';
import { REVIEW_TYPES } from '../lib/reviewTypes';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Field, Notice, Seg, TextArea } from '../ui';

function Chip({ level }: { level?: QLevel }) {
  if (!level) return <span className="q-chip none" title="Nehodnoceno" aria-label="Nehodnoceno" />;
  return (
    <span className={`q-chip ${level.tone}`} title={level.label} aria-label={level.label}>
      {level.symbol}
    </span>
  );
}

export default function QualityStep({ project, records }: StepProps) {
  const included = useMemo(() => includedRecords(records, project.type), [records, project.type]);
  const labels = useMemo(() => studyLabels(included), [included]);
  const ordered = useMemo(() => [...included].sort((a, b) => (labels.get(a.id) ?? '').localeCompare(labels.get(b.id) ?? '', 'cs')), [included, labels]);
  const [selected, setSelected] = useState<string | null>(null);
  const tool = toolFor(project);
  const suggested = REVIEW_TYPES[project.type].qualityTools;
  const current = ordered.find((r) => r.id === selected) ?? ordered[0] ?? null;
  const short = (i: number) => (tool?.id === 'amstar2' ? String(i + 1) : tool?.id === 'custom' ? `P${i + 1}` : `D${i + 1}`);
  const proposal = tool && current && tool.suggest ? tool.suggest(current.quality, tool.items) : null;

  return (
    <div className="stack">
      <section className="card">
        <h3>Nástroj hodnocení</h3>
        <div className="row" role="group" aria-label="Nástroj">
          {Object.values(QUALITY_TOOLS).map((t) => (
            <button key={t.id} type="button" className={`btn small ${project.qualityTool === t.id ? 'active' : ''}`} onClick={() => patchProject(project.id, { qualityTool: t.id })}>
              {t.name}
              {suggested.includes(t.id) && t.id !== 'custom' ? ' · doporučený' : ''}
            </button>
          ))}
        </div>
        {tool ? (
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {tool.name} je určen pro: {tool.forWhat}. Aplikace uvádí jen názvy oblastí a stručné vodítko – hodnoťte podle úplného znění a návodu:{' '}
            <a href={tool.source.url} target="_blank" rel="noreferrer">
              {tool.source.label}
            </a>
            .
          </p>
        ) : (
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Vyberte nástroj podle designu zařazených studií.
          </p>
        )}
        {tool?.id === 'custom' ? (
          <div style={{ marginTop: 12 }}>
            <Field label="Položky kontrolního seznamu" hint="Jedna otázka na řádek – například položky seznamu JBI pro váš design studie.">
              <TextArea value={project.customQualityItems} rows={6} onCommit={(customQualityItems) => patchProject(project.id, { customQualityItems })} />
            </Field>
          </div>
        ) : null}
      </section>

      {!tool || tool.items.length === 0 ? null : ordered.length === 0 ? (
        <Empty title="Zatím není co hodnotit">Hodnotí se až zařazené studie.</Empty>
      ) : (
        <>
          <div className="split">
            <div className="list" role="listbox" aria-label="Zařazené studie">
              {ordered.map((r) => (
                <button key={r.id} type="button" role="option" aria-selected={r.id === current?.id} className={`list-item ${r.id === current?.id ? 'sel' : ''}`} onClick={() => setSelected(r.id)}>
                  <Chip level={levelOf(tool.overallLevels, r.qualityOverall)} />
                  <span>
                    {labels.get(r.id)}
                    <span className="meta">{qualityComplete(r, tool) ? levelOf(tool.overallLevels, r.qualityOverall)?.label : `ohodnoceno ${tool.items.filter((i) => r.quality[i.id]).length} z ${tool.items.length}`}</span>
                  </span>
                </button>
              ))}
            </div>
            {current ? (
              <article className="card" key={current.id}>
                <h3 style={{ marginBottom: 2 }}>{labels.get(current.id)}</h3>
                <p className="small muted">{current.title}</p>
                <div className="stack">
                  {tool.items.map((item, i) => (
                    <div key={item.id}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {tool.id === 'amstar2' ? '' : `${short(i)} · `}
                        {item.label}
                        {item.critical ? <span className="pill warn" style={{ marginLeft: 8 }}>kritická oblast</span> : null}
                      </div>
                      {item.hint ? <div className="small muted" style={{ marginBottom: 5 }}>{item.hint}</div> : <div style={{ height: 5 }} />}
                      <Seg ariaLabel={item.label} value={current.quality[item.id] ?? ''} options={tool.levels.map((l) => ({ id: l.id, label: l.label }))} onChange={(v) => mergeRecord(current.id, 'quality', { [item.id]: current.quality[item.id] === v ? '' : v })} />
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>{tool.overallLabel}</div>
                    <Seg ariaLabel={tool.overallLabel} value={current.qualityOverall} options={tool.overallLevels.map((l) => ({ id: l.id, label: l.label }))} onChange={(v) => patchRecord(current.id, { qualityOverall: current.qualityOverall === v ? '' : v })} />
                    {proposal && proposal !== current.qualityOverall ? (
                      <div className="row small" style={{ marginTop: 8 }}>
                        <span className="muted">Podle pravidel nástroje vychází: {levelOf(tool.overallLevels, proposal)?.label.toLowerCase()}.</span>
                        <button type="button" className="btn small" onClick={() => patchRecord(current.id, { qualityOverall: proposal })}>
                          Použít
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <Field label="Zdůvodnění hodnocení" hint="Stručně, o co se úsudek opírá – ideálně s odkazem na místo v článku.">
                    <TextArea value={current.qualityNote} rows={3} onCommit={(qualityNote) => patchRecord(current.id, { qualityNote })} />
                  </Field>
                </div>
              </article>
            ) : null}
          </div>

          <section className="card">
            <h3>Souhrn hodnocení</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Studie</th>
                    {tool.items.map((item, i) => (
                      <th key={item.id} title={item.label} style={{ textAlign: 'center' }}>
                        {short(i)}
                      </th>
                    ))}
                    <th style={{ textAlign: 'center' }}>Celkem</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((r) => (
                    <tr key={r.id}>
                      <td className="nowrap">{labels.get(r.id)}</td>
                      {tool.items.map((item) => (
                        <td key={item.id} style={{ textAlign: 'center' }}>
                          <Chip level={levelOf(tool.levels, r.quality[item.id])} />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <Chip level={levelOf(tool.overallLevels, r.qualityOverall)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legend" style={{ marginTop: 10 }}>
              {[...new Map([...tool.levels, ...tool.overallLevels].map((l) => [`${l.symbol}${l.tone}${l.label}`, l])).values()].map((l) => (
                <span key={l.id + l.label}>
                  <Chip level={l} /> {l.label}
                </span>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
              {tool.items.map((item, i) => `${short(i)} – ${item.label.replace(/^\d+\.\s*/, '')}`).join(' · ')}
            </p>
          </section>
          {ordered.some((r) => !qualityComplete(r, tool)) ? <Notice kind="warn">Hodnocení není úplné u {ordered.filter((r) => !qualityComplete(r, tool)).length} z {ordered.length} studií.</Notice> : <Notice kind="good">Všechny studie jsou ohodnoceny.</Notice>}
        </>
      )}
    </div>
  );
}
