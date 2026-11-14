// Síťová metaanalýza (network meta-analysis): srovnává tři a více léčeb najednou a spojuje
// přímé důkazy (studie A vs. B) s nepřímými (A vs. C a B vs. C).
//
// Frekventistický kontrastní model: d = Xβ + u + e. Vícerameenné studie přispívají
// m − 1 kontrasty se známou kovariancí (společné rameno); heterogenita τ² je společná
// pro všechna srovnání, s kovariancí τ²/2 uvnitř vícerameenné studie.
// Odhad REML odpovídá volání rma.mv(yi, V, mods = ~ léčby − 1, random = ~ comp | study, rho = 1/2)
// v balíku metafor, proti kterému je výpočet ověřen.
//
// Literatura: Salanti (2012); Rücker a Schwarzer (2015, P-skóre); Dias et al. (2010, přímé
// a nepřímé důkazy); Higgins et al. (2012, konzistence mezi designy).

import { chi2Sf, normCdf, normInv } from './distributions';
import { inverse, logDetSpd, matMul, matVec, quad, transpose, zeros, type Matrix } from './linalg';

export interface NetContrastInput {
  /** Efekt je vyjádřen jako t1 oproti t2. */
  t1: string;
  t2: string;
  yi: number;
  vi: number;
}

export interface NetStudyInput {
  id: string;
  label: string;
  contrasts: NetContrastInput[];
  /** Rozptyl příspěvku jednotlivých ramen – určuje kovarianci kontrastů se společným ramenem. */
  armVar?: Record<string, number>;
  /** U standardizovaného rozdílu průměrů: celkový počet účastníků studie (člen g₁g₂/2N kovariance). */
  smdN?: number;
}

export interface NetOptions {
  model: 'random' | 'fixed';
  /** Referenční léčba; prázdné = léčba zastoupená v nejvíce studiích. */
  reference?: string;
  /** true = nižší hodnota efektu je lepší (např. úmrtí, bolest). */
  smallerBetter: boolean;
}

export interface NetEstimate {
  est: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  p: number;
}

export interface NetSplit {
  a: string;
  b: string;
  /** Počet studií s přímým srovnáním. */
  k: number;
  direct: { est: number; se: number };
  /** null, pokud nepřímé důkazy pro srovnání neexistují. */
  indirect: { est: number; se: number } | null;
  network: { est: number; se: number };
  diff: number | null;
  z: number | null;
  p: number | null;
}

export interface NetResult {
  treatments: string[];
  reference: string;
  studies: number;
  /** Počet nezávislých kontrastů (dvouramenná studie 1, m-ramenná m − 1). */
  contrasts: number;
  multiArm: number;
  model: 'random' | 'fixed';
  tau2: number;
  /** Celková heterogenita a nekonzistence (model se společným efektem). */
  Q: number;
  df: number;
  pQ: number;
  I2: number;
  /** Rozklad Q: uvnitř designů (heterogenita) a mezi designy (nekonzistence). */
  Qwithin: number;
  dfWithin: number;
  pWithin: number;
  Qbetween: number;
  dfBetween: number;
  pBetween: number;
  /** league[i][j] = efekt léčby i oproti léčbě j. */
  league: NetEstimate[][];
  /** Efekt každé léčby oproti referenční (v pořadí `treatments`). */
  vsReference: NetEstimate[];
  /** P-skóre (0–1): průměrná jistota, že léčba je lepší než ostatní. */
  pscore: { treatment: string; value: number }[];
  nodes: { treatment: string; studies: number }[];
  edges: { a: string; b: string; studies: number }[];
  split: NetSplit[];
  notes: string[];
}

export type NetOutcome = { ok: true; result: NetResult; skipped: { id: string; label: string; reason: string }[] } | { ok: false; error: string; skipped: { id: string; label: string; reason: string }[] };

