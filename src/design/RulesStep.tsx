import { mergeDesign } from '../lib/db';
import { FACTS, SCHOOL_QUESTIONS, type SchoolQuestion } from '../lib/design/catalog';
import { deriveNeeds, designOf, relevantQuestions } from '../lib/design/logic';
import type { DesignState } from '../lib/types';
import type { StepProps } from '../pages/ProjectPage';
import { Field, Notice, TextArea, TextInput } from '../ui';
import { FactLine } from './shared';

const GROUPS: SchoolQuestion['group'][] = ['Provoz', 'Práva a odevzdání', 'Osobní údaje a etika'];

function Question({ q, value, onCommit }: { q: SchoolQuestion; value: string; onCommit: (v: string) => void }) {
  return (
    <div className="school-q">
      <div className="q-label">{q.question}</div>
      <div className="small muted">{q.why}</div>
      {q.fact ? <FactLine fact={q.fact} /> : null}
      <TextArea value={value} rows={2} ariaLabel={`Odpověď: ${q.question}`} placeholder="Co jste zjistili, od koho a kdy" onCommit={onCommit} />
    </div>
  );
}

export default function RulesStep({ project }: StepProps) {
  const design = designOf(project);
  const needs = deriveNeeds(design.profile);
  const relevant = relevantQuestions(design);
  const rest = SCHOOL_QUESTIONS.filter((q) => !relevant.includes(q));
  const answered = relevant.filter((q) => design.school[q.id]?.trim()).length;
  const setAnswer = (id: string) => (v: string) => mergeDesign(project.id, 'school', { [id]: v });
  const setRule = (partial: Partial<DesignState['rules']>) => mergeDesign(project.id, 'rules', partial);

  return (
    <div className="stack">
      <section className="card">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Otázky pro školu</h3>
          <span className="small muted">
            Zodpovězeno {answered} z {relevant.length}
          </span>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Vybrány jsou otázky, které se týkají vašeho návrhu. Položte je vedoucímu, správcům IT a pověřenci pro ochranu osobních údajů; ke každé odpovědi si poznamenejte, kdo a kdy ji dal.
        </p>
        {GROUPS.map((g) => {
          const list = relevant.filter((q) => q.group === g);
          if (!list.length) return null;
          return (
            <div key={g} style={{ marginTop: 14 }}>
              <div className="mini-head">{g}</div>
              <div className="stack">
                {list.map((q) => (
                  <Question key={q.id} q={q} value={design.school[q.id] ?? ''} onCommit={setAnswer(q.id)} />
                ))}
              </div>
            </div>
          );
        })}
        {rest.length ? (
          <details style={{ marginTop: 16 }}>
            <summary>Další otázky ({rest.length})</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              {rest.map((q) => (
                <Question key={q.id} q={q} value={design.school[q.id] ?? ''} onCommit={setAnswer(q.id)} />
              ))}
            </div>
          </details>
        ) : null}
      </section>

      {design.solution.type !== 'nocode' ? (
        <section className="card">
          <h3>Licence</h3>
          <div className="stack">
            <FactLine fact={FACTS.schoolWork} />
            <Field
              label="Pod jakou licencí bude kód zveřejněn nebo předán"
              hint={
                <>
                  Bez licence nesmí nikdo jiný kód použít ani upravit, tedy ani ten, kdo aplikaci převezme. Přehled otevřených licencí je na{' '}
                  <a href="https://choosealicense.com/" target="_blank" rel="noreferrer">
                    choosealicense.com
                  </a>
                  ; volbu potvrďte se školou.
                </>
              }
            >
              <TextInput value={design.rules.licence} placeholder="např. MIT, GPL-3.0, neveřejný kód předaný škole" onCommit={(licence) => setRule({ licence })} />
            </Field>
          </div>
        </section>
      ) : null}

      {needs.personal !== 'none' ? (
        <section className="card">
          <h3>Osobní údaje</h3>
          <div className="stack">
            {needs.personalLeavesDevice ? <Notice kind="warn">Podle vlastností aplikace osobní údaje opustí zařízení uživatele. Někdo se stává jejich správcem; se školou vyjasněte, kdo to bude.</Notice> : <Notice>Podle vlastností aplikace zůstávají osobní údaje v zařízení uživatele. Popište to i tak, aby to šlo ověřit.</Notice>}
            <FactLine fact={needs.personal === 'special' ? FACTS.gdprSpecial : FACTS.gdprController} />
            <Field label="Jaké údaje aplikace zpracuje, proč, kde a jak dlouho" hint="Vyjmenujte jen to, co aplikace k plnění účelu potřebuje. Uveďte, jak je uživatel může smazat.">
              <TextArea value={design.rules.dataNote} rows={3} onCommit={(dataNote) => setRule({ dataNote })} />
            </Field>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h3>Po obhajobě</h3>
        <Field label="Co se s aplikací stane" hint="Kdo ji převezme a s jakými přístupy, nebo kdy a jak se vypne a co se stane s daty uživatelů.">
          <TextArea value={design.rules.handover} rows={3} onCommit={(handover) => setRule({ handover })} />
        </Field>
      </section>
    </div>
  );
}
