// Závislé efekty: více velikostí účinku z jedné studie nelze slučovat, jako by šlo
// o nezávislé studie. Modul nabízí dva běžné postupy:
//
// 1. sloučení efektů uvnitř studie do jednoho (Borenstein et al., 2009, kap. 24);
// 2. tříúrovňový model – efekty (úroveň 2) vnořené ve studiích (úroveň 3) se dvěma
//    složkami rozptylu, odhad REML (Cheung, 2014; Van den Noortgate et al., 2013).
//
// Tříúrovňový model odpovídá volání rma.mv(yi, vi, random = ~ 1 | studie/efekt)
// v balíku metafor, proti kterému je výpočet ověřen.

import { chi2Sf, normCdf, normInv } from './distributions';
import { inverse, logDetSpd, matVec, quad, zeros, type Matrix } from './linalg';
import type { Coef } from './metareg';

// ---- 1. Sloučení efektů uvnitř studie -----------------------------------------

/**
 * Souhrnný efekt jedné studie: prostý průměr efektů; rozptyl počítá s tím, že efekty
 * spolu korelují (společná korelace `rho`).
 * var = (1/m²) · [Σ vi + 2ρ Σ_{i<j} √(vi·vj)]
 */
export function compositeEffect(effects: { yi: number; vi: number }[], rho: number): { yi: number; vi: number } {
  const m = effects.length;
  if (m === 1) return { yi: effects[0].yi, vi: effects[0].vi };
  let s = 0;
  for (let i = 0; i < m; i++) {
    s += effects[i].vi;
    for (let j = i + 1; j < m; j++) s += 2 * rho * Math.sqrt(effects[i].vi * effects[j].vi);
  }
  return { yi: effects.reduce((a, e) => a + e.yi, 0) / m, vi: s / (m * m) };
}

// ---- 2. Tříúrovňový model -----------------------------------------------------

