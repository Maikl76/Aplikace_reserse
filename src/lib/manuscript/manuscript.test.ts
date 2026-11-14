import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';
import { analyzeOutcome, countBy, countByYear, forestRows, gradeCertainty, studyLabels } from '../analysis';
import { CHECKLISTS } from '../checklists';
import { db, exportBackup, importBackup, newProject, removeSearch, addSearchResults, deleteProject } from '../db';
import { createDemoProject } from '../demo';
import { barsSvg, columnsSvg, forestSvg, funnelSvg, niceTicks, prismaSvg, wrapText } from '../figures';
import { flowCounts, includedRecords } from '../flow';
import { QUALITY_TOOLS, toolFor } from '../quality';
import { REVIEW_TYPES, TYPE_ORDER, defaultFields } from '../reviewTypes';
import { GUIDES } from '../content/guides';
import type { Project, RecordItem } from '../types';
import { emptyBib } from '../util';
import { buildManuscript, countTodos, toBlocks } from './build';
import { buildDocx, splitTodos, toMarkdown } from './export';

// Nejmenší platný obrázek PNG (1×1 bod) místo vykreslení přes plátno prohlížeče.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));

let project: Project;
let records: RecordItem[];

beforeAll(async () => {
  project = await createDemoProject();
  records = await db.records.where('projectId').equals(project.id).toArray();
});

describe('ukázkový projekt', () => {
  it('obsahuje 13 zařazených studií a dává publikovaný výsledek', () => {
    expect(records).toHaveLength(13);
    const included = includedRecords(records, project.type);
    expect(included).toHaveLength(13);
    const a = analyzeOutcome(project, included, project.outcomes[0]);
    expect(a.studies).toHaveLength(13);
    expect(a.skipped).toHaveLength(0);
    expect(a.result!.estimate).toBeCloseTo(-0.7145, 4);
    expect(a.result!.tau2).toBeCloseTo(0.3132, 4);
    expect(a.subgroups!.groups.map((g) => g.name)).toEqual(['náhodné', 'střídavé', 'systematické']);
    expect(a.studies[0].label).toBe('Aronson (1948)');
    const rows = forestRows(a);
    expect(rows.filter((r) => r.kind === 'study')).toHaveLength(13);
    expect(rows.filter((r) => r.kind === 'group')).toHaveLength(3);
    expect(rows[rows.length - 1].kind).toBe('summary');
    expect(rows[rows.length - 1].pi).not.toBeNull();
  });
  it('rozliší stejně označené studie', () => {
    const labels = [...studyLabels(records).values()];
    expect(new Set(labels).size).toBe(13);
    expect(labels).toContain('Aronson (1948)');
    expect(labels).toContain('Ferguson a Simes (1949)');
  });
});

