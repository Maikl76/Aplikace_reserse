import { addRequirement, patchRequirement, removeRequirement } from '../lib/db';
import { PRIORITIES, REQ_SOURCES } from '../lib/design/catalog';
import { designOf } from '../lib/design/logic';
import { NO_REVIEW_NOTE } from '../lib/design/output';
import type { ReqSource, Requirement } from '../lib/types';
import { plural } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Notice, Seg, Stat, TextArea, TextInput } from '../ui';
import { Group } from './shared';

export default function RequirementsStep({ project }: StepProps) {
  const reqs = designOf(project).requirements;
  const filled = reqs.filter((r) => r.text.trim());
  const count = (p: Requirement['priority']) => filled.filter((r) => r.priority === p).length;
  const noSource = filled.filter((r) => !r.source).length;
  const assumed = filled.filter((r) => r.source === 'assumption').length;

  return (
    <div className="stack">
      <Notice>{NO_REVIEW_NOTE} Zdroj se objeví i ve výstupu, aby bylo vidět, co je podložené a co je zatím domněnka.</Notice>

      {filled.length ? (
        <div className="stats">
          {PRIORITIES.map((p) => (
            <Stat key={p.id} label={p.label} value={count(p.id)} sub={p.hint} />
          ))}
        </div>
      ) : null}

      {reqs.length === 0 ? (
        <Empty title="Zatím žádné požadavky">Začněte tím, bez čeho by aplikace neplnila účel.</Empty>
      ) : (
        reqs.map((r, i) => (
          <section className="card req" key={r.id}>
            <div className="row top">
              <span className="req-no">{i + 1}</span>
              <div className="grow">
                <TextArea value={r.text} rows={2} ariaLabel={`Požadavek ${i + 1}`} placeholder="Uživatel (kdo) dokáže (co)…" onCommit={(text) => patchRequirement(project.id, r.id, { text })} />
              </div>
            </div>
            <div className="req-meta">
              <Group label="Priorita">
                <Seg value={r.priority} options={PRIORITIES} onChange={(priority) => patchRequirement(project.id, r.id, { priority })} ariaLabel={`Priorita požadavku ${i + 1}`} />
              </Group>
              <label className="field">
                <span className="label">O co se opírá</span>
                <select value={r.source} aria-label={`Zdroj požadavku ${i + 1}`} onChange={(e) => patchRequirement(project.id, r.id, { source: e.target.value as ReqSource })}>
                  <option value="">– zvolte zdroj –</option>
                  {REQ_SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field grow">
                <span className="label">Upřesnění zdroje</span>
                <TextInput value={r.sourceNote} ariaLabel={`Upřesnění zdroje požadavku ${i + 1}`} placeholder={REQ_SOURCES.find((s) => s.id === r.source)?.hint ?? 'kdo, kdy, který dokument'} onCommit={(sourceNote) => patchRequirement(project.id, r.id, { sourceNote })} />
              </label>
              <button type="button" className="btn small ghost danger" onClick={() => removeRequirement(project.id, r.id)} aria-label={`Odstranit požadavek ${i + 1}`}>
                Odstranit
              </button>
            </div>
          </section>
        ))
      )}

      <div className="row">
        <button type="button" className="btn primary" onClick={() => addRequirement(project.id)}>
          Přidat požadavek
        </button>
      </div>

      {filled.length > 0 && count('must') === 0 ? <Notice kind="warn">Žádný požadavek nemá prioritu „musí“. Bez povinných požadavků není jasné, co je první verze.</Notice> : null}
      {filled.length >= 4 && count('must') === filled.length ? <Notice kind="warn">Všechny požadavky mají prioritu „musí“. Zkuste určit, bez kterých by aplikace ještě plnila účel.</Notice> : null}
      {noSource ? <Notice kind="warn">U {plural(noSource, 'požadavku', 'požadavků', 'požadavků')} není uveden zdroj.</Notice> : null}
      {assumed ? <Notice>{plural(assumed, 'požadavek stojí', 'požadavky stojí', 'požadavků stojí')} na neověřeném předpokladu. Ověřte {assumed === 1 ? 'ho' : 'je'} u budoucích uživatelů dřív, než se začne stavět.</Notice> : null}
    </div>
  );
}
