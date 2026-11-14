// Propojení dat projektu se statistikou: z extrahovaných čísel spočítá efekty,
// metaanalýzu a podklady pro grafy. Používá ji krok Syntéza i sestavení textu.

import type { BubbleSpec, Count, FigScale, ForestRow } from './figures';
import { MEASURES, computeEffect } from './stats/effects';
import { eggerTest, leaveOneOut, metaAnalyze, subgroupAnalysis, type EggerResult, type LeaveOneOut, type MetaOptions, type MetaResult, type Study, type SubgroupResult } from './stats/meta';
import { buildDesign, metaRegression, predictReg, type Coef, type Design, type Moderator } from './stats/metareg';
import { compositeEffect, multilevel, type MlResult } from './stats/multilevel';
import { networkMeta, type NetOutcome, type NetStudyInput } from './stats/network';
import { overlap, type OverlapResult } from './stats/overlap';
import type { EffectInput, Measure, OutcomeDef, Project, RecordItem } from './types';
import { fmt, fmtP, lines, num, shortLabel } from './util';

export interface OutcomeAnalysis {
  outcome: OutcomeDef;
  scale: FigScale;
  /**
   * Jednotky, které vstupují do modelu: obvykle jedna na studii; u tříúrovňového modelu
   * jednotlivé efekty (pak `cluster` říká, ze které studie efekt je).
   */
  studies: Study[];
  /** Počet studií (u více efektů na studii menší než počet efektů). */
  nStudies: number;
  /** Počet jednotlivých efektů před případným sloučením. */
  nEffects: number;
  /** single = každá studie má jeden efekt; aggregate = efekty studie sloučeny; multilevel = tříúrovňový model. */
  method: 'single' | 'aggregate' | 'multilevel';
  ml: MlResult | null;
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

// ---- Efekty studie ------------------------------------------------------------

/** Řádky efektů jedné studie pro daný výstup (vždy alespoň jeden, i prázdný – pro formulář). */
export function effectRows(r: Pick<RecordItem, 'effects'>, outcomeId: string): EffectInput[] {
  const rows = r.effects?.[outcomeId] ?? [];
  return rows.length ? rows : [{}];
}

const isBlank = (measure: Measure, raw: EffectInput) => MEASURES[measure].inputs.every((i) => (raw[i.id] ?? '').trim() === '');

interface EffectItem {
  recordId: string;
  index: number;
  rowLabel: string;
  raw: EffectInput;
  yi: number;
  vi: number;
  note?: string;
}

/** Spočítá všechny efekty zařazených studií pro daný výstup; neúplné řádky vrací jako vynechané. */
function collectEffects(included: RecordItem[], outcome: OutcomeDef, labels: Map<string, string>) {
  const items: EffectItem[] = [];
  const skipped: OutcomeAnalysis['skipped'] = [];
  const notes: OutcomeAnalysis['notes'] = [];
  for (const r of included) {
    const rows = effectRows(r, outcome.id);
    rows.forEach((raw, index) => {
      if (isBlank(outcome.measure, raw)) return;
      const rowLabel = (raw._label ?? '').trim();
      const label = `${labels.get(r.id) ?? r.title}${rows.length > 1 ? ` – ${rowLabel || `efekt ${index + 1}`}` : ''}`;
      const res = computeEffect(outcome.measure, raw);
      if (res.ok) {
        items.push({ recordId: r.id, index, rowLabel, raw, yi: res.effect.yi, vi: res.effect.vi, note: res.effect.note });
        if (res.effect.note) notes.push({ label, note: res.effect.note });
      } else skipped.push({ id: r.id, label, error: res.error });
    });
  }
  return { items, skipped, notes };
}

/** Převede výsledek tříúrovňového modelu do tvaru běžné metaanalýzy (pro společné zobrazení). */
function mlToMeta(ml: MlResult): MetaResult {
  return {
    k: ml.k,
    model: 'random',
    estimate: ml.estimate,
    se: ml.se,
    ciLow: ml.ciLow,
    ciHigh: ml.ciHigh,
    stat: ml.stat,
    p: ml.pval,
    tau2: ml.sigma2Between + ml.sigma2Within,
    Q: ml.QE,
    df: ml.dfE,
    pQ: ml.pQE,
    I2: ml.I2Between + ml.I2Within,
    H2: NaN,
    piLow: ml.piLow,
    piHigh: ml.piHigh,
    weights: ml.weights,
  };
}

const fitMl = (members: Study[]): MetaResult | null => {
  const ml = multilevel(members.map((s) => s.yi), members.map((s) => s.vi), members.map((s) => s.cluster ?? s.id));
  return ml ? mlToMeta(ml) : null;
};

export function analyzeOutcome(project: Project, included: RecordItem[], outcome: OutcomeDef): OutcomeAnalysis {
  const labels = studyLabels(included);
  const field = project.synthesis.subgroupField;
  const byId = new Map(included.map((r) => [r.id, r]));
  // Studie řadíme abecedně podle označení, aby pořadí v grafech a tabulkách bylo stálé.
  const sorted = [...included].sort((x, y) => (labels.get(x.id) ?? '').localeCompare(labels.get(y.id) ?? '', 'cs'));
  const { items, skipped, notes } = collectEffects(sorted, outcome, labels);
  const subgroupOf = (recordId: string) => (field ? byId.get(recordId)?.extraction[field] ?? '' : undefined);

  const perStudy = new Map<string, EffectItem[]>();
  for (const it of items) perStudy.set(it.recordId, [...(perStudy.get(it.recordId) ?? []), it]);
  const dependent = [...perStudy.values()].some((g) => g.length > 1);
  const method: OutcomeAnalysis['method'] = !dependent ? 'single' : project.synthesis.dependence === 'multilevel' ? 'multilevel' : 'aggregate';
  const opts = metaOptions(project);
  const rho = Math.min(0.99, Math.max(0, Number.isFinite(project.synthesis.rho) ? project.synthesis.rho : 0.6));

  let studies: Study[];
  if (method === 'multilevel') {
    studies = items.map((it) => {
      const many = (perStudy.get(it.recordId)?.length ?? 1) > 1;
      const label = `${labels.get(it.recordId) ?? ''}${many ? ` – ${it.rowLabel || `efekt ${it.index + 1}`}` : ''}`;
      return { id: `${it.recordId}#${it.index}`, label, yi: it.yi, vi: it.vi, subgroup: subgroupOf(it.recordId), cluster: it.recordId };
    });
  } else {
    studies = [...perStudy.entries()].map(([recordId, group]) => {
      const c = compositeEffect(group, rho);
      if (group.length > 1) notes.push({ label: labels.get(recordId) ?? '', note: `sloučeno ${group.length} efektů` });
      return { id: recordId, label: labels.get(recordId) ?? '', yi: c.yi, vi: c.vi, subgroup: subgroupOf(recordId), cluster: recordId };
    });
  }

  let result: MetaResult | null;
  let ml: MlResult | null = null;
  let loo: LeaveOneOut[] = [];
  let subgroups: SubgroupResult | null = null;
  let egger: EggerResult | null = null;
  if (method === 'multilevel') {
    ml = multilevel(studies.map((s) => s.yi), studies.map((s) => s.vi), studies.map((s) => s.cluster!));
    result = ml ? mlToMeta(ml) : null;
    // Citlivostní analýza vynechává celé studie, ne jednotlivé efekty.
    const clusters = [...new Set(studies.map((s) => s.cluster!))];
    if (clusters.length >= 3) {
      loo = clusters.flatMap((c) => {
        const res = fitMl(studies.filter((s) => s.cluster !== c));
        return res ? [{ omitted: c, label: labels.get(c) ?? '', result: res }] : [];
      });
    }
    if (field) subgroups = subgroupAnalysis(studies, opts, fitMl);
  } else {
    result = metaAnalyze(studies, opts);
    egger = eggerTest(studies);
    loo = leaveOneOut(studies, opts);
    if (field) subgroups = subgroupAnalysis(studies, opts);
  }

  return { outcome, scale: MEASURES[outcome.measure].scale, studies, nStudies: perStudy.size, nEffects: items.length, method, ml, skipped, notes, result, egger, loo, subgroups };
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
    label: a.method === 'multilevel' ? 'Celkem (tříúrovňový model)' : r.model === 'random' ? 'Celkem (náhodné efekty)' : 'Celkem (pevný efekt)',
    yi: r.estimate,
    lo: r.ciLow,
    hi: r.ciHigh,
    weight: 100,
    pi: r.piLow != null && r.piHigh != null ? [r.piLow, r.piHigh] : null,
  });
  return rows;
}

