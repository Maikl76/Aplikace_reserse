// Ukázkové projekty.
//
// 1. Metaanalýza účinnosti vakcíny BCG proti tuberkulóze.
// Čísla pocházejí z Colditz et al. (1994, JAMA 271:698–702) v podobě datové sady
// dat.bcg balíku metafor. Slouží k vyzkoušení aplikace a k porovnání výsledků
// s publikovaným výstupem (odhad logRR = −0,71; τ² = 0,31; I² = 92 %).
// Záznamy obsahují jen autora, rok a počty – názvy jsou označeny jako ukázkové.
//
// 2. Síťová metaanalýza intervencí pro odvykání kouření (Hasselblad, 1998, Medical Decision
// Making 18:37–43; datová sada dat.hasselblad1998 balíku metadat): 24 studií, 4 intervence,
// dvě tříramenné studie. Výsledek lze porovnat s kontrastním modelem v dokumentaci metafor.

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
    demo: 'Toto je ukázkový projekt s 13 studiemi vakcíny BCG (Colditz et al., 1994). Vyhledávání a třídění v něm neproběhlo; slouží k vyzkoušení extrakce, metaanalýzy, metaregrese a sestavení textu.',
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
    synthesis: { ...project.synthesis, subgroupField: 'alloc', moderators: ['ablat'] },
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
      effects: { [outcomeId]: [{ e1: String(tpos), n1: String(tpos + tneg), e2: String(cpos), n2: String(cpos + cneg) }] },
    };
  });

  await db.transaction('rw', db.projects, db.records, async () => {
    await db.projects.add(project);
    await db.records.bulkAdd(records);
  });
  return project;
}

// ---- Síťová metaanalýza: odvykání kouření --------------------------------------

const TREATMENTS: Record<string, string> = {
  no_contact: 'bez kontaktu',
  self_help: 'svépomoc',
  ind_counseling: 'individuální poradenství',
  grp_counseling: 'skupinové poradenství',
};

// autoři, rok, ramena [intervence, počet abstinujících, počet účastníků]
const SMOKING: [string, number, [string, number, number][]][] = [
  ['Reid et al.', 1974, [['no_contact', 75, 731], ['ind_counseling', 363, 714]]],
  ['Cottraux et al.', 1983, [['no_contact', 9, 140], ['ind_counseling', 23, 140], ['grp_counseling', 10, 138]]],
  ['Slama et al.', 1990, [['no_contact', 2, 106], ['ind_counseling', 9, 205]]],
  ['Jamrozik et al.', 1984, [['no_contact', 58, 549], ['ind_counseling', 237, 1561]]],
  ['Rabkin et al.', 1984, [['no_contact', 0, 33], ['ind_counseling', 9, 48]]],
  ['Decker; Evans', 1989, [['self_help', 20, 49], ['ind_counseling', 16, 43]]],
  ['Richmond et al.', 1986, [['no_contact', 3, 100], ['ind_counseling', 31, 98]]],
  ['Leung', 1991, [['no_contact', 1, 31], ['ind_counseling', 26, 95]]],
  ['Mothersill et al.', 1988, [['self_help', 11, 78], ['ind_counseling', 12, 85], ['grp_counseling', 29, 170]]],
  ['Langford et al.', 1983, [['no_contact', 6, 39], ['ind_counseling', 17, 77]]],
  ['Gritz et al.', 1992, [['no_contact', 79, 702], ['self_help', 77, 694]]],
  ['Campbell et al.', 1986, [['no_contact', 18, 671], ['self_help', 21, 535]]],
  ['Sanders et al.', 1989, [['no_contact', 64, 642], ['ind_counseling', 107, 761]]],
  ['Hilleman et al.', 1993, [['ind_counseling', 12, 76], ['grp_counseling', 20, 74]]],
  ['Gillams et al.', 1984, [['ind_counseling', 9, 55], ['grp_counseling', 3, 26]]],
  ['Mogielnicki et al.', 1986, [['self_help', 7, 66], ['grp_counseling', 32, 127]]],
  ['Page et al.', 1986, [['no_contact', 5, 62], ['ind_counseling', 8, 90]]],
  ['Vetter; Ford', 1990, [['no_contact', 20, 234], ['ind_counseling', 34, 237]]],
  ['Williams; Hall', 1988, [['no_contact', 0, 20], ['grp_counseling', 9, 20]]],
  ['Pallonen et al.', 1994, [['no_contact', 8, 116], ['self_help', 19, 149]]],
  ['Russell et al.', 1983, [['no_contact', 95, 1107], ['ind_counseling', 143, 1031]]],
  ['Stewart; Rosser', 1982, [['no_contact', 15, 187], ['ind_counseling', 36, 504]]],
  ['Russell et al.', 1979, [['no_contact', 78, 584], ['ind_counseling', 73, 675]]],
  ['Kendrick et al.', 1995, [['no_contact', 69, 1177], ['ind_counseling', 54, 888]]],
];

