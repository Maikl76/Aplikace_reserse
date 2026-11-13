// Prvky sdílené mezi kroky: zobrazení záznamu a zvýraznění slov.

import type { ReactNode } from 'react';
import type { RecordItem } from '../lib/types';
import { splitList } from '../lib/util';

export function authorsShort(r: Pick<RecordItem, 'authors'>, max = 6): string {
  const names = r.authors.map((a) => (a.given ? `${a.family} ${a.given}` : a.family));
  return names.length > max ? `${names.slice(0, max).join(', ')} et al.` : names.join(', ');
}

export function sourceLine(r: Pick<RecordItem, 'journal' | 'year' | 'volume' | 'issue' | 'pages'>): string {
  return [r.journal, r.year, r.volume ? `${r.volume}${r.issue ? `(${r.issue})` : ''}` : '', r.pages].filter(Boolean).join(' · ');
}

export function RecordLinks({ r }: { r: RecordItem }) {
  return (
    <span className="row small">
      {r.doi ? (
        <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
          DOI
        </a>
      ) : null}
      {r.pmid ? (
        <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer">
          PubMed
        </a>
      ) : null}
      {r.url && !r.url.includes('pubmed.ncbi') ? (
        <a href={r.url} target="_blank" rel="noreferrer">
          Záznam v databázi
        </a>
      ) : null}
      <a href={`https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}`} target="_blank" rel="noreferrer">
        Google Scholar
      </a>
    </span>
  );
}

const escapeRe = (s: string) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** Regulární výraz pro seznam slov oddělených čárkou; hvězdička nahrazuje koncovku. */
function wordsRegex(list: string): RegExp | null {
  const words = splitList(list).filter((w) => w.replace(/\*/g, '').length >= 2);
  if (!words.length) return null;
  const alt = words
    .sort((a, b) => b.length - a.length)
    .map((w) => escapeRe(w).replace(/\*/g, '[\\p{L}\\p{N}]*'))
    .join('|');
  return new RegExp(`(${alt})`, 'giu');
}

/** Text se zvýrazněnými slovy pro zařazení (zeleně) a vyřazení (červeně). */
export function Highlighted({ text, include, exclude }: { text: string; include: string; exclude: string }) {
  const inRe = wordsRegex(include);
  const outRe = wordsRegex(exclude);
  if (!inRe && !outRe) return <>{text}</>;
  const mark = (chunk: string, re: RegExp | null, cls: string, rest: (s: string, key: string) => ReactNode, key: string): ReactNode => {
    if (!re) return rest(chunk, key);
    return chunk.split(re).map((part, i) =>
      i % 2 === 1 ? (
        <mark key={`${key}-${i}`} className={cls}>
          {part}
        </mark>
      ) : (
        rest(part, `${key}-${i}`)
      ),
    );
  };
  return <>{mark(text, inRe, 'in', (s, k) => mark(s, outRe, 'out', (x) => x, k), 'h')}</>;
}

export function RecordHead({ r }: { r: RecordItem }) {
  return (
    <>
      <div className="record-title">{r.title || 'Bez názvu'}</div>
      <div className="small" style={{ color: 'var(--ink-2)' }}>
        {authorsShort(r) || 'Autor neuveden'}
      </div>
      <div className="small muted">{sourceLine(r) || 'Zdroj neuveden'}</div>
    </>
  );
}
