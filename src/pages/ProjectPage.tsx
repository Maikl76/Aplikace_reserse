import { useLiveQuery } from 'dexie-react-hooks';
import type { ComponentType } from 'react';
import { db, deleteProject, exportBackup, patchProject } from '../lib/db';
import { REVIEW_TYPES, STEP_LABELS, stepsOf } from '../lib/reviewTypes';
import type { Project, RecordItem, StepId } from '../lib/types';
import { download, slug } from '../lib/util';
import ChecklistStep from '../steps/ChecklistStep';
import DedupStep from '../steps/DedupStep';
import ExtractStep from '../steps/ExtractStep';
import FlowStep from '../steps/FlowStep';
import ProtocolStep from '../steps/ProtocolStep';
import QualityStep from '../steps/QualityStep';
import QuestionStep from '../steps/QuestionStep';
import Screen1Step from '../steps/Screen1Step';
import Screen2Step from '../steps/Screen2Step';
import SearchStep from '../steps/SearchStep';
import SynthesisStep from '../steps/SynthesisStep';
import WriteStep from '../steps/WriteStep';
import { Empty, GuidePanel, Notice, href, navigate } from '../ui';

export interface StepProps {
  project: Project;
  records: RecordItem[];
}

const COMPONENTS: Record<StepId, ComponentType<StepProps>> = {
  question: QuestionStep,
  protocol: ProtocolStep,
  search: SearchStep,
  dedup: DedupStep,
  screen1: Screen1Step,
  screen2: Screen2Step,
  extract: ExtractStep,
  quality: QualityStep,
  synthesis: SynthesisStep,
  flow: FlowStep,
  write: WriteStep,
  checklist: ChecklistStep,
};

// Kroky, které potřebují širší pracovní plochu.
const WIDE: StepId[] = ['screen1', 'screen2', 'extract', 'quality', 'synthesis'];

export default function ProjectPage({ id, step }: { id: string; step?: string }) {
  const loaded = useLiveQuery(async () => ({ project: await db.projects.get(id) }), [id]);
  const records = useLiveQuery(() => db.records.where('projectId').equals(id).toArray(), [id]);

  if (!loaded || !records) return <main className="page muted">Načítám…</main>;
  const project = loaded.project;
  if (!project) {
    return (
      <main className="page">
        <Empty title="Přehled nenalezen">
          Možná byl smazán, nebo jste na jiném počítači či v jiném prohlížeči. <a href="#/">Zpět na seznam přehledů</a>
        </Empty>
      </main>
    );
  }

  const steps = stepsOf(project.type);
  const fallback = steps.find((s) => !project.done[s.id]) ?? steps[0];
  const current = steps.find((s) => s.id === step) ?? fallback;
  const index = steps.indexOf(current);
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const Step = COMPONENTS[current.id];
  const conf = REVIEW_TYPES[project.type];
  const isDone = !!project.done[current.id];

  const backup = async () => download(`${slug(project.title)}-zaloha.json`, JSON.stringify(await exportBackup(project.id), null, 1), 'application/json');
  const remove = async () => {
    if (!window.confirm(`Opravdu smazat přehled „${project.title}“ včetně všech záznamů? Tuto akci nelze vrátit.`)) return;
    await deleteProject(project.id);
    navigate();
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="project-title">
          <div className="name">{project.title}</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {conf.name}
          </div>
        </div>
        <nav aria-label="Kroky přehledu">
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={s.id}>
                <a className={`step-link ${s.id === current.id ? 'current' : ''} ${project.done[s.id] ? 'done' : ''}`} href={href('p', project.id, s.id)} aria-current={s.id === current.id ? 'step' : undefined}>
                  <span className="step-num">{project.done[s.id] ? '✓' : i + 1}</span>
                  <span>{STEP_LABELS[s.id]}</span>
                  {s.optional ? <span className="step-opt">volitelný</span> : null}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'grid', gap: 6 }}>
          <button type="button" className="btn small" onClick={backup}>
            Stáhnout zálohu projektu
          </button>
          <button type="button" className="btn small ghost danger" onClick={remove}>
            Smazat přehled
          </button>
        </div>
      </aside>

      <main className="main">
        <div className={`main-inner ${WIDE.includes(current.id) ? 'wide' : ''}`}>
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="small muted">
              Krok {index + 1} z {steps.length}
            </span>
            {current.optional ? <span className="pill">volitelný krok</span> : null}
            {isDone ? <span className="pill accent">hotovo</span> : null}
          </div>
          <h1 style={{ marginBottom: 16 }}>{STEP_LABELS[current.id]}</h1>
          {project.demo ? (
            <div style={{ marginBottom: 16 }}>
              <Notice>Toto je ukázkový projekt s 13 studiemi vakcíny BCG (Colditz et al., 1994). Vyhledávání a třídění v něm neproběhlo; slouží k vyzkoušení extrakce, metaanalýzy a sestavení textu.</Notice>
            </div>
          ) : null}
          <GuidePanel key={current.id} step={current.id} type={project.type} done={isDone} />
          <Step key={current.id} project={project} records={records} />

          <div className="step-footer">
            <label className="check">
              <input type="checkbox" checked={isDone} onChange={(e) => patchProject(project.id, { done: { ...project.done, [current.id]: e.target.checked } })} />
              <span>Krok mám hotový</span>
            </label>
            <span className="grow" />
            {prev ? (
              <a className="btn" href={href('p', project.id, prev.id)}>
                ← {STEP_LABELS[prev.id]}
              </a>
            ) : null}
            {next ? (
              <a className="btn primary" href={href('p', project.id, next.id)}>
                {STEP_LABELS[next.id]} →
              </a>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
