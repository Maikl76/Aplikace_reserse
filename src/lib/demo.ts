// Ukázkový projekt: metaanalýza účinnosti vakcíny BCG proti tuberkulóze.
// Čísla pocházejí z Colditz et al. (1994, JAMA 271:698–702) v podobě datové sady
// dat.bcg balíku metafor. Slouží k vyzkoušení aplikace a k porovnání výsledků
// s publikovaným výstupem (odhad logRR = −0,71; τ² = 0,31; I² = 92 %).
// Záznamy obsahují jen autora, rok a počty – názvy jsou označeny jako ukázkové.

import { db, newProject, toRecord } from './db';
import type { Project, RecordItem, SearchRun } from './types';
import { nowIso, uid } from './util';

// autor, rok, nemocní a zdraví očkovaní, nemocní a zdraví neočkovaní, zeměpisná šířka, způsob přidělení
const BCG: [string, number, number, number, number, number, number, string][] = [
  ['Aronson', 1948, 4, 119, 11, 128, 44, 'náhodné'],
  ['Ferguson; Simes', 1949, 6, 300, 29, 274, 55, 'náhodné'],
  ['Rosenthal et al.', 1960, 3, 228, 11, 209, 42, 'náhodné'],
  ['Hart; Sutherland', 1977, 62, 13536, 248, 12619, 52, 'náhodné'],
  ['Frimodt-Moller et al.', 1973, 33, 5036, 47, 5761, 13, 'střídavé'],
  ['Stein; Aronson', 1953, 180, 1361, 372, 1079, 44, 'střídavé'],
  ['Vandiviere et al.', 1973, 8, 2537, 10, 619, 19, 'náhodné'],
  ['TPT Madras', 1980, 505, 87886, 499, 87892, 13, 'náhodné'],
  ['Coetzee; Berjak', 1968, 29, 7470, 45, 7232, 27, 'náhodné'],
  ['Rosenthal et al.', 1961, 17, 1699, 65, 1600, 42, 'systematické'],
  ['Comstock et al.', 1974, 186, 50448, 141, 27197, 18, 'systematické'],
  ['Comstock; Webster', 1969, 5, 2493, 3, 2338, 33, 'systematické'],
  ['Comstock et al.', 1976, 27, 16886, 29, 17825, 33, 'systematické'],
];

export async function createDemoProject(): Promise<Project> {
  const project = newProject('meta', 'Ukázka: účinnost vakcíny BCG proti tuberkulóze');
  const outcomeId = uid();
  const search: SearchRun = {
    id: uid(),
    source: 'Ukázková data (dat.bcg)',
    via: 'manual',
    date: nowIso(),
    query: 'Bez hledání – 13 studií převzatých z Colditz et al. (1994).',
    hits: 13,
    imported: 13,
    note: 'Ukázkový projekt neobsahuje skutečné vyhledávání ani třídění.',
  };

  Object.assign(project, {
    demo: true,
    question: {
      framework: 'PICO',
      elements: { P: 'osoby bez předchozí tuberkulózy', I: 'očkování vakcínou BCG', C: 'bez očkování', O: 'onemocnění tuberkulózou' },
      text: 'Snižuje očkování vakcínou BCG ve srovnání s neočkováním riziko onemocnění tuberkulózou?',
      aim: 'Odhadnout účinnost vakcíny BCG v prevenci tuberkulózy a prozkoumat, proč se výsledky studií liší.',
      rationale: 'Studie účinnosti BCG docházejí k velmi rozdílným výsledkům – od výrazné ochrany po žádný účinek.',
    },
    protocol: {
      ...project.protocol,
      include: 'Kontrolované studie srovnávající očkované a neočkované osoby\nUvedený počet případů tuberkulózy v obou skupinách',
      exclude: 'Studie bez kontrolní skupiny',
      sources: 'Ukázková datová sada',
    },
    searches: [search],
    fields: [
      { id: 'alloc', label: 'Způsob přidělení', kind: 'category', hint: 'náhodné, střídavé, systematické' },
      { id: 'ablat', label: 'Zeměpisná šířka (°)', kind: 'number', hint: 'absolutní zeměpisná šířka místa studie' },
      { id: 'findings', label: 'Hlavní zjištění', kind: 'text', hint: '' },
    ],
    outcomes: [{ id: outcomeId, name: 'Onemocnění tuberkulózou', measure: 'RR', note: 'Relativní riziko menší než 1 znamená ochranný účinek vakcíny.' }],
    qualityTool: 'custom',
    customQualityItems: 'Bylo přidělení do skupin náhodné?\nByly skupiny na začátku srovnatelné?\nBylo zjišťování onemocnění stejné v obou skupinách?',
    synthesis: { ...project.synthesis, subgroupField: 'alloc' },
    done: { question: true, protocol: true, search: true, dedup: true, screen1: true, screen2: true, extract: true },
  } satisfies Partial<Project>);

  const records: RecordItem[] = BCG.map(([authors, year, tpos, tneg, cpos, cneg, ablat, alloc]) => {
    const names = authors.replace(' et al.', '').split('; ');
    const base = toRecord(
      {
        title: `Ukázkový záznam: studie vakcíny BCG (${authors.replace('; ', ' a ')}, ${year})`,
        // „et al.“ je součástí označení – jména spoluautorů ukázková sada neobsahuje.
        authors: authors.includes('et al.') ? [{ family: authors, given: '' }] : names.map((family) => ({ family, given: '' })),
        year,
        journal: '',
        volume: '',
        issue: '',
        pages: '',
        doi: '',
        pmid: '',
        url: '',
        abstract: `Ukázková data bez abstraktu. Očkovaní: ${tpos} případů tuberkulózy z ${tpos + tneg}. Neočkovaní: ${cpos} případů z ${cpos + cneg}.`,
        keywords: [],
        language: '',
        pubType: 'ukázka',
      },
      project.id,
      search,
    );
    return {
      ...base,
      screen1: 'include',
      fulltext: 'retrieved',
      screen2: 'include',
      extraction: { alloc, ablat: String(ablat), findings: '' },
      effects: { [outcomeId]: { e1: String(tpos), n1: String(tpos + tneg), e2: String(cpos), n2: String(cpos + cneg) } },
    };
  });

  await db.transaction('rw', db.projects, db.records, async () => {
    await db.projects.add(project);
    await db.records.bulkAdd(records);
  });
  return project;
}
