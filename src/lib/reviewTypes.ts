// Nastavení pěti typů přehledů. Všechny sdílejí stejné kroky; liší se tím,
// které kroky jsou povinné, jakým rámcem se formuluje otázka a jaký standard platí.

import type { FieldDef, Framework, ReviewType, StepId } from './types';

export type SynthMode = 'themes' | 'charting' | 'meta' | 'overlap';

export interface StepConf {
  id: StepId;
  optional?: boolean;
}

export interface TypeConf {
  id: ReviewType;
  name: string;
  english: string;
  tagline: string;
  description: string;
  whenToUse: string[];
  notFor: string;
  framework: Framework;
  standard: { name: string; url: string };
  registry: string;
  steps: StepConf[];
  qualityTools: string[];
  synthesis: SynthMode[];
}

export const STEP_LABELS: Record<StepId, string> = {
  question: 'Výzkumná otázka',
  protocol: 'Protokol a kritéria',
  search: 'Vyhledávání',
  dedup: 'Duplicity',
  screen1: 'Třídění podle abstraktu',
  screen2: 'Posouzení plných textů',
  extract: 'Extrakce dat',
  quality: 'Hodnocení kvality',
  synthesis: 'Syntéza',
  flow: 'Vývojový diagram',
  write: 'Text práce',
  checklist: 'Kontrolní seznam',
};

const FULL: StepConf[] = [
  { id: 'question' },
  { id: 'protocol' },
  { id: 'search' },
  { id: 'dedup' },
  { id: 'screen1' },
  { id: 'screen2' },
  { id: 'extract' },
  { id: 'quality' },
  { id: 'synthesis' },
  { id: 'flow' },
  { id: 'write' },
  { id: 'checklist' },
];