export interface MlResult {
  /** Počet efektů. */
  k: number;
  /** Počet studií (shluků). */
  clusters: number;
  p: number;
  coef: Coef[];
  vcov: Matrix;
  /** Souhrnný efekt = absolutní člen (u modelu bez moderátorů). */
  estimate: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  stat: number;
  pval: number;
  /** Rozptyl mezi studiemi (úroveň 3). */
  sigma2Between: number;
  /** Rozptyl mezi efekty uvnitř studie (úroveň 2). */
  sigma2Within: number;
  /** Podíl celkového rozptylu připadající na rozdíly mezi studiemi a uvnitř studií (v %). */
  I2Between: number;
  I2Within: number;
  QE: number;
  dfE: number;
  pQE: number;
  QM: number;
  dfM: number;
  pQM: number;
  /** Predikční interval (jen bez moderátorů). */
  piLow: number | null;
  piHigh: number | null;
  logLik: number;
  converged: boolean;
  /** Váhy jednotlivých efektů v souhrnném odhadu v procentech (jen bez moderátorů). */
  weights: number[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

interface State {
  ll: number;
  P: Matrix;
  Py: number[];
  b: number[];
  vb: Matrix;
  /** Řádkové součty V⁻¹X – u modelu bez moderátorů váhy efektů. */
  A: Matrix;
}

/**
 * Tříúrovňová metaanalýza (případně metaregrese, je-li zadána matice X se sloupcem jedniček).
 * `cluster[i]` je označení studie, ze které pochází i-tý efekt.
 */
export function multilevel(y: number[], v: number[], cluster: string[], X?: Matrix, names?: string[]): MlResult | null {
  const k = y.length;
  const Xm: Matrix = X ?? y.map(() => [1]);
  const p = Xm[0]?.length ?? 0;
  if (k <= p || p === 0) return null;
  const ids = [...new Set(cluster)];
  const groups = ids.map((id) => cluster.map((c, i) => (c === id ? i : -1)).filter((i) => i >= 0));
  const C = groups.length;
  const groupOf = cluster.map((c) => ids.indexOf(c));
  // Bez studie s více efekty nelze obě složky rozptylu rozlišit – odhaduje se jen rozptyl mezi studiemi.
  const identifiable = groups.some((g) => g.length > 1);

  const evaluate = (sb: number, sw: number): State | null => {
    // Inverze V po blocích (Shermanův–Morrisonův vzorec): V_blok = diag(vi + σ²w) + σ²b·11'.
    const Vinv = zeros(k, k);
    let logDetV = 0;
    for (const g of groups) {
      const d = g.map((i) => v[i] + sw);
      const S = sum(d.map((x) => 1 / x));
      const denom = 1 + sb * S;
      logDetV += sum(d.map(Math.log)) + Math.log(denom);
      for (let a = 0; a < g.length; a++) {
        for (let c = 0; c < g.length; c++) Vinv[g[a]][g[c]] = (a === c ? 1 / d[a] : 0) - sb / (d[a] * d[c] * denom);
      }
    }
    // A = V⁻¹X, B = (X'V⁻¹X)⁻¹
    const A = zeros(k, p);
    for (let i = 0; i < k; i++) for (const j of groups[groupOf[i]]) { const f = Vinv[i][j]; for (let c = 0; c < p; c++) A[i][c] += f * Xm[j][c]; }
    const XtVX = zeros(p, p);
    for (let i = 0; i < k; i++) for (let a = 0; a < p; a++) for (let c = 0; c < p; c++) XtVX[a][c] += Xm[i][a] * A[i][c];
    const B = inverse(XtVX);
    if (!B) return null;
    const AB = A.map((row) => matVec(B, row));
    const P = zeros(k, k);
    for (let i = 0; i < k; i++) {
      const Pi = P[i];
      const ABi = AB[i];
      for (let j = 0; j < k; j++) {
        let s = Vinv[i][j];
        const Aj = A[j];
        for (let c = 0; c < p; c++) s -= ABi[c] * Aj[c];
        Pi[j] = s;
      }
    }
    const Py = matVec(P, y);
    const XtX = zeros(p, p);
    for (let i = 0; i < k; i++) for (let a = 0; a < p; a++) for (let c = 0; c < p; c++) XtX[a][c] += Xm[i][a] * Xm[i][c];
    const ll = -0.5 * (k - p) * Math.log(2 * Math.PI) + 0.5 * logDetSpd(XtX) - 0.5 * logDetV - 0.5 * logDetSpd(XtVX) - 0.5 * sum(y.map((yi, i) => yi * Py[i]));
    const b = matVec(B, Xm[0].map((_, c) => sum(A.map((row, i) => row[c] * y[i]))));
    return { ll, P, Py, b, vb: B, A };
  };

  // Výchozí hodnoty: polovina hrubého odhadu celkového rozptylu efektů na každou složku.
  const mean = sum(y) / k;
  const rough = Math.max(1e-4, sum(y.map((yi) => (yi - mean) ** 2)) / (k - 1) - sum(v) / k);
  let sb = identifiable ? rough / 2 : rough;
  let sw = identifiable ? rough / 2 : 0;
  let state = evaluate(sb, sw);
  if (!state) return null;
  let converged = false;

  for (let iter = 0; iter < 300; iter++) {
    const { P, Py } = state;
    // M[i][c] = Σ_{j ve studii c} P[i][j]; G[c][c'] = součet bloku P mezi studiemi c a c'.
    const M = zeros(k, C);
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) M[i][groupOf[j]] += P[i][j];
    const G = zeros(C, C);
    for (let i = 0; i < k; i++) for (let c = 0; c < C; c++) G[groupOf[i]][c] += M[i][c];
    const sPy = new Array<number>(C).fill(0);
    for (let i = 0; i < k; i++) sPy[groupOf[i]] += Py[i];

    const gb = -0.5 * sum(G.map((row, c) => row[c])) + 0.5 * sum(sPy.map((x) => x * x));
    const gw = -0.5 * sum(P.map((row, i) => row[i])) + 0.5 * sum(Py.map((x) => x * x));
    const Ibb = 0.5 * sum(G.map((row) => sum(row.map((x) => x * x))));
    const Iww = 0.5 * sum(P.map((row) => sum(row.map((x) => x * x))));
    const Ibw = 0.5 * sum(M.map((row) => sum(row.map((x) => x * x))));

    // Složka na hranici (nula) s klesající věrohodností zůstává na nule.
    const freeB = !(sb === 0 && gb <= 0);
    const freeW = identifiable && !(sw === 0 && gw <= 0);
    let db = 0;
    let dw = 0;
    if (freeB && freeW) {
      const det = Ibb * Iww - Ibw * Ibw;
      if (Math.abs(det) > 1e-300) {
        db = (Iww * gb - Ibw * gw) / det;
        dw = (Ibb * gw - Ibw * gb) / det;
      }
    } else if (freeB) db = gb / Ibb;
    else if (freeW) dw = gw / Iww;
    else {
      converged = true;
      break;
    }

    // Krok se zkracuje, dokud věrohodnost neklesá.
    let step = 1;
    let next: State | null = null;
    let nb = sb;
    let nw = sw;
    for (let h = 0; h < 30; h++) {
      nb = Math.max(0, sb + step * db);
      nw = Math.max(0, sw + step * dw);
      next = evaluate(nb, nw);
      if (next && next.ll >= state.ll - 1e-12) break;
      step /= 2;
      next = null;
    }
    if (!next) {
      converged = true;
      break;
    }
    const change = Math.max(Math.abs(nb - sb), Math.abs(nw - sw));
    sb = nb;
    sw = nw;
    state = next;
    if (change < 1e-11) {
      converged = true;
      break;
    }
  }

  const z = normInv(0.975);
  const { b, vb } = state;
  const coef: Coef[] = b.map((bj, j) => {
    const se = Math.sqrt(vb[j][j]);
    const stat = bj / se;
    return { name: names?.[j] ?? (j === 0 ? 'Absolutní člen' : `x${j}`), b: bj, se, stat, p: 2 * (1 - normCdf(Math.abs(stat))), ciLow: bj - z * se, ciHigh: bj + z * se };
  });

  // Zbytková heterogenita (Q) a „typický“ rozptyl uvnitř efektů počítáme s vahami 1/vi.
  const w0 = v.map((x) => 1 / x);
  const XtWX = zeros(p, p);
  const XtW2X = zeros(p, p);
  for (let i = 0; i < k; i++) for (let a = 0; a < p; a++) for (let c = 0; c < p; c++) {
    XtWX[a][c] += w0[i] * Xm[i][a] * Xm[i][c];
    XtW2X[a][c] += w0[i] * w0[i] * Xm[i][a] * Xm[i][c];
  }
  const B0 = inverse(XtWX);
  if (!B0) return null;
  const b0 = matVec(B0, Xm[0].map((_, c) => sum(Xm.map((row, i) => w0[i] * row[c] * y[i]))));
  const QE = sum(y.map((yi, i) => w0[i] * (yi - sum(Xm[i].map((x, c) => x * b0[c]))) ** 2));
  const dfE = k - p;
  let trP0 = sum(w0);
  for (let a = 0; a < p; a++) for (let c = 0; c < p; c++) trP0 -= B0[a][c] * XtW2X[c][a];
  const typical = dfE / trP0;
  const total = sb + sw + typical;

  const dfM = p - 1;
  let QM = NaN;
  let pQM = NaN;
  if (dfM > 0) {
    const sub = inverse(vb.slice(1).map((row) => row.slice(1)));
    if (sub) {
      QM = quad(sub, b.slice(1));
      pQM = chi2Sf(QM, dfM);
    }
  }

  const first = coef[0];
  const half = z * Math.sqrt(first.se * first.se + sb + sw);
  return {
    k,
    clusters: C,
    p,
    coef,
    vcov: vb,
    estimate: first.b,
    se: first.se,
    ciLow: first.ciLow,
    ciHigh: first.ciHigh,
    stat: first.stat,
    pval: first.p,
    sigma2Between: sb,
    sigma2Within: sw,
    I2Between: (100 * sb) / total,
    I2Within: (100 * sw) / total,
    QE,
    dfE,
    pQE: chi2Sf(QE, dfE),
    QM,
    dfM,
    pQM,
    piLow: p === 1 ? first.b - half : null,
    piHigh: p === 1 ? first.b + half : null,
    logLik: state.ll,
    converged,
    weights: p === 1 ? state.A.map((row) => (100 * row[0]) / sum(state.A.map((x) => x[0]))) : [],
  };
}
