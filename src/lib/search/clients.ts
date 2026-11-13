// Přímé vyhledávání v databázích s otevřeným rozhraním: PubMed, Europe PMC, ERIC.
// Vše běží v prohlížeči uživatele; aplikace nemá vlastní server.

import type { BibRecord } from '../types';
import { decodeEntities, emptyBib, normDoi, parseAuthor, parseYear, sleep, stripTags } from '../util';

export type ApiSource = 'pubmed' | 'europepmc' | 'eric';

export interface SearchOptions {
  /** Nepovinný klíč NCBI – zvyšuje povolený počet dotazů za sekundu. */
  pubmedApiKey?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export interface SearchOutcome {
  /** Počet výsledků, který ohlásila databáze. */
  total: number;
  records: BibRecord[];
}

export const API_LABELS: Record<ApiSource, string> = {
  pubmed: 'PubMed',
  europepmc: 'Europe PMC',
  eric: 'ERIC',
};

/** Nejvyšší počet záznamů, které aplikace z jedné databáze stáhne na jedno hledání. */
export const MAX_IMPORT = 5000;

const TOOL = 'pruvodce-prehledy';

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Databáze odpověděla chybou ${res.status}. Zkontrolujte zápis dotazu a zkuste to znovu.`);
  return res.json();
}

// ---- PubMed (NCBI E-utilities) --------------------------------------------

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

async function pubmedSearch(query: string, opts: SearchOptions) {
  const params = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: '0', usehistory: 'y', tool: TOOL });
  if (opts.pubmedApiKey) params.set('api_key', opts.pubmedApiKey);
  // Dlouhé dotazy posíláme metodou POST, aby se vešly (adresa má omezenou délku).
  const data =
    query.length > 1500
      ? await getJson(`${EUTILS}/esearch.fcgi`, { method: 'POST', body: params, signal: opts.signal })
      : await getJson(`${EUTILS}/esearch.fcgi?${params}`, { signal: opts.signal });
  const r = data?.esearchresult;
  if (!r || r.ERROR) throw new Error(`PubMed dotaz nepřijal: ${r?.ERROR ?? 'neznámá chyba'}`);
  return {
    total: Number(r.count ?? 0),
    webenv: String(r.webenv ?? ''),
    queryKey: String(r.querykey ?? ''),
    translation: String(r.querytranslation ?? ''),
    warnings: r.warninglist as undefined | { phrasesnotfound?: string[]; quotedphrasesnotfound?: string[] },
  };
}

export async function pubmedCount(query: string, opts: SearchOptions = {}) {
  const s = await pubmedSearch(query, opts);
  const missing = [...(s.warnings?.phrasesnotfound ?? []), ...(s.warnings?.quotedphrasesnotfound ?? [])];
  return { total: s.total, translation: s.translation, notFound: missing };
}

export async function pubmedFetch(query: string, max: number, opts: SearchOptions = {}): Promise<SearchOutcome> {
  const s = await pubmedSearch(query, opts);
  const want = Math.min(s.total, max);
  const records: BibRecord[] = [];
  const pause = opts.pubmedApiKey ? 120 : 400; // bez klíče nejvýše 3 dotazy za sekundu
  for (let start = 0; start < want; start += 200) {
    await sleep(pause);
    const params = new URLSearchParams({
      db: 'pubmed',
      query_key: s.queryKey,
      WebEnv: s.webenv,
      retstart: String(start),
      retmax: String(Math.min(200, want - start)),
      retmode: 'xml',
      tool: TOOL,
    });
    if (opts.pubmedApiKey) params.set('api_key', opts.pubmedApiKey);
    const res = await fetch(`${EUTILS}/efetch.fcgi?${params}`, { signal: opts.signal });
    if (!res.ok) throw new Error(`PubMed odpověděl chybou ${res.status} při stahování záznamů.`);
    records.push(...parsePubmedXml(await res.text()));
    opts.onProgress?.(Math.min(records.length, want), want);
  }
  return { total: s.total, records };
}

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const child = (el: Element | null | undefined, name: string) => (el ? Array.from(el.children).find((c) => c.tagName === name) ?? null : null);
const children = (el: Element | null | undefined, name: string) => (el ? Array.from(el.children).filter((c) => c.tagName === name) : []);

export function parsePubmedXml(xml: string): BibRecord[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const out: BibRecord[] = [];
  for (const art of Array.from(doc.getElementsByTagName('PubmedArticle'))) {
    const cit = child(art, 'MedlineCitation');
    const article = child(cit, 'Article');
    if (!article) continue;
    const r = emptyBib();
    r.pmid = text(child(cit, 'PMID'));
    r.title = text(child(article, 'ArticleTitle')).replace(/\.$/, '');
    r.abstract = children(child(article, 'Abstract'), 'AbstractText')
      .map((a) => {
        const label = a.getAttribute('Label');
        return (label ? `${label}: ` : '') + text(a);
      })
      .join(' ');
    r.authors = children(child(article, 'AuthorList'), 'Author')
      .map((a) => {
        const collective = text(child(a, 'CollectiveName'));
        if (collective) return { family: collective, given: '' };
        return { family: text(child(a, 'LastName')), given: text(child(a, 'ForeName')) || text(child(a, 'Initials')) };
      })
      .filter((a) => a.family);
    const journal = child(article, 'Journal');
    const issue = child(journal, 'JournalIssue');
    const pubDate = child(issue, 'PubDate');
    r.journal = text(child(journal, 'Title'));
    r.volume = text(child(issue, 'Volume'));
    r.issue = text(child(issue, 'Issue'));
    r.year = parseYear(text(child(pubDate, 'Year')) || text(child(pubDate, 'MedlineDate')));
    r.pages = text(child(child(article, 'Pagination'), 'MedlinePgn'));
    // DOI bereme jen z vlastního článku – stejné značky mají i citované zdroje v seznamu literatury.
    const ownIds = children(child(child(art, 'PubmedData'), 'ArticleIdList'), 'ArticleId');
    r.doi = normDoi(
      text(ownIds.find((i) => i.getAttribute('IdType') === 'doi')) ||
        text(children(article, 'ELocationID').find((e) => e.getAttribute('EIdType') === 'doi')),
    );
    r.language = text(child(article, 'Language'));
    r.pubType = children(child(article, 'PublicationTypeList'), 'PublicationType').map(text).join('; ');
    r.keywords = children(cit, 'KeywordList').flatMap((k) => children(k, 'Keyword').map(text));
    r.url = `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`;
    out.push(r);
  }
  return out;
}

// ---- Europe PMC ------------------------------------------------------------

const EPMC = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

export async function europepmcCount(query: string, opts: SearchOptions = {}) {
  const params = new URLSearchParams({ query, format: 'json', resultType: 'idlist', pageSize: '1' });
  const data = await getJson(`${EPMC}?${params}`, { signal: opts.signal });
  return { total: Number(data.hitCount ?? 0) };
}

export async function europepmcFetch(query: string, max: number, opts: SearchOptions = {}): Promise<SearchOutcome> {
  const records: BibRecord[] = [];
  let cursor = '*';
  let total = 0;
  while (records.length < max) {
    const params = new URLSearchParams({ query, format: 'json', resultType: 'core', pageSize: String(Math.min(500, max - records.length)), cursorMark: cursor });
    const data = await getJson(`${EPMC}?${params}`, { signal: opts.signal });
    total = Number(data.hitCount ?? 0);
    const page: any[] = data.resultList?.result ?? [];
    records.push(...page.map(europepmcToBib));
    opts.onProgress?.(Math.min(records.length, Math.min(total, max)), Math.min(total, max));
    if (!page.length || !data.nextCursorMark || data.nextCursorMark === cursor) break;
    cursor = data.nextCursorMark;
    await sleep(150);
  }
  return { total, records };
}

export function europepmcToBib(x: any): BibRecord {
  const r = emptyBib();
  r.title = stripTags(x.title ?? '').replace(/\.$/, '');
  const authors: any[] = x.authorList?.author ?? [];
  r.authors = authors.length
    ? authors
        .map((a) => (a.lastName ? { family: a.lastName, given: a.firstName ?? a.initials ?? '' } : { family: a.collectiveName ?? a.fullName ?? '', given: '' }))
        .filter((a) => a.family)
    : String(x.authorString ?? '')
        .replace(/\.$/, '')
        .split(/,\s*/)
        .filter(Boolean)
        .map(parseAuthor);
  r.year = parseYear(x.pubYear);
  r.journal = x.journalInfo?.journal?.title ?? x.bookOrReportDetails?.publisher ?? '';
  r.volume = String(x.journalInfo?.volume ?? '');
  r.issue = String(x.journalInfo?.issue ?? '');
  r.pages = x.pageInfo ?? '';
  r.doi = normDoi(x.doi ?? '');
  r.pmid = x.pmid ?? '';
  r.abstract = stripTags(x.abstractText ?? '');
  r.language = x.language ?? '';
  r.pubType = (x.pubTypeList?.pubType ?? []).join('; ');
  r.keywords = x.keywordList?.keyword ?? [];
  r.url = x.source && x.id ? `https://europepmc.org/article/${x.source}/${x.id}` : '';
  return r;
}

