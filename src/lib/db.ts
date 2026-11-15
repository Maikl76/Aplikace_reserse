// Úložiště v prohlížeči (IndexedDB přes knihovnu Dexie). Data neopouštějí počítač uživatele;
// přenos mezi počítači a zálohování řeší export a import souboru JSON.

import Dexie, { type Table } from 'dexie';
import { newDesign, normalizeDesign } from './design/logic';
import { DEFAULT_EXCLUDE_REASONS, REVIEW_TYPES, defaultFields } from './reviewTypes';
import { consensus1, consensus2, defaultTeam, shareKey } from './reviewers';
import type { BibRecord, DesignState, EffectInput, Project, ProjectBackup, RecordItem, Requirement, ReviewType, Screen1, SearchRun, StoredFile, Vote2, VotesFile } from './types';
import { nowIso, uid } from './util';

class AppDB extends Dexie {
  projects!: Table<Project, string>;
  records!: Table<RecordItem, string>;
  files!: Table<StoredFile, string>;
  settings!: Table<{ key: string; value: string }, string>;
  /** Odkazy na soubory na disku pro průběžné ukládání (rozhraní File System Access). */
  handles!: Table<{ key: string; handle: unknown }, string>;

  constructor() {
    super('pruvodce-prehledy');
    this.version(1).stores({
      projects: 'id, updatedAt',
      records: 'id, projectId',
      files: 'id, projectId, recordId',
      settings: 'key',
    });
    // Verze 2: více efektů na studii, hlasy dvou hodnotitelů, odkazy na soubory.
    this.version(2)
      .stores({
        projects: 'id, updatedAt',
        records: 'id, projectId',
        files: 'id, projectId, recordId',
        settings: 'key',
        handles: 'key',
      })
      .upgrade(async (tx) => {
        await tx.table('projects').toCollection().modify((p) => Object.assign(p, normalizeProject(p)));
        await tx.table('records').toCollection().modify((r) => Object.assign(r, normalizeRecord(r)));
      });
    // Verze 3: projekt má části (rešerše, návrh aplikace); dosavadní projekty jsou rešerše.
    this.version(3).upgrade(async (tx) => {
      await tx.table('projects').toCollection().modify((p) => Object.assign(p, normalizeProject(p)));
    });
  }
}

export const db = new AppDB();

// ---- Převod starších dat ---------------------------------------------------------

/** Doplní projektu části, které ve starší verzi dat chyběly. */
export function normalizeProject(p: Project): Project {
  const base = newProject(p.type, p.title);
  return {
    ...base,
    ...p,
    shareId: p.shareId || p.id,
    protocol: { ...base.protocol, ...p.protocol },
    synthesis: { ...base.synthesis, ...p.synthesis },
    manuscript: { ...base.manuscript, ...p.manuscript },
    team: p.team?.reviewers?.length === 2 ? p.team : base.team,
    parts: p.parts ?? base.parts,
    ...(p.design || p.parts?.design ? { design: normalizeDesign(p.design) } : {}),
  };
}

/** Doplní záznamu chybějící části; efekty převede na seznam (dříve jeden efekt na výstup). */
export function normalizeRecord(r: RecordItem): RecordItem {
  const effects: Record<string, EffectInput[]> = {};
  for (const [id, value] of Object.entries((r.effects ?? {}) as Record<string, EffectInput | EffectInput[]>)) {
    effects[id] = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  }
  return { ...r, effects, votes1: r.votes1 ?? {}, votes2: r.votes2 ?? {} };
}

// ---- Projekty --------------------------------------------------------------