describe('obrázky', () => {
  it('diagram PRISMA obsahuje počty a je platné XML', () => {
    const counts = flowCounts(records, 'meta', project.protocol.excludeReasons);
    const svg = prismaSvg(counts, { mode: 'light', unit: 'studie' });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(svg).toContain('(n\u00a0=\u00a013)');
    expect(svg).toContain('Identifikace');
    expect(svg).toContain('Studie zařazené do přehledu');
    // Jednostupňový výběr má méně polí.
    const single = prismaSvg(flowCounts(records, 'narrative'), { mode: 'dark', unit: 'zdroje' });
    expect(single).not.toContain('Plné texty');
    expect(single).toContain('Zdroje zařazené do přehledu');
  });
  it('lesní, trychtýřový a sloupcové grafy jsou platné XML', () => {
    const a = analyzeOutcome(project, includedRecords(records, 'meta'), project.outcomes[0]);
    const forest = forestSvg({ rows: forestRows(a), scale: a.scale, measure: 'RR', footer: ['Heterogenita: …'], mode: 'light' });
    const funnel = funnelSvg({ points: a.studies.map((s) => ({ label: s.label, yi: s.yi, se: Math.sqrt(s.vi) })), pooled: a.result!.estimate, scale: 'log', measure: 'RR', mode: 'light' });
    const bars = barsSvg(countBy(records, 'alloc'), { mode: 'light', title: 'Přidělení' });
    const cols = columnsSvg(countByYear(records), { mode: 'dark', title: 'Roky' });
    for (const svg of [forest, funnel, bars, cols]) {
      expect(new DOMParser().parseFromString(svg, 'image/svg+xml').getElementsByTagName('parsererror')).toHaveLength(0);
      expect(svg).not.toContain('NaN');
      expect(svg).not.toContain('Infinity');
    }
    expect(forest).toContain('0,49 [0,34; 0,70]');
    expect(forest).toContain('Celkem (náhodné efekty)');
    expect(bars).toContain('náhodné');
  });
  it('pomocné funkce', () => {
    expect(niceTicks(0, 10)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(-0.3, 1.2)[0]).toBeLessThanOrEqual(-0.3);
    expect(wrapText('jedna dvě tři čtyři', 9)).toEqual(['jedna dvě', 'tři čtyři']);
    expect(countByYear(records)[0].label).toBe('1948');
    expect(countBy(records, 'alloc')[0]).toEqual({ label: 'náhodné', value: 7 });
    expect(gradeCertainty({ rob: -1, inconsistency: -1, indirectness: 0, imprecision: 0, pubBias: 0 })).toBe('Nízká');
    expect(gradeCertainty({ rob: -2, inconsistency: -2, indirectness: -1, imprecision: 0, pubBias: 0 })).toBe('Velmi nízká');
  });
});

