// Metaregrese: velikost účinku se vysvětluje vlastnostmi studií (moderátory).
// Model se smíšenými efekty: y = Xb + u + e, u ~ N(0, τ²), e ~ N(0, vi).
// Postup i značení odpovídají funkci rma() balíku metafor, proti které je výpočet ověřen.

import { chi2Sf, fSf, normCdf, normInv, tCdf, tInv } from './distributions';
import { inverse, matMul, matVec, quad, transpose, zeros, type Matrix } from './linalg';
import type { MetaOptions } from './meta';

export interface Coef {
  name: string;
  b: number;
  se: number;
  /** Testová statistika (z, při Knappově–Hartungově úpravě t). */
  stat: number;
  p: number;
  ciLow: number;
  ciHigh: number;
}

export interface RegResult {
  k: number;
  /** Počet koeficientů včetně absolutního členu. */
  p: number;
  coef: Coef[];
  vcov: Matrix;
  model: 'random' | 'fixed';
  /** Zbytkový rozptyl mezi studiemi (co moderátory nevysvětlily). */
  tau2: number;
  /** Rozptyl mezi studiemi v modelu bez moderátorů. */
  tau2Null: number;
  /** Podíl rozptylu mezi studiemi vysvětlený moderátory v procentech; null u pevného modelu. */
  R2: number | null;
  /** Zbytková heterogenita I² v procentech. */
  I2: number;
  H2: number;
  /** Test zbytkové heterogenity. */
  QE: number;
  dfE: number;
  pQE: number;
  /** Souhrnný test moderátorů (bez absolutního členu); při úpravě Knappa a Hartunga jde o F. */
  QM: number;
  dfM: number;
  pQM: number;
  test: 'z' | 't';
  /** Kritická hodnota pro 95% interval (z nebo t). */
  crit: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Vážené součiny X'WX a X'Wy pro váhy w. */
function xtwx(X: Matrix, w: number[]): Matrix {
  const p = X[0].length;
  const out = zeros(p, p);
  for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) out[a][b] += w[i] * X[i][a] * X[i][b];
  return out;
}
const xtwy = (X: Matrix, w: number[], y: number[]): number[] => X[0].map((_, a) => sum(X.map((row, i) => w[i] * row[a] * y[i])));
const trace = (A: Matrix) => sum(A.map((row, i) => row[i]));

interface Fit {
  b: number[];
  vb: Matrix;
  resid: number[];
}

function wls(y: number[], X: Matrix, w: number[]): Fit | null {
  const vb = inverse(xtwx(X, w));
  if (!vb) return null;
  const b = matVec(vb, xtwy(X, w, y));
  const fitted = matVec(X, b);
  return { b, vb, resid: y.map((yi, i) => yi - fitted[i]) };
}

/** tr(P) pro váhy w, kde P = W − WX(X'WX)⁻¹X'W. */
function traceP(X: Matrix, w: number[], vb: Matrix): number {
  return sum(w) - trace(matMul(vb, xtwx(X, w.map((x) => x * x))));
}

/** Odhad τ² ve smíšeném modelu: REML (Fisherovo skórování) nebo metoda momentů (DerSimonian–Laird). */
export function tau2Reg(y: number[], v: number[], X: Matrix, method: 'REML' | 'DL'): number | null {
  const k = y.length;
  const p = X[0].length;
  if (k <= p) return null;
  const w0 = v.map((x) => 1 / x);
  const f0 = wls(y, X, w0);
  if (!f0) return null;
  const QE = sum(f0.resid.map((e, i) => w0[i] * e * e));
  const dl = Math.max(0, (QE - (k - p)) / traceP(X, w0, f0.vb));
  if (method === 'DL') return dl;

  let t2 = dl;
  for (let iter = 0; iter < 500; iter++) {
    const w = v.map((vi) => 1 / (vi + t2));
    const f = wls(y, X, w);
    if (!f) return null;
    const w2 = w.map((x) => x * x);
    const A2 = matMul(f.vb, xtwx(X, w2));
    const trP = sum(w) - trace(A2);
    const trPP = sum(w2) - 2 * trace(matMul(f.vb, xtwx(X, w.map((x) => x * x * x)))) + trace(matMul(A2, A2));
    const yPPy = sum(f.resid.map((e, i) => w2[i] * e * e));
    let next = t2 + (yPPy - trP) / trPP;
    if (next < 0) next = 0;
    if (Math.abs(next - t2) < 1e-12) return next;
    t2 = next;
  }
  return t2;
}

/**
 * Metaregrese. `X` je návrhová matice včetně sloupce jedniček (absolutní člen) na prvním místě,
 * `names` názvy sloupců. Vrací null, pokud je studií málo nebo jsou moderátory lineárně závislé.
 */