export async function createNetworkDemo(): Promise<Project> {
  const project = newProject('meta', 'Ukázka: síťová metaanalýza intervencí pro odvykání kouření');
  const outcomeId = uid();
  const search: SearchRun = {
    id: uid(),
    source: 'Ukázková data (dat.hasselblad1998)',
    via: 'manual',
    date: nowIso(),
    query: 'Bez hledání – 24 studií převzatých z Hasselblad (1998).',
    hits: SMOKING.length,
    imported: SMOKING.length,
    note: 'Ukázkový projekt neobsahuje skutečné vyhledávání ani třídění.',
  };

  Object.assign(project, {
    demo: 'Toto je ukázkový projekt s 24 studiemi intervencí pro odvykání kouření (Hasselblad, 1998). Vyhledávání a třídění v něm neproběhlo; slouží k vyzkoušení síťové metaanalýzy. Dvě studie mají tři ramena.',
    question: {
      framework: 'PICO',
      elements: { P: 'dospělí kuřáci', I: 'svépomocné materiály, individuální nebo skupinové poradenství', C: 'bez kontaktu a jednotlivé intervence navzájem', O: 'abstinence po 6 až 12 měsících' },
      text: 'Která intervence pro odvykání kouření vede u dospělých kuřáků nejčastěji k abstinenci po 6 až 12 měsících?',
      aim: 'Srovnat účinnost svépomoci, individuálního a skupinového poradenství při odvykání kouření a seřadit je podle účinnosti.',
      rationale: 'Jednotlivé studie srovnávají vždy jen dvě nebo tři intervence. Síťová metaanalýza umožňuje srovnat všechny najednou a využít i nepřímé důkazy.',
    },
    protocol: {
      ...project.protocol,
      include: 'Kontrolované studie intervencí pro odvykání kouření u dospělých\nUvedený počet abstinujících v každé skupině',
      exclude: 'Studie bez srovnávací skupiny',
      sources: 'Ukázková datová sada',
    },
    searches: [search],
    fields: [{ id: 'findings', label: 'Hlavní zjištění', kind: 'text', hint: '' }],
    outcomes: [{ id: outcomeId, name: 'Abstinence po 6–12 měsících', measure: 'OR', note: 'Poměr šancí větší než 1 znamená častější abstinenci.', network: true, smallerBetter: false, reference: TREATMENTS.no_contact }],
    qualityTool: 'rob2',
    done: { question: true, protocol: true, search: true, dedup: true, screen1: true, screen2: true, extract: true },
  } satisfies Partial<Project>);

  const records: RecordItem[] = SMOKING.map(([authors, year, arms]) => {
    const names = authors.replace(' et al.', '').split('; ');
    const base = toRecord(
      {
        title: `Ukázkový záznam: studie odvykání kouření (${authors.replace('; ', ' a ')}, ${year})`,
        authors: authors.includes('et al.') ? [{ family: authors, given: '' }] : names.map((family) => ({ family, given: '' })),
        year,
        journal: '',
        volume: '',
        issue: '',
        pages: '',
        doi: '',
        pmid: '',
        url: '',
        abstract: `Ukázková data bez abstraktu. ${arms.map(([t, x, n]) => `${TREATMENTS[t]}: ${x} abstinujících z ${n}`).join('; ')}.`,
        keywords: [],
        language: '',
        pubType: 'ukázka',
      },
      project.id,
      search,
    );
    // První rameno je srovnávací; u tříramenné studie se s ním srovnávají obě další ramena.
    const [control, ...others] = arms;
    return {
      ...base,
      screen1: 'include',
      fulltext: 'retrieved',
      screen2: 'include',
      extraction: { findings: '' },
      effects: {
        [outcomeId]: others.map(([t, x, n]) => ({ _t1: TREATMENTS[t], _t2: TREATMENTS[control[0]], e1: String(x), n1: String(n), e2: String(control[1]), n2: String(control[2]) })),
      },
    };
  });

  await db.transaction('rw', db.projects, db.records, async () => {
    await db.projects.add(project);
    await db.records.bulkAdd(records);
  });
  return project;
}
