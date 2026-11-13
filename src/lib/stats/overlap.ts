// Překryv primárních studií mezi systematickými přehledy (zastřešující přehled).
// Corrected covered area (CCA) podle Pieper et al. (2014).

import { stripDiacritics } from '../util';

export interface OverlapInput {
  id: string;
  label: string;
  /** Primární studie zahrnuté v přehledu, jedna na řádek (např. „Novák 2019“). */
  studies: string[];
}

export interface OverlapResult {
  reviews: { id: string; label: string }[];
  /** Unikátní primární studie (řádky matice). */
  rows: { key: string; label: string; inReviews: boolean[]; count: number }[];
  /** N – součet zahrnutí včetně opakování. */
  N: number;
  /** r – počet unikátních primárních studií. */
  r: number;
  /** c – počet přehledů. */
  c: number;
  /** CCA v procentech; null, pokud nejde spočítat. */
  cca: number | null;
  level: string;
}

export function studyKey(label: string): string {
  return stripDiacritics(label.toLowerCase())
    .replace(/\bet\s+al\.?/g, '')
    .replace(/\b(and|a|&)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function interpretCCA(cca: number): string {
  if (cca <= 5) return 'mírný překryv';
  if (cca <= 10) return 'střední překryv';
  if (cca <= 15) return 'vysoký překryv';
  return 'velmi vysoký překryv';
}

export function overlap(inputs: OverlapInput[]): OverlapResult {
  const reviews = inputs.filter((i) => i.studies.some((s) => studyKey(s)));
  const map = new Map<string, { label: string; inReviews: boolean[] }>();
  reviews.forEach((rev, col) => {
    for (const raw of rev.studies) {
      const key = studyKey(raw);
      if (!key) continue;
      if (!map.has(key)) map.set(key, { label: raw.trim(), inReviews: reviews.map(() => false) });
      map.get(key)!.inReviews[col] = true;
    }
  });
  const rows = [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, inReviews: v.inReviews, count: v.inReviews.filter(Boolean).length }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const N = rows.reduce((a, r) => a + r.count, 0);
  const r = rows.length;
  const c = reviews.length;
  const cca = c > 1 && r > 0 ? (100 * (N - r)) / (r * c - r) : null;
  return {
    reviews: reviews.map((x) => ({ id: x.id, label: x.label })),
    rows,
    N,
    r,
    c,
    cca,
    level: cca == null ? '' : interpretCCA(cca),
  };
}
