// Formátování citací: APA 7 a ČSN ISO 690 (forma jméno–datum).
// Výstupem jsou úseky textu s příznakem kurzívy, aby šly vykreslit do HTML, Markdownu i DOCX.

import type { Author, CitationStyle, RecordItem } from './types';
import { initials, stripDiacritics } from './util';

export interface Span {
  text: string;
  italic?: boolean;
}

type Bib = Pick<RecordItem, 'id' | 'title' | 'authors' | 'year' | 'journal' | 'volume' | 'issue' | 'pages' | 'doi' | 'url'>;

const dash = (pages: string) => pages.replace(/\s*[-–—]+\s*/g, '–');
const endDot = (s: string) => (/[.?!]$/.test(s.trim()) ? s.trim() : s.trim() + '.');
const link = (r: Bib) => (r.doi ? `https://doi.org/${r.doi}` : r.url);

// ---- APA 7 -----------------------------------------------------------------

function apaName(a: Author): string {
  const i = initials(a.given);
  return i ? `${a.family}, ${i}` : a.family;
}

function apaAuthors(authors: Author[]): string {
  const names = authors.map(apaName);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
  return `${names.slice(0, 19).join(', ')}, … ${names[names.length - 1]}`;
}

function apa(r: Bib, suffix: string): Span[] {
  const year = `(${r.year ?? 'n.d.'}${suffix})`;
  const out: Span[] = [];
  const authors = apaAuthors(r.authors);
  // Bez autorů se na první místo přesouvá název.
  out.push({ text: authors ? `${authors.replace(/\.$/, '')}. ${year}. ${endDot(r.title)} ` : `${endDot(r.title)} ${year}. ` });
  if (r.journal) {
    out.push({ text: r.journal, italic: true });
    if (r.volume) {
      out.push({ text: ', ' });
      out.push({ text: r.volume, italic: true });
    }
    if (r.issue) out.push({ text: `(${r.issue})` });
    if (r.pages) out.push({ text: `, ${dash(r.pages)}` });
    out.push({ text: '.' });
  }
  const url = link(r);
  if (url) out.push({ text: ` ${url}` });
  return out;
}

// ---- ČSN ISO 690 -----------------------------------------------------------

function isoName(a: Author): string {
  const family = a.family.toLocaleUpperCase('cs');
  return a.given ? `${family}, ${a.given}` : family;
}

function isoAuthors(authors: Author[]): string {
  const names = authors.map(isoName);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length > 5) return `${names[0]} et al.`;
  return `${names.slice(0, -1).join('; ')} a ${names[names.length - 1]}`;
}

function iso690(r: Bib, suffix: string): Span[] {
  const out: Span[] = [];
  const authors = isoAuthors(r.authors);
  const year = `${r.year ?? 'b. r.'}${suffix}`;
  out.push({ text: authors ? `${authors}, ${year}. ${endDot(r.title)} ` : `${endDot(r.title)} ${year}. ` });
  if (r.journal) {
    out.push({ text: r.journal, italic: true });
    out.push({ text: '.' });
    const parts = [r.volume ? `Roč. ${r.volume}` : '', r.issue ? `č. ${r.issue}` : '', r.pages ? `s. ${dash(r.pages)}` : ''].filter(Boolean);
    if (parts.length) out.push({ text: ` ${parts.join(', ')}.` });
  }
  const url = link(r);
  if (url) out.push({ text: ` Dostupné z: ${url}` });
  return out;
}

// ---- Odkazy v textu --------------------------------------------------------

function inTextNames(authors: Author[], style: CitationStyle): string {
  const a = authors.filter((x) => x.family);
  if (a.length === 0) return '';
  if (a.length === 1) return a[0].family;
  if (a.length === 2) return `${a[0].family} ${style === 'apa' ? '&' : 'a'} ${a[1].family}`;
  return `${a[0].family} et al.`;
}

export interface Cited {
  id: string;
  /** Odkaz v textu bez závorek, např. „Novák et al., 2020a“. */
  inText: string;
  /** Tvar pro použití ve větě, např. „Novák et al. (2020a)“. */
  narrative: string;
  reference: Span[];
  /** Položka seznamu literatury jako prostý text. */
  plain: string;
}

const sortKey = (r: Bib) => stripDiacritics(`${r.authors[0]?.family ?? r.title} ${r.authors[1]?.family ?? ''}`.toLowerCase());

/**
 * Připraví citace pro sadu záznamů: seřadí je abecedně a rozliší díla stejných autorů
 * ze stejného roku písmeny a, b, c.
 */
export function buildCitations(records: Bib[], style: CitationStyle): Cited[] {
  const sorted = [...records].sort((a, b) => sortKey(a).localeCompare(sortKey(b), 'cs') || (a.year ?? 0) - (b.year ?? 0) || a.title.localeCompare(b.title, 'cs'));
  const base = (r: Bib) => `${inTextNames(r.authors, style) || shortTitle(r.title)}|${r.year ?? ''}`;
  const counts = new Map<string, number>();
  for (const r of sorted) counts.set(base(r), (counts.get(base(r)) ?? 0) + 1);
  const used = new Map<string, number>();
  return sorted.map((r) => {
    const key = base(r);
    let suffix = '';
    if ((counts.get(key) ?? 0) > 1) {
      const n = used.get(key) ?? 0;
      used.set(key, n + 1);
      suffix = String.fromCharCode(97 + n);
    }
    const names = inTextNames(r.authors, style) || shortTitle(r.title);
    const year = `${r.year ?? (style === 'apa' ? 'n.d.' : 'b. r.')}${suffix}`;
    const reference = trimEnd(style === 'apa' ? apa(r, suffix) : iso690(r, suffix));
    return {
      id: r.id,
      inText: `${names}, ${year}`,
      narrative: `${names} (${year})`,
      reference,
      plain: reference.map((s) => s.text).join(''),
    };
  });
}

function trimEnd(spans: Span[]): Span[] {
  const last = spans[spans.length - 1];
  if (last) last.text = last.text.trimEnd();
  return spans;
}

function shortTitle(title: string): string {
  const words = title.split(/\s+/).slice(0, 4).join(' ');
  return words.length < title.length ? `„${words}…“` : `„${words}“`;
}

export const STYLE_LABELS: Record<CitationStyle, string> = {
  apa: 'APA 7',
  iso690: 'ČSN ISO 690',
};
