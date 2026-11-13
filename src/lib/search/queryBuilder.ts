// Sestavení vyhledávacího dotazu z pojmových bloků.
// Uvnitř bloku se synonyma spojují operátorem OR, bloky mezi sebou operátorem AND.
// Každá databáze má vlastní zápis polí, proto se ze stejných bloků generuje víc variant.

import type { ConceptBlock, Term } from '../types';

export type Target = 'pubmed' | 'europepmc' | 'eric' | 'scopus' | 'wos' | 'ebsco' | 'generic';

export interface TargetInfo {
  id: Target;
  name: string;
  /** true = aplikace umí databázi prohledat sama; false = dotaz zkopírujete a výsledky nahrajete. */
  api: boolean;
  note: string;
}

export const TARGETS: TargetInfo[] = [
  { id: 'pubmed', name: 'PubMed', api: true, note: 'Volný text se hledá v názvu a abstraktu [tiab], termíny MeSH přes [Mesh].' },
  { id: 'europepmc', name: 'Europe PMC', api: true, note: 'Hledá v názvu a abstraktu (TITLE_ABS). Hvězdičku uvnitř fráze neumí, taková fráze se rozloží na slova.' },
  { id: 'eric', name: 'ERIC', api: true, note: 'Pedagogická databáze. Volný text v názvu a abstraktu, deskriptory tezauru ERIC v poli subject.' },
  { id: 'scopus', name: 'Scopus', api: false, note: 'Vložte do pokročilého vyhledávání (Advanced search). Výsledky exportujte jako RIS nebo CSV včetně abstraktů.' },
  { id: 'wos', name: 'Web of Science', api: false, note: 'Vložte do pokročilého vyhledávání. TS = název, abstrakt a klíčová slova. Exportujte jako RIS.' },
  { id: 'ebsco', name: 'EBSCO (SPORTDiscus, CINAHL, PsycINFO)', api: false, note: 'Vložte do jednoho vyhledávacího pole. Rozmezí let nastavte v rozhraní databáze. Exportujte jako RIS.' },
  { id: 'generic', name: 'Obecný zápis', api: false, note: 'Pro databáze bez zvláštní syntaxe, Google Scholar nebo zápis do metodiky.' },
];

export interface Limits {
  yearFrom?: string;
  yearTo?: string;
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/"/g, '');
const isPhrase = (s: string) => /[\s\-/]/.test(s);
const quote = (s: string) => (isPhrase(s) ? `"${s}"` : s);

/** Termíny, které daná databáze umí použít (řízené slovníky jsou vázané na databázi). */
function usable(term: Term, target: Target): boolean {
  if (!clean(term.text)) return false;
  if (term.vocab === 'free') return true;
  if (term.vocab === 'mesh') return target === 'pubmed';
  if (term.vocab === 'eric') return target === 'eric';
  return false;
}

function termFor(term: Term, target: Target): string {
  const t = clean(term.text);
  switch (target) {
    case 'pubmed':
      return term.vocab === 'mesh' ? `"${t.replace(/\*/g, '')}"[Mesh]` : `${quote(t)}[tiab]`;
    case 'europepmc': {
      if (isPhrase(t) && t.includes('*')) {
        return '(' + t.split(/[\s\-/]+/).map((w) => `TITLE_ABS:${w}`).join(' AND ') + ')';
      }
      return `TITLE_ABS:${quote(t)}`;
    }
    case 'eric': {
      if (term.vocab === 'eric') return `subject:"${t.replace(/\*/g, '')}"`;
      if (isPhrase(t) && t.includes('*')) {
        const words = t.split(/[\s\-/]+/);
        return `((${words.map((w) => `title:${w}`).join(' AND ')}) OR (${words.map((w) => `description:${w}`).join(' AND ')}))`;
      }
      return `(title:${quote(t)} OR description:${quote(t)})`;
    }
    default:
      return quote(t);
  }
}

function blockExpr(block: ConceptBlock, target: Target): string {
  const terms = block.terms.filter((t) => usable(t, target)).map((t) => termFor(t, target));
  // Odstraníme opakované termíny, pořadí zachováme.
  const unique = [...new Set(terms)];
  if (!unique.length) return '';
  const joined = unique.join(' OR ');
  switch (target) {
    case 'scopus':
      return `TITLE-ABS-KEY(${joined})`;
    case 'wos':
      return `TS=(${joined})`;
    case 'ebsco':
      return `(TI (${joined}) OR AB (${joined}))`;
    default:
      return unique.length > 1 ? `(${joined})` : joined;
  }
}

function yearLimit(target: Target, limits: Limits): string {
  const from = (limits.yearFrom ?? '').trim();
  const to = (limits.yearTo ?? '').trim();
  if (!/^\d{4}$/.test(from) && !/^\d{4}$/.test(to)) return '';
  const a = /^\d{4}$/.test(from) ? Number(from) : null;
  const b = /^\d{4}$/.test(to) ? Number(to) : null;
  switch (target) {
    case 'pubmed':
      return `("${a ?? 1800}"[dp] : "${b ?? 3000}"[dp])`;
    case 'europepmc':
      return `PUB_YEAR:[${a ?? 1800} TO ${b ?? 3000}]`;
    case 'eric':
      return `publicationdateyear:[${a ?? 1900} TO ${b ?? 3000}]`;
    case 'scopus':
      return [a != null ? `PUBYEAR > ${a - 1}` : '', b != null ? `PUBYEAR < ${b + 1}` : ''].filter(Boolean).join(' AND ');
    case 'wos':
      return `PY=(${a ?? 1900}-${b ?? new Date().getFullYear()})`;
    default:
      return ''; // EBSCO a obecný zápis: omezení let se nastavuje v rozhraní databáze
  }
}

export function buildQuery(blocks: ConceptBlock[], target: Target, limits: Limits = {}): string {
  const parts = blocks.map((b) => blockExpr(b, target)).filter(Boolean);
  if (!parts.length) return '';
  const years = yearLimit(target, limits);
  return [...parts, years].filter(Boolean).join(' AND ');
}

/** Bloky, které by se v dané databázi neuplatnily (obsahují jen cizí řízené termíny). */
export function emptyBlocksFor(blocks: ConceptBlock[], target: Target): ConceptBlock[] {
  return blocks.filter((b) => b.terms.some((t) => clean(t.text)) && !b.terms.some((t) => usable(t, target)));
}