export function newProject(type: ReviewType, title: string): Project {
  const conf = REVIEW_TYPES[type];
  const now = nowIso();
  const id = uid();
  return {
    id,
    shareId: id,
    title: title.trim() || conf.name,
    type,
    createdAt: now,
    updatedAt: now,
    question: { framework: conf.framework, elements: {}, text: '', aim: '', rationale: '' },
    protocol: {
      include: '',
      exclude: '',
      excludeReasons: DEFAULT_EXCLUDE_REASONS,
      yearFrom: '',
      yearTo: '',
      languages: '',
      designs: '',
      sources: '',
      registration: '',
      reviewers: '',
      highlightInclude: '',
      highlightExclude: '',
    },
    blocks: [],
    searches: [],
    notDuplicates: [],
    fields: defaultFields(type),
    outcomes: [],
    qualityTool: conf.qualityTools[0] ?? '',
    customQualityItems: '',
    synthesis: { themes: [], narrative: '', model: 'random', tau2: 'REML', knha: false, subgroupField: '', dependence: 'aggregate', rho: 0.6, moderators: [], chartFields: [], grade: {} },
    manuscript: { template: 'bachelor', style: 'apa', author: '', supervisor: '', institution: '', year: String(new Date().getFullYear()), keywords: '', sections: {} },
    checklist: {},
    done: {},
    team: defaultTeam(),
    parts: { review: true, design: false },
  };
}

export async function createProject(type: ReviewType, title: string): Promise<Project> {
  const project = newProject(type, title);
  await db.projects.add(project);
  return project;
}

/** Projekt, který obsahuje jen návrh aplikace (bez rešerše). */
export function newDesignProject(title: string): Project {
  return { ...newProject('narrative', title.trim() || 'Návrh aplikace'), parts: { review: false, design: true }, design: newDesign() };
}

export async function createDesignProject(title: string): Promise<Project> {
  const project = newDesignProject(title);
  await db.projects.add(project);
  return project;
}

/** Části projektu; u starších dat bez tohoto údaje jde o rešerši. */
export const partsOf = (p: Pick<Project, 'parts'>) => p.parts ?? { review: true, design: false };

type DesignObjectKey = 'intent' | 'solution' | 'deploy' | 'rules' | 'profile' | 'school';

/** Sloučí změny do jedné části návrhu aplikace; čte se čerstvý stav, takže se souběžné úpravy nepřepíšou. */
export async function mergeDesign<K extends DesignObjectKey>(id: string, key: K, partial: Partial<DesignState[K]>): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      const design = normalizeDesign(p.design);
      p.design = { ...design, [key]: { ...design[key], ...partial } };
      p.updatedAt = nowIso();
    });
}

/** Změní jednoduché položky návrhu (autor, instituce). */
export async function patchDesign(id: string, partial: Partial<Pick<DesignState, 'author' | 'institution'>>): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      p.design = { ...normalizeDesign(p.design), ...partial };
      p.updatedAt = nowIso();
    });
}

export async function addRequirement(id: string): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      const design = normalizeDesign(p.design);
      p.design = { ...design, requirements: [...design.requirements, { id: uid(), text: '', priority: 'must', source: '', sourceNote: '' }] };
      p.updatedAt = nowIso();
    });
}

export async function patchRequirement(id: string, reqId: string, partial: Partial<Requirement>): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      const design = normalizeDesign(p.design);
      p.design = { ...design, requirements: design.requirements.map((r) => (r.id === reqId ? { ...r, ...partial } : r)) };
      p.updatedAt = nowIso();
    });
}

export async function removeRequirement(id: string, reqId: string): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      const design = normalizeDesign(p.design);
      p.design = { ...design, requirements: design.requirements.filter((r) => r.id !== reqId) };
      p.updatedAt = nowIso();
    });
}

/** Zapíše stav jedné etapy plánu (hotovo, poznámka). */
export async function setStage(id: string, stageId: string, partial: Partial<{ done: boolean; note: string }>): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      const design = normalizeDesign(p.design);
      p.design = { ...design, plan: { ...design.plan, [stageId]: { ...(design.plan[stageId] ?? { done: false, note: '' }), ...partial } } };
      p.updatedAt = nowIso();
    });
}

/** Uloží změny projektu. Vnořené objekty se předávají celé. */
export async function patchProject(id: string, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: nowIso() });
}

