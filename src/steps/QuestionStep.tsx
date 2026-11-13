import { mergeProject, patchProject } from '../lib/db';
import { FRAMEWORKS } from '../lib/reviewTypes';
import type { Question } from '../lib/types';
import type { StepProps } from '../pages/ProjectPage';
import { Field, TextArea, TextInput } from '../ui';

/** Návrh znění otázky z vyplněných prvků rámce. */
export function suggestQuestion(q: Question): string {
  const e = (id: string) => (q.elements[id] ?? '').trim();
  if (q.framework === 'PICO') {
    if (!e('I') || !e('P')) return '';
    const outcome = e('O') ? ` na ${e('O')}` : '';
    return e('C') ? `Jaký je účinek ${e('I')} ve srovnání s ${e('C')}${outcome} u ${e('P')}?` : `Jaký je účinek ${e('I')}${outcome} u ${e('P')}?`;
  }
  if (q.framework === 'PCC') {
    if (!e('C1')) return '';
    return `Co je známo o ${e('C1')}${e('P') ? ` u ${e('P')}` : ''}${e('C2') ? ` v kontextu ${e('C2')}` : ''}?`;
  }
  return e('topic') ? `Co je známo o tématu ${e('topic')}${e('scope') ? ` (${e('scope')})` : ''}?` : '';
}

export default function QuestionStep({ project }: StepProps) {
  const q = project.question;
  const fw = FRAMEWORKS[q.framework];
  const set = (partial: Partial<Question>) => mergeProject(project.id, 'question', partial);
  const suggestion = suggestQuestion(q);

  return (
    <div className="stack">
      <section className="card">
        <Field label="Pracovní název přehledu" hint="Použije se jako název práce; můžete ho kdykoli změnit.">
          <TextInput value={project.title} onCommit={(title) => patchProject(project.id, { title: title.trim() || project.title })} />
        </Field>
      </section>

      <section className="card">
        <h3>Prvky otázky – rámec {fw.name}</h3>
        <div className="stack">
          {fw.elements.map((el) => (
            <Field key={el.id} label={`${el.letter} – ${el.label}`} hint={el.hint}>
              <TextInput value={q.elements[el.id] ?? ''} placeholder={`např. ${el.example}`} onCommit={(v) => set({ elements: { ...q.elements, [el.id]: v } })} />
            </Field>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Znění otázky a cíl</h3>
        <div className="stack">
          <Field label="Výzkumná otázka" hint="Jedna věta zakončená otazníkem. Návrh berte jako východisko – česky ho bude potřeba doladit (pády, slovosled).">
            <TextArea value={q.text} rows={2} onCommit={(text) => set({ text })} placeholder="Např. Snižuje pravidelná pohybová aktivita příznaky deprese u dospívajících?" />
          </Field>
          {suggestion && suggestion !== q.text ? (
            <div className="row">
              <span className="small muted grow">Návrh z prvků: {suggestion}</span>
              <button type="button" className="btn small" onClick={() => set({ text: suggestion })}>
                Použít návrh
              </button>
            </div>
          ) : null}
          <Field label="Cíl přehledu" hint="Jednou až dvěma větami, co má přehled zjistit.">
            <TextArea value={q.aim} rows={2} onCommit={(aim) => set({ aim })} placeholder="Např. Shrnout důkazy o účinku pohybových intervencí na příznaky deprese u dospívajících." />
          </Field>
          <Field label="Proč je přehled potřeba" hint="Co se o tématu neví nebo je sporné. Tímto odstavcem začne úvod práce.">
            <TextArea value={q.rationale} rows={3} onCommit={(rationale) => set({ rationale })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>Ověřte, že stejný přehled už neexistuje</h3>
        <p>Než budete pokračovat, vyhledejte existující a probíhající přehledy na vaši otázku. Pokud aktuální přehled existuje, zvažte užší otázku, jinou populaci nebo aktualizaci.</p>
        <div className="row">
          <a className="btn small" href="https://www.crd.york.ac.uk/prospero/" target="_blank" rel="noreferrer">
            PROSPERO
          </a>
          <a className="btn small" href="https://www.cochranelibrary.com/" target="_blank" rel="noreferrer">
            Cochrane Library
          </a>
          <a className="btn small" href="https://www.epistemonikos.org/" target="_blank" rel="noreferrer">
            Epistemonikos
          </a>
          <a className="btn small" href="https://osf.io/registries" target="_blank" rel="noreferrer">
            OSF Registries
          </a>
        </div>
      </section>
    </div>
  );
}