export function metaRegression(y: number[], v: number[], X: Matrix, names: string[], opts: MetaOptions): RegResult | null {
  const k = y.length;
  const p = X[0]?.length ?? 0;
  if (p === 0 || k <= p) return null;

  const w0 = v.map((x) => 1 / x);
  const f0 = wls(y, X, w0);
  if (!f0) return null;
  const dfE = k - p;
  const QE = sum(f0.resid.map((e, i) => w0[i] * e * e));

  const random = opts.model === 'random';
  const tau2 = random ? tau2Reg(y, v, X, opts.tau2) : 0;
  if (tau2 == null) return null;
  const ones = y.map(() => [1]);
  const tau2Null = random ? tau2Reg(y, v, ones, opts.tau2) ?? 0 : 0;

  const w = v.map((vi) => 1 / (vi + tau2));
  const f = wls(y, X, w);
  if (!f) return null;
  let vb = f.vb;
  const knha = random && opts.knha;
  if (knha) {
    const s2 = sum(f.resid.map((e, i) => w[i] * e * e)) / dfE;
    vb = vb.map((row) => row.map((x) => x * s2));
  }
  const crit = knha ? tInv(0.975, dfE) : normInv(0.975);
  const coef: Coef[] = f.b.map((b, j) => {
    const se = Math.sqrt(vb[j][j]);
    const stat = b / se;
    const pv = knha ? 2 * (1 - tCdf(Math.abs(stat), dfE)) : 2 * (1 - normCdf(Math.abs(stat)));
    return { name: names[j] ?? `x${j}`, b, se, stat, p: pv, ciLow: b - crit * se, ciHigh: b + crit * se };
  });

  // Souhrnný test moderátorů: Waldův test všech koeficientů kromě absolutního členu.
  const dfM = p - 1;
  let QM = NaN;
  let pQM = NaN;
  if (dfM > 0) {
    const sub = inverse(vb.slice(1).map((row) => row.slice(1)));
    if (sub) {
      const wald = quad(sub, f.b.slice(1));
      QM = knha ? wald / dfM : wald;
      pQM = knha ? fSf(QM, dfM, dfE) : chi2Sf(QM, dfM);
    }
  }

  // Zbytková heterogenita: I² z τ² a „typického“ rozptylu uvnitř studií (jako metafor).
  const vt = dfE / traceP(X, w0, f0.vb);
  const I2 = random ? (100 * tau2) / (tau2 + vt) : QE > 0 ? Math.max(0, (100 * (QE - dfE)) / QE) : 0;
  const H2 = random ? tau2 / vt + 1 : QE / dfE;

  return {
    k,
    p,
    coef,
    vcov: vb,
    model: random ? 'random' : 'fixed',
    tau2,
    tau2Null,
    R2: random ? (tau2Null > 0 ? Math.max(0, (100 * (tau2Null - tau2)) / tau2Null) : 0) : null,
    I2,
    H2,
    QE,
    dfE,
    pQE: chi2Sf(QE, dfE),
    QM,
    dfM,
    pQM,
    test: knha ? 't' : 'z',
    crit,
  };
}

/** Předpověď průměrného efektu pro zadané hodnoty moderátorů (řádek návrhové matice včetně jedničky). */
export function predictReg(res: Pick<RegResult, 'coef' | 'vcov' | 'crit'>, x: number[]): { pred: number; se: number; ciLow: number; ciHigh: number } {
  const pred = sum(res.coef.map((c, j) => c.b * x[j]));
  const se = Math.sqrt(Math.max(0, quad(res.vcov, x)));
  return { pred, se, ciLow: pred - res.crit * se, ciHigh: pred + res.crit * se };
}

// ---- Návrhová matice z moderátorů ---------------------------------------------

export interface Moderator {
  id: string;
  label: string;
  kind: 'number' | 'category';
  /** Hodnoty pro jednotlivé studie ve stejném pořadí jako efekty. */
  values: string[];
}

export interface Design {
  X: Matrix;
  names: string[];
  /** Indexy studií, které zůstaly (mají hodnotu všech moderátorů). */
  rows: number[];
  /** U kategorií referenční úroveň, se kterou se ostatní srovnávají. */
  reference: Record<string, string>;
  problems: string[];
}

const toNumber = (s: string) => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  return t === '' ? NaN : Number(t);
};

/**
 * Sestaví návrhovou matici. Číselný moderátor = jeden sloupec; kategorie = sloupec 0/1
 * pro každou úroveň kromě referenční (nejčastější; při shodě první podle abecedy).
 * Studie, kterým některá hodnota chybí, se vynechají.
 */
export function buildDesign(mods: Moderator[], n: number): Design {
  const problems: string[] = [];
  const rows: number[] = [];
  for (let i = 0; i < n; i++) {
    const ok = mods.every((m) => (m.kind === 'number' ? Number.isFinite(toNumber(m.values[i] ?? '')) : (m.values[i] ?? '').trim() !== ''));
    if (ok) rows.push(i);
  }
  const names = ['Absolutní člen'];
  const cols: number[][] = [rows.map(() => 1)];
  const reference: Record<string, string> = {};
  for (const m of mods) {
    if (m.kind === 'number') {
      const col = rows.map((i) => toNumber(m.values[i]));
      if (new Set(col).size < 2) problems.push(`Moderátor „${m.label}“ má u všech studií stejnou hodnotu.`);
      names.push(m.label);
      cols.push(col);
    } else {
      const vals = rows.map((i) => m.values[i].trim());
      const freq = new Map<string, number>();
      for (const x of vals) freq.set(x, (freq.get(x) ?? 0) + 1);
      const levels = [...freq.keys()].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0) || a.localeCompare(b, 'cs'));
      if (levels.length < 2) problems.push(`Moderátor „${m.label}“ má u všech studií stejnou hodnotu.`);
      reference[m.id] = levels[0] ?? '';
      for (const level of levels.slice(1).sort((a, b) => a.localeCompare(b, 'cs'))) {
        names.push(`${m.label}: ${level}`);
        cols.push(vals.map((x) => (x === level ? 1 : 0)));
      }
    }
  }
  return { X: transpose(cols), names, rows, reference, problems };
}
