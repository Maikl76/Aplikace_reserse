// Datový model aplikace. Projekt = jeden přehled; záznam = jedna nalezená publikace.

export type ReviewType = 'narrative' | 'scoping' | 'systematic' | 'meta' | 'umbrella';

export type StepId =
  | 'question'
  | 'protocol'
  | 'search'
  | 'dedup'
  | 'screen1'
  | 'screen2'
  | 'extract'
  | 'quality'
  | 'synthesis'
  | 'flow'
  | 'write'
  | 'checklist';

export interface Author {
  family: string;
  given: string;
}

// ---- Výzkumná otázka -------------------------------------------------------

export type Framework = 'PICO' | 'PCC' | 'free';

export interface Question {
  framework: Framework;
  /** Prvky rámce (P, I, C, O nebo P, C, C) – klíč je id prvku. */
  elements: Record<string, string>;
  /** Výsledné znění otázky. */
  text: string;
  /** Cíl přehledu jednou až dvěma větami. */
  aim: string;
  /** Proč je přehled potřeba (zdůvodnění). */
  rationale: string;
}

// ---- Protokol --------------------------------------------------------------

export interface Protocol {
  include: string; // kritéria zařazení, jedno na řádek
  exclude: string; // kritéria vyřazení, jedno na řádek
  /** Důvody vyřazení nabízené při posuzování plných textů, jeden na řádek. */
  excludeReasons: string;
  yearFrom: string;
  yearTo: string;
  languages: string;
  designs: string;
  /** Plánované zdroje (databáze, šedá literatura…), jeden na řádek. */
  sources: string;
  registration: string;
  /** Volný popis toho, kdo vybírá a hodnotí (objeví se v metodice). */
  reviewers: string;
  /** Slova zvýrazněná při třídění zeleně / červeně, oddělená čárkou. */
  highlightInclude: string;
  highlightExclude: string;
}

// ---- Vyhledávání -----------------------------------------------------------

export type Vocab = 'free' | 'mesh' | 'eric';

export interface Term {
  text: string;
  /** free = volný text (název/abstrakt); mesh/eric = řízený slovník dané databáze. */
  vocab: Vocab;
}

export interface ConceptBlock {
  id: string;
  label: string;
  terms: Term[];
}

export interface SearchRun {
  id: string;
  source: string;
  /** api = staženo aplikací; file = import souboru; manual = ruční zápis do deníku. */
  via: 'api' | 'file' | 'manual';
  date: string;
  query: string;
  /** Počet výsledků, který databáze ohlásila. */
  hits: number | null;
  /** Počet záznamů skutečně uložených do projektu. */
  imported: number;
  note: string;
}

// ---- Záznamy ---------------------------------------------------------------

export type Screen1 = 'pending' | 'include' | 'maybe' | 'exclude';
export type Screen2 = 'pending' | 'include' | 'exclude';
export type Fulltext = 'pending' | 'retrieved' | 'notRetrieved';

/** Rozhodnutí jednoho hodnotitele o plném textu. */
export interface Vote2 {
  decision: Screen2;
  reason: string;
}

/**
 * Vstupní čísla jednoho efektu (např. průměry, SD a n obou skupin). Klíče začínající
 * podtržítkem nesou doplňující údaje: `_label` označení efektu (časový bod, podskupina),
 * `_t1` a `_t2` názvy srovnávaných léčeb u síťové metaanalýzy.
 */
export type EffectInput = Record<string, string>;

export interface RecordItem {
  id: string;
  projectId: string;
  searchId: string;
  source: string;
  title: string;
  authors: Author[];
  year: number | null;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  pmid: string;
  url: string;
  abstract: string;
  keywords: string[];
  language: string;
  pubType: string;
  /** Id záznamu, se kterým byl tento sloučen jako duplicita. */
  duplicateOf: string | null;
  /** Výsledné rozhodnutí; při dvou hodnotitelích shoda obou nebo vyřešená neshoda. */
  screen1: Screen1;
  fulltext: Fulltext;
  screen2: Screen2;
  excludeReason: string;
  /** Rozhodnutí jednotlivých hodnotitelů při třídění podle abstraktu: id hodnotitele → rozhodnutí. */
  votes1: Record<string, Screen1>;
  /** Rozhodnutí jednotlivých hodnotitelů o plném textu. */
  votes2: Record<string, Vote2>;
  /** Id záznamu v projektu, ze kterého byl načten – podle něj se párují rozhodnutí druhého hodnotitele. */
  originId?: string;
  /** Extrahovaná data: id pole → hodnota. */
  extraction: Record<string, string>;
  /** Data pro metaanalýzu: id výstupu → jeden nebo více efektů ze studie. */
  effects: Record<string, EffectInput[]>;
  /** Hodnocení kvality: id položky → id úrovně. */
  quality: Record<string, string>;
  qualityOverall: string;
  /** Zdůvodnění hodnocení kvality. */
  qualityNote: string;
  /** Témata (id), ke kterým studie přispívá. */
  themes: string[];
  /** Zastřešující přehled: primární studie zahrnuté v tomto přehledu, jedna na řádek. */
  primaryStudies: string;
  notes: string;
  addedAt: string;
}