describe('sestavení textu', () => {
  it('bakalářská práce: struktura, čísla kapitol a obsah z dat', () => {
    const ms = buildManuscript(project, records);
    const titles = ms.sections.map((s) => (s.number ? `${s.number} ${s.title}` : s.title));
    expect(titles).toEqual([
      'Abstrakt',
      '1 Úvod',
      '2 Teoretická východiska',
      '3 Cíl a výzkumné otázky',
      '4 Metodika',
      '4.1 Kritéria způsobilosti',
      '4.2 Informační zdroje a vyhledávání',
      '4.3 Výběr studií',
      '4.4 Extrakce dat',
      '4.5 Hodnocení rizika zkreslení',
      '4.6 Syntéza',
      '5 Výsledky',
      '5.1 Výběr studií',
      '5.2 Charakteristiky zařazených studií',
      '5.3 Riziko zkreslení',
      '5.4 Výsledky syntézy',
      '6 Diskuse',
      '7 Závěr',
      'Prohlášení o použitých nástrojích',
      'Seznam literatury',
      'Příloha A: Vyhledávací strategie',
      'Příloha B: Vyřazené plné texty',
      'Příloha C: Kontrolní seznam PRISMA 2020',
    ]);
    const get = (id: string) => ms.sections.find((s) => s.id === id)!;
    expect(get('m-synthesis').generated).toContain('omezené maximální věrohodnosti (REML)');
    expect(get('m-synthesis').generated).toContain('podle proměnné „způsob přidělení“');
    const res = get('r-synthesis').generated;
    expect(res).toContain('RR = 0,49 (95% CI 0,34 až 0,70; p < 0,001; obrázek 2)');
    expect(res).toContain('I² = 92,2 %');
    expect(res).toContain('k = 13');
    expect(res).toContain('Eggerův test');
    // Lesní graf a bublinový graf metaregrese (moderátor: zeměpisná šířka).
    expect(get('r-synthesis').extras.filter((b) => b.t === 'figure')).toHaveLength(2);
    expect(res).toContain('Metaregrese (studií k = 13; tabulka 2): test moderátorů Q(1) = 16,36, p < 0,001; moderátory vysvětlily 75,6 % rozptylu mezi studiemi');
    expect(get('m-synthesis').generated).toContain('metaregresí se smíšenými efekty; moderátory byly: zeměpisná šířka (°)');
    expect(get('r-selection').generated).toContain('Do přehledu byly zařazeny studie (n = 13; obrázek 1).');
    expect(get('references').extras).toHaveLength(13);
    const table = get('r-characteristics').extras[0];
    expect(table.t === 'table' && table.rows.length).toBe(13);
    expect(table.t === 'table' && table.head).toEqual(['Studie', 'Způsob přidělení', 'Zeměpisná šířka (°)', 'Hlavní zjištění']);
    expect(get('app-checklist').extras[0].t === 'table' && (get('app-checklist').extras[0] as any).rows.length).toBe(CHECKLISTS.meta.items.length);
  });
  it('vlastní text má přednost a místa k doplnění se počítají', () => {
    const edited: Project = { ...project, manuscript: { ...project.manuscript, sections: { intro: 'Můj úvod.\n\nDruhý odstavec.', discussion: '' } } };
    const blocks = toBlocks(buildManuscript(edited, records), edited);
    const i = blocks.findIndex((b) => b.t === 'h' && b.text === '1 Úvod');
    expect(blocks[i + 1]).toEqual({ t: 'p', text: 'Můj úvod.' });
    expect(blocks[i + 2]).toEqual({ t: 'p', text: 'Druhý odstavec.' });
    expect(blocks.some((b) => b.t === 'todo' && b.text.includes('Diskuse'))).toBe(true);
    expect(countTodos(blocks)).toBeGreaterThan(5);
    expect(splitTodos('Text [DOPLŇTE: něco] konec')).toEqual([
      { text: 'Text ', todo: false },
      { text: '[DOPLŇTE: něco]', todo: true },
      { text: ' konec', todo: false },
    ]);
  });
  it('článek nemá čísla kapitol ani teoretickou část', () => {
    const article: Project = { ...project, manuscript: { ...project.manuscript, template: 'article', style: 'iso690' } };
    const ms = buildManuscript(article, records);
    expect(ms.sections.every((s) => s.number === '')).toBe(true);
    expect(ms.sections.map((s) => s.id)).not.toContain('theory');
    expect(ms.sections.find((s) => s.id === 'methods')!.generated).toContain('Výzkumná otázka zněla');
    const md = toMarkdown(article, ms);
    expect(md).toContain('## Metody');
    expect(md).toContain('| Studie | Způsob přidělení |');
    expect(md).toContain('ARONSON, 1948.');
  });
  it('každý typ přehledu se sestaví i bez dat', () => {
    for (const type of TYPE_ORDER) {
      const empty = newProject(type, 'Prázdný');
      const ms = buildManuscript(empty, []);
      const blocks = toBlocks(ms, empty);
      expect(blocks.length).toBeGreaterThan(10);
      expect(JSON.stringify(blocks)).not.toContain('undefined');
      expect(JSON.stringify(blocks)).not.toContain('NaN');
      expect(toMarkdown(empty, ms).length).toBeGreaterThan(500);
    }
  });
  it('mapovací a zastřešující přehled: četnosti a překryv', () => {
    const base = (over: Partial<RecordItem>): RecordItem => ({ ...records[0], ...emptyBib(), effects: {}, extraction: {}, quality: {}, qualityOverall: '', qualityNote: '', themes: [], ...over });
    const scoping = newProject('scoping', 'Mapa');
    scoping.synthesis.chartFields = ['design'];
    scoping.synthesis.themes = [{ id: 't1', name: 'Motivace', summary: 'Studie se shodují.' }];
    const recs = [
      base({ id: 'a', projectId: scoping.id, title: 'A', year: 2019, authors: [{ family: 'Novák', given: 'J' }], extraction: { design: 'kvalitativní' }, themes: ['t1'] }),
      base({ id: 'b', projectId: scoping.id, title: 'B', year: 2021, authors: [{ family: 'Malá', given: 'E' }], extraction: { design: 'kvalitativní; průřezová' } }),
    ];
    const ms = buildManuscript(scoping, recs);
    const res = ms.sections.find((s) => s.id === 'r-synthesis')!;
    expect(res.title).toBe('Výsledky mapování');
    expect(res.generated).toContain('nejčastější hodnotou bylo „kvalitativní“ (n = 2)');
    expect(res.generated).toContain('Motivace. Studie se shodují. (Novák, 2019)');
    expect(res.extras.map((b) => b.t)).toEqual(['figure', 'table']);
    expect(ms.sections.map((s) => s.id)).not.toContain('r-quality');

    const umbrella = newProject('umbrella', 'Zastřešující');
    const revs = [
      base({ id: 'r1', projectId: umbrella.id, title: 'R1', year: 2020, authors: [{ family: 'Adams', given: 'A' }], primaryStudies: 'Lee 2018\nKim 2019\nPark 2020' }),
      base({ id: 'r2', projectId: umbrella.id, title: 'R2', year: 2022, authors: [{ family: 'Brown', given: 'B' }], primaryStudies: 'Lee 2018\nKim 2019\nCho 2021' }),
    ];
    const um = buildManuscript(umbrella, revs);
    const synth = um.sections.find((s) => s.id === 'r-synthesis')!;
    expect(synth.generated).toContain('4 unikátních primárních studií při 6 zahrnutích');
    expect(synth.generated).toContain('CCA činil 50,0 %');
    expect(um.sections.find((s) => s.id === 'm-quality')!.generated).toContain('AMSTAR 2');
    expect(um.sections.find((s) => s.id === 'app-checklist')!.title).toContain('PRIOR');
  });
});