type NestedKey = 'question' | 'protocol' | 'synthesis' | 'manuscript';

/** Sloučí změny do vnořené části projektu; čte se čerstvý stav, takže se souběžné úpravy nepřepíšou. */
export async function mergeProject<K extends NestedKey>(id: string, key: K, partial: Partial<Project[K]>): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      p[key] = { ...p[key], ...partial };
      p.updatedAt = nowIso();
    });
}

/** Uloží vlastní znění jednoho oddílu textu práce (prázdný text = vrátit vygenerovaný). */
export async function setSectionText(id: string, sectionId: string, text: string): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      p.manuscript = { ...p.manuscript, sections: { ...p.manuscript.sections, [sectionId]: text } };
      p.updatedAt = nowIso();
    });
}

/** Uloží hodnocení GRADE jednoho výstupu. */
export async function setGrade(id: string, outcomeId: string, rating: Project['synthesis']['grade'][string] | null): Promise<void> {
  await db.projects
    .where('id')
    .equals(id)
    .modify((p) => {
      const grade = { ...p.synthesis.grade };
      if (rating) grade[outcomeId] = rating;
      else delete grade[outcomeId];
      p.synthesis = { ...p.synthesis, grade };
      p.updatedAt = nowIso();
    });
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.records, db.files, async () => {
    await db.records.where('projectId').equals(id).delete();
    await db.files.where('projectId').equals(id).delete();
    await db.projects.delete(id);
  });
}

// ---- Záznamy ---------------------------------------------------------------

export function toRecord(bib: BibRecord, projectId: string, search: Pick<SearchRun, 'id' | 'source'>): RecordItem {
  return {
    ...bib,
    id: uid(),
    projectId,
    searchId: search.id,
    source: search.source,
    duplicateOf: null,
    screen1: 'pending',
    fulltext: 'pending',
    screen2: 'pending',
    excludeReason: '',
    votes1: {},
    votes2: {},
    extraction: {},
    effects: {},
    quality: {},
    qualityOverall: '',
    qualityNote: '',
    themes: [],
    primaryStudies: '',
    notes: '',
    addedAt: nowIso(),
  };
}

/** Přidá záznamy z jednoho hledání a zapíše hledání do deníku. */
export async function addSearchResults(project: Project, run: Omit<SearchRun, 'id' | 'date' | 'imported'>, bibs: BibRecord[]): Promise<SearchRun> {
  const search: SearchRun = { ...run, id: uid(), date: nowIso(), imported: bibs.length };
  await db.transaction('rw', db.projects, db.records, async () => {
    await db.records.bulkAdd(bibs.map((b) => toRecord(b, project.id, search)));
    const fresh = await db.projects.get(project.id);
    await db.projects.update(project.id, { searches: [...(fresh?.searches ?? []), search], updatedAt: nowIso() });
  });
  return search;
}

export const MANUAL_SOURCE = 'Jiné zdroje (ručně)';

/** Přidá jeden ručně zapsaný záznam; všechny ruční záznamy sdílejí jeden řádek deníku. */
export async function addManualRecord(project: Project, bib: BibRecord): Promise<void> {
  const fresh = await db.projects.get(project.id);
  const existing = fresh?.searches.find((s) => s.via === 'manual' && s.source === MANUAL_SOURCE);
  if (!existing) {
    await addSearchResults(project, { source: MANUAL_SOURCE, via: 'manual', query: 'Záznamy doplněné ručně (seznamy literatury, doporučení, šedá literatura).', hits: null, note: '' }, [bib]);
    return;
  }
  await db.transaction('rw', db.projects, db.records, async () => {
    await db.records.add(toRecord(bib, project.id, existing));
    const now = await db.projects.get(project.id);
    await db.projects.update(project.id, { searches: (now?.searches ?? []).map((s) => (s.id === existing.id ? { ...s, imported: s.imported + 1 } : s)), updatedAt: nowIso() });
  });
}

