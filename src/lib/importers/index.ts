// Import bibliografických záznamů ze souborů exportovaných z databází
// (Scopus, Web of Science, EBSCO, PubMed, Zotero…).

import type { Author, BibRecord } from '../types';
import { decodeEntities, emptyBib, normDoi, parseAuthor, parseYear, stripTags } from '../util';

export type ImportFormat = 'ris' | 'nbib' | 'bibtex' | 'csv';

export const FORMAT_LABELS: Record<ImportFormat, string> = {
  ris: 'RIS',
  nbib: 'PubMed (NBIB)',
  bibtex: 'BibTeX',
  csv: 'CSV / tabulka',
};

export function detectFormat(filename: string, text: string): ImportFormat {
  const name = filename.toLowerCase();
  const head = text.slice(0, 5000);
  if (name.endsWith('.nbib') || /^PMID\s*- /m.test(head)) return 'nbib';
  if (name.endsWith('.ris') || /^TY {2}- /m.test(head)) return 'ris';
  if (name.endsWith('.bib') || /^\s*@\w+\s*\{/m.test(head)) return 'bibtex';
  return 'csv';
}

export function parseFile(filename: string, text: string): { format: ImportFormat; records: BibRecord[] } {
  const clean = text.replace(/^﻿/, '');
  const format = detectFormat(filename, clean);
  const parser = { ris: parseRis, nbib: parseNbib, bibtex: parseBibtex, csv: parseCsv }[format];
  return { format, records: parser(clean).filter((r) => r.title || r.doi) };
}

function tidy(r: BibRecord): BibRecord {
  r.title = stripTags(r.title).replace(/\s+/g, ' ').trim();
  r.abstract = stripTags(r.abstract);
  r.journal = decodeEntities(r.journal).trim();
  r.doi = normDoi(r.doi);
  r.authors = r.authors.filter((a) => a.family);
  r.keywords = r.keywords.map((k) => k.trim()).filter(Boolean);
  return r;
}

function doiFrom(text: string): string {
  const m = text.match(/10\.\d{4,9}\/[^\s"<>]+/);
  return m ? m[0] : '';
}

// ---- RIS -------------------------------------------------------------------

export function parseRis(text: string): BibRecord[] {
  const out: BibRecord[] = [];
  let cur: Record<string, string[]> | null = null;
  let lastTag = '';
  const flush = () => {
    if (cur && Object.keys(cur).length) out.push(risToBib(cur));
    cur = null;
    lastTag = '';
  };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z][A-Z0-9]) {1,2}-(?: (.*))?$/);
    if (m) {
      const [, tag, value = ''] = m;
      if (tag === 'ER') {
        flush();
        continue;
      }
      if (tag === 'TY' && cur) flush();
      cur ??= {};
      (cur[tag] ??= []).push(value.trim());
      lastTag = tag;
    } else if (cur && lastTag && line.trim()) {
      // Pokračování předchozího pole na dalším řádku.
      const arr = cur[lastTag];
      arr[arr.length - 1] += ' ' + line.trim();
    }
  }
  flush();
  return out;
}

function risToBib(t: Record<string, string[]>): BibRecord {
  const first = (...tags: string[]) => {
    for (const tag of tags) if (t[tag]?.[0]) return t[tag][0];
    return '';
  };
  const r = emptyBib();
  r.title = first('TI', 'T1', 'ST', 'CT');
  r.authors = [...(t.AU ?? []), ...(t.A1 ?? [])].map(parseAuthor);
  r.year = parseYear(first('PY', 'Y1', 'DA'));
  r.journal = first('JF', 'JO', 'T2', 'J2', 'JA');
  r.volume = first('VL');
  r.issue = first('IS');
  const sp = first('SP');
  const ep = first('EP');
  r.pages = sp && ep && !sp.includes('-') ? `${sp}–${ep}` : sp;
  r.doi = first('DO') || doiFrom([...(t.UR ?? []), ...(t.M3 ?? []), ...(t.L3 ?? [])].join(' '));
  r.abstract = first('AB', 'N2');
  r.keywords = (t.KW ?? []).flatMap((k) => k.split(/;\s*/));
  r.url = first('UR', 'L2');
  r.language = first('LA');
  r.pubType = first('M3') && !/10\.\d{4}/.test(first('M3')) ? first('M3') : first('TY');
  return tidy(r);
}

