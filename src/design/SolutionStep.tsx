import { mergeDesign } from '../lib/db';
import { SOLUTION_TYPES } from '../lib/design/catalog';
import { deriveNeeds, designOf, solutionFit } from '../lib/design/logic';
import type { StepProps } from '../pages/ProjectPage';
import { Field, Notice, TextArea, TextInput, href } from '../ui';
import { Bullets, Facts, FitBadge, OptionCard, Reasons } from './shared';

export default function SolutionStep({ project }: StepProps) {
  const design = designOf(project);
  const answered = deriveNeeds(design.profile).answered > 0;
  const chosen = SOLUTION_TYPES.find((s) => s.id === design.solution.type);
  const chosenFit = chosen ? solutionFit(chosen.id, design) : null;

  return (
    <div className="stack">
      {!answered ? (
        <Notice kind="warn">
          Vlastnosti aplikace zatím nejsou vyplněny, takže u typů řešení nelze ukázat, zda jim vyhovují. <a href={href('p', project.id, 'd-profile')}>Vyplnit vlastnosti</a>
        </Notice>
      ) : (
        <Notice>Vhodnost je odvozena z vašich odpovědí o vlastnostech aplikace. Vychází z technických souvislostí, ne z výzkumu; rozhodnutí je na vás.</Notice>
      )}

      {SOLUTION_TYPES.map((s) => {
        const f = solutionFit(s.id, design);
        const sel = chosen?.id === s.id;
        return (
          <OptionCard key={s.id} selected={sel} muted={answered && f.level === 'no' && !sel}>
            <div className="row between top">
              <div className="grow">
                <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                  <h3 style={{ margin: 0 }}>{s.name}</h3>
                  <FitBadge fit={f} show={answered} />
                  {sel ? <span className="pill accent">zvoleno</span> : null}
                </div>
                <p style={{ margin: 0 }}>{s.description}</p>
              </div>
              <button type="button" className={`btn small ${sel ? '' : 'primary'}`} aria-pressed={sel} onClick={() => mergeDesign(project.id, 'solution', { type: sel ? '' : s.id })}>
                {sel ? 'Zrušit volbu' : 'Zvolit'}
              </button>
            </div>
            {answered ? <Reasons fit={f} /> : null}
            <details open={sel}>
              <summary>Co umí, co neumí a co se podcení</summary>
              <div className="option-grid">
                <Bullets title="Umí" items={s.can} />
                <Bullets title="Neumí" items={s.cannot} />
                <Bullets title="Co se často podcení" items={s.underestimated} />
                <div>
                  <div className="mini-head">Obvyklé technologie</div>
                  <ul className="small">
                    {s.tech.map((t) => (
                      <li key={t.name}>
                        <strong>{t.name}.</strong> {t.note}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <p className="small" style={{ margin: '8px 0 0' }}>
                <strong>Potřebné dovednosti:</strong> {s.skills} <strong>Provoz:</strong> {s.running}
              </p>
              <div style={{ marginTop: 8 }}>
                <Facts facts={s.facts} />
              </div>
            </details>
          </OptionCard>
        );
      })}

      <section className="card">
        <h3>Vaše volba</h3>
        {chosen ? (
          <div className="stack">
            {chosenFit?.level === 'no' ? (
              <Notice kind="bad">
                Zvolený typ neodpovídá vlastnostem aplikace: {chosenFit.reasons[0]} Buď zvolte jiný typ, nebo se dané vlastnosti vzdejte v kroku <a href={href('p', project.id, 'd-profile')}>Vlastnosti aplikace</a>.
              </Notice>
            ) : null}
            <Field label={`Proč ${chosen.name.toLowerCase()}`} hint="Vlastními slovy: co rozhodlo a čeho jste se kvůli tomu vzdali. Zdůvodnění se objeví ve výstupu.">
              <TextArea value={design.solution.why} rows={3} onCommit={(why) => mergeDesign(project.id, 'solution', { why })} />
            </Field>
            <Field label="Zvolené technologie" hint="Programovací jazyk, knihovny, úložiště. Řiďte se tím, co umí ten, kdo bude aplikaci stavět a udržovat.">
              <TextInput value={design.solution.tech} onCommit={(tech) => mergeDesign(project.id, 'solution', { tech })} />
            </Field>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Zatím není zvolen žádný typ řešení.
          </p>
        )}
      </section>
    </div>
  );
}