// ---- ERIC ------------------------------------------------------------------

const ERIC = 'https://api.ies.ed.gov/eric/';
const ERIC_FIELDS = 'id,title,author,source,sourceid,publicationdateyear,description,subject,publicationtype,language,url';

export async function ericCount(query: string, opts: SearchOptions = {}) {
  const params = new URLSearchParams({ search: query, format: 'json', rows: '1', fields: 'id' });
  const data = await getJson(`${ERIC}?${params}`, { signal: opts.signal });
  return { total: Number(data.response?.numFound ?? 0) };
}

export async function ericFetch(query: string, max: number, opts: SearchOptions = {}): Promise<SearchOutcome> {
  const records: BibRecord[] = [];
  let total = 0;
  for (let start = 0; start < max; start += 200) {
    const params = new URLSearchParams({ search: query, format: 'json', rows: String(Math.min(200, max - start)), start: String(start), fields: ERIC_FIELDS });
    const data = await getJson(`${ERIC}?${params}`, { signal: opts.signal });
    total = Number(data.response?.numFound ?? 0);
    const page: any[] = data.response?.docs ?? [];
    records.push(...page.map(ericToBib));
    opts.onProgress?.(Math.min(records.length, Math.min(total, max)), Math.min(total, max));
    if (!page.length || records.length >= total) break;
    await sleep(150);
  }
  return { total, records };
}

