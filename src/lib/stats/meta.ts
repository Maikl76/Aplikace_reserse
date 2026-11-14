// Metaanalýza metodou inverzního rozptylu: model s pevným a s náhodnými efekty,
// heterogenita, predikční interval, citlivostní analýza, podskupiny a Eggerův test.

import { chi2Sf, normCdf, normInv, tCdf, tInv } from './distributions';

export interface Study {
  id: string;
  label: string;
  yi: number;
  vi: number;
  subgroup?: string;
  /** Studie, ze které efekt pochází (liší se od id, když má studie více efektů). */
  cluster?: string;
}

export interface MetaOptions {
  model: 'random' | 'fixed';
  /** Odhad mezistudijního rozptylu: REML (výchozí i v balíku metafor) nebo DerSimonian–Laird. */
  tau2: 'REML' | 'DL';
  /** Knappova–Hartungova úprava intervalu spolehlivosti (vhodná při malém počtu studií). */
  knha: boolean;
}

export interface MetaResult {
  k: number;
  model: 'random' | 'fixed';
  estimate: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  /** Testová statistika (z, při Knappově–Hartungově úpravě t). */
  stat: number;
  p: number;
  tau2: number;
  Q: number;
  df: number;
  pQ: number;
  /** I² v procentech. */
  I2: number;
  H2: number;
  /** Predikční interval – jen u modelu s náhodnými efekty a k ≥ 3. */
  piLow: number | null;
  piHigh: number | null;
  /** Váhy studií v procentech, ve stejném pořadí jako vstup. */
  weights: number[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const Z975 = normInv(0.975);

function fixedParts(y: number[], v: number[]) {
  const w = v.map((x) => 1 / x);
  const sw = sum(w);
  const est = sum(w.map((wi, i) => wi * y[i])) / sw;
  const Q = sum(w.map((wi, i) => wi * (y[i] - est) ** 2));
  return { w, sw, est, Q };
}

export function tau2DL(y: number[], v: number[]): number {
  const k = y.length;
  if (k < 2) return 0;
  const { w, sw, Q } = fixedParts(y, v);
  const C = sw - sum(w.map((x) => x * x)) / sw;
  return Math.max(0, (Q - (k - 1)) / C);
}

/** REML odhad τ² Fisherovým skórováním (stejný postup jako metafor::rma). */
export function tau2REML(y: number[], v: number[]): number {
  const k = y.length;
  if (k < 2) return 0;
  let t2 = tau2DL(y, v);
  for (let iter = 0; iter < 200; iter++) {
    const w = v.map((vi) => 1 / (vi + t2));
    const sw = sum(w);
    const mu = sum(w.map((wi, i) => wi * y[i])) / sw;
    const sw2 = sum(w.map((x) => x * x));
    const sw3 = sum(w.map((x) => x * x * x));
    const trP = sw - sw2 / sw;
    const yPPy = sum(w.map((wi, i) => wi * wi * (y[i] - mu) ** 2));
    const trPP = sw2 - (2 * sw3) / sw + (sw2 * sw2) / (sw * sw);
    let next = t2 + (yPPy - trP) / trPP;
    if (next < 0) next = 0;
    if (Math.abs(next - t2) < 1e-12) {
      t2 = next;
      break;
    }
    t2 = next;
  }
  return t2;
}

export function metaAnalyze(studies: Pick<Study, 'yi' | 'vi'>[], opts: MetaOptions): MetaResult | null {
  const y = studies.map((s) => s.yi);
  const v = studies.map((s) => s.vi);
  const k = y.length;
  if (k === 0) return null;

  const fx = fixedParts(y, v);
  const df = k - 1;
  const Q = fx.Q;
  const pQ = df > 0 ? chi2Sf(Q, df) : NaN;

  const random = opts.model === 'random' && k > 1;
  const tau2 = random ? (opts.tau2 === 'DL' ? tau2DL(y, v) : tau2REML(y, v)) : 0;
  const w = v.map((vi) => 1 / (vi + tau2));
  const sw = sum(w);
  const estimate = sum(w.map((wi, i) => wi * y[i])) / sw;
  let se = Math.sqrt(1 / sw);

  let stat: number;
  let p: number;
  let crit: number;
  if (random && opts.knha && k > 1) {
    se = Math.sqrt(sum(w.map((wi, i) => wi * (y[i] - estimate) ** 2)) / (df * sw));
    stat = estimate / se;
    p = 2 * (1 - tCdf(Math.abs(stat), df));
    crit = tInv(0.975, df);
  } else {
    stat = estimate / se;
    p = 2 * (1 - normCdf(Math.abs(stat)));
    crit = Z975;
  }

  // I² a H²: u modelu s náhodnými efekty z τ² a „typického“ rozptylu uvnitř studií
  // (Higgins a Thompson, 2002), u pevného modelu z Q.
  let I2 = 0;
  let H2 = 1;
  if (k > 1) {
    if (random) {
      const sw2 = sum(fx.w.map((x) => x * x));
      const s2 = (df * fx.sw) / (fx.sw * fx.sw - sw2);
      I2 = (100 * tau2) / (tau2 + s2);
      H2 = tau2 / s2 + 1;
    } else {
      I2 = Q > 0 ? Math.max(0, (100 * (Q - df)) / Q) : 0;
      H2 = Q / df;
    }
  }

  let piLow: number | null = null;
  let piHigh: number | null = null;
  if (random && k >= 3) {
    const half = tInv(0.975, k - 2) * Math.sqrt(tau2 + se * se);
    piLow = estimate - half;
    piHigh = estimate + half;
  }

  return {
    k,
    model: random ? 'random' : 'fixed',
    estimate,
    se,
    ciLow: estimate - crit * se,
    ciHigh: estimate + crit * se,
    stat,
    p,
    tau2,
    Q,
    df,
    pQ,
    I2,
    H2,
    piLow,
    piHigh,
    weights: w.map((wi) => (100 * wi) / sw),
  };
}

// ---- Citlivostní analýza: postupné vynechání jedné studie -------------------

export interface LeaveOneOut {
  omitted: string;
  label: string;
  result: MetaResult;
}

export function leaveOneOut(studies: Study[], opts: MetaOptions): LeaveOneOut[] {
  if (studies.length < 3) return [];
  return studies.map((s) => ({
    omitted: s.id,
    label: s.label,
    result: metaAnalyze(studies.filter((x) => x.id !== s.id), opts)!,
  }));
}

// ---- Podskupiny ------------------------------------------------------------

export interface SubgroupResult {
  groups: { name: string; studies: Study[]; result: MetaResult }[];
  /** Test rozdílu mezi podskupinami. */
  Qb: number;
  df: number;
  p: number;
}

/** `fit` umožňuje použít jiný model než běžnou metaanalýzu (např. tříúrovňový). */
export function subgroupAnalysis(studies: Study[], opts: MetaOptions, fit: (members: Study[]) => MetaResult | null = (members) => metaAnalyze(members, opts)): SubgroupResult | null {
  const names = [...new Set(studies.map((s) => (s.subgroup ?? '').trim() || 'neuvedeno'))].sort((a, b) => a.localeCompare(b, 'cs'));
  if (names.length < 2) return null;
  const fitted = names.map((name) => {
    const members = studies.filter((s) => ((s.subgroup ?? '').trim() || 'neuvedeno') === name);
    return { name, studies: members, result: fit(members) };
  });
  if (fitted.some((g) => !g.result)) return null;
  const groups = fitted as { name: string; studies: Study[]; result: MetaResult }[];
  const w = groups.map((g) => 1 / (g.result.se * g.result.se));
  const sw = sum(w);
  const pooled = sum(w.map((wi, i) => wi * groups[i].result.estimate)) / sw;
  const Qb = sum(w.map((wi, i) => wi * (groups[i].result.estimate - pooled) ** 2));
  const df = groups.length - 1;
  return { groups, Qb, df, p: chi2Sf(Qb, df) };
}

// ---- Eggerův test asymetrie trychtýřového grafu ------------------------------

export interface EggerResult {
  intercept: number;
  se: number;
  t: number;
  df: number;
  p: number;
}

/** Regrese standardizovaného efektu (y/SE) na přesnost (1/SE); testuje se absolutní člen. */
export function eggerTest(studies: Pick<Study, 'yi' | 'vi'>[]): EggerResult | null {
  const k = studies.length;
  if (k < 3) return null;
  const x = studies.map((s) => 1 / Math.sqrt(s.vi));
  const z = studies.map((s) => s.yi / Math.sqrt(s.vi));
  const mx = sum(x) / k;
  const mz = sum(z) / k;
  const sxx = sum(x.map((xi) => (xi - mx) ** 2));
  if (sxx === 0) return null;
  const slope = sum(x.map((xi, i) => (xi - mx) * (z[i] - mz))) / sxx;
  const intercept = mz - slope * mx;
  const rss = sum(z.map((zi, i) => (zi - intercept - slope * x[i]) ** 2));
  const df = k - 2;
  const s2 = rss / df;
  const se = Math.sqrt(s2 * (1 / k + (mx * mx) / sxx));
  const t = intercept / se;
  return { intercept, se, t, df, p: 2 * (1 - tCdf(Math.abs(t), df)) };
}

// ---- Slovní výklad ---------------------------------------------------------

/** Orientační výklad I² podle Cochrane Handbook (kap. 10.10.2); pásma se překrývají. */
export function interpretI2(I2: number): string {
  if (I2 < 30) return 'nízká – heterogenita nemusí být důležitá';
  if (I2 < 50) return 'mírná až střední';
  if (I2 < 75) return 'podstatná';
  return 'značná';
}
