// Výstup průvodce návrhem: dokument „Návrh aplikace“ a stručné zadání pro toho, kdo bude stavět.
// Dokument přiznává původ každého požadavku a u údajů z podmínek poskytovatelů a předpisů
// uvádí zdroj s datem ověření.

import type { Block } from '../manuscript/build';
import type { DesignState, Project } from '../types';
import { formatDate, plural } from '../util';
import { BUILDERS, CONSEQUENCE_LABELS, CONTEXTS, DEPLOY_OPTIONS, EXPERIENCE, HORIZONS, PRIORITIES, PROFILE_QUESTIONS, REQ_SOURCES, SCHOOL_QUESTIONS, SOLUTION_TYPES, type Choice, type ConsequenceKey, type Fact } from './catalog';
import { FIT_LABELS, deployFit, deployOf, deriveNeeds, designOf, implications, openPoints, planFor, relevantQuestions, solutionFit, solutionOf, DESIGN_STEP_LABELS } from './logic';

export const NO_REVIEW_NOTE = 'Požadavky v tomto návrhu nevycházejí ze systematické rešerše literatury. U každého je proto uvedeno, o co se opírá.';

const labelOf = (list: Choice[], id: string) => list.find((x) => x.id === id)?.label ?? '';
const orDash = (s: string) => (s.trim() ? s.trim() : '–');
const TODO_MARK = '[DOPLŇTE';
const todo = (what: string) => `${TODO_MARK}: ${what}]`;

export const priorityLabel = (id: string) => PRIORITIES.find((p) => p.id === id)?.label ?? '';
export const sourceLabel = (id: string) => REQ_SOURCES.find((s) => s.id === id)?.label ?? '';

export interface DesignDoc {
  title: string;
  blocks: Block[];
  /** Údaje se zdrojem, na které dokument odkazuje, v pořadí odkazů. */
  sources: Fact[];
}