export function heterogeneityText(r: MetaResult, ml?: MlResult | null): string {
  if (r.k < 2) return 'Heterogenitu nelze hodnotit u jediné studie.';
  if (ml) {
    return `Heterogenita: Q(${r.df}) = ${fmt(r.Q, 2)}, p ${fmtP(r.pQ)}; rozptyl mezi studiemi σ² = ${fmt(ml.sigma2Between, 4)} (I² = ${fmt(ml.I2Between, 1)} %), mezi efekty uvnitř studií σ² = ${fmt(ml.sigma2Within, 4)} (I² = ${fmt(ml.I2Within, 1)} %)`;
  }
  return `Heterogenita: Q(${r.df}) = ${fmt(r.Q, 2)}, p ${fmtP(r.pQ)}; I² = ${fmt(r.I2, 1)} %; τ² = ${fmt(r.tau2, 4)}`;
}

export function forestFooter(a: OutcomeAnalysis): string[] {
  if (!a.result) return [];
  const out = [heterogeneityText(a.result, a.ml)];
  if (a.subgroups) out.push(`Test rozdílu mezi podskupinami: Q(${a.subgroups.df}) = ${fmt(a.subgroups.Qb, 2)}, p ${fmtP(a.subgroups.p)}`);
  if (a.result.piLow != null) out.push('Silná čára pod kosočtvercem znázorňuje 95% predikční interval.');
  return out;
}