export const REVIEW_TYPES: Record<ReviewType, TypeConf> = {
  narrative: {
    id: 'narrative',
    name: 'Narativní přehled',
    english: 'narrative review',
    tagline: 'Široký, výkladový přehled tématu',
    description:
      'Shrnuje a vykládá literaturu k širšímu tématu. Autor volí zdroje podle odborného úsudku, ale postup hledání a výběru má i tak popsat.',
    whenToUse: [
      'chcete uvést čtenáře do tématu nebo popsat jeho vývoj',
      'otázka je široká a nedá se rozložit do PICO',
      'píšete teoretickou část práce',
    ],
    notFor: 'Nehodí se pro tvrzení typu „intervence X funguje“ – k tomu je potřeba systematický postup.',
    framework: 'free',
    standard: { name: 'SANRA', url: 'https://doi.org/10.1186/s41073-019-0064-8' },
    registry: 'Registrace se nevyžaduje.',
    steps: [
      { id: 'question' },
      { id: 'protocol', optional: true },
      { id: 'search' },
      { id: 'dedup' },
      { id: 'screen1' },
      { id: 'extract' },
      { id: 'synthesis' },
      { id: 'flow', optional: true },
      { id: 'write' },
      { id: 'checklist' },
    ],
    qualityTools: [],
    synthesis: ['themes'],
  },
  scoping: {
    id: 'scoping',
    name: 'Mapovací přehled',
    english: 'scoping review',
    tagline: 'Zmapování rozsahu a povahy výzkumu',
    description:
      'Systematicky mapuje, jaký výzkum k tématu existuje, jaké pojmy a metody se používají a kde jsou mezery. Nehodnotí účinnost.',
    whenToUse: [
      'téma je nové nebo roztříštěné a nevíte, kolik výzkumu existuje',
      'chcete popsat typy důkazů, pojmy nebo mezery ve výzkumu',
      'zvažujete, zda má smysl navazující systematický přehled',
    ],
    notFor: 'Neodpovídá na otázku, zda něco funguje, a obvykle nehodnotí kvalitu studií.',
    framework: 'PCC',
    standard: { name: 'PRISMA-ScR', url: 'https://doi.org/10.7326/M18-0850' },
    registry: 'Protokol se zveřejňuje na OSF (PROSPERO mapovací přehledy nepřijímá).',
    steps: FULL.map((s) => (s.id === 'quality' ? { ...s, optional: true } : s)),
    qualityTools: ['custom'],
    synthesis: ['charting', 'themes'],
  },
  systematic: {
    id: 'systematic',
    name: 'Systematický přehled',
    english: 'systematic review',
    tagline: 'Odpověď na úzkou otázku podle předem daného postupu',
    description:
      'Odpovídá na přesně vymezenou otázku. Vyhledání, výběr, hodnocení kvality i syntéza se řídí protokolem tak, aby šel postup zopakovat.',
    whenToUse: [
      'máte úzkou otázku (např. účinek intervence u určité populace)',
      'chcete shrnout všechny dostupné studie, ne jen vybrané',
      'studie jsou příliš různorodé na statistické sloučení',
    ],
    notFor: 'Je pracný; pro široké nebo neujasněné téma zvolte mapovací přehled.',
    framework: 'PICO',
    standard: { name: 'PRISMA 2020', url: 'https://doi.org/10.1136/bmj.n71' },
    registry: 'Protokol se registruje v PROSPERO (zdravotní výstupy) nebo na OSF.',
    steps: FULL,
    qualityTools: ['rob2', 'robins-i', 'custom'],
    synthesis: ['themes'],
  },
  meta: {
    id: 'meta',
    name: 'Systematický přehled s metaanalýzou',
    english: 'systematic review with meta-analysis',
    tagline: 'Systematický přehled se statistickým sloučením výsledků',
    description:
      'Systematický přehled, ve kterém se výsledky dostatečně podobných studií statisticky slučují do společného odhadu účinku.',
    whenToUse: [
      'studie měří stejný výstup srovnatelným způsobem',
      'chcete číselný odhad velikosti účinku a jeho nejistoty',
      'máte alespoň několik studií s úplnými číselnými údaji',
    ],
    notFor: 'Nemá smysl slučovat studie, které se zásadně liší populací, intervencí nebo měřením.',
    framework: 'PICO',
    standard: { name: 'PRISMA 2020', url: 'https://doi.org/10.1136/bmj.n71' },
    registry: 'Protokol se registruje v PROSPERO (zdravotní výstupy) nebo na OSF.',
    steps: FULL,
    qualityTools: ['rob2', 'robins-i', 'custom'],
    synthesis: ['meta', 'themes'],
  },
  umbrella: {
    id: 'umbrella',
    name: 'Zastřešující přehled',
    english: 'umbrella review',
    tagline: 'Přehled systematických přehledů',
    description:
      'Shrnuje závěry již existujících systematických přehledů a metaanalýz. Jednotkou analýzy je přehled, ne primární studie.',
    whenToUse: [
      'k tématu už existuje více systematických přehledů',
      'chcete porovnat jejich závěry a kvalitu',
      'potřebujete souhrn důkazů pro širší oblast',
    ],
    notFor: 'Pokud systematické přehledy k tématu neexistují, není co zastřešovat.',
    framework: 'PICO',
    standard: { name: 'PRIOR', url: 'https://doi.org/10.1136/bmj-2022-070849' },
    registry: 'Protokol se registruje v PROSPERO nebo na OSF.',
    steps: FULL,
    qualityTools: ['amstar2', 'robis', 'custom'],
    synthesis: ['overlap', 'themes'],
  },
};

export const TYPE_ORDER: ReviewType[] = ['narrative', 'scoping', 'systematic', 'meta', 'umbrella'];

export function stepsOf(type: ReviewType): StepConf[] {
  return REVIEW_TYPES[type].steps;
}

export function hasStep(type: ReviewType, id: StepId): boolean {
  return REVIEW_TYPES[type].steps.some((s) => s.id === id);
}

// ---- Rámce pro formulaci otázky -------------------------------------------

export interface FrameworkElement {
  id: string;
  letter: string;
  label: string;
  hint: string;
  example: string;
}

