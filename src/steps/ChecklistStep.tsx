import { CHECKLISTS } from '../lib/checklists';
import { patchProject } from '../lib/db';
import { STEP_LABELS, hasStep } from '../lib/reviewTypes';
import type { ChecklistAnswer } from '../lib/types';
import type { StepProps } from '../pages/ProjectPage';
import { TextInput, href } from '../ui';

export default function ChecklistStep({ project }: StepProps) {
  const list = CHECKLISTS[project.type];
  const answers = project.checklist;
  const set = (id: string, patch: Partial<ChecklistAnswer>) => {
    const prev: ChecklistAnswer = answers[id] ?? { done: false, where: '' };
    return patchProject(project.id, { checklist: { ...answers, [id]: { ...prev, ...patch } } });
  };
  const done = list.items.filter((i) => answers[i.id]?.done).length;
  const sections = [...new Set(list.items.map((i) => i.section))];

  return (
    <div className="stack">
      <section className="card">
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{list.name}</h3>
          <span>
            Splněno <strong>{done}</strong> z {list.items.length}
          </span>
        </div>
        <div className="progress">
          <i style={{ width: `${(100 * done) / list.items.length}%` }} />
        </div>
        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          {list.note} Položky jsou zde ve zkráceném českém znění; závazný je originál:{' '}
          <a href={list.url} target="_blank" rel="noreferrer">
            {list.citation}
          </a>
        </p>
      </section>

      {sections.map((section) => (
        <section key={section} className="card">
          <h3>{section}</h3>
          <div className="stack">
            {list.items
              .filter((i) => i.section === section)
              .map((item) => {
                const a = answers[item.id];
                return (
                  <div key={item.id} className="row top">
                    <label className="check grow" style={{ alignItems: 'flex-start', flexBasis: 360 }}>
                      <input type="checkbox" checked={!!a?.done} onChange={(e) => set(item.id, { done: e.target.checked })} style={{ marginTop: 3 }} />
                      <span>
                        <strong>{item.no}</strong> · {item.text}
                        {item.optional ? <span className="pill" style={{ marginLeft: 6 }}>pokud se týká</span> : null}
                        {item.step && hasStep(project.type, item.step) ? (
                          <span className="small muted">
                            {' '}
                            Podklady:{' '}
                            <a href={href('p', project.id, item.step)} onClick={(e) => e.stopPropagation()}>
                              {STEP_LABELS[item.step]}
                            </a>
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <span style={{ width: 220 }}>
                      <TextInput value={a?.where ?? ''} placeholder="Kde v textu (kapitola, strana)" ariaLabel={`Kde v textu je položka ${item.no}`} onCommit={(where) => set(item.id, { where })} />
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
