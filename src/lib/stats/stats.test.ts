import { describe, expect, it } from 'vitest';
import ref from '../../../tests/reference/reference.json';
import { chi2Sf, lgamma, normCdf, normInv, tCdf, tInv } from './distributions';
import { computeEffect, hedgesJ } from './effects';
import { eggerTest, leaveOneOut, metaAnalyze, subgroupAnalysis, tau2DL, tau2REML, type Study } from './meta';
import { overlap, studyKey } from './overlap';

// 13 studií vakcíny BCG (Colditz et al., 1994; datová sada dat.bcg balíku metafor).
const BCG = [
  [4, 119, 11, 128], [6, 300, 29, 274], [3, 228, 11, 209], [62, 13536, 248, 12619],
  [33, 5036, 47, 5761], [180, 1361, 372, 1079], [8, 2537, 10, 619], [505, 87886, 499, 87892],
  [29, 7470, 45, 7232], [17, 1699, 65, 1600], [186, 50448, 141, 27197], [5, 2493, 3, 2338],
  [27, 16886, 29, 17825],
];
const ALLOC = ['random', 'random', 'random', 'random', 'alternate', 'alternate', 'random', 'random', 'random', 'systematic', 'systematic', 'systematic', 'systematic'];

const studies: Study[] = BCG.map(([tpos, tneg, cpos, cneg], i) => {
  const r = computeEffect('RR', { e1: String(tpos), n1: String(tpos + tneg), e2: String(cpos), n2: String(cpos + cneg) });
  if (!r.ok) throw new Error(r.error);
  return { id: String(i), label: `Studie ${i + 1}`, yi: r.effect.yi, vi: r.effect.vi, subgroup: ALLOC[i] };
});

describe('rozdělení pravděpodobnosti', () => {
  const d = ref.dist;
  it('normální rozdělení', () => {
    expect(normCdf(1.96)).toBeCloseTo(d['normCdf_1.96'], 10);
    expect(normCdf(-3.5)).toBeCloseTo(d['normCdf_-3.5'], 12);
    expect(normInv(0.975)).toBeCloseTo(d['normInv_0.975'], 9);
    expect(normInv(0.001)).toBeCloseTo(d['normInv_0.001'], 9);
  });
  it('chí-kvadrát', () => {
    expect(chi2Sf(3.84, 1)).toBeCloseTo(d['chi2Sf_3.84_1'], 10);
    expect(chi2Sf(20, 12)).toBeCloseTo(d['chi2Sf_20_12'], 10);
    expect(chi2Sf(152.233, 12) / d['chi2Sf_152.233_12']).toBeCloseTo(1, 6);
  });
  it('Studentovo t', () => {
    expect(tCdf(2, 10)).toBeCloseTo(d['tCdf_2_10'], 10);
    expect(tCdf(-1.3, 3)).toBeCloseTo(d['tCdf_-1.3_3'], 10);
    expect(tInv(0.975, 11)).toBeCloseTo(d['tInv_0.975_11'], 7);
    expect(tInv(0.975, 1)).toBeCloseTo(d['tInv_0.975_1'], 6);
    expect(tInv(0.975, 120)).toBeCloseTo(d['tInv_0.975_120'], 7);
  });
  it('logaritmus funkce gama', () => {
    expect(lgamma(0.5)).toBeCloseTo(d['lgamma_0.5'], 9);
    expect(lgamma(10.3)).toBeCloseTo(d['lgamma_10.3'], 9);
  });
});

