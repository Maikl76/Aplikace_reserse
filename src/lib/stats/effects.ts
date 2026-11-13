// Výpočet velikosti účinku jedné studie (yi) a jejího rozptylu (vi) z údajů uvedených ve studii.
// Vzorce odpovídají běžné praxi (Borenstein et al., 2009; funkce escalc v balíku metafor).

import type { Measure } from '../types';
import { lgamma } from './distributions';
import { num } from '../util';

export interface MeasureInfo {
  id: Measure;
  name: string;
  short: string;
  /** Které vstupy je potřeba ze studie opsat. */
  inputs: { id: string; label: string }[];
  /** Škála, na které se počítá: log = logaritmus poměru, z = Fisherovo z. */
  scale: 'identity' | 'log' | 'z';
  /** Hodnota „bez účinku“ na zobrazované škále. */
  nullValue: number;
  explain: string;
}

const CONT = [
  { id: 'm1', label: 'Průměr – intervenční' },
  { id: 'sd1', label: 'SD – intervenční' },
  { id: 'n1', label: 'n – intervenční' },
  { id: 'm2', label: 'Průměr – kontrolní' },
  { id: 'sd2', label: 'SD – kontrolní' },
  { id: 'n2', label: 'n – kontrolní' },
];
const BIN = [
  { id: 'e1', label: 'Události – intervenční' },
  { id: 'n1', label: 'n – intervenční' },
  { id: 'e2', label: 'Události – kontrolní' },
  { id: 'n2', label: 'n – kontrolní' },
];

export const MEASURES: Record<Measure, MeasureInfo> = {
  SMD: {
    id: 'SMD',
    name: 'Standardizovaný rozdíl průměrů (Hedgesovo g)',
    short: 'SMD',
    inputs: CONT,
    scale: 'identity',
    nullValue: 0,
    explain: 'Pro spojité výstupy měřené různými škálami. Rozdíl průměrů se dělí společnou směrodatnou odchylkou a opraví na malé soubory.',
  },
  MD: {
    id: 'MD',
    name: 'Rozdíl průměrů',
    short: 'MD',
    inputs: CONT,
    scale: 'identity',
    nullValue: 0,
    explain: 'Pro spojité výstupy měřené ve všech studiích stejnou škálou a jednotkami. Výsledek je v původních jednotkách.',
  },
  OR: {
    id: 'OR',
    name: 'Poměr šancí',
    short: 'OR',
    inputs: BIN,
    scale: 'log',
    nullValue: 1,
    explain: 'Pro výstupy typu ano/ne. Počítá se na logaritmické škále; hodnota 1 znamená žádný rozdíl.',
  },
  RR: {
    id: 'RR',
    name: 'Relativní riziko',
    short: 'RR',
    inputs: BIN,
    scale: 'log',
    nullValue: 1,
    explain: 'Pro výstupy typu ano/ne. Poměr rizika ve dvou skupinách; hodnota 1 znamená žádný rozdíl.',
  },
  RD: {
    id: 'RD',
    name: 'Rozdíl rizik',
    short: 'RD',
    inputs: BIN,
    scale: 'identity',
    nullValue: 0,
    explain: 'Pro výstupy typu ano/ne. Absolutní rozdíl podílu událostí mezi skupinami.',
  },
  COR: {
    id: 'COR',
    name: 'Korelační koeficient',
    short: 'r',
    inputs: [
      { id: 'r', label: 'Korelace r' },
      { id: 'n', label: 'n' },
    ],
    scale: 'z',
    nullValue: 0,
    explain: 'Pro vztah dvou proměnných. Slučuje se po Fisherově z-transformaci a výsledek se převádí zpět na r.',
  },
  GEN: {
    id: 'GEN',
    name: 'Hotový efekt se směrodatnou chybou',
    short: 'efekt',
    inputs: [
      { id: 'y', label: 'Efekt' },
      { id: 'se', label: 'Směrodatná chyba' },
      { id: 'lo', label: 'nebo 95% CI od' },
      { id: 'hi', label: '95% CI do' },
    ],
    scale: 'identity',
    nullValue: 0,
    explain: 'Když studie uvádí přímo velikost účinku (např. upravený rozdíl). Zadejte směrodatnou chybu, nebo meze 95% intervalu spolehlivosti.',
  },
  RATIO: {
    id: 'RATIO',
    name: 'Hotový poměr (OR, RR, HR) s 95% CI',
    short: 'poměr',
    inputs: [
      { id: 'y', label: 'Poměr' },
      { id: 'lo', label: '95% CI od' },
      { id: 'hi', label: '95% CI do' },
    ],
    scale: 'log',
    nullValue: 1,
    explain: 'Když studie uvádí přímo poměr (např. upravený OR nebo HR) s intervalem spolehlivosti. Aplikace hodnoty sama zlogaritmuje.',
  },
};

export interface Effect {
  yi: number;
  vi: number;
  /** Poznámka k výpočtu (např. použitá korekce nulových buněk). */
  note?: string;
}

export type EffectResult = { ok: true; effect: Effect } | { ok: false; error: string };

const Z975 = 1.959963984540054;

/** Opravný faktor J pro Hedgesovo g (přesný tvar s funkcí gama). */
export function hedgesJ(df: number): number {
  if (df <= 1) return 1;
  return Math.exp(lgamma(df / 2) - Math.log(Math.sqrt(df / 2)) - lgamma((df - 1) / 2));
}