interface Prepared {
  id: string;
  label: string;
  /** Ramena; první je základní rameno studie. */
  arms: string[];
  /** Kontrasty ostatních ramen proti základnímu a jejich kovarianční matice. */
  y: number[];
  V: Matrix;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const cmp = (a: string, b: string) => a.localeCompare(b, 'cs');

/** Převede kontrasty studie na jiné základní rameno (lineární transformace včetně kovariancí). */
function rebase(arms: string[], y: number[], V: Matrix, base: string): { arms: string[]; y: number[]; V: Matrix } {
  if (arms[0] === base) return { arms, y, V };
  const others = arms.filter((a) => a !== base);
  // d(a, base) = d(a, starý základ) − d(base, starý základ); starý základ má efekt 0.
  const idx = (a: string) => arms.indexOf(a) - 1; // −1 = starý základ
  const T = others.map((a) => {
    const row = new Array<number>(y.length).fill(0);
    if (idx(a) >= 0) row[idx(a)] += 1;
    row[idx(base)] -= 1;
    return row;
  });
  return { arms: [base, ...others], y: matVec(T, y), V: matMul(matMul(T, V), transpose(T)) };
}

export function networkMeta(input: NetStudyInput[], opts: NetOptions): NetOutcome {
  const skipped: { id: string; label: string; reason: string }[] = [];
  const notes: string[] = [];

  // ---- 1. Názvy léčeb sjednotíme bez ohledu na velikost písmen -----------------
  const display = new Map<string, string>();
  const norm = (s: string) => {
    const key = s.trim().toLocaleLowerCase('cs');
    if (!display.has(key)) display.set(key, s.trim());
    return display.get(key)!;
  };

  interface Clean {
    id: string;
    label: string;
    contrasts: NetContrastInput[];
    armVar: Record<string, number>;
    smdN?: number;
    arms: string[];
  }
  const clean: Clean[] = [];
  for (const s of input) {
    const seen = new Set<string>();
    const contrasts: NetContrastInput[] = [];
    let duplicate = false;
    for (const c of s.contrasts) {
      if (!c.t1.trim() || !c.t2.trim() || !Number.isFinite(c.yi) || !(c.vi > 0)) continue;
      const t1 = norm(c.t1);
      const t2 = norm(c.t2);
      if (t1 === t2) continue;
      const key = [t1, t2].sort(cmp).join('\u0000');
      if (seen.has(key)) {
        duplicate = true;
        continue;
      }
      seen.add(key);
      contrasts.push({ t1, t2, yi: c.yi, vi: c.vi });
    }
    if (!contrasts.length) continue;
    if (duplicate) notes.push(`${s.label}: stejné srovnání je zadáno vícekrát, použito bylo první.`);
    const armVar: Record<string, number> = {};
    for (const [k, val] of Object.entries(s.armVar ?? {})) if (Number.isFinite(val) && val > 0) armVar[norm(k)] = val;
    clean.push({ id: s.id, label: s.label, contrasts, armVar, smdN: s.smdN, arms: [...new Set(contrasts.flatMap((c) => [c.t1, c.t2]))].sort(cmp) });
  }
  if (!clean.length) return { ok: false, error: 'Žádná studie nemá úplná data včetně názvů obou srovnávaných léčeb.', skipped };

  // ---- 2. Referenční léčba ------------------------------------------------------
  const count = new Map<string, number>();
  for (const s of clean) for (const a of s.arms) count.set(a, (count.get(a) ?? 0) + 1);
  const all = [...count.keys()].sort(cmp);
  const wanted = opts.reference?.trim() ? display.get(opts.reference.trim().toLocaleLowerCase('cs')) : undefined;
  const reference = wanted && count.has(wanted) ? wanted : [...all].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || cmp(a, b))[0];