/** Sestaví dokument „Návrh aplikace“ z rozhodnutí zapsaných v projektu. */
export function buildDesignDoc(project: Pick<Project, 'title' | 'design'>): DesignDoc {
  const d = designOf(project);
  const blocks: Block[] = [];
  const sources: Fact[] = [];
  const cite = (f: Fact): string => {
    let i = sources.findIndex((s) => s.source.url === f.source.url && s.text === f.text);
    if (i < 0) i = sources.push(f) - 1;
    return ` [${i + 1}]`;
  };
  const h = (text: string, level: 1 | 2 = 1) => blocks.push({ t: 'h', level, text });
  const p = (text: string) => blocks.push({ t: 'p', text });
  const item = (text: string) => blocks.push({ t: 'p', text: `– ${text}` });
  let tableNo = 0;
  const table = (caption: string, head: string[], rows: string[][]) => blocks.push({ t: 'table', caption: `Tabulka ${++tableNo}. ${caption}`, head, rows });

  // ---- Záměr
  const i = d.intent;
  h('Záměr');
  p(`Problém, který aplikace řeší: ${i.problem.trim() || todo('jaký problém aplikace řeší')}`);
  p(`Pro koho je určena: ${i.users.trim() || todo('cílová skupina')}`);
  if (i.goal.trim()) p(`Co s ní má uživatel dokázat: ${i.goal.trim()}`);
  if (i.success.trim()) p(`Podle čeho se pozná, že plní účel: ${i.success.trim()}`);
  table(
    'Okolnosti vzniku a provozu',
    ['Okolnost', 'Údaj'],
    [
      ['Rámec', orDash(labelOf(CONTEXTS, i.context))],
      ['Kdo aplikaci staví', orDash(labelOf(BUILDERS, i.builder))],
      ['Zkušenost s programováním', orDash(labelOf(EXPERIENCE, i.experience))],
      ['Jak dlouho má běžet', orDash(labelOf(HORIZONS, i.horizon))],
      ['Kdo se o ni postará po skončení projektu', orDash(i.maintainer)],
    ],
  );

  // ---- Požadavky
  const reqs = d.requirements.filter((r) => r.text.trim());
  h('Požadavky');
  p(NO_REVIEW_NOTE);
  if (reqs.length) {
    const ordered = [...reqs].sort((a, b) => PRIORITIES.findIndex((x) => x.id === a.priority) - PRIORITIES.findIndex((x) => x.id === b.priority));
    table(
      'Požadavky na aplikaci a jejich zdroj',
      ['Č.', 'Požadavek', 'Priorita', 'Zdroj'],
      ordered.map((r, k) => [`P${k + 1}`, r.text.trim(), priorityLabel(r.priority), r.source ? `${sourceLabel(r.source)}${r.sourceNote.trim() ? `: ${r.sourceNote.trim()}` : ''}` : 'neuveden']),
    );
    const assumed = reqs.filter((r) => r.source === 'assumption').length;
    const unsourced = reqs.filter((r) => !r.source).length;
    const notes: string[] = [];
    if (assumed) notes.push(`${plural(assumed, 'požadavek stojí', 'požadavky stojí', 'požadavků stojí')} na neověřeném předpokladu a ${assumed === 1 ? 'měl' : 'měly'} by se před stavbou ověřit u budoucích uživatelů`);
    if (unsourced) notes.push(`u ${plural(unsourced, 'požadavku', 'požadavků', 'požadavků')} zdroj uveden není`);
    if (notes.length) p(`${notes.join('; ').replace(/^./, (c) => c.toUpperCase())}.`);
  } else {
    blocks.push({ t: 'todo', text: todo('požadavky na aplikaci') });
  }

  // ---- Vlastnosti
  h('Vlastnosti aplikace');
  const answered = PROFILE_QUESTIONS.filter((q) => d.profile[q.id]);
  if (answered.length) {
    table(
      'Vlastnosti aplikace',
      ['Otázka', 'Odpověď'],
      PROFILE_QUESTIONS.map((q) => [q.label, labelOf(q.options, d.profile[q.id] ?? '') || 'nezodpovězeno']),
    );
    h('Co z vlastností plyne', 2);
    for (const imp of implications(d.profile)) {
      p(`${imp.title}. ${imp.text}${imp.reasons?.length ? ` Důvody: ${imp.reasons.map((r) => r.replace(/\.$/, '')).join('; ')}.` : ''}${imp.fact ? ` ${imp.fact.text}${cite(imp.fact)}` : ''}`);
    }
  } else {
    blocks.push({ t: 'todo', text: todo('vlastnosti aplikace') });
  }

  // ---- Typ řešení
  h('Typ řešení');
  const type = solutionOf(d.solution.type);
  if (type) {
    p(`Zvolený typ: ${type.name}. ${type.description}`);
    p(`Zdůvodnění volby: ${d.solution.why.trim() || todo('proč právě tento typ řešení')}`);
    if (d.solution.tech.trim()) p(`Zvolené technologie: ${d.solution.tech.trim()}`);
    h('Co z volby plyne', 2);
    p('Řešení umí:');
    type.can.forEach(item);
    p('Řešení neumí:');
    type.cannot.forEach(item);
    p('Co se často podcení:');
    type.underestimated.forEach(item);
    type.facts.forEach((f) => item(`${f.text}${cite(f)}`));
    p(`Potřebné dovednosti: ${type.skills}`);
    p(`Provoz: ${type.running}`);
  } else {
    blocks.push({ t: 'todo', text: todo('zvolený typ řešení') });
  }
  if (answered.length) {
    table(
      'Zvažované typy řešení',
      ['Typ řešení', 'Vhodnost', 'Důvody'],
      SOLUTION_TYPES.map((s) => {
        const f = solutionFit(s.id, d);
        return [`${s.name}${s.id === type?.id ? ' (zvoleno)' : ''}`, FIT_LABELS[f.level], f.reasons.join(' ') || '–'];
      }),
    );
  }

  // ---- Nasazení
  h('Nasazení a provoz');
  const place = deployOf(d.deploy.choice);
  const extras = d.deploy.extras.map(deployOf).filter((x) => x !== undefined && x.id !== place?.id) as NonNullable<ReturnType<typeof deployOf>>[];
  if (place) {
    p(`Zvolené místo provozu: ${place.name} (${place.examples}). ${place.description}`);
    p(`Zdůvodnění volby: ${d.deploy.why.trim() || todo('proč právě toto nasazení')}`);
    table(
      `Důsledky volby: ${place.name.toLowerCase()}`,
      ['Otázka', 'Odpověď'],
      (Object.keys(CONSEQUENCE_LABELS) as ConsequenceKey[]).map((k) => [CONSEQUENCE_LABELS[k], place.consequences[k]]),
    );
    p('Co se často podcení:');
    place.underestimated.forEach(item);
    place.facts.forEach((f) => item(`${f.text}${cite(f)}`));
  } else {
    blocks.push({ t: 'todo', text: todo('kde aplikace poběží') });
  }
  for (const e of extras) {
    h(`Doplněk: ${e.name.toLowerCase()}`, 2);
    p(e.description);
    e.underestimated.forEach(item);
    e.facts.forEach((f) => item(`${f.text}${cite(f)}`));
  }
  if (type || answered.length) {
    table(
      'Zvažované možnosti nasazení',
      ['Možnost', 'Vhodnost', 'Důvody'],
      DEPLOY_OPTIONS.map((o) => {
        const f = deployFit(o.id, d);
        const chosen = o.id === place?.id || extras.some((e) => e.id === o.id);
        return [`${o.name}${chosen ? ' (zvoleno)' : ''}`, FIT_LABELS[f.level], f.reasons.join(' ') || '–'];
      }),
    );
  }

  // ---- Škola a pravidla
  h('Škola a pravidla');
  const relevant = relevantQuestions(d);
  const others = SCHOOL_QUESTIONS.filter((q) => !relevant.includes(q) && d.school[q.id]?.trim());
  table(
    'Otázky pro školu a zjištěné odpovědi',
    ['Otázka', 'Odpověď'],
    [...relevant, ...others].map((q) => [q.question, d.school[q.id]?.trim() || 'nezjištěno']),
  );
  for (const q of relevant) if (q.fact) p(`${q.fact.text}${cite(q.fact)}`);
  const needs = deriveNeeds(d.profile);
  if (type?.id !== 'nocode') p(`Licence: ${d.rules.licence.trim() || todo('licence, pod kterou bude kód zveřejněn nebo předán')}`);
  if (needs.personal !== 'none') p(`Zpracování osobních údajů: ${d.rules.dataNote.trim() || todo('jaké údaje, proč, kde a jak dlouho')}`);
  p(`Po obhajobě: ${d.rules.handover.trim() || todo('kdo aplikaci převezme, nebo kdy a jak se vypne')}`);

  // ---- Plán
  h('Plán etap');
  const stages = planFor(d);
  table(
    'Etapy stavby',
    ['Č.', 'Etapa', 'Hotovo, když', 'Stav'],
    stages.map((s, k) => [String(k + 1), s.title, s.doneWhen, d.plan[s.id]?.done ? 'hotovo' : d.plan[s.id]?.note.trim() ? `rozpracováno: ${d.plan[s.id].note.trim()}` : 'čeká']),
  );

  // ---- Otevřené body
  const open = openPoints(d);
  h('Otevřené body');
  if (open.length) open.forEach((o) => item(`${DESIGN_STEP_LABELS[o.step]}: ${o.text}`));
  else p('Všechna rozhodnutí, která průvodce sleduje, jsou zapsána.');

  // ---- Zdroje
  if (sources.length) {
    h('Zdroje údajů');
    p('Údaje o podmínkách poskytovatelů a o předpisech se mění. U každého je uvedeno, kdy byl naposledy ověřen; před rozhodnutím ho zkontrolujte u zdroje.');
    sources.forEach((f, k) => blocks.push({ t: 'ref', spans: [{ text: `[${k + 1}] ${f.source.label}. ${f.source.url} (ověřeno ${formatDate(f.verified)})`, italic: false }] }));
  }

  return { title: project.title, blocks, sources };
}

