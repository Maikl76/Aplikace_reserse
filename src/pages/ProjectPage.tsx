import { useLiveQuery } from 'dexie-react-hooks';
import type { ComponentType } from 'react';
import DeployStep from '../design/DeployStep';
import IntentStep from '../design/IntentStep';
import OutputStep from '../design/OutputStep';
import PlanStep from '../design/PlanStep';
import ProfileStep from '../design/ProfileStep';
import RequirementsStep from '../design/RequirementsStep';
import RulesStep from '../design/RulesStep';
import SolutionStep from '../design/SolutionStep';
import { GUIDES } from '../lib/content/guides';
import { db, deleteProject, partsOf, patchProject } from '../lib/db';
import { DESIGN_GUIDES } from '../lib/design/guides';
import { DESIGN_STEPS } from '../lib/design/logic';
import { REVIEW_TYPES, STEP_LABELS, stepsOf } from '../lib/reviewTypes';
import type { DesignStepId, Project, RecordItem, StepId } from '../lib/types';
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
import { Check, Empty, GuidePanel, Notice, href, navigate } from '../ui';
import SaveBox from './SaveBox';

export interface StepProps {
  project: Project;
  records: RecordItem[];
}

type AnyStepId = StepId | DesignStepId;

const COMPONENTS: Record<AnyStepId, ComponentType<StepProps>> = {
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
  'd-intent': IntentStep,
  'd-reqs': RequirementsStep,
  'd-profile': ProfileStep,
  'd-solution': SolutionStep,
  'd-deploy': DeployStep,
  'd-rules': RulesStep,
  'd-plan': PlanStep,
  'd-output': OutputStep,
};

// Kroky, které potřebují širší pracovní plochu.
const WIDE: AnyStepId[] = ['screen1', 'screen2', 'extract', 'quality', 'synthesis', 'd-deploy'];

interface NavStep {
  id: AnyStepId;
  label: string;
  optional?: boolean;
  part: 'review' | 'design';
  /** Pořadí kroku uvnitř své části (od 1). */
  no: number;
}

/** Kroky projektu podle toho, které části obsahuje: rešerši, návrh aplikace, nebo obojí. */
export function stepsOfProject(project: Pick<Project, 'type' | 'parts'>): NavStep[] {
  const parts = partsOf(project);
  const review: NavStep[] = parts.review ? stepsOf(project.type).map((s, i) => ({ id: s.id, label: STEP_LABELS[s.id], optional: s.optional, part: 'review', no: i + 1 })) : [];
  const design: NavStep[] = parts.design ? DESIGN_STEPS.map((s, i) => ({ id: s.id, label: s.label, part: 'design', no: i + 1 })) : [];
  return [...review, ...design];
}

/** Označení druhu projektu pro seznamy a postranní panel. */
export function kindLabel(project: Pick<Project, 'type' | 'parts'>): string {
  const parts = partsOf(project);
  if (parts.review && parts.design) return `${REVIEW_TYPES[project.type].name} a návrh aplikace`;
  return parts.design ? 'Návrh aplikace' : REVIEW_TYPES[project.type].name;
}