// ---- Metaregrese ----------------------------------------------------------------

export interface RegressionAnalysis {
  moderators: Moderator[];
  design: Design;
  /** Počet jednotek v modelu (studií, u tříúrovňového modelu efektů). */
  k: number;
  /** Kolik jednotek vypadlo, protože jim chybí hodnota moderátoru. */
  dropped: number;
  kind: 'two-level' | 'three-level';
  coef: Coef[];
  test: 'z' | 't';
  QM: number;
  dfM: number;
  pQM: number;
  /** Zbytkový rozptyl mezi studiemi (u tříúrovňového modelu součet obou složek). */
  tau2: number;
  R2: number | null;
  I2: number | null;
  QE: number;
  dfE: number;
  pQE: number;
  /** Podklad pro bublinový graf – jen při jediném číselném moderátoru. */
  bubble: Omit<BubbleSpec, 'mode' | 'scale' | 'measure'> | null;
  problems: string[];
}

/** Metaregrese pro výstup: moderátory jsou pole z extrakce vybraná v nastavení syntézy. */
export function analyzeRegression(project: Project, included: RecordItem[], a: OutcomeAnalysis): RegressionAnalysis | null {
  const fields = project.fields.filter((f) => project.synthesis.moderators.includes(f.id) && f.kind !== 'text');
  if (!fields.length || a.studies.length === 0) return null;
  const byId = new Map(included.map((r) => [r.id, r]));
  const moderators: Moderator[] = fields.map((f) => ({
    id: f.id,
    label: f.label,
    kind: f.kind === 'number' ? 'number' : 'category',
    values: a.studies.map((s) => byId.get(s.cluster ?? s.id)?.extraction[f.id] ?? ''),
  }));
  const design = buildDesign(moderators, a.studies.length);
  const units = design.rows.map((i) => a.studies[i]);
  const y = units.map((s) => s.yi);
  const v = units.map((s) => s.vi);
  const problems = [...design.problems];
  const base = { moderators, design, k: units.length, dropped: a.studies.length - units.length, bubble: null, problems };
  const empty: RegressionAnalysis = { ...base, kind: 'two-level', coef: [], test: 'z', QM: NaN, dfM: 0, pQM: NaN, tau2: NaN, R2: null, I2: null, QE: NaN, dfE: 0, pQE: NaN };
  if (problems.length) return empty;
  if (units.length <= design.names.length) {
    problems.push(`Pro ${design.names.length - 1} ${design.names.length - 1 === 1 ? 'koeficient' : 'koeficienty'} moderátorů je potřeba víc studií, než kolik jich má vyplněné hodnoty (${units.length}).`);
    return empty;
  }

  let out: RegressionAnalysis;
  let predict: (x: number[]) => { pred: number; ciLow: number; ciHigh: number };
  let weight: (i: number) => number;
  if (a.method === 'multilevel') {
    const ml = multilevel(y, v, units.map((s) => s.cluster ?? s.id), design.X, design.names);
    if (!ml) return { ...empty, problems: ['Model nešlo odhadnout – moderátory jsou pravděpodobně lineárně závislé.'] };
    out = { ...base, kind: 'three-level', coef: ml.coef, test: 'z', QM: ml.QM, dfM: ml.dfM, pQM: ml.pQM, tau2: ml.sigma2Between + ml.sigma2Within, R2: null, I2: ml.I2Between + ml.I2Within, QE: ml.QE, dfE: ml.dfE, pQE: ml.pQE };
    predict = (x) => predictReg({ coef: ml.coef, vcov: ml.vcov, crit: Z }, x);
    weight = (i) => 1 / (v[i] + ml.sigma2Between + ml.sigma2Within);
  } else {
    const res = metaRegression(y, v, design.X, design.names, metaOptions(project));
    if (!res) return { ...empty, problems: ['Model nešlo odhadnout – moderátory jsou pravděpodobně lineárně závislé.'] };
    out = { ...base, kind: 'two-level', coef: res.coef, test: res.test, QM: res.QM, dfM: res.dfM, pQM: res.pQM, tau2: res.tau2, R2: res.R2, I2: res.I2, QE: res.QE, dfE: res.dfE, pQE: res.pQE };
    predict = (x) => predictReg(res, x);
    weight = (i) => 1 / (v[i] + res.tau2);
  }

  if (moderators.length === 1 && moderators[0].kind === 'number') {
    const xs = design.X.map((row) => row[1]);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    out.bubble = {
      xLabel: moderators[0].label,
      points: units.map((s, i) => ({ label: s.label, x: xs[i], yi: s.yi, weight: weight(i) })),
      line: Array.from({ length: 41 }, (_, i) => {
        const x = lo + ((hi - lo) * i) / 40;
        const p = predict([1, x]);
        return { x, y: p.pred, lo: p.ciLow, hi: p.ciHigh };
      }),
    };
  }
  return out;
}