/** Odstraní hledání z deníku včetně záznamů, které přineslo. */
export async function removeSearch(project: Project, searchId: string): Promise<void> {
  await db.transaction('rw', db.projects, db.records, db.files, async () => {
    const records = await db.records.where('projectId').equals(project.id).toArray();
    const gone = new Set(records.filter((r) => r.searchId === searchId).map((r) => r.id));
    await db.records.bulkDelete([...gone]);
    // Duplicity, jejichž ponechaný záznam mizí, se vracejí mezi samostatné záznamy.
    const orphans = records.filter((r) => !gone.has(r.id) && r.duplicateOf && gone.has(r.duplicateOf));
    for (const o of orphans) await db.records.update(o.id, { duplicateOf: null });
    for (const id of gone) await db.files.where('recordId').equals(id).delete();
    const fresh = await db.projects.get(project.id);
    await db.projects.update(project.id, { searches: (fresh?.searches ?? []).filter((s) => s.id !== searchId), updatedAt: nowIso() });
  });
}

export async function patchRecord(id: string, patch: Partial<RecordItem>): Promise<void> {
  await db.records.update(id, patch);
}

/** Sloučí hodnoty do slovníku uvnitř záznamu (extrakce, hodnocení kvality). */
export async function mergeRecord(id: string, key: 'extraction' | 'quality', partial: Record<string, string>): Promise<void> {
  await db.records
    .where('id')
    .equals(id)
    .modify((r) => {
      r[key] = { ...r[key], ...partial };
    });
}

/** Uloží vstupní čísla jednoho efektu (řádku) daného výstupu. */
export async function mergeEffect(id: string, outcomeId: string, index: number, partial: EffectInput): Promise<void> {
  await db.records
    .where('id')
    .equals(id)
    .modify((r) => {
      const rows = [...(r.effects[outcomeId] ?? [])];
      while (rows.length <= index) rows.push({});
      rows[index] = { ...rows[index], ...partial };
      r.effects = { ...r.effects, [outcomeId]: rows };
    });
}

/** Přidá studii další efekt téhož výstupu (jiný časový bod, podskupina, další rameno). */
export async function addEffect(id: string, outcomeId: string): Promise<void> {
  await db.records
    .where('id')
    .equals(id)
    .modify((r) => {
      const rows = [...(r.effects[outcomeId] ?? [])];
      if (rows.length === 0) rows.push({});
      rows.push({});
      r.effects = { ...r.effects, [outcomeId]: rows };
    });
}

export async function removeEffect(id: string, outcomeId: string, index: number): Promise<void> {
  await db.records
    .where('id')
    .equals(id)
    .modify((r) => {
      r.effects = { ...r.effects, [outcomeId]: (r.effects[outcomeId] ?? []).filter((_, i) => i !== index) };
    });
}

// ---- Dva hodnotitelé -------------------------------------------------------------

/** Zapíše rozhodnutí hodnotitele při třídění podle abstraktu a přepočítá výsledné rozhodnutí. */
export async function castVote1(project: Pick<Project, 'team'>, recordId: string, reviewerId: string, value: Screen1): Promise<void> {
  await db.records
    .where('id')
    .equals(recordId)
    .modify((r) => {
      const votes = { ...r.votes1 };
      if (value === 'pending') delete votes[reviewerId];
      else votes[reviewerId] = value;
      r.votes1 = votes;
      r.screen1 = consensus1(r, project.team.reviewers);
    });
}

/** Zapíše rozhodnutí hodnotitele o plném textu a přepočítá výsledné rozhodnutí. */
export async function castVote2(project: Pick<Project, 'team'>, recordId: string, reviewerId: string, vote: Vote2): Promise<void> {
  await db.records
    .where('id')
    .equals(recordId)
    .modify((r) => {
      const votes = { ...r.votes2 };
      if (vote.decision === 'pending') delete votes[reviewerId];
      else votes[reviewerId] = vote;
      r.votes2 = votes;
      const c = consensus2(r, project.team.reviewers);
      r.screen2 = c.decision;
      r.excludeReason = c.reason;
      if (vote.decision !== 'pending' && r.fulltext === 'pending') r.fulltext = 'retrieved';
    });
}

