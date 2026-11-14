import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCitations } from './citations';
import { findDuplicates, mergedFields, pickPrimary, similarity } from './dedup';
import { flowCounts, includedRecords } from './flow';
import { detectFormat, parseBibtex, parseCsv, parseDelimited, parseFile, parseNbib, parseRis } from './importers';
import { europepmcToBib, ericToBib, parsePubmedXml } from './search/clients';
import { buildQuery, emptyBlocksFor } from './search/queryBuilder';
import type { ConceptBlock, RecordItem } from './types';
import { decodeEntities, emptyBib, initials, normDoi, normTitle, parseAuthor, plural, shortLabel } from './util';

const fixture = (name: string) => readFileSync(`tests/fixtures/${name}`, 'utf8');

function rec(over: Partial<RecordItem>): RecordItem {
  return {
    ...emptyBib(),
    id: Math.random().toString(36).slice(2),
    projectId: 'p',
    searchId: 's',
    source: 'PubMed',
    duplicateOf: null,
    screen1: 'pending',
    fulltext: 'pending',
    screen2: 'pending',
    excludeReason: '',
    votes1: {},
    votes2: {},
    extraction: {},
    effects: {},
    quality: {},
    qualityOverall: '',
    qualityNote: '',
    themes: [],
    primaryStudies: '',
    notes: '',
    addedAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

describe('pomocné funkce', () => {
  it('jména autorů', () => {
    expect(parseAuthor('Novák, Jan')).toEqual({ family: 'Novák', given: 'Jan' });
    expect(parseAuthor('Jan Novák')).toEqual({ family: 'Novák', given: 'Jan' });
    expect(parseAuthor('Novák JK')).toEqual({ family: 'Novák', given: 'JK' });
    expect(parseAuthor('Novák J.')).toEqual({ family: 'Novák', given: 'J.' });
    expect(parseAuthor('De La Cruz J. K.')).toEqual({ family: 'De La Cruz', given: 'J. K.' });
    expect(parseAuthor('Jan K. Novák')).toEqual({ family: 'Novák', given: 'Jan K.' });
    expect(parseAuthor('van der Berg, A. B.')).toEqual({ family: 'van der Berg', given: 'A. B.' });
    expect(initials('Jan Karel')).toBe('J. K.');
    expect(initials('JK')).toBe('J. K.');
    expect(initials('Yu-Na')).toBe('Y.-N.');
    expect(initials('')).toBe('');
  });
  it('normalizace DOI a názvů', () => {
    expect(normDoi('https://doi.org/10.1000/ABC.1.')).toBe('10.1000/abc.1');
    expect(normDoi('doi: 10.1000/x')).toBe('10.1000/x');
    expect(normTitle('Účinek <i>cvičení</i>: přehled!')).toBe('ucinekcviceniprehled');
    expect(decodeEntities('Students&apos; views &amp; &#x10D;as')).toBe("Students' views & čas");
  });
  it('označení studie a skloňování', () => {
    expect(shortLabel({ authors: [{ family: 'Novák', given: 'J' }], year: 2020, title: 'x' })).toBe('Novák (2020)');
    expect(shortLabel({ authors: [parseAuthor('A, B'), parseAuthor('C, D'), parseAuthor('E, F')], year: null, title: 'x' })).toBe('A et al. (b. r.)');
    expect(plural(1, 'záznam', 'záznamy', 'záznamů')).toBe('1 záznam');
    expect(plural(3, 'záznam', 'záznamy', 'záznamů')).toBe('3 záznamy');
    expect(plural(12, 'záznam', 'záznamy', 'záznamů')).toBe('12 záznamů');
  });
});

describe('import souborů', () => {
  const ris = `TY  - JOUR
AU  - Novák, Jan
AU  - Svobodová, Eva
TI  - Pohybová aktivita a deprese u dospívajících:
      systematický přehled
PY  - 2021/03/15
T2  - Česká kinantropologie
VL  - 25
IS  - 2
SP  - 10
EP  - 24
DO  - https://doi.org/10.1000/CK.2021.5
AB  - Cílem bylo shrnout důkazy.
KW  - deprese
KW  - adolescenti; pohyb
LA  - cze
ER  - 

TY  - CHAP
A1  - Smith, John
T1  - Second record without ER
Y1  - 1999
UR  - https://doi.org/10.2000/xyz
`;
  it('RIS včetně pokračovacích řádků a záznamu bez ER', () => {
    const r = parseRis(ris);
    expect(r).toHaveLength(2);
    expect(r[0].title).toBe('Pohybová aktivita a deprese u dospívajících: systematický přehled');
    expect(r[0].authors).toEqual([{ family: 'Novák', given: 'Jan' }, { family: 'Svobodová', given: 'Eva' }]);
    expect(r[0].year).toBe(2021);
    expect(r[0].journal).toBe('Česká kinantropologie');
    expect(r[0].pages).toBe('10–24');
    expect(r[0].doi).toBe('10.1000/ck.2021.5');
    expect(r[0].keywords).toEqual(['deprese', 'adolescenti', 'pohyb']);
    expect(r[1].title).toBe('Second record without ER');
    expect(r[1].doi).toBe('10.2000/xyz');
    expect(r[1].year).toBe(1999);
  });

  const nbib = `PMID- 12345678
OWN - NLM
DP  - 2020 Mar 5
TI  - Exercise for depression in adolescents: a randomized
      controlled trial.
PG  - 101-110
LID - 10.1000/j.x.2020.01 [doi]
LID - S0000-0000(20)30001-1 [pii]
AB  - BACKGROUND: Something. METHODS: Something else that continues
      on the next line.
FAU - Kim, Yu-Na
AU  - Kim YN
FAU - Gray, Nicola
AU  - Gray N
LA  - eng
PT  - Journal Article
PT  - Randomized Controlled Trial
TA  - J Test
JT  - Journal of Testing
VI  - 12
IP  - 3
OT  - adolescents

PMID- 87654321
TI  - Second article.
DP  - 2019
`;
  it('NBIB z PubMedu', () => {
    const r = parseNbib(nbib);
    expect(r).toHaveLength(2);
    expect(r[0].pmid).toBe('12345678');
    expect(r[0].title).toBe('Exercise for depression in adolescents: a randomized controlled trial');
    expect(r[0].abstract).toContain('continues on the next line.');
    expect(r[0].authors).toEqual([{ family: 'Kim', given: 'Yu-Na' }, { family: 'Gray', given: 'Nicola' }]);
    expect(r[0].doi).toBe('10.1000/j.x.2020.01');
    expect(r[0].journal).toBe('Journal of Testing');
    expect(r[0].pubType).toBe('Journal Article; Randomized Controlled Trial');
    expect(r[0].year).toBe(2020);
    expect(r[1].pmid).toBe('87654321');
  });

  it('BibTeX s vnořenými závorkami', () => {
    const r = parseBibtex(`@comment{ignored}
@article{novak2020,
  author = {Nov{\\'a}k, Jan and Eva Svobodov{\\'a}},
  title = {Effects of {HIIT} on fitness, health, and mood},
  journal = "Sports Medicine",
  year = 2020,
  volume = {50},
  number = {4},
  pages = {100--120},
  doi = {10.1000/sm.2020}
}
@inproceedings{x, title={Another one}, year={2018}}`);
    expect(r).toHaveLength(2);
    expect(r[0].title).toBe('Effects of HIIT on fitness, health, and mood');
    expect(r[0].authors[1]).toEqual({ family: "Svobodov\\'a", given: 'Eva' });
    expect(r[0].journal).toBe('Sports Medicine');
    expect(r[0].year).toBe(2020);
    expect(r[0].pages).toBe('100–120');
    expect(r[0].issue).toBe('4');
    expect(r[1].title).toBe('Another one');
    expect(r[1].pubType).toBe('inproceedings');
  });

  it('CSV ze Scopusu (uvozovky, čárky a zalomení uvnitř buněk)', () => {
    const csv = `"Authors","Author full names","Title","Year","Source title","Volume","Issue","Page start","Page end","DOI","Abstract","Author Keywords","Document Type","PubMed ID"
"Novák J.; Malá E.","Novák, Jan (123); Malá, Eva (456)","Title with ""quotes"", commas","2022","Journal A","5","1","11","20","10.1000/a","Line one
line two","kw1; kw2","Article","999"
"Smith A., Brown B.C.","","Second title","2021","Journal B","","","","","","[No abstract available]","","Review",""
`;
    const r = parseCsv(csv);
    expect(r).toHaveLength(2);
    expect(r[0].title).toBe('Title with "quotes", commas');
    expect(r[0].authors).toEqual([{ family: 'Novák', given: 'J.' }, { family: 'Malá', given: 'E.' }]);
    expect(r[0].pages).toBe('11–20');
    expect(r[0].abstract).toBe('Line one line two');
    expect(r[0].keywords).toEqual(['kw1', 'kw2']);
    expect(r[0].pmid).toBe('999');
    expect(r[1].authors.map((a) => a.family)).toEqual(['Smith', 'Brown']);
    expect(r[1].abstract).toBe('');
  });

  it('tabulátory oddělený export Web of Science', () => {
    const tsv = 'PT\tAU\tTI\tSO\tPY\tVL\tBP\tEP\tDI\tAB\nJ\tNovak, J; Mala, E\tA title\tSOME JOURNAL\t2019\t7\t1\t9\t10.1/x\tAbstract text\n';
    const r = parseCsv(tsv);
    expect(r).toHaveLength(1);
    expect(r[0].authors).toHaveLength(2);
    expect(r[0].journal).toBe('SOME JOURNAL');
    expect(r[0].pages).toBe('1–9');
  });

  it('rozpoznání formátu a oddělovače', () => {
    expect(detectFormat('export.ris', '')).toBe('ris');
    expect(detectFormat('pubmed.txt', nbib)).toBe('nbib');
    expect(detectFormat('x.txt', ris)).toBe('ris');
    expect(detectFormat('refs.bib', '')).toBe('bibtex');
    expect(detectFormat('scopus.csv', 'Authors,Title')).toBe('csv');
    expect(parseDelimited('a;b;c\n1;2;3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    expect(parseFile('x.ris', '﻿' + ris).records).toHaveLength(2);
    expect(parseFile('x.csv', 'Foo,Bar\n1,2').records).toHaveLength(0);
  });
});

describe('odpovědi databází (skutečné ukázky)', () => {
  it('PubMed XML', () => {
    const r = parsePubmedXml(fixture('pubmed-efetch.xml'));
    expect(r).toHaveLength(3);
    expect(r[0].pmid).toBe('35450664');
    expect(r[0].title.startsWith('The Role of Physiotherapy in the Management of Functional Neurological Disorder')).toBe(true);
    expect(r[0].doi).toBe('10.1016/j.spen.2021.100947');
    expect(r[0].authors[0]).toEqual({ family: 'Kim', given: 'Yu-Na' });
    expect(r[0].journal).toBe('Seminars in pediatric neurology');
    expect(r[0].volume).toBe('41');
    expect(r[0].year).toBe(2022);
    expect(r[0].pubType).toContain('Review');
    expect(r[0].abstract.length).toBeGreaterThan(20);
    // DOI citovaného zdroje se nesmí zaměnit za DOI článku.
    expect(r[1].doi).toBe('10.1007/s12671-021-01719-0');
    expect(r[1].keywords).toContain('mindfulness');
    expect(r[2].doi).toBe('10.18502/ijph.v50i10.7493');
    expect(r.every((x) => x.url.includes(x.pmid) && x.language === 'eng')).toBe(true);
  });
  it('Europe PMC', () => {
    const data = JSON.parse(fixture('europepmc-search.json'));
    const r = data.resultList.result.map(europepmcToBib);
    expect(r[0].doi).toBe('10.1371/journal.pone.0360292');
    expect(r[0].authors[0]).toEqual({ family: 'Philippot', given: 'Arnaud' });
    expect(r[0].journal).toBe('PloS one');
    expect(r[0].volume).toBe('21');
    expect(r[0].issue).toBe('10');
    expect(r[0].abstract).not.toContain('<h4>');
    expect(r[0].abstract.startsWith('Introduction')).toBe(true);
    expect(r[0].url).toBe('https://europepmc.org/article/MED/42945193');
    // Preprint bez údajů o časopise.
    expect(r[1].journal).toBe('');
    expect(r[1].pubType).toBe('Preprint');
    expect(r[1].authors).toHaveLength(1);
  });
  it('ERIC', () => {
    const data = JSON.parse(fixture('eric-search.json'));
    const r = data.response.docs.map(ericToBib);
    expect(r[0].title).toBe("Students' Perceptions of Responsibility in Physical Education: A Qualitative Study");
    expect(r[0].authors[0]).toEqual({ family: 'Koutelidas', given: 'Achillios' });
    expect(r[0].journal).toBe('Education 3-13');
    expect(r[0].volume).toBe('50');
    expect(r[0].issue).toBe('2');
    expect(r[0].pages).toBe('171-183');
    expect(r[0].doi).toBe('10.1080/03004279.2020.1840607');
    expect(r[0].url).toBe('https://eric.ed.gov/?id=EJ1326755');
    expect(r[0].year).toBe(2022);
    expect(r[1].doi).toBe('');
    expect(r[1].pubType).toContain('Dissertations');
  });
});

describe('sestavení dotazu', () => {
  const blocks: ConceptBlock[] = [
    { id: '1', label: 'Populace', terms: [{ text: 'adolescen*', vocab: 'free' }, { text: 'Adolescent', vocab: 'mesh' }, { text: 'High School Students', vocab: 'eric' }] },
    { id: '2', label: 'Intervence', terms: [{ text: 'physical activit*', vocab: 'free' }, { text: 'exercise', vocab: 'free' }, { text: 'exercise', vocab: 'free' }, { text: '  ', vocab: 'free' }] },
    { id: '3', label: 'Prázdný', terms: [] },
  ];
  it('PubMed', () => {
    expect(buildQuery(blocks, 'pubmed', { yearFrom: '2010', yearTo: '2024' })).toBe(
      '(adolescen*[tiab] OR "Adolescent"[Mesh]) AND ("physical activit*"[tiab] OR exercise[tiab]) AND ("2010"[dp] : "2024"[dp])',
    );
  });
  it('Europe PMC rozloží frázi se zástupným znakem', () => {
    expect(buildQuery(blocks, 'europepmc', { yearFrom: '2010' })).toBe(
      'TITLE_ABS:adolescen* AND ((TITLE_ABS:physical AND TITLE_ABS:activit*) OR TITLE_ABS:exercise) AND PUB_YEAR:[2010 TO 3000]',
    );
  });
  it('ERIC používá deskriptory tezauru', () => {
    const q = buildQuery(blocks, 'eric');
    expect(q).toContain('subject:"High School Students"');
    expect(q).toContain('(title:exercise OR description:exercise)');
    expect(q).not.toContain('Mesh');
  });
  it('Scopus, Web of Science, EBSCO a obecný zápis', () => {
    expect(buildQuery(blocks, 'scopus', { yearFrom: '2010', yearTo: '2024' })).toBe(
      'TITLE-ABS-KEY(adolescen*) AND TITLE-ABS-KEY("physical activit*" OR exercise) AND PUBYEAR > 2009 AND PUBYEAR < 2025',
    );
    expect(buildQuery(blocks, 'wos', { yearFrom: '2010', yearTo: '2024' })).toBe('TS=(adolescen*) AND TS=("physical activit*" OR exercise) AND PY=(2010-2024)');
    expect(buildQuery(blocks, 'ebsco')).toBe('(TI (adolescen*) OR AB (adolescen*)) AND (TI ("physical activit*" OR exercise) OR AB ("physical activit*" OR exercise))');
    expect(buildQuery(blocks, 'generic')).toBe('adolescen* AND ("physical activit*" OR exercise)');
  });
  it('prázdné bloky a bloky jen s cizím slovníkem', () => {
    expect(buildQuery([], 'pubmed')).toBe('');
    const onlyMesh: ConceptBlock[] = [{ id: 'm', label: 'M', terms: [{ text: 'Exercise', vocab: 'mesh' }] }];
    expect(buildQuery(onlyMesh, 'scopus')).toBe('');
    expect(emptyBlocksFor(onlyMesh, 'scopus')).toHaveLength(1);
    expect(emptyBlocksFor(onlyMesh, 'pubmed')).toHaveLength(0);
  });
});

describe('duplicity', () => {
  it('podobnost názvů', () => {
    expect(similarity('abcdef', 'abcdef')).toBe(1);
    expect(similarity('abcdef', 'uvwxyz')).toBe(0);
    expect(similarity(normTitle('Exercise and depression in adolescents'), normTitle('Exercise and depression in adolescent'))).toBeGreaterThan(0.95);
  });
  it('najde jisté i pravděpodobné shody a rozliší je', () => {
    const records = [
      rec({ id: 'a', title: 'Effects of exercise on depression in adolescents: a randomized trial', doi: '10.1/abc', year: 2020, authors: [parseAuthor('Kim, Y')], abstract: 'x' }),
      rec({ id: 'b', title: 'Completely different title, same DOI though', doi: 'https://doi.org/10.1/ABC', year: 2020 }),
      rec({ id: 'c', title: 'Effects of Exercise on Depression in Adolescents: A Randomized Trial.', year: 2021, source: 'Scopus' }),
      rec({ id: 'd', title: 'School-based physical activity programmes and wellbeing of pupils', year: 2019, pmid: '111' }),
      rec({ id: 'e', title: 'School based physical activity programs and wellbeing of pupils', year: 2019 }),
      rec({ id: 'f', title: 'Editorial', year: 2018, authors: [parseAuthor('A, B')] }),
      rec({ id: 'g', title: 'Editorial', year: 2018, authors: [parseAuthor('C, D')] }),
      rec({ id: 'h', title: 'An unrelated qualitative study of teachers', year: 2015 }),
      rec({ id: 'i', title: 'Anything', pmid: '111', year: 2019 }),
      rec({ id: 'j', title: 'Already merged duplicate', doi: '10.1/abc', duplicateOf: 'a' }),
    ];
    const groups = findDuplicates(records);
    const certain = groups.filter((g) => g.certain).map((g) => [...g.ids].sort().join(''));
    const probable = groups.filter((g) => !g.certain).map((g) => [...g.ids].sort().join(''));
    expect(certain.sort()).toEqual(['abc', 'di']);
    expect(probable).toEqual(['de']);
    expect(groups.flatMap((g) => g.ids)).not.toContain('j');
    expect(groups.flatMap((g) => g.ids)).not.toContain('h');
    // Krátké shodné názvy od různých autorů se neslučují.
    expect(groups.flatMap((g) => g.ids)).not.toContain('f');
  });
  it('shodný název s různými DOI není jistá shoda', () => {
    const records = [
      rec({ id: 'a', title: 'A sufficiently long identical title of two versions', doi: '10.1/preprint', year: 2020 }),
      rec({ id: 'b', title: 'A sufficiently long identical title of two versions', doi: '10.1/published', year: 2020 }),
    ];
    const groups = findDuplicates(records);
    expect(groups).toHaveLength(1);
    expect(groups[0].certain).toBe(false);
  });
  it('ponechá nejúplnější záznam a doplní chybějící údaje', () => {
    const a = rec({ id: 'a', title: 'T', doi: '', abstract: '', journal: 'J' });
    const b = rec({ id: 'b', title: 'T', doi: '10.1/x', abstract: 'Abstrakt', pmid: '5', year: 2020, authors: [parseAuthor('A, B')] });
    expect(pickPrimary([a, b]).id).toBe('b');
    expect(mergedFields(a, [b])).toEqual({ abstract: 'Abstrakt', doi: '10.1/x', pmid: '5', year: 2020, authors: [{ family: 'A', given: 'B' }] });
  });
});

describe('počty pro vývojový diagram', () => {
  const records = [
    rec({ source: 'PubMed', screen1: 'include', fulltext: 'retrieved', screen2: 'include' }),
    rec({ source: 'PubMed', screen1: 'maybe', fulltext: 'retrieved', screen2: 'exclude', excludeReason: 'Nevhodný design studie' }),
    rec({ source: 'PubMed', screen1: 'include', fulltext: 'notRetrieved' }),
    rec({ source: 'Scopus', screen1: 'include', fulltext: 'retrieved', screen2: 'exclude', excludeReason: 'Nevhodná populace' }),
    rec({ source: 'Scopus', screen1: 'include', fulltext: 'retrieved', screen2: 'exclude', excludeReason: '' }),
    rec({ source: 'Scopus', screen1: 'exclude' }),
    rec({ source: 'Scopus', screen1: 'exclude' }),
    rec({ source: 'Scopus', screen1: 'pending' }),
    rec({ source: 'Scopus', duplicateOf: 'x', screen1: 'include', screen2: 'include' }),
    rec({ source: 'ERIC', screen1: 'include', fulltext: 'pending', screen2: 'pending' }),
  ];
  it('dvoustupňový výběr', () => {
    const c = flowCounts(records, 'systematic', 'Nevhodná populace\nNevhodný design studie');
    expect(c.identified).toBe(10);
    expect(c.bySource).toEqual([{ source: 'Scopus', n: 6 }, { source: 'PubMed', n: 3 }, { source: 'ERIC', n: 1 }]);
    expect(c.duplicates).toBe(1);
    expect(c.screened).toBe(9);
    expect(c.excluded1).toBe(2);
    expect(c.pending1).toBe(1);
    expect(c.sought).toBe(6);
    expect(c.notRetrieved).toBe(1);
    expect(c.assessed).toBe(5);
    expect(c.excluded2).toEqual([{ reason: 'Nevhodná populace', n: 1 }, { reason: 'Nevhodný design studie', n: 1 }, { reason: 'Důvod neuveden', n: 1 }]);
    expect(c.excluded2Total).toBe(3);
    expect(c.pending2).toBe(1);
    expect(c.included).toBe(1);
    // Kontrola, že se počty sčítají.
    expect(c.screened).toBe(c.excluded1 + c.pending1 + c.sought);
    expect(c.assessed).toBe(c.excluded2Total + c.pending2 + c.included);
    expect(includedRecords(records, 'systematic')).toHaveLength(1);
  });
  it('jednostupňový výběr u narativního přehledu', () => {
    const c = flowCounts(records, 'narrative');
    expect(c.twoStage).toBe(false);
    expect(c.included).toBe(5);
    expect(includedRecords(records, 'narrative')).toHaveLength(5);
  });
});

describe('citace', () => {
  const a = rec({
    id: 'a',
    title: 'Effects of exercise on depression',
    authors: [parseAuthor('Novák, Jan Karel'), parseAuthor('Svobodová, Eva')],
    year: 2020,
    journal: 'Journal of Sport',
    volume: '12',
    issue: '3',
    pages: '45-67',
    doi: '10.1000/js.2020',
  });
  const b = rec({ id: 'b', title: 'Another study?', authors: [parseAuthor('Novák, Jan Karel'), parseAuthor('Svobodová, Eva')], year: 2020, journal: 'Other Journal' });
  const c = rec({ id: 'c', title: 'Big team paper', authors: ['Adams, Al', 'Brown, Bo', 'Clark, Cy'].map(parseAuthor), year: 2019 });
  const d = rec({ id: 'd', title: 'Report without any authors listed here', year: null });

  it('APA 7', () => {
    const cites = buildCitations([a, c], 'apa');
    expect(cites.map((x) => x.id)).toEqual(['c', 'a']);
    expect(cites[1].plain).toBe('Novák, J. K., & Svobodová, E. (2020). Effects of exercise on depression. Journal of Sport, 12(3), 45–67. https://doi.org/10.1000/js.2020');
    expect(cites[1].reference.filter((s) => s.italic).map((s) => s.text)).toEqual(['Journal of Sport', '12']);
    expect(cites[1].inText).toBe('Novák & Svobodová, 2020');
    expect(cites[0].inText).toBe('Adams et al., 2019');
    expect(cites[0].plain).toBe('Adams, A., Brown, B., & Clark, C. (2019). Big team paper.');
  });
  it('ČSN ISO 690', () => {
    const cites = buildCitations([a], 'iso690');
    expect(cites[0].plain).toBe(
      'NOVÁK, Jan Karel a SVOBODOVÁ, Eva, 2020. Effects of exercise on depression. Journal of Sport. Roč. 12, č. 3, s. 45–67. Dostupné z: https://doi.org/10.1000/js.2020',
    );
    expect(cites[0].narrative).toBe('Novák a Svobodová (2020)');
  });
  it('rozliší stejné autory a rok písmeny a zvládne chybějící údaje', () => {
    const cites = buildCitations([b, a, d], 'apa');
    const byId = Object.fromEntries(cites.map((x) => [x.id, x]));
    expect(byId.b.inText).toBe('Novák & Svobodová, 2020a');
    expect(byId.a.inText).toBe('Novák & Svobodová, 2020b');
    expect(byId.b.plain).toBe('Novák, J. K., & Svobodová, E. (2020a). Another study? Other Journal.');
    expect(byId.d.plain).toBe('Report without any authors listed here. (n.d.).');
    expect(byId.d.inText).toBe('„Report without any authors…“, n.d.');
  });
});