// ---- Síťová metaanalýza -----------------------------------------------------------

/** Rozptyl, kterým k efektu přispívá každé ze dvou ramen (pro kovariance u vícerameenných studií). */
function armVariances(measure: Measure, raw: EffectInput, corrected: boolean): { v1: number; v2: number; n1: number; n2: number } | null {
  const g = (k: string) => num(raw[k]);
  switch (measure) {
    case 'MD':
      return { v1: (g('sd1') * g('sd1')) / g('n1'), v2: (g('sd2') * g('sd2')) / g('n2'), n1: g('n1'), n2: g('n2') };
    case 'SMD':
      return { v1: 1 / g('n1'), v2: 1 / g('n2'), n1: g('n1'), n2: g('n2') };
    case 'OR':
    case 'RR':
    case 'RD': {
      const add = corrected ? 0.5 : 0;
      const [a, b, c, d] = [g('e1') + add, g('n1') - g('e1') + add, g('e2') + add, g('n2') - g('e2') + add];
      if (measure === 'OR') return { v1: 1 / a + 1 / b, v2: 1 / c + 1 / d, n1: g('n1'), n2: g('n2') };
      if (measure === 'RR') return { v1: 1 / a - 1 / (a + b), v2: 1 / c - 1 / (c + d), n1: g('n1'), n2: g('n2') };
      const p1 = g('e1') / g('n1');
      const p2 = g('e2') / g('n2');
      return { v1: (p1 * (1 - p1)) / g('n1'), v2: (p2 * (1 - p2)) / g('n2'), n1: g('n1'), n2: g('n2') };
    }
    default:
      return null;
  }
}

export interface NetworkAnalysis {
  outcome: OutcomeDef;
  scale: FigScale;
  outcomeResult: NetOutcome;
  /** Řádky bez názvu některé z léčeb. */
  unnamed: string[];
  skipped: OutcomeAnalysis['skipped'];
}

/** Síťová metaanalýza výstupu: každý řádek efektu nese názvy dvou srovnávaných léčeb. */
export function analyzeNetwork(project: Project, included: RecordItem[], outcome: OutcomeDef): NetworkAnalysis {
  const labels = studyLabels(included);
  const sorted = [...included].sort((x, y) => (labels.get(x.id) ?? '').localeCompare(labels.get(y.id) ?? '', 'cs'));
  const { items, skipped } = collectEffects(sorted, outcome, labels);
  const unnamed: string[] = [];
  const studies = new Map<string, NetStudyInput & { arms: Map<string, number> }>();
  for (const it of items) {
    const t1 = (it.raw._t1 ?? '').trim();
    const t2 = (it.raw._t2 ?? '').trim();
    const label = labels.get(it.recordId) ?? '';
    if (!t1 || !t2) {
      if (!unnamed.includes(label)) unnamed.push(label);
      continue;
    }
    const s = studies.get(it.recordId) ?? { id: it.recordId, label, contrasts: [], armVar: {}, arms: new Map<string, number>() };
    s.contrasts.push({ t1, t2, yi: it.yi, vi: it.vi });
    const av = armVariances(outcome.measure, it.raw, !!it.note?.includes('korekce'));
    if (av && [av.v1, av.v2].every((x) => Number.isFinite(x) && x > 0)) {
      s.armVar![t1] ??= av.v1;
      s.armVar![t2] ??= av.v2;
      s.arms.set(t1.toLocaleLowerCase('cs'), av.n1);
      s.arms.set(t2.toLocaleLowerCase('cs'), av.n2);
    }
    studies.set(it.recordId, s);
  }
  const input: NetStudyInput[] = [...studies.values()].map(({ arms, ...s }) => ({
    ...s,
    // U standardizovaného rozdílu průměrů závisí kovariance i na celkovém počtu účastníků studie.
    smdN: outcome.measure === 'SMD' && arms.size ? [...arms.values()].reduce((x, y) => x + y, 0) : undefined,
  }));
  const outcomeResult = networkMeta(input, { model: project.synthesis.model, reference: outcome.reference, smallerBetter: !!outcome.smallerBetter });
  return { outcome, scale: MEASURES[outcome.measure].scale, outcomeResult, unnamed, skipped };
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