export function ericToBib(x: any): BibRecord {
  const r = emptyBib();
  r.title = decodeEntities(x.title ?? '');
  r.authors = (x.author ?? []).map((a: string) => parseAuthor(decodeEntities(a)));
  r.year = parseYear(x.publicationdateyear);
  r.journal = decodeEntities(x.source ?? '');
  // sourceid má tvar „v50 n2 p171-183 2022“.
  const sid = String(x.sourceid ?? '');
  r.volume = sid.match(/\bv(\S+)/)?.[1] ?? '';
  r.issue = sid.match(/\bn(\S+)/)?.[1] ?? '';
  r.pages = sid.match(/\bp([\d\-–,]+)/)?.[1]?.replace(/,$/, '') ?? '';
  r.abstract = decodeEntities(x.description ?? '');
  r.keywords = x.subject ?? [];
  r.language = (x.language ?? []).join('; ');
  r.pubType = (x.publicationtype ?? []).join('; ');
  const link = String(x.url ?? '');
  const doi = link.match(/10\.\d{4,9}\/\S+/);
  r.doi = doi ? normDoi(doi[0]) : '';
  r.url = x.id ? `https://eric.ed.gov/?id=${x.id}` : link;
  return r;
}

// ---- Společné rozhraní -----------------------------------------------------

export async function countHits(source: ApiSource, query: string, opts: SearchOptions = {}): Promise<{ total: number; translation?: string; notFound?: string[] }> {
  if (source === 'pubmed') return pubmedCount(query, opts);
  if (source === 'europepmc') return europepmcCount(query, opts);
  return ericCount(query, opts);
}

export async function fetchRecords(source: ApiSource, query: string, max: number, opts: SearchOptions = {}): Promise<SearchOutcome> {
  if (source === 'pubmed') return pubmedFetch(query, max, opts);
  if (source === 'europepmc') return europepmcFetch(query, max, opts);
  return ericFetch(query, max, opts);
}