export default function ProjectPage({ id, step }: { id: string; step?: string }) {
  const loaded = useLiveQuery(async () => ({ project: await db.projects.get(id) }), [id]);
  const records = useLiveQuery(() => db.records.where('projectId').equals(id).toArray(), [id]);

  if (!loaded || !records) return <main className="page muted">Načítám…</main>;
  const project = loaded.project;
  if (!project) {
    return (
      <main className="page">
        <Empty title="Projekt nenalezen">
          Možná byl smazán, nebo jste na jiném počítači či v jiném prohlížeči. <a href="#/">Zpět na seznam projektů</a>
        </Empty>
      </main>
    );
  }

  const parts = partsOf(project);
  const steps = stepsOfProject(project);
  const fallback = steps.find((s) => !project.done[s.id]) ?? steps[0];
  const current = steps.find((s) => s.id === step) ?? fallback;
  const index = steps.indexOf(current);
  const prev = steps[index - 1];
  const next = steps[index + 1];
  const Step = COMPONENTS[current.id];
  const isDone = !!project.done[current.id];
  const inPart = steps.filter((s) => s.part === current.part);
  const what = parts.review ? 'přehled' : 'návrh';
  const guide = current.part === 'design' ? DESIGN_GUIDES[current.id as DesignStepId] : GUIDES[current.id as StepId];

  const remove = async () => {
    if (!window.confirm(`Opravdu smazat ${what} „${project.title}“${parts.review ? ' včetně všech záznamů' : ''}? Tuto akci nelze vrátit.`)) return;
    await deleteProject(project.id);
    navigate();
  };

  const group = (part: 'review' | 'design', title: string) => {
    const list = steps.filter((s) => s.part === part);
    if (!list.length) return null;
    return (
      <>
        {parts.review && parts.design ? <div className="steps-group">{title}</div> : null}
        <ol className="steps">
          {list.map((s) => (
            <li key={s.id}>
              <a className={`step-link ${s.id === current.id ? 'current' : ''} ${project.done[s.id] ? 'done' : ''}`} href={href('p', project.id, s.id)} aria-current={s.id === current.id ? 'step' : undefined}>
                <span className="step-num">{project.done[s.id] ? '✓' : s.no}</span>
                <span>{s.label}</span>
                {s.optional ? <span className="step-opt">volitelný</span> : null}
              </a>
            </li>
          ))}
        </ol>
      </>
    );
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="project-title">
          <div className="name">{project.title}</div>
          <div className="small muted" style={{ marginTop: 2 }}>
            {kindLabel(project)}
          </div>
        </div>
        <nav aria-label="Kroky projektu">
          {group('review', 'Přehled literatury')}
          {group('design', 'Návrh aplikace')}
        </nav>
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'grid', gap: 10 }}>
          <SaveBox project={project} records={records} />
          <button type="button" className="btn small ghost danger" onClick={remove}>
            Smazat {what}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className={`main-inner ${WIDE.includes(current.id) ? 'wide' : ''}`}>
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="small muted">
              Krok {current.no} z {inPart.length}
            </span>
            {current.optional ? <span className="pill">volitelný krok</span> : null}
            {isDone ? <span className="pill accent">hotovo</span> : null}
          </div>
          <h1 style={{ marginBottom: 16 }}>{current.label}</h1>
          {project.reviewerCopy ? (
            <div style={{ marginBottom: 16 }}>
              <Notice>Toto je kopie projektu pro druhého hodnotitele. Slouží jen k nezávislému třídění; svá rozhodnutí pak stáhněte v kroku Třídění nebo Posouzení plných textů a pošlete je zpět.</Notice>
            </div>
          ) : null}
          {project.demo ? (
            <div style={{ marginBottom: 16 }}>
              <Notice>{typeof project.demo === 'string' ? project.demo : 'Toto je ukázkový projekt s 13 studiemi vakcíny BCG (Colditz et al., 1994). Vyhledávání a třídění v něm neproběhlo; slouží k vyzkoušení extrakce, metaanalýzy a sestavení textu.'}</Notice>
            </div>
          ) : null}
          <GuidePanel key={`guide-${current.id}`} step={current.id} guide={guide} extra={current.part === 'review' ? guide.byType?.[project.type] : undefined} done={isDone} />
          <Step key={`step-${current.id}`} project={project} records={records} />

          <div className="step-footer">
            <Check checked={isDone} onChange={(v) => patchProject(project.id, { done: { ...project.done, [current.id]: v } })}>
              Krok mám hotový
            </Check>
            <span className="grow" />
            {prev ? (
              <a className="btn" href={href('p', project.id, prev.id)}>
                ← {prev.label}
              </a>
            ) : null}
            {next ? (
              <a className="btn primary" href={href('p', project.id, next.id)}>
                {next.label} →
              </a>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
