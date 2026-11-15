import { useState } from 'react';
import { mergeDesign } from '../lib/db';
import { CATALOG_VERIFIED, CONSEQUENCE_LABELS, DEPLOY_OPTIONS, type ConsequenceKey, type DeployOption } from '../lib/design/catalog';
import { FIT_LABELS, deployFit, deployOf, deriveNeeds, designOf, solutionOf, type Fit } from '../lib/design/logic';
import { formatDate } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Check, Field, Notice, Seg, TextArea, href } from '../ui';
import { Bullets, Facts, FitBadge, OptionCard, Reasons } from './shared';

const KEYS = Object.keys(CONSEQUENCE_LABELS) as ConsequenceKey[];
const ORDER = { ok: 0, warn: 1, no: 2 } as const;

function Consequences({ option }: { option: DeployOption }) {
  return (
    <dl className="cons">
      {KEYS.map((k) => (
        <div key={k}>
          <dt>{CONSEQUENCE_LABELS[k]}</dt>
          <dd>{option.consequences[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function DeployStep({ project }: StepProps) {
  const design = designOf(project);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const type = solutionOf(design.solution.type);
  const known = !!type || deriveNeeds(design.profile).answered > 0;
  const fits = new Map<string, Fit>(DEPLOY_OPTIONS.map((o) => [o.id, deployFit(o.id, design)]));
  const byFit = (a: DeployOption, b: DeployOption) => ORDER[fits.get(a.id)!.level] - ORDER[fits.get(b.id)!.level];
  const mains = DEPLOY_OPTIONS.filter((o) => o.role !== 'extra').sort(byFit);
  const extras = DEPLOY_OPTIONS.filter((o) => o.role !== 'main');
  const chosen = deployOf(design.deploy.choice);
  const chosenFit = chosen ? fits.get(chosen.id)! : null;
  const toggleExtra = (id: string, on: boolean) => mergeDesign(project.id, 'deploy', { extras: on ? [...new Set([...design.deploy.extras, id])] : design.deploy.extras.filter((x) => x !== id) });

  return (
    <div className="stack">
      {!type ? (
        <Notice kind="warn">
          Zatím není zvolen typ řešení, takže vhodnost možností je jen orientační. <a href={href('p', project.id, 'd-solution')}>Zvolit typ řešení</a>
        </Notice>
      ) : (
        <Notice>
          Možnosti jsou seřazeny podle toho, jak odpovídají typu řešení „{type.name.toLowerCase()}“ a vlastnostem aplikace. Důsledky vyplývají z podmínek poskytovatelů a z předpisů; katalog byl naposledy zkontrolován {formatDate(CATALOG_VERIFIED)}.
        </Notice>
      )}

      <div className="row between">
        <h3 style={{ margin: 0 }}>Kde aplikace poběží</h3>
        <Seg
          value={view}
          options={[
            { id: 'cards', label: 'Podrobně' },
            { id: 'table', label: 'Srovnání' },
          ]}
          onChange={setView}
          ariaLabel="Zobrazení možností"
        />
      </div>

      {view === 'table' ? (
        <section className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table compare">
              <thead>
                <tr>
                  <th>Možnost</th>
                  {known ? <th>Vhodnost</th> : null}
                  {KEYS.map((k) => (
                    <th key={k}>{CONSEQUENCE_LABELS[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...mains, ...extras.filter((e) => e.role === 'extra')].map((o) => (
                  <tr key={o.id} className={o.id === chosen?.id ? 'sel' : undefined}>
                    <td>
                      <strong>{o.name}</strong>
                      <div className="muted">{o.examples}</div>
                    </td>
                    {known ? <td>{FIT_LABELS[fits.get(o.id)!.level]}</td> : null}
                    {KEYS.map((k) => (
                      <td key={k}>{o.consequences[k]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        mains.map((o) => {
          const f = fits.get(o.id)!;
          const sel = chosen?.id === o.id;
          return (
            <OptionCard key={o.id} selected={sel} muted={known && f.level === 'no' && !sel}>
              <div className="row between top">
                <div className="grow">
                  <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0 }}>{o.name}</h3>
                    <FitBadge fit={f} show={known} />
                    {sel ? <span className="pill accent">zvoleno</span> : design.deploy.extras.includes(o.id) ? <span className="pill">přidáno jako doplněk</span> : null}
                  </div>
                  <div className="small muted" style={{ marginBottom: 4 }}>
                    {o.examples}
                  </div>
                  <p style={{ margin: 0 }}>{o.description}</p>
                </div>
                <button type="button" className={`btn small ${sel ? '' : 'primary'}`} aria-pressed={sel} onClick={() => mergeDesign(project.id, 'deploy', { choice: sel ? '' : o.id })}>
                  {sel ? 'Zrušit volbu' : 'Zvolit'}
                </button>
              </div>
              {known ? <Reasons fit={f} /> : null}
              {/* Po volbě zůstane rozbalená jen zvolená možnost; do té doby všechny, které připadají v úvahu. */}
              <details open={sel || (!chosen && f.level !== 'no')}>
                <summary>Důsledky volby</summary>
                <Consequences option={o} />
                <div className="option-grid">
                  <Bullets title="Co se často podcení" items={o.underestimated} />
                  <Facts facts={o.facts} />
                </div>
              </details>
            </OptionCard>
          );
        })
      )}

      <h3 style={{ margin: '8px 0 0' }}>Doplňky k místu provozu</h3>
      <p className="muted" style={{ margin: 0 }}>
        Stálá kopie aplikace nezávislá na tom, zda a kde právě běží. V práci na ni lze odkázat i tehdy, když živá adresa přestane fungovat.
      </p>
      {extras.map((o) => {
        const f = fits.get(o.id)!;
        const on = design.deploy.extras.includes(o.id) && o.id !== chosen?.id;
        const isMain = o.id === chosen?.id;
        return (
          <OptionCard key={o.id} selected={on} muted={f.level === 'no' && !on}>
            <div className="row between top">
              <div className="grow">
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <h3 style={{ margin: 0 }}>{o.name}</h3>
                  {f.level === 'no' ? <FitBadge fit={f} /> : null}
                </div>
                <div className="small muted" style={{ marginBottom: 4 }}>
                  {o.examples}
                </div>
                <p style={{ margin: 0 }}>{o.description}</p>
              </div>
              {isMain ? (
                <span className="pill accent">zvoleno jako místo provozu</span>
              ) : (
                <Check checked={on} onChange={(v) => toggleExtra(o.id, v)}>
                  Přidat
                </Check>
              )}
            </div>
            {f.level === 'no' ? <Reasons fit={f} /> : null}
            <details>
              <summary>Důsledky volby</summary>
              <Consequences option={o} />
              <div className="option-grid">
                <Bullets title="Co se často podcení" items={o.underestimated} />
                <Facts facts={o.facts} />
              </div>
            </details>
          </OptionCard>
        );
      })}

      <section className="card">
        <h3>Vaše volba</h3>
        {chosen ? (
          <div className="stack">
            {chosenFit?.level === 'no' ? <Notice kind="bad">Zvolené nasazení neodpovídá návrhu: {chosenFit.reasons[0]}</Notice> : null}
            <Field label={`Proč ${chosen.name.toLowerCase()}`} hint="Co rozhodlo a s čím jste se smířili. Zdůvodnění se objeví ve výstupu.">
              <TextArea value={design.deploy.why} rows={3} onCommit={(why) => mergeDesign(project.id, 'deploy', { why })} />
            </Field>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Zatím není zvoleno, kde aplikace poběží.
          </p>
        )}
      </section>
    </div>
  );
}
