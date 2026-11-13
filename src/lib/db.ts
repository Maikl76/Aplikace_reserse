// Úložiště v prohlížeči (IndexedDB přes knihovnu Dexie). Data neopouštějí počítač uživatele;
// přenos mezi počítači a zálohování řeší export a import souboru JSON.

import Dexie, { type Table } from 'dexie';
import { DEFAULT_EXCLUDE_REASONS, REVIEW_TYPES, defaultFields } from './reviewTypes';
import type { BibRecord, Project, ProjectBackup, RecordItem, ReviewType, SearchRun, StoredFile } from './types';
import { nowIso, uid } from './util';

class AppDB extends Dexie {
  projects!: Table<Project, string>;
  records!: Table<RecordItem, string>;
  files!: Table<StoredFile, string>;
  settings!: Table<{ key: string; value: string }, string>;

  constructor() {
    super('pruvodce-prehledy');
    this.version(1).stores({
      projects: 'id, updatedAt',
      records: 'id, projectId',
      files: 'id, projectId, recordId',
      settings: 'key',
    });
  }
}

export const db = new AppDB();

// ---- Projekty --------------------------------------------------------------

export function newProject(type: ReviewType, title: string): Project {
  const conf = REVIEW_TYPES[type];
  const now = nowIso();
  return {
    id: uid(),
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
    synthesis: { themes: [], narrative: '', model: 'random', tau2: 'REML', knha: false, subgroupField: '', chartFields: [], grade: {} },
    manuscript: { template: 'bachelor', style: 'apa', author: '', supervisor: '', institution: '', year: String(new Date().getFullYear()), keywords: '', sections: {} },
    checklist: {},
    done: {},
  };
}

export async function createProject(type: ReviewType, title: string): Promise<Project> {
  const project = newProject(type, title);
  await db.projects.add(project);
  return project;
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

/** Uloží vstupní čísla jednoho výstupu pro metaanalýzu. */
export async function mergeEffect(id: string, outcomeId: string, partial: Record<string, string>): Promise<void> {
  await db.records
    .where('id')
    .equals(id)
    .modify((r) => {
      r.effects = { ...r.effects, [outcomeId]: { ...(r.effects[outcomeId] ?? {}), ...partial } };
    });
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
  return { format: 'pruvodce-prehledy', version: 1, exportedAt: nowIso(), project, records };
}

/** Načte zálohu jako nový projekt (původní se nepřepisuje). */
export async function importBackup(data: unknown): Promise<Project> {
  const backup = data as ProjectBackup;
  if (!backup || backup.format !== 'pruvodce-prehledy' || !backup.project || !Array.isArray(backup.records)) {
    throw new Error('Soubor není zálohou z této aplikace.');
  }
  const base = newProject(backup.project.type, backup.project.title);
  // Chybějící části (starší verze zálohy) se doplní výchozími hodnotami.
  const project: Project = {
    ...base,
    ...backup.project,
    id: base.id,
    protocol: { ...base.protocol, ...backup.project.protocol },
    synthesis: { ...base.synthesis, ...backup.project.synthesis },
    manuscript: { ...base.manuscript, ...backup.project.manuscript },
    updatedAt: nowIso(),
  };
  const idMap = new Map(backup.records.map((r) => [r.id, uid()]));
  const records = backup.records.map((r) => ({
    ...toRecord(r, project.id, { id: r.searchId, source: r.source }),
    ...r,
    id: idMap.get(r.id)!,
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