describe('velikosti účinku', () => {
  const e = ref.effects;
  it('relativní riziko odpovídá referenčním hodnotám pro všech 13 studií', () => {
    studies.forEach((s, i) => {
      expect(s.yi).toBeCloseTo(ref.bcg.yi[i], 10);
      expect(s.vi).toBeCloseTo(ref.bcg.vi[i], 10);
    });
  });
  it('Hedgesovo g a rozdíl průměrů', () => {
    const raw = { m1: '10', sd1: '2', n1: '20', m2: '8', sd2: '2,5', n2: '22' }; // i s desetinnou čárkou
    const smd = computeEffect('SMD', raw);
    const md = computeEffect('MD', raw);
    expect(smd.ok && md.ok).toBe(true);
    if (smd.ok && md.ok) {
      expect(smd.effect.yi).toBeCloseTo(e.smd.g, 10);
      expect(smd.effect.vi).toBeCloseTo(e.smd.v, 10);
      expect(md.effect.yi).toBeCloseTo(e.md.y, 12);
      expect(md.effect.vi).toBeCloseTo(e.md.v, 12);
    }
    expect(hedgesJ(40)).toBeCloseTo(e.smd.J, 10);
  });
  it('poměr šancí včetně korekce nulové buňky', () => {
    const first = computeEffect('OR', { e1: '4', n1: '123', e2: '11', n2: '139' });
    const zero = computeEffect('OR', { e1: '0', n1: '10', e2: '5', n2: '25' });
    expect(first.ok && zero.ok).toBe(true);
    if (first.ok && zero.ok) {
      expect(first.effect.yi).toBeCloseTo(e.or_first.y, 10);
      expect(first.effect.vi).toBeCloseTo(e.or_first.v, 10);
      expect(zero.effect.yi).toBeCloseTo(e.or_zero.y, 10);
      expect(zero.effect.vi).toBeCloseTo(e.or_zero.v, 10);
      expect(zero.effect.note).toContain('0,5');
    }
  });
  it('korelace přes Fisherovo z', () => {
    const r = computeEffect('COR', { r: '0.45', n: '50' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.effect.yi).toBeCloseTo(e.cor.y, 12);
      expect(r.effect.vi).toBeCloseTo(e.cor.v, 12);
    }
  });
  it('hotový poměr s intervalem spolehlivosti', () => {
    const r = computeEffect('RATIO', { y: '0.5', lo: '0.25', hi: '1.0' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.effect.yi).toBeCloseTo(Math.log(0.5), 12);
      expect(Math.sqrt(r.effect.vi)).toBeCloseTo((Math.log(1) - Math.log(0.25)) / (2 * 1.959963984540054), 10);
    }
  });
  it('odmítne neúplná nebo nesmyslná data', () => {
    expect(computeEffect('SMD', { m1: '1' }).ok).toBe(false);
    expect(computeEffect('SMD', {}).ok).toBe(false);
    expect(computeEffect('OR', { e1: '0', n1: '10', e2: '0', n2: '10' }).ok).toBe(false);
    expect(computeEffect('OR', { e1: '12', n1: '10', e2: '1', n2: '10' }).ok).toBe(false);
    expect(computeEffect('COR', { r: '1.2', n: '30' }).ok).toBe(false);
  });
});

