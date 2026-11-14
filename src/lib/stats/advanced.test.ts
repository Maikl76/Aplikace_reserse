// Pokročilé analýzy ověřené proti balíku metafor (tests/reference/make_reference.R).
import { describe, expect, it } from 'vitest';
import data from '../../../tests/fixtures/metadat.json';
import ref from '../../../tests/reference/reference-metafor.json';
import { fSf } from './distributions';
import { computeEffect } from './effects';
import { inverse, logDetSpd, matMul } from './linalg';
import { metaAnalyze } from './meta';
import { buildDesign, metaRegression, predictReg } from './metareg';
import { compositeEffect, multilevel } from './multilevel';
import { networkMeta, type NetStudyInput } from './network';

const close = (a: number, b: number, tol = 1e-5) => expect(Math.abs(a - b)).toBeLessThan(tol * Math.max(1, Math.abs(b)));

describe('lineární algebra a F rozdělení', () => {
  it('inverze a determinant', () => {
    const A = [
      [4, 1, 0.5],
      [1, 3, 0.2],
      [0.5, 0.2, 2],
    ];
    const I = matMul(A, inverse(A)!);
    I.forEach((row, i) => row.forEach((x, j) => expect(x).toBeCloseTo(i === j ? 1 : 0, 12)));
    // det = 4·(6 − 0,04) − 1·(2 − 0,1) + 0,5·(0,2 − 1,5) = 21,29
    expect(logDetSpd(A)).toBeCloseTo(Math.log(21.29), 12);
    expect(inverse([[1, 2], [2, 4]])).toBeNull();
  });
  it('F rozdělení', () => {
    expect(fSf(1, 3, 10)).toBeCloseTo(ref.dist.fSf_1_3_10, 10);
    expect(fSf(4.2565, 2, 9)).toBeCloseTo(ref.dist['fSf_4.2565_2_9'], 10);
    expect(fSf(12.5, 4, 30) / ref.dist['fSf_12.5_4_30']).toBeCloseTo(1, 7);
  });
});

// ---- Metaregrese ----------------------------------------------------------------