/**
 * Přepne mezi jedním a dvěma hodnotiteli. Při zapnutí se dosavadní rozhodnutí stanou hlasy
 * prvního hodnotitele a čekají na druhého; při vypnutí se hlasy prvního hodnotitele stanou
 * výsledným rozhodnutím tam, kde shoda ještě nevznikla.
 */
export async function setDoubleMode(project: Project, double: boolean): Promise<void> {
  const [first] = project.team.reviewers;
  const team = { ...project.team, double };
  await db.transaction('rw', db.projects, db.records, async () => {
    await db.projects.update(project.id, { team, updatedAt: nowIso() });
    await db.records
      .where('projectId')
      .equals(project.id)
      .modify((r) => {
        if (double) {
          if (r.screen1 !== 'pending' && !Object.keys(r.votes1).length) r.votes1 = { [first.id]: r.screen1 };
          if (r.screen2 !== 'pending' && !Object.keys(r.votes2).length) r.votes2 = { [first.id]: { decision: r.screen2, reason: r.excludeReason } };
          r.screen1 = consensus1(r, team.reviewers);
          const c = consensus2(r, team.reviewers);
          r.screen2 = c.decision;
          r.excludeReason = c.reason;
        } else {
          if (r.screen1 === 'pending' && r.votes1[first.id]) r.screen1 = r.votes1[first.id];
          if (r.screen2 === 'pending' && r.votes2[first.id]) {
            r.screen2 = r.votes2[first.id].decision;
            r.excludeReason = r.votes2[first.id].reason;
          }
        }
      });
  });
}

/** Rozhodnutí jednoho hodnotitele jako soubor k odeslání druhému (hlavnímu) hodnotiteli. */
export async function exportVotes(projectId: string, reviewerId: string): Promise<VotesFile> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Projekt nenalezen.');
  const reviewer = project.team.reviewers.find((x) => x.id === reviewerId);
  if (!reviewer) throw new Error('Hodnotitel v projektu není.');
  const records = await db.records.where('projectId').equals(projectId).toArray();
  const votes1: VotesFile['votes1'] = {};
  const votes2: VotesFile['votes2'] = {};
  for (const r of records) {
    if (r.votes1[reviewerId]) votes1[shareKey(r)] = r.votes1[reviewerId];
    if (r.votes2[reviewerId]) votes2[shareKey(r)] = r.votes2[reviewerId];
  }
  return { format: 'pruvodce-prehledy-rozhodnuti', version: 1, exportedAt: nowIso(), shareId: project.shareId, projectTitle: project.title, reviewer, votes1, votes2 };
}

export interface VotesImport {
  reviewer: string;
  stage1: number;
  stage2: number;
  /** Rozhodnutí, ke kterým se v projektu nenašel záznam. */
  unknown: number;
}

