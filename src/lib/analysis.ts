// Propojení dat projektu se statistikou: z extrahovaných čísel spočítá efekty,
// metaanalýzu a podklady pro grafy. Používá ji krok Syntéza i sestavení textu.

import type { Count, FigScale, ForestRow } from './figures';
import { MEASURES, computeEffect } from './stats/effects';
import { eggerTest, leaveOneOut, metaAnalyze, subgroupAnalysis, type EggerResult, type LeaveOneOut, type MetaOptions, type MetaResult, type Study, type SubgroupResult } from './stats/meta';
import { overlap, type OverlapResult } from './stats/overlap';
import type { OutcomeDef, Project, RecordItem } from './types';
import { fmt, fmtP, lines, shortLabel } from './util';

export interface OutcomeAnalysis {
  outcome: OutcomeDef;
  scale: FigScale;
  studies: Study[];
  /** Studie, u kterých efekt nešel spočítat, s důvodem. */
  skipped: { id: string; label: string; error: string }[];
  /** Poznámky k výpočtu (např. korekce nulových buněk). */
  notes: { label: string; note: string }[];
  result: MetaResult | null;
  egger: EggerResult | null;
  loo: LeaveOneOut[];
  subgroups: SubgroupResult | null;
}

export function metaOptions(project: Pick<Project, 'synthesis'>): MetaOptions {
  return { model: project.synthesis.model, tau2: project.synthesis.tau2, knha: project.synthesis.knha };
}

/** Označení studií pro tabulky a grafy; shodná označení se rozliší písmeny. */
export function studyLabels(records: Pick<RecordItem, 'id' | 'authors' | 'year' | 'title'>[]): Map<string, string> {
  const base = records.map((r) => shortLabel(r));
  const total = new Map<string, number>();
  for (const b of base) total.set(b, (total.get(b) ?? 0) + 1);
  const seen = new Map<string, number>();
  return new Map(
    records.map((r, i) => {
      const b = base[i];
      if ((total.get(b) ?? 0) < 2) return [r.id, b];
      const n = seen.get(b) ?? 0;
      seen.set(b, n + 1);
      return [r.id, b.replace(/\)$/, `${String.fromCharCode(97 + n)})`)];
    }),
  );
}

export function analyzeOutcome(project: Project, included: RecordItem[], outcome: OutcomeDef): OutcomeAnalysis {
  const labels = studyLabels(included);
  const studies: Study[] = [];
  const skipped: OutcomeAnalysis['skipped'] = [];
  const notes: OutcomeAnalysis['notes'] = [];
  const field = project.synthesis.subgroupField;
  for (const r of included) {
    const label = labels.get(r.id) ?? r.title;
    const res = computeEffect(outcome.measure, r.effects[outcome.id]);
    if (res.ok) {
      studies.push({ id: r.id, label, yi: res.effect.yi, vi: res.effect.vi, subgroup: field ? r.extraction[field] ?? '' : undefined });
      if (res.effect.note) notes.push({ label, note: res.effect.note });
    } else if (res.error !== 'Chybí data.') {
      skipped.push({ id: r.id, label, error: res.error });
    }
  }
  const opts = metaOptions(project);
  const result = metaAnalyze(studies, opts);
  return {
    outcome,
    scale: MEASURES[outcome.measure].scale,
    studies,
    skipped,
    notes,
    result,
    egger: eggerTest(studies),
    loo: leaveOneOut(studies, opts),
    subgroups: field ? subgroupAnalysis(studies, opts) : null,
  };
}

const Z = 1.959963984540054;

/** Řádky lesního grafu včetně případných podskupin a souhrnu. */
export function forestRows(a: OutcomeAnalysis): ForestRow[] {
  if (!a.result) return [];
  const weightOf = new Map(a.studies.map((s, i) => [s.id, a.result!.weights[i]]));
  const studyRow = (s: Study): ForestRow => {
    const se = Math.sqrt(s.vi);
    return { kind: 'study', label: s.label, yi: s.yi, lo: s.yi - Z * se, hi: s.yi + Z * se, weight: weightOf.get(s.id) };
  };
  const rows: ForestRow[] = [];
  if (a.subgroups) {
    for (const g of a.subgroups.groups) {
      rows.push({ kind: 'group', label: g.name });
      rows.push(...g.studies.map(studyRow));
      rows.push({ kind: 'subsummary', label: `Mezisoučet (k = ${g.result.k})`, yi: g.result.estimate, lo: g.result.ciLow, hi: g.result.ciHigh });
    }
  } else rows.push(...a.studies.map(studyRow));
  const r = a.result;
  rows.push({
    kind: 'summary',
    label: r.model === 'random' ? 'Celkem (náhodné efekty)' : 'Celkem (pevný efekt)',
    yi: r.estimate,
    lo: r.ciLow,
    hi: r.ciHigh,
    weight: 100,
    pi: r.piLow != null && r.piHigh != null ? [r.piLow, r.piHigh] : null,
  });
  return rows;
}