describe('export do Wordu', () => {
  it('vytvoří platný soubor DOCX s textem, tabulkami a obrázky', async () => {
    const ms = buildManuscript(project, records);
    const doc = await buildDocx(project, ms, async () => PNG);
    const buffer = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Metodika');
    expect(xml).toContain('Bakalářská práce');
    expect(xml).toContain('RR = 0,49');
    expect(xml.split('<w:tbl>').length - 1).toBe(4); // charakteristiky, metaregrese, deník hledání, kontrolní seznam
    expect(xml).toContain('w:highlight');
    // Tři obrázky (diagram, lesní graf, metaregrese); shodná data knihovna uloží jen jednou.
    expect(xml.split('<w:drawing>').length - 1).toBe(3);
    expect(Object.keys(zip.files).filter((f) => f.startsWith('word/media/')).length).toBeGreaterThanOrEqual(1);
  }, 30000);
});

describe('úložiště a záloha', () => {
  it('záloha se načte jako nový projekt se zachovanými vazbami', async () => {
    const dupOf = records[0].id;
    await db.records.update(records[1].id, { duplicateOf: dupOf });
    const backup = JSON.parse(JSON.stringify(await exportBackup(project.id)));
    const copy = await importBackup(backup);
    expect(copy.id).not.toBe(project.id);
    expect(copy.title).toBe(project.title);
    const copied = await db.records.where('projectId').equals(copy.id).toArray();
    expect(copied).toHaveLength(13);
    const dup = copied.find((r) => r.duplicateOf)!;
    expect(copied.some((r) => r.id === dup.duplicateOf)).toBe(true);
    expect(dup.duplicateOf).not.toBe(dupOf);
    await expect(importBackup({ foo: 1 })).rejects.toThrow('není zálohou');
    await db.records.update(records[1].id, { duplicateOf: null });
    await deleteProject(copy.id);
    expect(await db.records.where('projectId').equals(copy.id).count()).toBe(0);
  });
  it('přidání a odebrání hledání udržuje deník i záznamy', async () => {
    const p = newProject('systematic', 'Test');
    await db.projects.add(p);
    const bib = { ...emptyBib(), title: 'Jedna' };
    const run = await addSearchResults(p, { source: 'PubMed', via: 'api', query: 'q', hits: 10, note: '' }, [bib, { ...bib, title: 'Dvě' }]);
    const run2 = await addSearchResults(p, { source: 'Scopus', via: 'file', query: '', hits: null, note: '' }, [{ ...bib, title: 'Tři' }]);
    let all = await db.records.where('projectId').equals(p.id).toArray();
    expect(all).toHaveLength(3);
    expect((await db.projects.get(p.id))!.searches.map((s) => s.imported)).toEqual([2, 1]);
    // Duplicita ze Scopusu ukazuje na záznam z PubMedu; po odebrání PubMedu se osamostatní.
    const scopus = all.find((r) => r.searchId === run2.id)!;
    await db.records.update(scopus.id, { duplicateOf: all.find((r) => r.searchId === run.id)!.id });
    await removeSearch(p, run.id);
    all = await db.records.where('projectId').equals(p.id).toArray();
    expect(all).toHaveLength(1);
    expect(all[0].duplicateOf).toBeNull();
    expect((await db.projects.get(p.id))!.searches).toHaveLength(1);
  });
});