export function computeEffect(measure: Measure, raw: Record<string, string> | undefined): EffectResult {
  const v = (k: string) => num(raw?.[k]);
  const fail = (error: string): EffectResult => ({ ok: false, error });
  const done = (yi: number, vi: number, note?: string): EffectResult =>
    Number.isFinite(yi) && Number.isFinite(vi) && vi > 0 ? { ok: true, effect: { yi, vi, note } } : fail('Ze zadaných čísel nejde efekt spočítat.');

  if (!raw || MEASURES[measure].inputs.every((i) => (raw[i.id] ?? '').trim() === '')) return fail('Chybí data.');

  switch (measure) {
    case 'SMD':
    case 'MD': {
      const [m1, sd1, n1, m2, sd2, n2] = [v('m1'), v('sd1'), v('n1'), v('m2'), v('sd2'), v('n2')];
      if (![m1, sd1, n1, m2, sd2, n2].every(Number.isFinite)) return fail('Vyplňte průměr, SD a n obou skupin.');
      if (n1 < 2 || n2 < 2) return fail('Každá skupina musí mít alespoň 2 účastníky.');
      if (sd1 <= 0 || sd2 <= 0) return fail('Směrodatná odchylka musí být kladná.');
      if (measure === 'MD') return done(m1 - m2, (sd1 * sd1) / n1 + (sd2 * sd2) / n2);
      const df = n1 + n2 - 2;
      const sp = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / df);
      const g = hedgesJ(df) * ((m1 - m2) / sp);
      return done(g, 1 / n1 + 1 / n2 + (g * g) / (2 * (n1 + n2)));
    }
    case 'OR':
    case 'RR':
    case 'RD': {
      const [e1, n1, e2, n2] = [v('e1'), v('n1'), v('e2'), v('n2')];
      if (![e1, n1, e2, n2].every(Number.isFinite)) return fail('Vyplňte počet událostí a n obou skupin.');
      if (e1 < 0 || e2 < 0 || e1 > n1 || e2 > n2 || n1 <= 0 || n2 <= 0) return fail('Počet událostí musí být mezi 0 a n.');
      if (measure === 'RD') {
        const p1 = e1 / n1;
        const p2 = e2 / n2;
        let vi = (p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2;
        let note: string | undefined;
        if (vi === 0) {
          // Nulový rozptyl (0 % nebo 100 % událostí v obou skupinách): rozptyl odhadneme s korekcí 0,5.
          const q1 = (e1 + 0.5) / (n1 + 1);
          const q2 = (e2 + 0.5) / (n2 + 1);
          vi = (q1 * (1 - q1)) / (n1 + 1) + (q2 * (1 - q2)) / (n2 + 1);
          note = 'rozptyl s korekcí 0,5';
        }
        return done(p1 - p2, vi, note);
      }
      if ((e1 === 0 && e2 === 0) || (e1 === n1 && e2 === n2)) {
        return fail('V obou skupinách nenastala žádná (nebo nastala u všech) událost – studie k poměru nepřispívá.');
      }
      let [a, b, c, d] = [e1, n1 - e1, e2, n2 - e2];
      let note: string | undefined;
      if (a === 0 || b === 0 || c === 0 || d === 0) {
        [a, b, c, d] = [a + 0.5, b + 0.5, c + 0.5, d + 0.5];
        note = 'nulová buňka: korekce 0,5';
      }
      if (measure === 'OR') return done(Math.log((a * d) / (b * c)), 1 / a + 1 / b + 1 / c + 1 / d, note);
      return done(Math.log(a / (a + b) / (c / (c + d))), 1 / a - 1 / (a + b) + 1 / c - 1 / (c + d), note);
    }
    case 'COR': {
      const [r, n] = [v('r'), v('n')];
      if (!Number.isFinite(r) || !Number.isFinite(n)) return fail('Vyplňte r a n.');
      if (Math.abs(r) >= 1) return fail('Korelace musí být mezi −1 a 1.');
      if (n < 4) return fail('Pro korelaci je potřeba n alespoň 4.');
      return done(Math.atanh(r), 1 / (n - 3));
    }
    case 'GEN': {
      const [y, se, lo, hi] = [v('y'), v('se'), v('lo'), v('hi')];
      if (!Number.isFinite(y)) return fail('Vyplňte efekt.');
      if (Number.isFinite(se)) return se > 0 ? done(y, se * se) : fail('Směrodatná chyba musí být kladná.');
      if (Number.isFinite(lo) && Number.isFinite(hi)) {
        if (!(lo < hi)) return fail('Dolní mez intervalu musí být menší než horní.');
        return done(y, ((hi - lo) / (2 * Z975)) ** 2, 'SE odvozena z 95% CI');
      }
      return fail('Vyplňte směrodatnou chybu, nebo obě meze 95% CI.');
    }
    case 'RATIO': {
      const [y, lo, hi] = [v('y'), v('lo'), v('hi')];
      if (![y, lo, hi].every(Number.isFinite)) return fail('Vyplňte poměr a obě meze 95% CI.');
      if (y <= 0 || lo <= 0 || hi <= 0) return fail('Poměr i meze intervalu musí být kladné.');
      if (!(lo < hi)) return fail('Dolní mez intervalu musí být menší než horní.');
      return done(Math.log(y), ((Math.log(hi) - Math.log(lo)) / (2 * Z975)) ** 2, 'SE odvozena z 95% CI');
    }
  }
}

/** Převod z výpočetní škály zpět na zobrazovanou (např. z logaritmu na poměr). */
export function backTransform(measure: Measure, x: number): number {
  const scale = MEASURES[measure].scale;
  if (scale === 'log') return Math.exp(x);
  if (scale === 'z') return Math.tanh(x);
  return x;
}