export function heterogeneityText(r: MetaResult): string {
  if (r.k < 2) return 'Heterogenitu nelze hodnotit u jediné studie.';
  return `Heterogenita: Q(${r.df}) = ${fmt(r.Q, 2)}, p ${fmtP(r.pQ)}; I² = ${fmt(r.I2, 1)} %; τ² = ${fmt(r.tau2, 4)}`;
}

export function forestFooter(a: OutcomeAnalysis): string[] {
  if (!a.result) return [];
  const out = [heterogeneityText(a.result)];
  if (a.subgroups) out.push(`Test rozdílu mezi podskupinami: Q(${a.subgroups.df}) = ${fmt(a.subgroups.Qb, 2)}, p ${fmtP(a.subgroups.p)}`);
  if (a.result.piLow != null) out.push('Silná čára pod kosočtvercem znázorňuje 95% predikční interval.');
  return out;
}

// ---- Četnosti pro mapovací přehled ------------------------------------------

/** Četnosti hodnot jednoho pole; více hodnot v buňce lze oddělit středníkem. */
export function countBy(records: RecordItem[], fieldId: string): Count[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const raw = (r.extraction[fieldId] ?? '').trim();
    const values = raw ? raw.split(';').map((v) => v.trim()).filter(Boolean) : ['neuvedeno'];
    for (const v of new Set(values)) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'cs'));
}

/** Počty podle roku publikace včetně let bez studií (souvislá časová osa). */
export function countByYear(records: RecordItem[]): Count[] {
  const years = records.map((r) => r.year).filter((y): y is number => y != null);
  if (!years.length) return [];
  const min = Math.min(...years);
  const max = Math.max(...years);
  const out: Count[] = [];
  // U dlouhého období seskupíme po pětiletích, aby graf zůstal čitelný.
  if (max - min > 40) {
    for (let start = Math.floor(min / 5) * 5; start <= max; start += 5) {
      out.push({ label: `${start}–${String(start + 4).slice(2)}`, value: years.filter((y) => y >= start && y < start + 5).length });
    }
    return out;
  }
  for (let y = min; y <= max; y++) out.push({ label: String(y), value: years.filter((v) => v === y).length });
  return out;
}

// ---- Překryv primárních studií ----------------------------------------------

export function overlapOf(included: RecordItem[]): OverlapResult {
  const labels = studyLabels(included);
  return overlap(included.map((r) => ({ id: r.id, label: labels.get(r.id) ?? r.title, studies: lines(r.primaryStudies) })));
}

// ---- GRADE ------------------------------------------------------------------

export const GRADE_DOMAINS: { id: 'rob' | 'inconsistency' | 'indirectness' | 'imprecision' | 'pubBias'; label: string; hint: string }[] = [
  { id: 'rob', label: 'Riziko zkreslení', hint: 'Pochází většina váhy ze studií s vysokým rizikem zkreslení?' },
  { id: 'inconsistency', label: 'Nekonzistence', hint: 'Liší se výsledky studií bez vysvětlení (vysoké I², široký predikční interval)?' },
  { id: 'indirectness', label: 'Nepřímost', hint: 'Odpovídají populace, intervence a výstupy studií vaší otázce?' },
  { id: 'imprecision', label: 'Nepřesnost', hint: 'Je interval spolehlivosti široký nebo je účastníků málo?' },
  { id: 'pubBias', label: 'Publikační zkreslení', hint: 'Je podezření, že chybějí nepublikované studie?' },
];

export const GRADE_LEVELS = ['Velmi nízká', 'Nízká', 'Střední', 'Vysoká'];

/** Jistota důkazů: začíná na „vysoká“ (randomizované studie) a snižuje se o součet srážek. */
export function gradeCertainty(rating: { rob: number; inconsistency: number; indirectness: number; imprecision: number; pubBias: number } | undefined): string {
  if (!rating) return '';
  const down = rating.rob + rating.inconsistency + rating.indirectness + rating.imprecision + rating.pubBias;
  return GRADE_LEVELS[Math.max(0, 3 + down)];
}
