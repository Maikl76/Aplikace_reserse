import { mergeDesign } from '../lib/db';
import { PROFILE_QUESTIONS } from '../lib/design/catalog';
import { deriveNeeds, designOf, implications } from '../lib/design/logic';
import type { StepProps } from '../pages/ProjectPage';
import { Notice, Seg } from '../ui';
import { FactLine } from './shared';

export default function ProfileStep({ project }: StepProps) {
  const profile = designOf(project).profile;
  const needs = deriveNeeds(profile);
  const list = implications(profile);

  return (
    <div className="stack">
      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Otázky o aplikaci</h3>
          <span className="small muted">
            Zodpovězeno {needs.answered} z {PROFILE_QUESTIONS.length}
          </span>
        </div>
        <div className="questions">
          {PROFILE_QUESTIONS.map((q) => (
            <div className="question" key={q.id}>
              <div className="q-text">
                <div className="q-label">{q.label}</div>
                <div className="hint small muted">{q.hint}</div>
              </div>
              <Seg value={profile[q.id] ?? ''} options={q.options} onChange={(v) => mergeDesign(project.id, 'profile', { [q.id]: v })} ariaLabel={q.label} />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>Co z odpovědí plyne</h3>
        {list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Po zodpovězení otázek se tu objeví, co odpovědi znamenají pro typ řešení a provoz.
          </p>
        ) : (
          <div className="stack">
            {list.map((imp) => (
              <Notice key={imp.title} kind={imp.kind === 'warn' ? 'warn' : undefined}>
                <strong>{imp.title}.</strong> {imp.text}
                {imp.reasons?.length ? (
                  <ul className="small" style={{ margin: '6px 0 0' }}>
                    {imp.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                ) : null}
                {imp.fact ? (
                  <div style={{ marginTop: 6 }}>
                    <FactLine fact={imp.fact} />
                  </div>
                ) : null}
              </Notice>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