describe('metaanalýza – data BCG', () => {
  const b = ref.bcg;
  it('model s pevným efektem', () => {
    const r = metaAnalyze(studies, { model: 'fixed', tau2: 'REML', knha: false })!;
    expect(r.estimate).toBeCloseTo(b.fixed.estimate, 8);
    expect(r.se).toBeCloseTo(b.fixed.se, 8);
    expect(r.Q).toBeCloseTo(b.fixed.Q, 6);
    expect(r.I2).toBeCloseTo(b.fixed.I2, 6);
    expect(r.tau2).toBe(0);
    expect(r.piLow).toBeNull();
  });
  it('DerSimonian–Laird', () => {
    expect(tau2DL(studies.map((s) => s.yi), studies.map((s) => s.vi))).toBeCloseTo(b.dl.tau2, 8);
    const r = metaAnalyze(studies, { model: 'random', tau2: 'DL', knha: false })!;
    expect(r.estimate).toBeCloseTo(b.dl.estimate, 8);
    expect(r.se).toBeCloseTo(b.dl.se, 8);
    // U DL se I² z τ² shoduje s klasickým výpočtem z Q.
    expect(r.I2).toBeCloseTo(b.fixed.I2, 6);
  });
  it('REML – shoda s nezávislou maximalizací věrohodnosti i s publikovaným výstupem metafor', () => {
    expect(tau2REML(studies.map((s) => s.yi), studies.map((s) => s.vi))).toBeCloseTo(b.reml.tau2, 6);
    const r = metaAnalyze(studies, { model: 'random', tau2: 'REML', knha: false })!;
    expect(r.estimate).toBeCloseTo(b.reml.estimate, 6);
    expect(r.se).toBeCloseTo(b.reml.se, 6);
    expect(r.ciLow).toBeCloseTo(b.reml.ciLow, 6);
    expect(r.ciHigh).toBeCloseTo(b.reml.ciHigh, 6);
    expect(r.I2).toBeCloseTo(b.reml.I2, 4);
    expect(r.H2).toBeCloseTo(b.reml.H2, 4);
    expect(r.piLow!).toBeCloseTo(b.reml.piLow, 5);
    expect(r.piHigh!).toBeCloseTo(b.reml.piHigh, 5);
    r.weights.forEach((w, i) => expect(w).toBeCloseTo(b.reml.weights[i], 4));
    expect(r.weights.reduce((x, y) => x + y, 0)).toBeCloseTo(100, 8);
    // Hodnoty z dokumentace metafor: rma(yi, vi, data = dat.bcg)
    expect(r.tau2).toBeCloseTo(0.3132, 4);
    expect(r.estimate).toBeCloseTo(-0.7145, 4);
    expect(r.se).toBeCloseTo(0.1798, 4);
    expect(r.I2).toBeCloseTo(92.22, 2);
    expect(r.Q).toBeCloseTo(152.233, 3);
  });
  it('Knappova–Hartungova úprava', () => {
    const r = metaAnalyze(studies, { model: 'random', tau2: 'REML', knha: true })!;
    expect(r.se).toBeCloseTo(b.knha.se, 6);
    expect(r.ciLow).toBeCloseTo(b.knha.ciLow, 5);
    expect(r.ciHigh).toBeCloseTo(b.knha.ciHigh, 5);
    expect(r.p).toBeCloseTo(b.knha.p, 7);
  });
  it('Eggerův test', () => {
    const e = eggerTest(studies)!;
    expect(e.intercept).toBeCloseTo(b.egger.intercept, 8);
    expect(e.t).toBeCloseTo(b.egger.t, 8);
    expect(e.p).toBeCloseTo(b.egger.p, 8);
    expect(e.df).toBe(11);
  });
  it('vynechání jedné studie a podskupiny', () => {
    const opts = { model: 'random', tau2: 'REML', knha: false } as const;
    const loo = leaveOneOut(studies, opts);
    expect(loo).toHaveLength(13);
    expect(loo.every((l) => l.result.k === 12)).toBe(true);
    const sub = subgroupAnalysis(studies, opts)!;
    expect(sub.groups.map((g) => g.name)).toEqual(['alternate', 'random', 'systematic']);
    expect(sub.groups.map((g) => g.result.k)).toEqual([2, 7, 4]);
    expect(sub.df).toBe(2);
    expect(sub.p).toBeGreaterThan(0);
    expect(sub.p).toBeLessThan(1);
  });
  it('okrajové případy', () => {
    const opts = { model: 'random', tau2: 'REML', knha: true } as const;
    expect(metaAnalyze([], opts)).toBeNull();
    const one = metaAnalyze([{ yi: 0.3, vi: 0.04 }], opts)!;
    expect(one.estimate).toBeCloseTo(0.3, 12);
    expect(one.se).toBeCloseTo(0.2, 12);
    expect(one.model).toBe('fixed');
    // Shodné studie: žádná heterogenita.
    const same = metaAnalyze([{ yi: 0.2, vi: 0.01 }, { yi: 0.2, vi: 0.02 }, { yi: 0.2, vi: 0.03 }], { model: 'random', tau2: 'REML', knha: false })!;
    expect(same.tau2).toBe(0);
    expect(same.I2).toBe(0);
    expect(same.Q).toBeCloseTo(0, 12);
  });
});

describe('překryv primárních studií (CCA)', () => {
  it('spočítá CCA podle Pieper et al. (2014)', () => {
    const r = overlap([
      { id: 'a', label: 'Přehled A', studies: ['Novák 2019', 'Smith et al. 2020', 'Lee 2018'] },
      { id: 'b', label: 'Přehled B', studies: ['novák 2019', 'Smith 2020', 'Brown 2021'] },
      { id: 'c', label: 'Přehled C', studies: ['Lee 2018', 'Green 2017'] },
    ]);
    expect(r.c).toBe(3);
    expect(r.r).toBe(5);
    expect(r.N).toBe(8);
    expect(r.cca).toBeCloseTo((100 * (8 - 5)) / (5 * 3 - 5), 10); // 30 %
    expect(r.level).toBe('velmi vysoký překryv');
    expect(r.rows[0].count).toBe(2);
  });
  it('sjednocuje zápis studií', () => {
    expect(studyKey('Smith et al. (2020)')).toBe(studyKey('smith 2020'));
    expect(studyKey('Novák & Malá, 2019')).toBe(studyKey('Novak a Mala 2019'));
  });
  it('bez dat nebo s jedním přehledem CCA nepočítá', () => {
    expect(overlap([]).cca).toBeNull();
    expect(overlap([{ id: 'a', label: 'A', studies: ['X 2020'] }]).cca).toBeNull();
  });
});