describe('metaregrese (vakcína BCG, metafor::rma)', () => {
  const { yi, vi, ablat, year, alloc } = data.bcg;
  const ones = yi.map(() => 1);
  const X1 = yi.map((_, i) => [1, ablat[i]]);
  type R = (typeof ref.reg)['ablat_reml'];

  const check = (res: NonNullable<ReturnType<typeof metaRegression>>, r: Omit<R, 'pred'>) => {
    res.coef.forEach((c, j) => {
      close(c.b, r.b[j]);
      close(c.se, r.se[j]);
      close(c.stat, r.stat[j], 1e-4);
      close(c.p, r.pval[j], 1e-4);
      close(c.ciLow, r.ciLow[j]);
      close(c.ciHigh, r.ciHigh[j]);
    });
    close(res.tau2, r.tau2);
    close(res.I2, r.I2, 1e-4);
    close(res.H2, r.H2, 1e-4);
    close(res.QE, r.QE);
    close(res.pQE, r.pQE, 1e-4);
    close(res.QM, r.QM, 1e-4);
    close(res.pQM, r.pQM, 1e-4);
  };

  it('jeden spojitý moderátor, REML', () => {
    const res = metaRegression(yi, vi, X1, ['int', 'ablat'], { model: 'random', tau2: 'REML', knha: false })!;
    check(res, ref.reg.ablat_reml);
    close(res.R2!, ref.reg.ablat_reml.R2, 1e-4);
    // Publikovaný výstup metafor: sklon −0,0291 (SE 0,0072), τ² = 0,0764, R² = 75,62 %.
    expect(res.coef[1].b).toBeCloseTo(-0.0291, 4);
    expect(res.tau2).toBeCloseTo(0.0764, 3);
    ref.reg.ablat_reml.pred.x.forEach((x, i) => {
      const p = predictReg(res, [1, x]);
      close(p.pred, ref.reg.ablat_reml.pred.pred[i]);
      close(p.se, ref.reg.ablat_reml.pred.se[i]);
      close(p.ciLow, ref.reg.ablat_reml.pred.ciLow[i]);
    });
  });
  it('DerSimonian–Laird, pevný model a Knappova–Hartungova úprava', () => {
    check(metaRegression(yi, vi, X1, [], { model: 'random', tau2: 'DL', knha: false })!, ref.reg.ablat_dl);
    check(metaRegression(yi, vi, X1, [], { model: 'fixed', tau2: 'REML', knha: false })!, ref.reg.ablat_fe);
    const kh = metaRegression(yi, vi, X1, [], { model: 'random', tau2: 'REML', knha: true })!;
    check(kh, ref.reg.ablat_knha);
    expect(kh.test).toBe('t');
    ref.reg.ablat_knha.pred.x.forEach((x, i) => close(predictReg(kh, [1, x]).ciHigh, ref.reg.ablat_knha.pred.ciHigh[i]));
  });
  it('dva moderátory', () => {
    check(metaRegression(yi, vi, yi.map((_, i) => [1, ablat[i], year[i]]), [], { model: 'random', tau2: 'REML', knha: false })!, ref.reg.ablat_year);
  });
  it('kategoriální moderátor přes návrhovou matici', () => {
    // metafor bere jako referenční první úroveň podle abecedy (alternate); stejné kódování zadáme ručně.
    const X = yi.map((_, i) => [1, alloc[i] === 'random' ? 1 : 0, alloc[i] === 'systematic' ? 1 : 0]);
    check(metaRegression(yi, vi, X, [], { model: 'random', tau2: 'REML', knha: false })!, ref.reg.alloc);
    check(metaRegression(yi, vi, X, [], { model: 'random', tau2: 'REML', knha: true })!, ref.reg.alloc_knha);
  });
  it('model bez moderátorů dává stejný výsledek jako běžná metaanalýza', () => {
    const res = metaRegression(yi, vi, ones.map((x) => [x]), ['int'], { model: 'random', tau2: 'REML', knha: false })!;
    const ma = metaAnalyze(yi.map((y, i) => ({ yi: y, vi: vi[i] })), { model: 'random', tau2: 'REML', knha: false })!;
    close(res.coef[0].b, ma.estimate, 1e-8);
    close(res.tau2, ma.tau2, 1e-8);
    close(res.I2, ma.I2, 1e-8);
  });
  it('sestavení návrhové matice', () => {
    const d = buildDesign(
      [
        { id: 'a', label: 'Šířka', kind: 'number', values: ['44', '55,5', '', '13'] },
        { id: 'b', label: 'Přidělení', kind: 'category', values: ['náhodné', 'střídavé', 'náhodné', 'náhodné'] },
      ],
      4,
    );
    expect(d.rows).toEqual([0, 1, 3]); // studie bez hodnoty vypadne
    expect(d.names).toEqual(['Absolutní člen', 'Šířka', 'Přidělení: střídavé']);
    expect(d.reference.b).toBe('náhodné'); // nejčastější úroveň je referenční
    expect(d.X).toEqual([
      [1, 44, 0],
      [1, 55.5, 1],
      [1, 13, 0],
    ]);
    expect(metaRegression([0.1, 0.2], [0.1, 0.1], [[1, 1], [1, 2]], [], { model: 'random', tau2: 'REML', knha: false })).toBeNull(); // málo studií
  });
});

// ---- Závislé efekty ---------------------------------------------------------------

describe('tříúrovňový model (metafor::rma.mv)', () => {
  type R = (typeof ref.ml)['konst'];
  const check = (res: NonNullable<ReturnType<typeof multilevel>>, r: Omit<R, 'piLow' | 'piHigh'>) => {
    expect(res.converged).toBe(true);
    res.coef.forEach((c, j) => {
      close(c.b, r.b[j], 1e-4);
      close(c.se, r.se[j], 1e-4);
    });
    close(res.sigma2Between, r.sigma2Between, 2e-4);
    close(res.sigma2Within, r.sigma2Within, 2e-4);
    close(res.I2Between, r.I2[0], 2e-4);
    close(res.I2Within, r.I2[1], 2e-4);
    close(res.QE, r.QE);
    close(res.logLik, r.logLik, 1e-5);
  };
  it('školy v obvodech (Konstantopoulos, 2011)', () => {
    const d = data.konst;
    const res = multilevel(d.yi, d.vi, d.district)!;
    check(res, ref.ml.konst);
    // Publikovaný výstup: odhad 0,1847 (SE 0,0846), σ² = 0,0651 a 0,0327.
    expect(res.estimate).toBeCloseTo(0.1847, 4);
    expect(res.sigma2Between).toBeCloseTo(0.0651, 3);
    expect(res.sigma2Within).toBeCloseTo(0.0327, 3);
    expect(res.clusters).toBe(11);
    close(res.piLow!, ref.ml.konst.piLow, 1e-4);
    close(res.piHigh!, ref.ml.konst.piHigh, 1e-4);
  });
  it('s moderátorem', () => {
    const d = data.konst;
    const res = multilevel(d.yi, d.vi, d.district, d.yi.map((_, i) => [1, d.year[i]]))!;
    check(res, ref.ml.konst_year);
    close(res.QM, ref.ml.konst_year.QM, 1e-3);
  });
  it('100 efektů ze 17 studií (Assink a Wibbelink, 2016)', () => {
    const d = data.assink;
    check(multilevel(d.yi, d.vi, d.study)!, ref.ml.assink);
    const levels = [...new Set(d.deltype)].sort();
    const X = d.yi.map((_, i) => [1, ...levels.slice(1).map((l) => (d.deltype[i] === l ? 1 : 0))]);
    check(multilevel(d.yi, d.vi, d.study, X)!, ref.ml.assink_deltype);
  });
  it('bez studie s více efekty se odhaduje jen rozptyl mezi studiemi', () => {
    const { yi, vi } = data.bcg;
    const res = multilevel(yi, vi, yi.map((_, i) => `s${i}`))!;
    const ma = metaAnalyze(yi.map((y, i) => ({ yi: y, vi: vi[i] })), { model: 'random', tau2: 'REML', knha: false })!;
    close(res.estimate, ma.estimate, 1e-6);
    close(res.sigma2Between, ma.tau2, 1e-6);
    expect(res.sigma2Within).toBe(0);
  });
});