describe('úplnost nastavení', () => {
  it('každý typ má průvodce ke všem krokům, kontrolní seznam a platné nástroje', () => {
    for (const type of TYPE_ORDER) {
      const conf = REVIEW_TYPES[type];
      for (const step of conf.steps) expect(GUIDES[step.id]).toBeTruthy();
      for (const toolId of conf.qualityTools) expect(QUALITY_TOOLS[toolId]).toBeTruthy();
      expect(CHECKLISTS[type].items.length).toBeGreaterThan(5);
      expect(new Set(CHECKLISTS[type].items.map((i) => i.id)).size).toBe(CHECKLISTS[type].items.length);
      expect(defaultFields(type).length).toBeGreaterThan(2);
    }
    expect(CHECKLISTS.systematic.items).toHaveLength(42);
    expect(CHECKLISTS.scoping.items).toHaveLength(22);
    expect(CHECKLISTS.umbrella.items).toHaveLength(46);
    expect(CHECKLISTS.narrative.items).toHaveLength(6);
  });
  it('návrh celkového hodnocení podle pravidel nástrojů', () => {
    const rob = QUALITY_TOOLS.rob2;
    const all = (v: string) => Object.fromEntries(rob.items.map((i) => [i.id, v]));
    expect(rob.suggest!(all('low'), rob.items)).toBe('low');
    expect(rob.suggest!({ ...all('low'), d3: 'some' }, rob.items)).toBe('some');
    expect(rob.suggest!({ ...all('some'), d5: 'high' }, rob.items)).toBe('high');
    expect(rob.suggest!({ d1: 'low' }, rob.items)).toBeNull();
    const am = QUALITY_TOOLS.amstar2;
    const yes = Object.fromEntries(am.items.map((i) => [i.id, 'yes']));
    expect(am.items.filter((i) => i.critical).map((i) => i.id)).toEqual(['q2', 'q4', 'q7', 'q9', 'q11', 'q13', 'q15']);
    expect(am.suggest!(yes, am.items)).toBe('high');
    expect(am.suggest!({ ...yes, q1: 'no' }, am.items)).toBe('high');
    expect(am.suggest!({ ...yes, q1: 'no', q3: 'no' }, am.items)).toBe('moderate');
    expect(am.suggest!({ ...yes, q4: 'no' }, am.items)).toBe('low');
    expect(am.suggest!({ ...yes, q4: 'no', q9: 'no' }, am.items)).toBe('critically-low');
    expect(am.suggest!({ ...yes, q11: 'na', q12: 'na', q15: 'na' }, am.items)).toBe('high');
    const ri = QUALITY_TOOLS['robins-i'];
    expect(ri.suggest!({ ...Object.fromEntries(ri.items.map((i) => [i.id, 'low'])), d1: 'serious', d2: 'moderate' }, ri.items)).toBe('serious');
    expect(toolFor({ qualityTool: 'custom', customQualityItems: 'A?\nB?\n\n' })!.items).toHaveLength(2);
    expect(toolFor({ qualityTool: '', customQualityItems: '' })).toBeNull();
  });
});