  // ---- 3. Kontrasty proti základnímu rameni studie a jejich kovariance ---------
  const prepared: Prepared[] = [];
  for (const s of clean) {
    const find = (a: string, b: string) => {
      const c = s.contrasts.find((x) => (x.t1 === a && x.t2 === b) || (x.t1 === b && x.t2 === a));
      return c ? { yi: c.t1 === a ? c.yi : -c.yi, vi: c.vi } : null;
    };
    // Základní rameno musí být srovnáno se všemi ostatními rameny studie.
    const candidates = s.arms.filter((a) => s.arms.every((b) => b === a || find(b, a)));
    if (!candidates.length) {
      skipped.push({ id: s.id, label: s.label, reason: 'u vícerameenné studie musí být jedno rameno srovnáno se všemi ostatními' });
      continue;
    }
    const base = candidates.includes(reference) ? reference : candidates[0];
    const others = s.arms.filter((a) => a !== base);
    const basic = others.map((a) => find(a, base)!);
    const m = others.length;
    const V = zeros(m, m);
    let approx = false;
    for (let i = 0; i < m; i++) {
      V[i][i] = basic[i].vi;
      for (let j = i + 1; j < m; j++) {
        const limit = Math.sqrt(basic[i].vi * basic[j].vi);
        let cov: number | null = null;
        if (s.armVar[base] != null) cov = s.armVar[base] + (s.smdN ? (basic[i].yi * basic[j].yi) / (2 * s.smdN) : 0);
        else {
          const direct = find(others[i], others[j]);
          if (direct) cov = (basic[i].vi + basic[j].vi - direct.vi) / 2;
        }
        if (cov == null || !(cov > 0) || cov >= limit) {
          cov = 0.5 * Math.min(basic[i].vi, basic[j].vi);
          approx = true;
        }
        V[i][j] = V[j][i] = cov;
      }
    }
    if (approx) notes.push(`${s.label}: kovarianci kontrastů se společným ramenem nešlo spočítat z dat, použit byl odhad (polovina menšího rozptylu).`);
    // Sjednocené základní rameno: referenční léčba, jinak první podle abecedy – aby stejné designy sdílely parametry.
    const canonical = s.arms.includes(reference) ? reference : s.arms[0];
    const rb = rebase([base, ...others], basic.map((b) => b.yi), V, canonical);
    prepared.push({ id: s.id, label: s.label, arms: rb.arms, y: rb.y, V: rb.V });
  }
  if (!prepared.length) return { ok: false, error: 'Žádnou studii nešlo do sítě zařadit.', skipped };

  // ---- 4. Souvislost sítě -------------------------------------------------------
  const treatments = [...new Set(prepared.flatMap((s) => s.arms))].sort(cmp);
  const parent = new Map(treatments.map((t) => [t, t]));
  const root = (t: string): string => (parent.get(t) === t ? t : root(parent.get(t)!));
  for (const s of prepared) for (const a of s.arms.slice(1)) parent.set(root(a), root(s.arms[0]));
  const comps = new Map<string, string[]>();
  for (const t of treatments) comps.set(root(t), [...(comps.get(root(t)) ?? []), t]);
  if (treatments.length < 3) {
    return { ok: false, error: 'Síťová metaanalýza potřebuje alespoň tři různé léčby. U dvou léčeb použijte běžnou metaanalýzu.', skipped };
  }
  if (comps.size > 1) {
    return { ok: false, error: `Síť není souvislá – některé léčby nespojuje žádná studie. Oddělené části: ${[...comps.values()].map((c) => c.join(', ')).join(' | ')}.`, skipped };
  }
  const ref = treatments.includes(reference) ? reference : treatments[0];
  const params = treatments.filter((t) => t !== ref);
  const pIdx = new Map(params.map((t, i) => [t, i]));
  const T1 = params.length;

  // ---- 5. Návrhová matice a blokové matice --------------------------------------
  const blocks: number[][] = [];
  const y: number[] = [];
  const X: Matrix = [];
  for (const s of prepared) {
    const rows: number[] = [];
    s.arms.slice(1).forEach((a, i) => {
      const row = new Array<number>(T1).fill(0);
      if (pIdx.has(a)) row[pIdx.get(a)!] += 1;
      if (pIdx.has(s.arms[0])) row[pIdx.get(s.arms[0])!] -= 1;
      rows.push(y.length);
      y.push(s.y[i]);
      X.push(row);
    });
    blocks.push(rows);
  }
  const n = y.length;
  const df = n - T1;
  const blockOf = new Array<number>(n);
  blocks.forEach((rows, b) => rows.forEach((i) => (blockOf[i] = b)));
  const H = (i: number, j: number) => (i === j ? 1 : blockOf[i] === blockOf[j] ? 0.5 : 0);