describe('sloučení efektů uvnitř studie (metafor::aggregate, weighted = FALSE)', () => {
  it('odpovídá referenčním hodnotám', () => {
    const d = data.assink;
    const r = ref.aggregate;
    const composites = r.study.map((s) => compositeEffect(d.yi.map((y, i) => ({ yi: y, vi: d.vi[i], s: d.study[i] })).filter((e) => e.s === s), r.rho));
    composites.forEach((c, i) => {
      close(c.yi, r.yi[i], 1e-8);
      close(c.vi, r.vi[i], 1e-8);
    });
    const ma = metaAnalyze(composites, { model: 'random', tau2: 'REML', knha: false })!;
    close(ma.estimate, r.b, 1e-6);
    close(ma.se, r.se, 1e-6);
    close(ma.tau2, r.tau2, 1e-5);
  });
  it('jeden efekt se nemění; nezávislé efekty dávají průměr s rozptylem Σv/m²', () => {
    expect(compositeEffect([{ yi: 0.3, vi: 0.04 }], 0.6)).toEqual({ yi: 0.3, vi: 0.04 });
    const c = compositeEffect([{ yi: 0.2, vi: 0.04 }, { yi: 0.4, vi: 0.08 }], 0);
    expect(c.yi).toBeCloseTo(0.3, 12);
    expect(c.vi).toBeCloseTo(0.03, 12);
  });
});

// ---- Síťová metaanalýza -----------------------------------------------------------

/** Z údajů o ramenech sestaví všechna párová srovnání studie. */
function armsToStudies<A>(ids: (string | number)[], arms: A[], trt: (a: A) => string, effect: (x: A, y: A) => { yi: number; vi: number }, armVar?: (a: A) => number): NetStudyInput[] {
  const out: NetStudyInput[] = [];
  for (const id of [...new Set(ids)]) {
    const mine = arms.filter((_, i) => ids[i] === id);
    const contrasts = [];
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) contrasts.push({ t1: trt(mine[i]), t2: trt(mine[j]), ...effect(mine[i], mine[j]) });
    out.push({ id: String(id), label: `Studie ${id}`, contrasts, armVar: armVar ? Object.fromEntries(mine.map((a) => [trt(a), armVar(a)])) : undefined });
  }
  return out;
}