/** Načte rozhodnutí druhého hodnotitele do projektu a přepočítá výsledná rozhodnutí. */
export async function importVotes(projectId: string, data: unknown): Promise<VotesImport> {
  const file = data as VotesFile;
  if (!file || file.format !== 'pruvodce-prehledy-rozhodnuti' || !file.reviewer) throw new Error('Soubor neobsahuje rozhodnutí hodnotitele z této aplikace.');
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Projekt nenalezen.');
  if (file.shareId !== project.shareId) throw new Error(`Soubor patří k jinému projektu („${file.projectTitle}“).`);
  const reviewer = project.team.reviewers.find((x) => x.id === file.reviewer.id);
  if (!reviewer) throw new Error('Hodnotitel ze souboru v tomto projektu není. Balíček pro druhého hodnotitele vytvořte znovu.');
  const out: VotesImport = { reviewer: reviewer.name, stage1: 0, stage2: 0, unknown: 0 };
  const seen = new Set<string>();
  await db.transaction('rw', db.projects, db.records, async () => {
    await db.records
      .where('projectId')
      .equals(projectId)
      .modify((r) => {
        const key = shareKey(r);
        const v1 = file.votes1?.[key] ?? file.votes1?.[r.id];
        const v2 = file.votes2?.[key] ?? file.votes2?.[r.id];
        if (v1) {
          r.votes1 = { ...r.votes1, [reviewer.id]: v1 };
          r.screen1 = consensus1(r, project.team.reviewers);
          out.stage1++;
          seen.add(`1:${key}`);
        }
        if (v2) {
          r.votes2 = { ...r.votes2, [reviewer.id]: v2 };
          const c = consensus2(r, project.team.reviewers);
          r.screen2 = c.decision;
          r.excludeReason = c.reason;
          if (r.fulltext === 'pending') r.fulltext = 'retrieved';
          out.stage2++;
          seen.add(`2:${key}`);
        }
      });
    await db.projects.update(projectId, { updatedAt: nowIso() });
  });
  out.unknown = Object.keys(file.votes1 ?? {}).length + Object.keys(file.votes2 ?? {}).length - seen.size;
  return out;
}

// ---- Soubory plných textů ---------------------------------------------------

export async function attachFile(projectId: string, recordId: string, file: File): Promise<void> {
  await db.transaction('rw', db.files, async () => {
    await db.files.where('recordId').equals(recordId).delete();
    await db.files.add({ id: uid(), projectId, recordId, name: file.name, blob: file });
  });
}

// ---- Záloha ----------------------------------------------------------------

export async function exportBackup(projectId: string): Promise<ProjectBackup> {
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Projekt nenalezen.');
  const records = await db.records.where('projectId').equals(projectId).toArray();
  return { format: 'pruvodce-prehledy', version: 3, exportedAt: nowIso(), project, records };
}

/**
 * Kopie projektu pro druhého hodnotitele: obsahuje záznamy a jeho vlastní rozhodnutí,
 * ne však rozhodnutí ostatních – aby třídil nezávisle.
 */
export async function exportReviewerPackage(projectId: string, reviewerId: string): Promise<ProjectBackup> {
  const backup = await exportBackup(projectId);
  const own = <T,>(votes: Record<string, T>) => (votes[reviewerId] ? { [reviewerId]: votes[reviewerId] } : {});
  return {
    ...backup,
    project: { ...backup.project, reviewerCopy: reviewerId },
    records: backup.records.map((r) => ({ ...r, votes1: own(r.votes1), votes2: own(r.votes2), notes: '' })),
  };
}

/** Načte zálohu jako nový projekt (původní se nepřepisuje). */
export async function importBackup(data: unknown): Promise<Project> {
  const backup = data as ProjectBackup;
  if (!backup || backup.format !== 'pruvodce-prehledy' || !backup.project || !Array.isArray(backup.records)) {
    throw new Error('Soubor není zálohou z této aplikace.');
  }
  // Chybějící části (starší verze zálohy) se doplní výchozími hodnotami; stálé označení projektu zůstává.
  const project: Project = { ...normalizeProject(backup.project), id: uid(), updatedAt: nowIso() };
  const idMap = new Map(backup.records.map((r) => [r.id, uid()]));
  const records = backup.records.map((r) => ({
    ...toRecord(r, project.id, { id: r.searchId, source: r.source }),
    ...normalizeRecord(r),
    id: idMap.get(r.id)!,
    // Původní id zůstává, aby šla zpět spárovat rozhodnutí druhého hodnotitele.
    originId: r.originId ?? r.id,
    projectId: project.id,
    duplicateOf: r.duplicateOf ? idMap.get(r.duplicateOf) ?? null : null,
  }));
  await db.transaction('rw', db.projects, db.records, async () => {
    await db.projects.add(project);
    await db.records.bulkAdd(records);
  });
  return project;
}

// ---- Nastavení -------------------------------------------------------------

export async function getSetting(key: string): Promise<string> {
  return (await db.settings.get(key))?.value ?? '';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}