// ---- NBIB (formát MEDLINE z PubMedu) --------------------------------------

export function parseNbib(text: string): BibRecord[] {
  const out: BibRecord[] = [];
  let cur: Record<string, string[]> | null = null;
  let lastTag = '';
  const flush = () => {
    if (cur && Object.keys(cur).length) out.push(nbibToBib(cur));
    cur = null;
    lastTag = '';
  };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z]{2,4}) *- (.*)$/);
    if (m && line.indexOf('-') <= 5) {
      const [, tag, value] = m;
      if (tag === 'PMID') flush();
      cur ??= {};
      (cur[tag] ??= []).push(value.trim());
      lastTag = tag;
    } else if (/^\s{6}\S/.test(line) && cur && lastTag) {
      const arr = cur[lastTag];
      arr[arr.length - 1] += ' ' + line.trim();
    } else if (!line.trim()) {
      lastTag = '';
    }
  }
  flush();
  return out;
}

function nbibToBib(t: Record<string, string[]>): BibRecord {
  const r = emptyBib();
  r.pmid = t.PMID?.[0] ?? '';
  r.title = (t.TI?.[0] ?? t.BTI?.[0] ?? '').replace(/\.$/, '');
  r.abstract = t.AB?.[0] ?? '';
  r.authors = (t.FAU ?? t.AU ?? []).map(parseAuthor);
  r.year = parseYear(t.DP?.[0]);
  r.journal = t.JT?.[0] ?? t.TA?.[0] ?? '';
  r.volume = t.VI?.[0] ?? '';
  r.issue = t.IP?.[0] ?? '';
  r.pages = t.PG?.[0] ?? '';
  const ids = [...(t.LID ?? []), ...(t.AID ?? [])];
  r.doi = (ids.find((x) => /\[doi\]/i.test(x)) ?? '').replace(/\s*\[doi\]/i, '');
  r.language = t.LA?.[0] ?? '';
  r.pubType = (t.PT ?? []).join('; ');
  r.keywords = t.OT ?? [];
  r.url = r.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/` : '';
  return tidy(r);
}

// ---- BibTeX ----------------------------------------------------------------

export function parseBibtex(text: string): BibRecord[] {
  const out: BibRecord[] = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at < 0) break;
    const open = text.indexOf('{', at);
    if (open < 0) break;
    const type = text.slice(at + 1, open).trim().toLowerCase();
    // Najdeme odpovídající uzavírací závorku záznamu.
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    i = j;
    if (type === 'comment' || type === 'string' || type === 'preamble') continue;
    out.push(bibtexToBib(type, parseBibFields(body)));
  }
  return out;
}

function parseBibFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = body.indexOf(',') + 1; // přeskočíme citační klíč
  if (i === 0) return fields;
  while (i < body.length) {
    const eq = body.indexOf('=', i);
    if (eq < 0) break;
    const name = body.slice(i, eq).trim().toLowerCase();
    let j = eq + 1;
    while (j < body.length && /\s/.test(body[j])) j++;
    let value = '';
    if (body[j] === '{') {
      let depth = 1;
      const start = ++j;
      while (j < body.length && depth > 0) {
        if (body[j] === '{') depth++;
        else if (body[j] === '}') depth--;
        j++;
      }
      value = body.slice(start, j - 1);
    } else if (body[j] === '"') {
      const start = ++j;
      while (j < body.length && !(body[j] === '"' && body[j - 1] !== '\\')) j++;
      value = body.slice(start, j);
      j++;
    } else {
      const start = j;
      while (j < body.length && body[j] !== ',') j++;
      value = body.slice(start, j);
    }
    if (name) fields[name] = value.replace(/[{}]/g, '').replace(/\\&/g, '&').replace(/\s+/g, ' ').trim();
    const comma = body.indexOf(',', j);
    if (comma < 0) break;
    i = comma + 1;
  }
  return fields;
}

function bibtexToBib(type: string, f: Record<string, string>): BibRecord {
  const r = emptyBib();
  r.title = f.title ?? '';
  r.authors = (f.author ?? '').split(/\s+and\s+/i).filter(Boolean).map(parseAuthor);
  r.year = parseYear(f.year ?? f.date);
  r.journal = f.journal ?? f.journaltitle ?? f.booktitle ?? '';
  r.volume = f.volume ?? '';
  r.issue = f.number ?? f.issue ?? '';
  r.pages = (f.pages ?? '').replace(/--/g, '–');
  r.doi = f.doi ?? '';
  r.abstract = f.abstract ?? '';
  r.keywords = (f.keywords ?? '').split(/[;,]\s*/);
  r.url = f.url ?? '';
  r.language = f.language ?? '';
  r.pmid = f.pmid ?? '';
  r.pubType = type;
  return tidy(r);
}

// ---- CSV / tabulátorem oddělený text --------------------------------------

/** Rozloží CSV na řádky a buňky; zvládá uvozovky, vnořené oddělovače a zalomení v buňce. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
  const d =
    delimiter ??
    (['\t', ';', ','] as const)
      .map((c) => ({ c, n: firstLine.split(c).length }))
      .sort((a, b) => b.n - a.n)[0].c;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === d) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

// Názvy sloupců, pod kterými se dané pole vyskytuje v exportech (Scopus, WoS, obecné).
const COLUMNS: Record<string, string[]> = {
  title: ['title', 'article title', 'document title', 'ti', 'název', 'nazev'],
  authors: ['authors', 'author', 'author full names', 'au', 'af', 'autoři', 'autori'],
  year: ['year', 'publication year', 'py', 'rok'],
  journal: ['source title', 'journal', 'publication name', 'so', 'source', 'časopis', 'casopis'],
  volume: ['volume', 'vl'],
  issue: ['issue', 'is', 'number'],
  pages: ['pages', 'page range'],
  pageStart: ['page start', 'start page', 'bp'],
  pageEnd: ['page end', 'end page', 'ep'],
  doi: ['doi', 'di'],
  abstract: ['abstract', 'ab', 'abstrakt'],
  keywords: ['author keywords', 'keywords', 'de', 'klíčová slova'],
  language: ['language of original document', 'language', 'la', 'jazyk'],
  pubType: ['document type', 'publication type', 'dt'],
  pmid: ['pubmed id', 'pmid', 'pm'],
  url: ['link', 'url'],
};

function splitAuthors(raw: string): Author[] {
  const s = raw.replace(/\s*\(\d+\)/g, '').trim(); // Scopus přidává k plným jménům číselná id
  if (!s) return [];
  if (s.includes(';')) return s.split(';').map(parseAuthor);
  if (/\band\b/i.test(s)) return s.split(/\s+and\s+/i).map(parseAuthor);
  const parts = s.split(',').map((p) => p.trim());
  // "Novák J., Svoboda P." – každá část končí iniciálami → čárka odděluje autory.
  if (parts.length > 1 && parts.every((p) => /\s[A-ZÁ-Ž][A-ZÁ-Ž.\- ]{0,6}$/.test(p))) return parts.map(parseAuthor);
  return [parseAuthor(s)];
}

export function parseCsv(text: string): BibRecord[] {
  const rows = parseDelimited(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (key: string) => {
    for (const name of COLUMNS[key]) {
      const idx = header.indexOf(name);
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const idx = Object.fromEntries(Object.keys(COLUMNS).map((k) => [k, col(k)]));
  if (idx.title < 0) return [];
  return rows.slice(1).map((row) => {
    const get = (k: string) => (idx[k] >= 0 ? (row[idx[k]] ?? '').trim() : '');
    const r = emptyBib();
    r.title = get('title');
    r.authors = splitAuthors(get('authors'));
    r.year = parseYear(get('year'));
    r.journal = get('journal');
    r.volume = get('volume');
    r.issue = get('issue');
    const ps = get('pageStart');
    const pe = get('pageEnd');
    r.pages = get('pages') || (ps && pe ? `${ps}–${pe}` : ps);
    r.doi = get('doi');
    r.abstract = /^\[?no abstract available\]?$/i.test(get('abstract')) ? '' : get('abstract');
    r.keywords = get('keywords').split(/;\s*/);
    r.language = get('language');
    r.pubType = get('pubType');
    r.pmid = get('pmid');
    r.url = get('url');
    return tidy(r);
  });
}