describe('síťová metaanalýza (metafor::rma.mv, kontrastní model)', () => {
  const h = data.hasselblad;
  const hArms = h.study.map((_, i) => ({ trt: h.trt[i], x: h.xi[i], n: h.ni[i] }));
  const or = (a: { x: number; n: number }, b: { x: number; n: number }) => {
    const r = computeEffect('OR', { e1: String(a.x), n1: String(a.n), e2: String(b.x), n2: String(b.n) });
    if (!r.ok) throw new Error(r.error);
    return r.effect;
  };
  const hStudies = armsToStudies(h.study, hArms, (a) => a.trt, or, (a) => 1 / a.x + 1 / (a.n - a.x));

  const s = data.senn;
  const sArms = s.study.map((_, i) => ({ trt: s.treatment[i], n: s.ni[i], m: s.mi[i], sd: s.sdi[i] }));
  const md = (a: (typeof sArms)[0], b: (typeof sArms)[0]) => ({ yi: a.m - b.m, vi: (a.sd * a.sd) / a.n + (b.sd * b.sd) / b.n });
  const sStudies = armsToStudies(s.study, sArms, (a) => a.trt, md, (a) => (a.sd * a.sd) / a.n);

  const check = (out: ReturnType<typeof networkMeta>, r: { names: string[]; b: number[]; se: number[]; tau2: number; QE: number; k: number }) => {
    if (!out.ok) throw new Error(out.error);
    const res = out.result;
    r.names.forEach((name, j) => {
      const e = res.vsReference[res.treatments.indexOf(name)];
      close(e.est, r.b[j], 2e-4);
      close(e.se, r.se[j], 2e-4);
    });
    close(res.tau2, r.tau2, 5e-4);
    close(res.Q, r.QE, 1e-6);
    expect(res.contrasts).toBe(r.k);
    return res;
  };

  it('odvykání kouření (Hasselblad, 1998): 24 studií, dvě tříramenné', () => {
    const re = check(networkMeta(hStudies, { model: 'random', reference: 'no_contact', smallerBetter: false }), ref.nma.hasselblad_re);
    expect(re.studies).toBe(24);
    expect(re.multiArm).toBe(2);
    expect(re.treatments).toHaveLength(4);
    // P-skóre: v R je pořadí [referenční, ostatní podle modelu].
    const order = ['no_contact', ...ref.nma.hasselblad_re.names];
    order.forEach((t, i) => close(re.pscore.find((p) => p.treatment === t)!.value, ref.nma.hasselblad_re.pscore[i], 1e-3));
    expect(re.pscore[0].treatment).toBe('grp_counseling');

    const fe = check(networkMeta(hStudies, { model: 'fixed', reference: 'no_contact', smallerBetter: false }), ref.nma.hasselblad_fe);
    close(fe.Qwithin, ref.nma.hasselblad_fe.within.Q, 1e-6);
    expect(fe.dfWithin).toBe(ref.nma.hasselblad_fe.within.df);
    expect(fe.df).toBe(23);
  });

  it('kovariance u tříramenných studií jde odvodit i jen z rozptylů tří kontrastů', () => {
    const noArm = hStudies.map((x) => ({ ...x, armVar: undefined }));
    const a = networkMeta(hStudies, { model: 'random', reference: 'no_contact', smallerBetter: false });
    const b = networkMeta(noArm, { model: 'random', reference: 'no_contact', smallerBetter: false });
    if (!a.ok || !b.ok) throw new Error('síť nešla spočítat');
    a.result.vsReference.forEach((e, i) => close(b.result.vsReference[i].est, e.est, 1e-8));
    expect(b.result.notes).toHaveLength(0);
  });

  it('léky na diabetes (Senn et al., 2013): 26 studií, 10 léčeb', () => {
    const re = check(networkMeta(sStudies, { model: 'random', reference: 'placebo', smallerBetter: true }), ref.nma.senn_re);
    const order = ['placebo', ...ref.nma.senn_re.names];
    order.forEach((t, i) => close(re.pscore.find((p) => p.treatment === t)!.value, ref.nma.senn_re.pscore[i], 1e-3));
    expect(re.pscore[0].treatment).toBe('rosiglitazone');
    expect(re.pscore[re.pscore.length - 1].treatment).toBe('placebo');

    const fe = check(networkMeta(sStudies, { model: 'fixed', reference: 'placebo', smallerBetter: true }), ref.nma.senn_fe);
    // Publikovaný rozklad (netmeta, decomp.design): Q = 96,98 (df 18); uvnitř designů 74,46 (df 11); mezi designy 22,53 (df 7).
    expect(fe.Q).toBeCloseTo(96.98, 1);
    expect(fe.df).toBe(18);
    close(fe.Qwithin, ref.nma.senn_fe.within.Q, 1e-6);
    expect(fe.dfWithin).toBe(11);
    expect(fe.Qbetween).toBeCloseTo(22.53, 1);
    expect(fe.dfBetween).toBe(7);
  });

  it('volba referenční léčby nemění srovnání mezi léčbami', () => {
    const a = networkMeta(sStudies, { model: 'random', reference: 'placebo', smallerBetter: true });
    const b = networkMeta(sStudies, { model: 'random', reference: 'metformin', smallerBetter: true });
    if (!a.ok || !b.ok) throw new Error('síť nešla spočítat');
    const ia = a.result.treatments.indexOf('rosiglitazone');
    const ja = a.result.treatments.indexOf('acarbose');
    close(b.result.league[ia][ja].est, a.result.league[ia][ja].est, 1e-6);
    close(b.result.league[ia][ja].se, a.result.league[ia][ja].se, 1e-6);
    close(b.result.tau2, a.result.tau2, 1e-6);
    expect(b.result.reference).toBe('metformin');
  });

  it('trojúhelník A–B–C: síťový odhad spojuje přímé a nepřímé důkazy', () => {
    const tri: NetStudyInput[] = [
      { id: '1', label: 'S1', contrasts: [{ t1: 'B', t2: 'A', yi: 0.5, vi: 0.04 }] },
      { id: '2', label: 'S2', contrasts: [{ t1: 'C', t2: 'A', yi: 0.9, vi: 0.05 }] },
      { id: '3', label: 'S3', contrasts: [{ t1: 'C', t2: 'B', yi: 0.1, vi: 0.02 }] },
    ];
    const out = networkMeta(tri, { model: 'fixed', reference: 'A', smallerBetter: false });
    if (!out.ok) throw new Error(out.error);
    const res = out.result;
    // B vs. A: přímo 0,5 (v = 0,04); nepřímo 0,9 − 0,1 = 0,8 (v = 0,07). Vážený průměr = (0,5/0,04 + 0,8/0,07)/(1/0,04 + 1/0,07).
    const expected = (0.5 / 0.04 + 0.8 / 0.07) / (1 / 0.04 + 1 / 0.07);
    const ba = res.league[res.treatments.indexOf('B')][res.treatments.indexOf('A')];
    expect(ba.est).toBeCloseTo(expected, 10);
    expect(ba.se).toBeCloseTo(Math.sqrt(1 / (1 / 0.04 + 1 / 0.07)), 10);
    const sp = res.split.find((x) => x.a === 'A' && x.b === 'B')!;
    expect(sp.direct.est).toBeCloseTo(-0.5, 10); // A oproti B
    expect(sp.indirect!.est).toBeCloseTo(-0.8, 8);
    expect(sp.indirect!.se).toBeCloseTo(Math.sqrt(0.07), 8);
    // Nekonzistence smyčky: (0,5 − 0,8)² / (0,04 + 0,07) = Q s jedním stupněm volnosti.
    expect(res.Q).toBeCloseTo(0.09 / 0.11, 10);
    expect(res.df).toBe(1);
    expect(res.Qbetween).toBeCloseTo(res.Q, 10);
    expect(sp.z! * sp.z!).toBeCloseTo(res.Q, 8);
  });

  it('nesouvislá síť a příliš málo léčeb se odmítnou s vysvětlením', () => {
    const two = networkMeta([{ id: '1', label: 'S1', contrasts: [{ t1: 'B', t2: 'A', yi: 0.5, vi: 0.04 }] }], { model: 'random', smallerBetter: false });
    expect(two.ok).toBe(false);
    const split = networkMeta(
      [
        { id: '1', label: 'S1', contrasts: [{ t1: 'B', t2: 'A', yi: 0.5, vi: 0.04 }] },
        { id: '2', label: 'S2', contrasts: [{ t1: 'D', t2: 'C', yi: 0.5, vi: 0.04 }] },
      ],
      { model: 'random', smallerBetter: false },
    );
    expect(split.ok).toBe(false);
    if (!split.ok) expect(split.error).toContain('není souvislá');
  });

  it('názvy léčeb se sjednocují bez ohledu na velikost písmen; neúplná tříramenná studie se vynechá', () => {
    const out = networkMeta(
      [
        { id: '1', label: 'S1', contrasts: [{ t1: 'Placebo', t2: 'A', yi: 0.5, vi: 0.04 }] },
        { id: '2', label: 'S2', contrasts: [{ t1: 'B', t2: 'placebo ', yi: 0.5, vi: 0.04 }] },
        { id: '3', label: 'S3', contrasts: [{ t1: 'B', t2: 'A', yi: 0.1, vi: 0.04 }] },
        { id: '4', label: 'S4', contrasts: [{ t1: 'A', t2: 'B', yi: 0.1, vi: 0.04 }, { t1: 'C', t2: 'D', yi: 0.1, vi: 0.04 }] },
      ],
      { model: 'fixed', smallerBetter: false },
    );
    if (!out.ok) throw new Error(out.error);
    expect(out.result.treatments).toEqual(['A', 'B', 'Placebo']);
    expect(out.skipped.map((x) => x.id)).toEqual(['4']);
  });
});