export const FRAMEWORKS: Record<Framework, { name: string; elements: FrameworkElement[] }> = {
  PICO: {
    name: 'PICO',
    elements: [
      { id: 'P', letter: 'P', label: 'Populace', hint: 'U koho? Věk, pohlaví, diagnóza, úroveň.', example: 'dospívající 12–18 let' },
      { id: 'I', letter: 'I', label: 'Intervence nebo expozice', hint: 'Co se zkoumá?', example: 'aerobní pohybová intervence' },
      { id: 'C', letter: 'C', label: 'Srovnání', hint: 'S čím se srovnává? Může chybět.', example: 'běžná péče nebo žádná intervence' },
      { id: 'O', letter: 'O', label: 'Výstupy', hint: 'Co se měří?', example: 'příznaky deprese' },
    ],
  },
  PCC: {
    name: 'PCC',
    elements: [
      { id: 'P', letter: 'P', label: 'Populace', hint: 'Koho se téma týká?', example: 'učitelé tělesné výchovy' },
      { id: 'C1', letter: 'C', label: 'Koncept', hint: 'Jaký jev, pojem nebo činnost mapujete?', example: 'formativní hodnocení' },
      { id: 'C2', letter: 'C', label: 'Kontext', hint: 'V jakém prostředí, zemi, oboru?', example: 'základní školy v Evropě' },
    ],
  },
  free: {
    name: 'Volná formulace',
    elements: [
      { id: 'topic', letter: 'T', label: 'Téma', hint: 'O čem přehled je?', example: 'vývoj pojetí pohybové gramotnosti' },
      { id: 'scope', letter: 'V', label: 'Vymezení', hint: 'Co do přehledu patří a co už ne?', example: 'školní prostředí, literatura od roku 2000' },
    ],
  },
};

// ---- Výchozí pole pro extrakci dat ----------------------------------------

const f = (id: string, label: string, kind: FieldDef['kind'], hint = ''): FieldDef => ({ id, label, kind, hint });

export function defaultFields(type: ReviewType): FieldDef[] {
  const design = f('design', 'Design studie', 'category', 'např. RCT, kohortová, kvalitativní');
  const country = f('country', 'Země', 'category');
  const sample = f('sample', 'Velikost souboru', 'number', 'celkový počet účastníků');
  const population = f('population', 'Účastníci', 'text', 'věk, pohlaví, charakteristika');
  const findings = f('findings', 'Hlavní zjištění', 'text');
  switch (type) {
    case 'narrative':
      return [f('doctype', 'Typ zdroje', 'category', 'např. studie, přehled, kniha'), f('message', 'Hlavní sdělení', 'text'), f('relevance', 'Přínos pro přehled', 'text')];
    case 'scoping':
      return [
        design,
        country,
        population,
        f('concept', 'Koncept', 'text', 'jak studie zkoumaný jev vymezuje'),
        f('context', 'Kontext', 'category', 'prostředí, ve kterém studie proběhla'),
        f('methods', 'Metody', 'text'),
        findings,
        f('gaps', 'Mezery a doporučení', 'text'),
      ];
    case 'umbrella':
      return [
        f('reviewtype', 'Typ přehledu', 'category', 'systematický přehled, metaanalýza…'),
        f('nstudies', 'Počet primárních studií', 'number'),
        f('searchdates', 'Období vyhledávání', 'text'),
        population,
        f('intervention', 'Intervence', 'text'),
        f('outcomes', 'Výstupy', 'text'),
        f('appraisal', 'Nástroj hodnocení kvality v přehledu', 'category'),
        f('effect', 'Souhrnný efekt (jak je uveden)', 'text', 'např. SMD −0,35 (95% CI −0,50 až −0,20)'),
        findings,
      ];
    default:
      return [
        design,
        country,
        sample,
        population,
        f('intervention', 'Intervence', 'text', 'obsah, dávka, délka'),
        f('comparator', 'Srovnání', 'text'),
        f('outcomes', 'Výstupy a nástroje měření', 'text'),
        f('followup', 'Délka sledování', 'text'),
        findings,
      ];
  }
}

export const DEFAULT_EXCLUDE_REASONS = [
  'Nevhodná populace',
  'Nevhodná intervence nebo koncept',
  'Nevhodné srovnání',
  'Nevhodné výstupy',
  'Nevhodný design studie',
  'Nevhodný typ publikace',
  'Nevyhovující jazyk',
].join('\n');