  interface Fit {
    beta: number[];
    vb: Matrix;
    Vinv: Matrix;
    P: Matrix;
    Py: number[];
    ll: number;
  }
  const fit = (tau2: number): Fit | null => {
    const Vinv = zeros(n, n);
    let logDetV = 0;
    for (let b = 0; b < blocks.length; b++) {
      const rows = blocks[b];
      const Vs = prepared[b].V.map((row, i) => row.map((x, j) => x + tau2 * (i === j ? 1 : 0.5)));
      const inv = inverse(Vs);
      const ld = logDetSpd(Vs);
      if (!inv || !Number.isFinite(ld)) return null;
      logDetV += ld;
      rows.forEach((gi, i) => rows.forEach((gj, j) => (Vinv[gi][gj] = inv[i][j])));
    }
    const A = zeros(n, T1); // V⁻¹X
    for (let i = 0; i < n; i++) for (const j of blocks[blockOf[i]]) for (let c = 0; c < T1; c++) A[i][c] += Vinv[i][j] * X[j][c];
    const XtVX = matMul(transpose(X), A);
    const vb = inverse(XtVX);
    const ldx = logDetSpd(XtVX);
    if (!vb || !Number.isFinite(ldx)) return null;
    const AB = matMul(A, vb);
    const P = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      let s = Vinv[i][j];
      for (let c = 0; c < T1; c++) s -= AB[i][c] * A[j][c];
      P[i][j] = s;
    }
    const Py = matVec(P, y);
    const beta = matVec(vb, matVec(transpose(A), y));
    return { beta, vb, Vinv, P, Py, ll: -0.5 * logDetV - 0.5 * ldx - 0.5 * sum(y.map((yi, i) => yi * Py[i])) };
  };

  const fixed = fit(0);
  if (!fixed) return { ok: false, error: 'Model nešlo odhadnout – zkontrolujte, zda data některé studie nejsou chybná.', skipped };
  const Q = sum(y.map((yi, i) => yi * fixed.Py[i]));

  // ---- 6. Odhad τ² (REML, Fisherovo skórování) ----------------------------------
  let tau2 = 0;
  let current = fixed;
  if (opts.model === 'random' && df > 0) {
    tau2 = Math.max(0, (Q - df) / Math.max(1e-12, sum(fixed.P.map((row, i) => sum(row.map((x, j) => x * H(j, i)))))));
    current = fit(tau2) ?? fixed;
    for (let iter = 0; iter < 300; iter++) {
      const { P, Py } = current;
      const PH = zeros(n, n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (const l of blocks[blockOf[j]]) PH[i][j] += P[i][l] * H(l, j);
      const trPH = sum(PH.map((row, i) => row[i]));
      let trPHPH = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) trPHPH += PH[i][j] * PH[j][i];
      let quadH = 0;
      for (let i = 0; i < n; i++) for (const j of blocks[blockOf[i]]) quadH += Py[i] * H(i, j) * Py[j];
      const score = -0.5 * trPH + 0.5 * quadH;
      if (tau2 === 0 && score <= 0) break;
      const delta = score / (0.5 * trPHPH);
      let step = 1;
      let next: Fit | null = null;
      let nt = tau2;
      for (let h = 0; h < 30; h++) {
        nt = Math.max(0, tau2 + step * delta);
        next = fit(nt);
        if (next && next.ll >= current.ll - 1e-12) break;
        step /= 2;
        next = null;
      }
      if (!next) break;
      const change = Math.abs(nt - tau2);
      tau2 = nt;
      current = next;
      if (change < 1e-11) break;
    }
  } else if (opts.model === 'random') {
    notes.push('Síť nemá žádný stupeň volnosti navíc (každé srovnání jen jednou), heterogenitu proto nelze odhadnout a použit je model se společným efektem.');
  }
  const model: 'random' | 'fixed' = opts.model === 'random' && df > 0 ? 'random' : 'fixed';

  // ---- 7. Výsledky: tabulka všech srovnání --------------------------------------
  const z975 = normInv(0.975);
  const effect = (t: string) => (t === ref ? 0 : current.beta[pIdx.get(t)!]);
  const cov = (a: string, b: string) => (a === ref || b === ref ? 0 : current.vb[pIdx.get(a)!][pIdx.get(b)!]);
  const estimate = (a: string, b: string): NetEstimate => {
    if (a === b) return { est: 0, se: 0, ciLow: 0, ciHigh: 0, p: 1 };
    const est = effect(a) - effect(b);
    const se = Math.sqrt(Math.max(0, cov(a, a) + cov(b, b) - 2 * cov(a, b)));
    return { est, se, ciLow: est - z975 * se, ciHigh: est + z975 * se, p: 2 * (1 - normCdf(Math.abs(est / se))) };
  };
  const league = treatments.map((a) => treatments.map((b) => estimate(a, b)));

  // P-skóre: průměr pravděpodobností, že léčba je lepší než každá z ostatních.
  const pscore = treatments
    .map((a, i) => ({
      treatment: a,
      value:
        sum(
          treatments
            .filter((b) => b !== a)
            .map((b) => {
              const e = league[i][treatments.indexOf(b)];
              const zz = e.est / e.se;
              return normCdf(opts.smallerBetter ? -zz : zz);
            }),
        ) /
        (treatments.length - 1),
    }))
    .sort((a, b) => b.value - a.value || cmp(a.treatment, b.treatment));

  // ---- 8. Geometrie sítě ---------------------------------------------------------
  const nodes = treatments.map((t) => ({ treatment: t, studies: prepared.filter((s) => s.arms.includes(t)).length }));
  const edges: { a: string; b: string; studies: number }[] = [];
  for (let i = 0; i < treatments.length; i++) for (let j = i + 1; j < treatments.length; j++) {
    const k = prepared.filter((s) => s.arms.includes(treatments[i]) && s.arms.includes(treatments[j])).length;
    if (k > 0) edges.push({ a: treatments[i], b: treatments[j], studies: k });
  }

  // ---- 9. Přímé a nepřímé důkazy (zpětný výpočet) --------------------------------
  const split: NetSplit[] = edges.map((e) => {
    let sw = 0;
    let swy = 0;
    for (const s of prepared) {
      if (!s.arms.includes(e.a) || !s.arms.includes(e.b)) continue;
      const rb = rebase(s.arms, s.y, s.V, e.b);
      const i = rb.arms.indexOf(e.a) - 1;
      const w = 1 / (rb.V[i][i] + tau2);
      sw += w;
      swy += w * rb.y[i];
    }
    const direct = { est: swy / sw, se: Math.sqrt(1 / sw) };
    const net = estimate(e.a, e.b);
    const vd = 1 / sw;
    const vn = net.se * net.se;
    if (vd <= vn * (1 + 1e-8)) return { ...e, k: e.studies, direct, indirect: null, network: { est: net.est, se: net.se }, diff: null, z: null, p: null };
    const vi = 1 / (1 / vn - 1 / vd);
    const ind = (net.est / vn - direct.est / vd) * vi;
    const diff = direct.est - ind;
    const zz = diff / Math.sqrt(vd + vi);
    return { ...e, k: e.studies, direct, indirect: { est: ind, se: Math.sqrt(vi) }, network: { est: net.est, se: net.se }, diff, z: zz, p: 2 * (1 - normCdf(Math.abs(zz))) };
  });

  // ---- 10. Rozklad Q: uvnitř designů a mezi designy ------------------------------
  // Design = množina ramen studie. Uvnitř designu se studie liší jen heterogenitou;
  // rozdíly mezi designy ukazují na nekonzistenci přímých a nepřímých důkazů.
  const designs = new Map<string, Prepared[]>();
  for (const s of prepared) {
    const key = s.arms.join('\u0000');
    designs.set(key, [...(designs.get(key) ?? []), s]);
  }
  let Qwithin = 0;
  let dfWithin = 0;
  for (const group of designs.values()) {
    if (group.length < 2) continue;
    const m = group[0].y.length;
    const invs = group.map((s) => inverse(s.V)!);
    const S = zeros(m, m);
    const b = new Array<number>(m).fill(0);
    group.forEach((s, g) => {
      const w = matVec(invs[g], s.y);
      for (let i = 0; i < m; i++) {
        b[i] += w[i];
        for (let j = 0; j < m; j++) S[i][j] += invs[g][i][j];
      }
    });
    const Sinv = inverse(S);
    if (!Sinv) continue;
    const theta = matVec(Sinv, b);
    group.forEach((s, g) => (Qwithin += quad(invs[g], s.y.map((v, i) => v - theta[i]))));
    dfWithin += (group.length - 1) * m;
  }
  const Qbetween = Math.max(0, Q - Qwithin);
  const dfBetween = df - dfWithin;

  return {
    ok: true,
    skipped,
    result: {
      treatments,
      reference: ref,
      studies: prepared.length,
      contrasts: n,
      multiArm: prepared.filter((s) => s.arms.length > 2).length,
      model,
      tau2,
      Q,
      df,
      pQ: df > 0 ? chi2Sf(Q, df) : NaN,
      I2: df > 0 && Q > 0 ? Math.max(0, (100 * (Q - df)) / Q) : 0,
      Qwithin,
      dfWithin,
      pWithin: dfWithin > 0 ? chi2Sf(Qwithin, dfWithin) : NaN,
      Qbetween,
      dfBetween,
      pBetween: dfBetween > 0 ? chi2Sf(Qbetween, dfBetween) : NaN,
      league,
      vsReference: treatments.map((t) => estimate(t, ref)),
      pscore,
      nodes,
      edges,
      split,
      notes,
    },
  };
}
