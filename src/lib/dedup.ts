// Hledání duplicit mezi záznamy z různých databází.
// Jisté shody (stejné DOI, PMID nebo shodný název) lze sloučit hromadně,
// pravděpodobné (podobný název) má potvrdit člověk.

import type { RecordItem } from './types';
import { normDoi, normTitle, stripDiacritics } from './util';

export interface DupGroup {
  ids: string[];
  reason: 'doi' | 'pmid' | 'title' | 'similar';
  certain: boolean;
  /** Podobnost názvů 0–1 (u jistých shod 1). */
  score: number;
}

type Rec = Pick<RecordItem, 'id' | 'title' | 'authors' | 'year' | 'doi' | 'pmid' | 'abstract' | 'journal' | 'duplicateOf'>;

/** Diceův koeficient nad dvojicemi znaků – 1 = shodné řetězce. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2);
    grams.set(g, (grams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2);
    const n = grams.get(g) ?? 0;
    if (n > 0) {
      grams.set(g, n - 1);
      hits++;
    }
  }
  return (2 * hits) / (a.length + b.length - 2);
}

const firstAuthor = (r: Rec) => stripDiacritics((r.authors[0]?.family ?? '').toLowerCase()).replace(/[^a-z]/g, '');

function yearsCompatible(a: Rec, b: Rec): boolean {
  if (a.year == null || b.year == null) return true;
  return Math.abs(a.year - b.year) <= 1; // online first vs. tištěné vydání
}

function doisConflict(a: Rec, b: Rec): boolean {
  const da = normDoi(a.doi);
  const db = normDoi(b.doi);
  return !!da && !!db && da !== db;
}

export const SIMILAR_THRESHOLD = 0.9;

export function findDuplicates(all: Rec[]): DupGroup[] {
  const records = all.filter((r) => !r.duplicateOf);
  const index = new Map(records.map((r, i) => [r.id, i]));
  const title = records.map((r) => normTitle(r.title));

  // Union-find pro jisté shody.
  const parent = records.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const reasonOf = new Map<number, DupGroup['reason']>();
  const union = (i: number, j: number, reason: DupGroup['reason']) => {
    const a = find(i);
    const b = find(j);
    if (a === b) return;
    parent[b] = a;
    reasonOf.set(a, reasonOf.get(a) ?? reasonOf.get(b) ?? reason);
  };

  const byKey = (key: (r: Rec, i: number) => string, reason: DupGroup['reason'], ok: (i: number, j: number) => boolean) => {
    const seen = new Map<string, number>();
    records.forEach((r, i) => {
      const k = key(r, i);
      if (!k) return;
      const j = seen.get(k);
      if (j === undefined) seen.set(k, i);
      else if (ok(j, i)) union(j, i, reason);
    });
  };

  byKey((r) => normDoi(r.doi), 'doi', () => true);
  byKey((r) => r.pmid.trim(), 'pmid', () => true);
  // Shodný název: jistá shoda jen u delších názvů nebo při shodě prvního autora;
  // krátké názvy typu „Editorial“ se opakují i u různých článků.
  byKey(
    (_, i) => title[i],
    'title',
    (i, j) =>
      yearsCompatible(records[i], records[j]) &&
      !doisConflict(records[i], records[j]) &&
      (title[i].length >= 25 || (firstAuthor(records[i]) !== '' && firstAuthor(records[i]) === firstAuthor(records[j]))),
  );

  const groups = new Map<number, number[]>();
  records.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  });

  const out: DupGroup[] = [];
  for (const [root, members] of groups) {
    if (members.length > 1) {
      out.push({ ids: members.map((i) => records[i].id), reason: reasonOf.get(root) ?? 'title', certain: true, score: 1 });
    }
  }

  // Pravděpodobné shody: seřadíme podle názvu (zepředu i zezadu) a porovnáme sousedy.
  const WINDOW = 8;
  const pairs = new Map<string, number>();
  const scan = (order: number[]) => {
    for (let a = 0; a < order.length; a++) {
      for (let b = a + 1; b < Math.min(order.length, a + 1 + WINDOW); b++) {
        const i = order[a];
        const j = order[b];
        if (find(i) === find(j)) continue;
        if (title[i].length < 15 || title[j].length < 15) continue;
        if (!yearsCompatible(records[i], records[j])) continue;
        const s = similarity(title[i], title[j]);
        const exact = s === 1;
        if (s >= SIMILAR_THRESHOLD || exact) {
          const key = i < j ? `${i}|${j}` : `${j}|${i}`;
          pairs.set(key, Math.max(pairs.get(key) ?? 0, s));
        }
      }
    }
  };
  const idxs = records.map((_, i) => i).filter((i) => title[i]);
  scan([...idxs].sort((a, b) => (title[a] < title[b] ? -1 : 1)));
  const rev = title.map((t) => t.split('').reverse().join(''));
  scan([...idxs].sort((a, b) => (rev[a] < rev[b] ? -1 : 1)));

  for (const [key, score] of pairs) {
    const [i, j] = key.split('|').map(Number);
    out.push({ ids: [records[i].id, records[j].id], reason: 'similar', certain: false, score });
  }

  // Stabilní pořadí: nejdřív jisté, pak podle podobnosti.
  return out.sort((a, b) => Number(b.certain) - Number(a.certain) || b.score - a.score || (index.get(a.ids[0]) ?? 0) - (index.get(b.ids[0]) ?? 0));
}

/** Záznam s nejúplnějšími údaji – ten se při sloučení ponechá. */
export function pickPrimary<T extends Rec>(records: T[]): T {
  const score = (r: T) => (r.abstract ? 4 : 0) + (r.doi ? 2 : 0) + (r.pmid ? 2 : 0) + (r.journal ? 1 : 0) + (r.authors.length ? 1 : 0);
  return [...records].sort((a, b) => score(b) - score(a))[0];
}

/** Doplní do ponechaného záznamu údaje, které má jen některá z duplicit. */
export function mergedFields(primary: RecordItem, dups: RecordItem[]): Partial<RecordItem> {
  const patch: Partial<RecordItem> = {};
  const keys = ['abstract', 'doi', 'pmid', 'journal', 'volume', 'issue', 'pages', 'url', 'language', 'pubType'] as const;
  for (const k of keys) {
    if (!primary[k]) {
      const donor = dups.find((d) => d[k]);
      if (donor) patch[k] = donor[k];
    }
  }
  if (primary.year == null) {
    const donor = dups.find((d) => d.year != null);
    if (donor) patch.year = donor.year;
  }
  if (!primary.authors.length) {
    const donor = dups.find((d) => d.authors.length);
    if (donor) patch.authors = donor.authors;
  }
  if (!primary.keywords.length) {
    const donor = dups.find((d) => d.keywords.length);
    if (donor) patch.keywords = donor.keywords;
  }
  return patch;
}