/** Bibliografická část záznamu – to, co vrací importy a vyhledávání. */
export type BibRecord = Pick<
  RecordItem,
  | 'title'
  | 'authors'
  | 'year'
  | 'journal'
  | 'volume'
  | 'issue'
  | 'pages'
  | 'doi'
  | 'pmid'
  | 'url'
  | 'abstract'
  | 'keywords'
  | 'language'
  | 'pubType'
>;

// ---- Extrakce, výstupy, kvalita -------------------------------------------

export interface FieldDef {
  id: string;
  label: string;
  /** category = krátká hodnota vhodná pro četnosti a podskupiny. */
  kind: 'text' | 'number' | 'category';
  hint: string;
}

export type Measure = 'SMD' | 'MD' | 'OR' | 'RR' | 'RD' | 'COR' | 'GEN' | 'RATIO';

export interface OutcomeDef {
  id: string;
  name: string;
  measure: Measure;
  note: string;
  /** Síťová metaanalýza: u každého efektu se zapisují názvy obou srovnávaných léčeb. */
  network?: boolean;
  /** Nižší hodnota efektu je lepší (úmrtí, bolest) – určuje pořadí léčeb. */
  smallerBetter?: boolean;
  /** Referenční léčba sítě; prázdné = nejčastější. */
  reference?: string;
}

export interface Theme {
  id: string;
  name: string;
  summary: string;
}

export interface GradeRating {
  rob: number; // 0, -1, -2
  inconsistency: number;
  indirectness: number;
  imprecision: number;
  pubBias: number;
  note: string;
}

export interface SynthesisState {
  themes: Theme[];
  narrative: string;
  model: 'random' | 'fixed';
  tau2: 'REML' | 'DL';
  knha: boolean;
  subgroupField: string;
  /** Více efektů z jedné studie: sloučit do jednoho, nebo tříúrovňový model. */
  dependence: 'aggregate' | 'multilevel';
  /** Předpokládaná korelace efektů uvnitř studie (pro sloučení). */
  rho: number;
  /** Pole z extrakce použitá jako moderátory v metaregresi. */
  moderators: string[];
  chartFields: string[];
  grade: Record<string, GradeRating>;
}

// ---- Text ------------------------------------------------------------------

export type Template = 'article' | 'bachelor' | 'master';
export type CitationStyle = 'apa' | 'iso690';

export interface ManuscriptState {
  template: Template;
  style: CitationStyle;
  author: string;
  supervisor: string;
  institution: string;
  year: string;
  keywords: string;
  /** Texty psané člověkem nebo upravené verze generovaných oddílů: id oddílu → text. */
  sections: Record<string, string>;
}

export interface ChecklistAnswer {
  done: boolean;
  where: string;
}

// ---- Projekt ---------------------------------------------------------------

export interface Reviewer {
  id: string;
  name: string;
}

export interface Team {
  /** true = třídění provádějí dva hodnotitelé nezávisle. */
  double: boolean;
  reviewers: Reviewer[];
}

export interface Project {
  id: string;
  /** Stálé označení projektu, které se nemění při načtení ze zálohy – páruje soubory hodnotitelů. */
  shareId: string;
  title: string;
  type: ReviewType;
  createdAt: string;
  updatedAt: string;
  question: Question;
  protocol: Protocol;
  blocks: ConceptBlock[];
  searches: SearchRun[];
  /** Dvojice záznamů, o kterých uživatel rozhodl, že duplicitami nejsou („id|id“). */
  notDuplicates: string[];
  fields: FieldDef[];
  outcomes: OutcomeDef[];
  qualityTool: string;
  /** Položky vlastního kontrolního seznamu kvality, jedna na řádek. */
  customQualityItems: string;
  synthesis: SynthesisState;
  manuscript: ManuscriptState;
  checklist: Record<string, ChecklistAnswer>;
  done: Partial<Record<StepId, boolean>>;
  team: Team;
  /** Kopie projektu určená druhému hodnotiteli: id hodnotitele, který v ní třídí. */
  reviewerCopy?: string;
  /** Ukázkový projekt s předvyplněnými daty. */
  demo?: boolean | string;
}

export interface StoredFile {
  id: string;
  projectId: string;
  recordId: string;
  name: string;
  blob: Blob;
}

/** Podoba zálohy projektu (export / import JSON). */
export interface ProjectBackup {
  format: 'pruvodce-prehledy';
  version: 1 | 2;
  exportedAt: string;
  project: Project;
  records: RecordItem[];
}

/** Soubor s rozhodnutími jednoho hodnotitele, který se načítá do hlavního projektu. */
export interface VotesFile {
  format: 'pruvodce-prehledy-rozhodnuti';
  version: 1;
  exportedAt: string;
  shareId: string;
  projectTitle: string;
  reviewer: Reviewer;
  /** Klíč = id záznamu v hlavním projektu. */
  votes1: Record<string, Screen1>;
  votes2: Record<string, Vote2>;
}
