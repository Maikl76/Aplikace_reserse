import { setStage } from '../lib/db';
import { designOf, planFor } from '../lib/design/logic';
import type { StepProps } from '../pages/ProjectPage';
import { Check, Notice, TextInput, href } from '../ui';

export default function PlanStep({ project }: StepProps) {
  const design = designOf(project);
  const stages = planFor(design);
  const done = stages.filter((s) => design.plan[s.id]?.done).length;

  return (
    <div className="stack">
      {!design.solution.type ? (
        <Notice kind="warn">
          Zatím není zvolen typ řešení, proto je plán jen obecný. Po volbě se doplní etapy, které k danému typu patří. <a href={href('p', project.id, 'd-solution')}>Zvolit typ řešení</a>
        </Notice>
      ) : (
        <Notice>Plán je obecný postup sestavený podle vašich voleb. Není to návod krok za krokem pro konkrétní aplikaci; ten doplní ten, kdo bude stavět.</Notice>
      )}

      <div className="row">
        <span className="small muted">
          Hotovo {done} z {stages.length} etap
        </span>
        <div className="progress grow" style={{ maxWidth: 260 }}>
          <i style={{ width: `${(100 * done) / stages.length}%` }} />
        </div>
      </div>

      {stages.map((s, i) => {
        const st = design.plan[s.id];
        return (
          <section className={`card stage ${st?.done ? 'done' : ''}`} key={s.id}>
            <div className="row between top">
              <h3 style={{ margin: 0 }}>
                {i + 1}. {s.title}
              </h3>
              <Check checked={!!st?.done} onChange={(v) => setStage(project.id, s.id, { done: v })}>
                Hotovo
              </Check>
            </div>
            <ol className="small" style={{ margin: '8px 0' }}>
              {s.steps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <div className="who">
              <div>
                <strong>Hotovo, když</strong>
                {s.doneWhen}
              </div>
              <div>
                <strong>Častá chyba</strong>
                {s.mistake}
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <TextInput value={st?.note ?? ''} ariaLabel={`Poznámka k etapě ${s.title}`} placeholder="Poznámka k průběhu (objeví se ve výstupu)" onCommit={(note) => setStage(project.id, s.id, { note })} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
