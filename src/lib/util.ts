import type { Author, BibRecord } from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const nowIso = () => new Date().toISOString();

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

/** Řádky víceřádkového textu bez prázdných. */
export function lines(text: string): string[] {
  return (text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function splitList(text: string): string[] {
  return (text || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stripTags(html: string): string {
  return decodeEntities((html || '').replace(/<\/(h\d|p|div|li)>/gi, ' ').replace(/<[^>]+>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
};

export function decodeEntities(s: string): string {
  return (s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Název převedený na tvar vhodný pro porovnávání (bez diakritiky, interpunkce a mezer). */
export function normTitle(title: string): string {
  return stripDiacritics(stripTags(title).toLowerCase()).replace(/[^a-z0-9]+/g, '');
}

export function normDoi(doi: string): string {
  return (doi || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '')
    .replace(/[.,;\s]+$/, '');
}

/** "Novák, Jan" nebo "Jan Novák" nebo "Novák J" → Author. */
export function parseAuthor(raw: string): Author {
  const s = raw.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, (m) => (m.includes('.') ? '.' : ''));
  if (!s) return { family: '', given: '' };
  if (s.includes(',')) {
    const [family, ...rest] = s.split(',');
    return { family: family.trim(), given: rest.join(',').trim() };
  }
  const parts = s.split(' ');
  if (parts.length === 1) return { family: s, given: '' };
  // "Novák JK" nebo "Novák J. K." – příjmení následované iniciálami (styl PubMed a Scopus).
  const isInitials = (t: string) => /^(?:[A-ZÁ-Ž]\.?-?){1,4}$/.test(t);
  let cut = parts.length;
  while (cut > 1 && isInitials(parts[cut - 1])) cut--;
  if (cut < parts.length) return { family: parts.slice(0, cut).join(' '), given: parts.slice(cut).join(' ') };
  const last = parts[parts.length - 1];
  return { family: last, given: parts.slice(0, -1).join(' ') };
}

export function initials(given: string): string {
  const g = given.trim();
  if (!g) return '';
  // Samotné iniciály bez teček ("JK") rozdělíme po písmenech.
  if (/^[A-ZÁ-Ž]{1,4}$/.test(g)) return g.split('').map((c) => c + '.').join(' ');
  return g
    .split(/[\s]+/)
    .filter(Boolean)
    .map((part) =>
      part
        .split('-')
        .filter(Boolean)
        .map((p) => p[0].toUpperCase() + '.')
        .join('-'),
    )
    .join(' ');
}

export function emptyBib(): BibRecord {
  return {
    title: '',
    authors: [],
    year: null,
    journal: '',
    volume: '',
    issue: '',
    pages: '',
    doi: '',
    pmid: '',
    url: '',
    abstract: '',
    keywords: [],
    language: '',
    pubType: '',
  };
}

export function parseYear(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const m = String(s).match(/(1[5-9]\d\d|20\d\d)/);
  return m ? Number(m[1]) : null;
}

/** Krátké označení studie, např. "Novák et al. (2020)". */
export function shortLabel(r: { authors: Author[]; year: number | null; title: string }): string {
  const a = r.authors.filter((x) => x.family);
  let who: string;
  if (a.length === 0) who = r.title.slice(0, 40) || 'Bez názvu';
  else if (a.length === 1) who = a[0].family;
  else if (a.length === 2) who = `${a[0].family} a ${a[1].family}`;
  else who = `${a[0].family} et al.`;
  return `${who} (${r.year ?? 'b. r.'})`;
}

export function num(s: string | undefined | null): number {
  if (s == null) return NaN;
  const t = String(s).trim().replace(',', '.').replace('−', '-');
  if (t === '') return NaN;
  return Number(t);
}

/** Číslo v českém zápisu (desetinná čárka). */
export function fmt(x: number, digits = 2): string {
  if (!Number.isFinite(x)) return '–';
  return x.toFixed(digits).replace('.', ',').replace(/^-/, '−');
}

export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return '–';
  if (p < 0.001) return '< 0,001';
  return '= ' + p.toFixed(3).replace('.', ',');
}

export function escapeXml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function download(filename: string, data: Blob | string, mime = 'text/plain;charset=utf-8') {
  const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slug(s: string): string {
  return (
    stripDiacritics(s.toLowerCase())
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'projekt'
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Česká shoda číslovky: plural(5, 'záznam', 'záznamy', 'záznamů'). */
export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n);
  if (a === 1) return `${n} ${one}`;
  if (a >= 2 && a <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}