// ---- Zadání pro toho, kdo bude stavět -----------------------------------------------------------

/** Stručné zadání ve formátu Markdown pro vývojáře nebo nástroj AI. */
export function designBrief(project: Pick<Project, 'title' | 'design'>): string {
  const d: DesignState = designOf(project);
  const out: string[] = [`# Zadání: ${project.title}`, ''];
  const i = d.intent;

  out.push('## Účel');
  if (i.problem.trim()) out.push(`- Problém: ${i.problem.trim()}`);
  if (i.users.trim()) out.push(`- Uživatelé: ${i.users.trim()}`);
  if (i.goal.trim()) out.push(`- Cíl uživatele: ${i.goal.trim()}`);
  if (i.success.trim()) out.push(`- Měřítko úspěchu: ${i.success.trim()}`);
  out.push('');

  out.push('## Požadavky');
  const reqs = d.requirements.filter((r) => r.text.trim());
  for (const pr of PRIORITIES) {
    const list = reqs.filter((r) => r.priority === pr.id);
    if (!list.length) continue;
    out.push(`${pr.label} (${pr.hint}):`);
    list.forEach((r) => out.push(`- ${r.text.trim()}`));
    out.push('');
  }
  if (!reqs.length) out.push('- (zatím nezapsány)', '');

  out.push('## Rozhodnutí, která je potřeba dodržet');
  const type = solutionOf(d.solution.type);
  const place = deployOf(d.deploy.choice);
  const needs = deriveNeeds(d.profile);
  if (type) out.push(`- Typ řešení: ${type.name}.${d.solution.why.trim() ? ` Důvod: ${d.solution.why.trim()}` : ''}`);
  if (d.solution.tech.trim()) out.push(`- Technologie: ${d.solution.tech.trim()}`);
  if (place) out.push(`- Provoz: ${place.name} (${place.examples}).${d.deploy.why.trim() ? ` Důvod: ${d.deploy.why.trim()}` : ''}`);
  const extras = d.deploy.extras.map(deployOf).filter((x) => x && x.id !== place?.id);
  if (extras.length) out.push(`- Navíc: ${extras.map((e) => e!.name.toLowerCase()).join(', ')}.`);
  if (d.rules.licence.trim()) out.push(`- Licence: ${d.rules.licence.trim()}`);
  if (needs.personal !== 'none' && d.rules.dataNote.trim()) out.push(`- Osobní údaje: ${d.rules.dataNote.trim()}`);
  out.push('');

  const answered = PROFILE_QUESTIONS.filter((q) => d.profile[q.id]);
  if (answered.length) {
    out.push('## Vlastnosti aplikace');
    answered.forEach((q) => out.push(`- ${q.label} ${labelOf(q.options, d.profile[q.id])}`));
    out.push('');
  }

  out.push('## Čemu se vyhnout');
  out.push('- Nepřidávat funkce, které nejsou v požadavcích.');
  if (type?.id === 'static') out.push('- Neposílat data uživatele mimo jeho zařízení a nepřidávat server.', '- Nabídnout uživateli export a opětovné načtení dat.');
  if (!needs.server.length && type && type.id !== 'static') out.push('- Podle vlastností aplikace server potřeba není; ověřit, zda je zvolený typ řešení nutný.');
  out.push('- Neukládat do kódu ani do repozitáře žádné tajné klíče a hesla.');
  if (needs.personal !== 'none') out.push('- Nezpracovávat jiné osobní údaje, než jsou uvedeny výše.');
  out.push('- Každou změnu nasadit stejným postupem na cílové místo a vyzkoušet ji tam.');
  out.push('');

  out.push('## Postup');
  planFor(d).forEach((s, k) => out.push(`${k + 1}. ${s.title} – hotovo, když: ${s.doneWhen}`));
  out.push('');

  const open = openPoints(d);
  if (open.length) {
    out.push('## Otevřené body');
    open.forEach((o) => out.push(`- ${DESIGN_STEP_LABELS[o.step]}: ${o.text}`));
    out.push('');
  }
  return out.join('\n').trim() + '\n';
}
