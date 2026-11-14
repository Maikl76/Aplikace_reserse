// Rozšíření verze 0.2: dva hodnotitelé, více efektů na studii, metaregrese a síťová metaanalýza
// na úrovni projektu (úložiště, analýza, sestavení textu).
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import ref from '../../tests/reference/reference-metafor.json';
import { analyzeNetwork, analyzeOutcome, analyzeRegression, effectRows, forestRows } from './analysis';
import { addEffect, addSearchResults, castVote1, castVote2, db, exportBackup, exportReviewerPackage, exportVotes, importBackup, importVotes, mergeEffect, newProject, normalizeProject, normalizeRecord, removeEffect, setDoubleMode } from './db';
import { createDemoProject, createNetworkDemo } from './demo';
import { bubbleSvg, networkSvg } from './figures';
import { flowCounts, includedRecords } from './flow';
import { buildManuscript } from './manuscript/build';
import { cohenKappa, consensus1, consensus2, interpretKappa, reasonMismatch, stage1Stats, stage2Stats, state1, state2 } from './reviewers';
import { compositeEffect } from './stats/multilevel';
import { ago } from './storage';
import type { Project, RecordItem } from './types';
import { emptyBib } from './util';

const recordsOf = (id: string) => db.records.where('projectId').equals(id).toArray();
const fresh = async (id: string) => (await db.projects.get(id))!;

// ---- Dva hodnotitelé ---------------------------------------------------------------

describe('míra shody a výsledné rozhodnutí', () => {
  it('Cohenovo kappa', () => {
    // 20 oba ano, 5 jen A, 10 jen B, 15 oba ne: po = 0,7; pe = 0,5·0,6 + 0,5·0,4 = 0,5; κ = 0,4
    const pairs: [boolean, boolean][] = [...Array(20).fill([true, true]), ...Array(5).fill([true, false]), ...Array(10).fill([false, true]), ...Array(15).fill([false, false])];
    const k = cohenKappa(pairs);
    expect(k.n).toBe(50);
    expect(k.po).toBeCloseTo(0.7, 12);
    expect(k.pe).toBeCloseTo(0.5, 12);
    expect(k.kappa).toBeCloseTo(0.4, 12);
    expect(k.table).toEqual([20, 5, 10, 15]);
    expect(cohenKappa([[true, true], [true, true]]).kappa).toBeNull(); // oba rozhodli vždy stejně
    expect(cohenKappa([]).kappa).toBeNull();
    expect(interpretKappa(0.4)).toBe('slabá');
    expect(interpretKappa(0.75)).toBe('podstatná');
    expect(interpretKappa(0.9)).toBe('téměř úplná');
  });
  it('shoda, čekání a neshoda', () => {
    const rev = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
    expect(state1({ votes1: { a: 'include' } }, rev)).toBe('waiting');
    expect(state1({ votes1: { a: 'include', b: 'maybe' } }, rev)).toBe('agree'); // obojí posílá záznam dál
    expect(consensus1({ votes1: { a: 'include', b: 'maybe' } }, rev)).toBe('maybe');
    expect(consensus1({ votes1: { a: 'include', b: 'include' } }, rev)).toBe('include');
    expect(consensus1({ votes1: { a: 'exclude', b: 'exclude' } }, rev)).toBe('exclude');
    expect(state1({ votes1: { a: 'maybe', b: 'exclude' } }, rev)).toBe('conflict');
    expect(consensus1({ votes1: { a: 'maybe', b: 'exclude' } }, rev)).toBe('pending');
    const v = (decision: 'include' | 'exclude', reason = '') => ({ decision, reason });
    expect(state2({ votes2: { a: v('include'), b: v('exclude', 'x') } }, rev)).toBe('conflict');
    expect(consensus2({ votes2: { a: v('exclude', 'design'), b: v('exclude', 'populace') } }, rev)).toEqual({ decision: 'exclude', reason: 'design' });
    expect(reasonMismatch({ votes2: { a: v('exclude', 'design'), b: v('exclude', 'populace') } }, rev)).toBe(true);
    expect(reasonMismatch({ votes2: { a: v('exclude', 'design'), b: v('exclude', 'design') } }, rev)).toBe(false);
    expect(consensus2({ votes2: { a: v('include'), b: v('include') } }, rev)).toEqual({ decision: 'include', reason: '' });
  });
});

describe('třídění dvěma hodnotiteli v projektu', () => {
  let project: Project;
  let ids: string[];
  const titles = ['Jedna', 'Dvě', 'Tři', 'Čtyři', 'Pět', 'Šest'];

  it('zapnutí režimu převede dosavadní rozhodnutí na hlasy prvního hodnotitele', async () => {
    project = newProject('systematic', 'Dva hodnotitelé');
    await db.projects.add(project);
    await addSearchResults(project, { source: 'PubMed', via: 'api', query: 'q', hits: 6, note: '' }, titles.map((title) => ({ ...emptyBib(), title })));
    const recs = await recordsOf(project.id);
    ids = titles.map((t) => recs.find((r) => r.title === t)!.id);
    await db.records.update(ids[0], { screen1: 'include' });
    await setDoubleMode(project, true);
    project = await fresh(project.id);
    expect(project.team.double).toBe(true);
    const first = (await db.records.get(ids[0]))!;
    expect(first.votes1[project.team.reviewers[0].id]).toBe('include');
    expect(first.screen1).toBe('pending'); // čeká na druhého hodnotitele
  });

  it('výsledné rozhodnutí vzniká shodou, neshoda zůstává otevřená', async () => {
    const [a, b] = project.team.reviewers.map((r) => r.id);
    const votesA = ['include', 'include', 'exclude', 'exclude', 'maybe', 'exclude'] as const;
    const votesB = ['include', 'exclude', 'exclude', 'include', 'include', 'exclude'] as const;
    for (let i = 0; i < 6; i++) await castVote1(project, ids[i], a, votesA[i]);
    let recs = await recordsOf(project.id);
    expect(recs.every((r) => r.screen1 === 'pending')).toBe(true);
    for (let i = 0; i < 6; i++) await castVote1(project, ids[i], b, votesB[i]);
    recs = await recordsOf(project.id);
    const final = ids.map((id) => recs.find((r) => r.id === id)!.screen1);
    expect(final).toEqual(['include', 'pending', 'exclude', 'pending', 'maybe', 'exclude']);
    const st = stage1Stats(recs, project.team);
    expect(st.agreement.n).toBe(6);
    expect(st.agreement.agree).toBe(4);
    expect(st.conflicts).toBe(2);
    expect(st.open).toBe(2);
    expect(st.votedBy).toEqual([6, 6]);
    // Vývojový diagram bere jen výsledná rozhodnutí; neshody se počítají jako neposouzené.
    expect(flowCounts(recs, 'systematic').pending1).toBe(2);
    // Vyřešení neshody = ruční zápis výsledného rozhodnutí; hlasy zůstávají.
    await db.records.update(ids[1], { screen1: 'include' });
    await db.records.update(ids[3], { screen1: 'exclude' });
    recs = await recordsOf(project.id);
    expect(stage1Stats(recs, project.team).open).toBe(0);
    expect(stage1Stats(recs, project.team).conflicts).toBe(2);
    // Změna hlasu po vyřešení výsledek znovu přepočítá.
    await castVote1(project, ids[3], b, 'exclude');
    expect((await db.records.get(ids[3]))!.screen1).toBe('exclude');
    await castVote1(project, ids[3], b, 'pending');
    expect((await db.records.get(ids[3]))!.screen1).toBe('pending');
    await castVote1(project, ids[3], b, 'exclude');
  });

  it('plné texty: shoda, důvod vyřazení a míra shody', async () => {
    const [a, b] = project.team.reviewers.map((r) => r.id);
    await castVote2(project, ids[0], a, { decision: 'include', reason: '' });
    await castVote2(project, ids[0], b, { decision: 'include', reason: '' });
    await castVote2(project, ids[1], a, { decision: 'exclude', reason: 'Nevhodný design' });
    await castVote2(project, ids[1], b, { decision: 'exclude', reason: 'Nevhodná populace' });
    await castVote2(project, ids[4], a, { decision: 'include', reason: '' });
    await castVote2(project, ids[4], b, { decision: 'exclude', reason: 'Nevhodný výstup' });
    const recs = await recordsOf(project.id);
    const r = (i: number) => recs.find((x) => x.id === ids[i])!;
    expect(r(0).screen2).toBe('include');
    expect(r(0).fulltext).toBe('retrieved');
    expect(r(1).screen2).toBe('exclude');
    expect(r(1).excludeReason).toBe('Nevhodný design');
    expect(r(4).screen2).toBe('pending');
    const st = stage2Stats(recs.filter((x) => x.screen1 === 'include' || x.screen1 === 'maybe'), project.team);
    expect(st.agreement.n).toBe(3);
    expect(st.conflicts).toBe(1);
    const ms = buildManuscript(project, recs);
    const methods = ms.sections.find((s) => s.id === 'm-selection')!.generated;
    expect(methods).toContain('nezávisle dva hodnotitelé (Hodnotitel A, Hodnotitel B)');
    const results = ms.sections.find((s) => s.id === 'r-selection')!.generated;
    // A: ano, ano, ne, ne, ano, ne; B: ano, ne, ne, ne, ano, ne → shoda 5/6, pe = 0,5, κ = 0,67.
    expect(results).toContain('Při třídění podle názvu a abstraktu se hodnotitelé shodli u 83,3 % záznamů posouzených oběma (n = 6; Cohenovo κ = 0,67, shoda podstatná); neshody (n = 1) byly řešeny dohodou.');
    expect(results).toContain('Při posuzování plných textů se hodnotitelé shodli u 66,7 % záznamů posouzených oběma (n = 3; Cohenovo κ = 0,40, shoda slabá)');
    expect(results).toContain('[DOPLŇTE: 1 neshoda zatím není vyřešena]');
  });

  it('balíček pro druhého hodnotitele neobsahuje cizí rozhodnutí a rozhodnutí se vrátí zpět', async () => {
    const [a, b] = project.team.reviewers.map((r) => r.id);
    // Nový projekt: A třídí u sebe, B dostane balíček.
    const main = newProject('systematic', 'Výměna');
    await db.projects.add(main);
    await addSearchResults(main, { source: 'PubMed', via: 'api', query: 'q', hits: 3, note: '' }, ['X', 'Y', 'Z'].map((title) => ({ ...emptyBib(), title })));
    await setDoubleMode(main, true);
    const m = await fresh(main.id);
    const [ra, rb] = m.team.reviewers.map((r) => r.id);
    const mine = await recordsOf(m.id);
    const id = (t: string) => mine.find((r) => r.title === t)!.id;
    await castVote1(m, id('X'), ra, 'include');
    await castVote1(m, id('Y'), ra, 'exclude');
    await castVote1(m, id('Z'), ra, 'include');

    const pkg = JSON.parse(JSON.stringify(await exportReviewerPackage(m.id, rb)));
    expect(pkg.project.reviewerCopy).toBe(rb);
    expect(pkg.records.every((r: RecordItem) => Object.keys(r.votes1).length === 0)).toBe(true);

    const copy = await importBackup(pkg);
    expect(copy.reviewerCopy).toBe(rb);
    expect(copy.shareId).toBe(m.shareId);
    const theirs = await recordsOf(copy.id);
    expect(theirs.find((r) => r.title === 'X')!.originId).toBe(id('X'));
    const cid = (t: string) => theirs.find((r) => r.title === t)!.id;
    await castVote1(copy, cid('X'), rb, 'include');
    await castVote1(copy, cid('Y'), rb, 'include');
    await castVote1(copy, cid('Z'), rb, 'exclude');

    const votes = JSON.parse(JSON.stringify(await exportVotes(copy.id, rb)));
    expect(Object.keys(votes.votes1).sort()).toEqual([id('X'), id('Y'), id('Z')].sort());
    const res = await importVotes(m.id, votes);
    expect(res).toMatchObject({ stage1: 3, stage2: 0, unknown: 0 });
    const after = await recordsOf(m.id);
    expect(after.find((r) => r.title === 'X')!.screen1).toBe('include');
    expect(after.find((r) => r.title === 'Y')!.screen1).toBe('pending');
    expect(stage1Stats(after, m.team).conflicts).toBe(2);
    // Soubor z jiného projektu se odmítne.
    await expect(importVotes(project.id, votes)).rejects.toThrow('jinému projektu');
    await expect(importVotes(m.id, { foo: 1 })).rejects.toThrow('neobsahuje rozhodnutí');
    expect(a).not.toBe(ra);
    expect(b).not.toBe(rb);
  });

  it('návrat k jednomu hodnotiteli použije rozhodnutí prvního', async () => {
    await setDoubleMode(project, false);
    const recs = await recordsOf(project.id);
    expect(recs.find((r) => r.id === ids[4])!.screen2).toBe('include');
    expect((await fresh(project.id)).team.double).toBe(false);
  });
});

// ---- Starší data --------------------------------------------------------------------

describe('převod starších dat', () => {
  it('jeden efekt na výstup se převede na seznam, chybějící části se doplní', () => {
    const old = { ...emptyBib(), id: 'r', projectId: 'p', effects: { o1: { e1: '1', n1: '10' } } } as unknown as RecordItem;
    const r = normalizeRecord(old);
    expect(r.effects.o1).toEqual([{ e1: '1', n1: '10' }]);
    expect(r.votes1).toEqual({});
    expect(r.votes2).toEqual({});
    const p = newProject('meta', 'Starý');
    const stripped = { ...p, synthesis: { themes: [], narrative: '', model: 'fixed', tau2: 'DL', knha: true, subgroupField: '', chartFields: [], grade: {} } } as unknown as Project;
    delete (stripped as Partial<Project>).team;
    delete (stripped as Partial<Project>).shareId;
    const n = normalizeProject(stripped);
    expect(n.team.reviewers).toHaveLength(2);
    expect(n.shareId).toBe(p.id);
    expect(n.synthesis).toMatchObject({ model: 'fixed', tau2: 'DL', knha: true, dependence: 'aggregate', rho: 0.6, moderators: [] });
  });
  it('záloha ve starém tvaru se načte', async () => {
    const demo = await createDemoProject();
    const backup = JSON.parse(JSON.stringify(await exportBackup(demo.id)));
    backup.version = 1;
    for (const r of backup.records) {
      r.effects = Object.fromEntries(Object.entries(r.effects).map(([k, v]) => [k, (v as unknown[])[0]]));
      delete r.votes1;
      delete r.votes2;
    }
    delete backup.project.team;
    delete backup.project.shareId;
    const copy = await importBackup(backup);
    const recs = await recordsOf(copy.id);
    const a = analyzeOutcome(copy, includedRecords(recs, copy.type), copy.outcomes[0]);
    expect(a.result!.estimate).toBeCloseTo(-0.7145, 4);
    expect(copy.team.double).toBe(false);
  });
});

// ---- Více efektů na studii -----------------------------------------------------------

describe('více efektů z jedné studie', () => {
  let project: Project;
  let recs: RecordItem[];
  const smd = (m1: number, m2: number, label = ''): Record<string, string> => ({ _label: label, m1: String(m1), sd1: '2', n1: '30', m2: String(m2), sd2: '2', n2: '30' });

  it('řádky efektů lze přidávat, upravovat a odebírat', async () => {
    project = newProject('meta', 'Závislé efekty');
    project.outcomes = [{ id: 'o', name: 'Výstup', measure: 'SMD', note: '' }];
    project.fields = [{ id: 'dose', label: 'Dávka', kind: 'number', hint: '' }];
    await db.projects.add(project);
    await addSearchResults(project, { source: 'X', via: 'manual', query: '', hits: null, note: '' }, ['A', 'B', 'C', 'D'].map((title, i) => ({ ...emptyBib(), title, authors: [{ family: title, given: '' }], year: 2020 + i })));
    recs = await recordsOf(project.id);
    for (const r of recs) await db.records.update(r.id, { screen1: 'include', screen2: 'include', fulltext: 'retrieved' });
    const id = (t: string) => recs.find((r) => r.title === t)!.id;
    expect(effectRows(recs[0], 'o')).toEqual([{}]);
    await mergeEffect(id('A'), 'o', 0, smd(10, 8, '6 týdnů'));
    await addEffect(id('A'), 'o');
    await mergeEffect(id('A'), 'o', 1, smd(11, 8, '12 týdnů'));
    await addEffect(id('A'), 'o');
    await removeEffect(id('A'), 'o', 2);
    await mergeEffect(id('B'), 'o', 0, smd(9, 8));
    await mergeEffect(id('C'), 'o', 0, smd(9.5, 8));
    await mergeEffect(id('D'), 'o', 0, smd(8.2, 8, 'chlapci'));
    await mergeEffect(id('D'), 'o', 1, smd(8.6, 8, 'dívky'));
    recs = await recordsOf(project.id);
    expect(recs.find((r) => r.title === 'A')!.effects.o).toHaveLength(2);
  });

  it('sloučení do jednoho efektu na studii', () => {
    const a = analyzeOutcome(project, recs, project.outcomes[0]);
    expect(a.method).toBe('aggregate');
    expect(a.nStudies).toBe(4);
    expect(a.nEffects).toBe(6);
    expect(a.studies).toHaveLength(4);
    const studyA = a.studies.find((s) => s.label.startsWith('A'))!;
    const rows = recs.find((r) => r.title === 'A')!.effects.o;
    const parts = rows.map((raw) => {
      const g = analyzeOutcome({ ...project, synthesis: { ...project.synthesis } }, [{ ...recs.find((r) => r.title === 'A')!, effects: { o: [raw] } }], project.outcomes[0]).studies[0];
      return { yi: g.yi, vi: g.vi };
    });
    const c = compositeEffect(parts, 0.6);
    expect(studyA.yi).toBeCloseTo(c.yi, 12);
    expect(studyA.vi).toBeCloseTo(c.vi, 12);
    // Vyšší korelace = větší rozptyl sloučeného efektu = menší váha studie.
    const hi = analyzeOutcome({ ...project, synthesis: { ...project.synthesis, rho: 0.9 } }, recs, project.outcomes[0]);
    expect(hi.studies.find((s) => s.label.startsWith('A'))!.vi).toBeGreaterThan(studyA.vi);
    expect(a.notes.some((n) => n.note === 'sloučeno 2 efektů')).toBe(true);
    const text = buildManuscript(project, recs).sections.find((s) => s.id === 'm-synthesis')!.generated;
    expect(text).toContain('za předpokladu korelace ρ = 0,60');
  });

  it('tříúrovňový model', () => {
    const p = { ...project, synthesis: { ...project.synthesis, dependence: 'multilevel' as const } };
    const a = analyzeOutcome(p, recs, p.outcomes[0]);
    expect(a.method).toBe('multilevel');
    expect(a.studies).toHaveLength(6);
    expect(a.studies.map((s) => s.label)).toContain('A (2020) – 12 týdnů');
    expect(a.ml!.clusters).toBe(4);
    expect(a.result!.k).toBe(6);
    expect(a.result!.weights.reduce((x, y) => x + y, 0)).toBeCloseTo(100, 8);
    expect(a.egger).toBeNull();
    expect(a.loo).toHaveLength(4); // vynechávají se celé studie
    expect(forestRows(a).at(-1)!.label).toBe('Celkem (tříúrovňový model)');
    const ms = buildManuscript(p, recs);
    expect(ms.sections.find((s) => s.id === 'm-synthesis')!.generated).toContain('tříúrovňový model s náhodnými efekty');
    expect(ms.sections.find((s) => s.id === 'r-synthesis')!.generated).toContain('k = 4 s celkem 6 efekty');
  });

  it('bez více efektů zůstává běžná metaanalýza', async () => {
    const demo = await createDemoProject();
    const a = analyzeOutcome(demo, await recordsOf(demo.id), demo.outcomes[0]);
    expect(a.method).toBe('single');
    expect(a.nStudies).toBe(13);
    expect(a.nEffects).toBe(13);
  });
});

// ---- Metaregrese a síť na úrovni projektu ---------------------------------------------

describe('metaregrese v ukázkovém projektu', () => {
  it('zeměpisná šířka vysvětluje většinu heterogenity (jako v dokumentaci metafor)', async () => {
    const demo = await createDemoProject();
    const recs = await recordsOf(demo.id);
    const a = analyzeOutcome(demo, recs, demo.outcomes[0]);
    const reg = analyzeRegression(demo, recs, a)!;
    expect(reg.k).toBe(13);
    expect(reg.coef.map((c) => c.name)).toEqual(['Absolutní člen', 'Zeměpisná šířka (°)']);
    expect(reg.coef[1].b).toBeCloseTo(ref.reg.ablat_reml.b[1], 5);
    expect(reg.R2!).toBeCloseTo(ref.reg.ablat_reml.R2, 2);
    expect(reg.bubble!.points).toHaveLength(13);
    expect(reg.bubble!.line).toHaveLength(41);
    const svg = bubbleSvg({ ...reg.bubble!, scale: 'log', measure: 'RR', mode: 'light' });
    expect(svg.match(/<circle/g)).toHaveLength(13);
    expect(svg).toContain('<polygon');
    // Kategorie jako moderátor; málo studií → varování se řeší v rozhraní, model se spočítá.
    const cat = analyzeRegression({ ...demo, synthesis: { ...demo.synthesis, moderators: ['alloc'] } }, recs, a)!;
    expect(cat.coef).toHaveLength(3);
    expect(cat.design.reference.alloc).toBe('náhodné');
    expect(cat.bubble).toBeNull();
    // Bez moderátorů a s textovým polem se nic nepočítá.
    expect(analyzeRegression({ ...demo, synthesis: { ...demo.synthesis, moderators: [] } }, recs, a)).toBeNull();
    expect(analyzeRegression({ ...demo, synthesis: { ...demo.synthesis, moderators: ['findings'] } }, recs, a)).toBeNull();
  });
});

describe('síťová metaanalýza v ukázkovém projektu', () => {
  it('dává stejný výsledek jako metafor a promítne se do textu', async () => {
    const demo = await createNetworkDemo();
    const recs = await recordsOf(demo.id);
    expect(recs).toHaveLength(24);
    const net = analyzeNetwork(demo, recs, demo.outcomes[0]);
    if (!net.outcomeResult.ok) throw new Error(net.outcomeResult.error);
    const res = net.outcomeResult.result;
    expect(res.reference).toBe('bez kontaktu');
    expect(res.studies).toBe(24);
    expect(res.multiArm).toBe(2);
    const cz: Record<string, string> = { self_help: 'svépomoc', ind_counseling: 'individuální poradenství', grp_counseling: 'skupinové poradenství' };
    ref.nma.hasselblad_re.names.forEach((name, j) => {
      const e = res.vsReference[res.treatments.indexOf(cz[name])];
      expect(e.est).toBeCloseTo(ref.nma.hasselblad_re.b[j], 3);
      expect(e.se).toBeCloseTo(ref.nma.hasselblad_re.se[j], 3);
    });
    expect(res.tau2).toBeCloseTo(ref.nma.hasselblad_re.tau2, 3);
    expect(res.pscore[0].treatment).toBe('skupinové poradenství');
    expect(res.notes).toHaveLength(0);

    const svg = networkSvg({ nodes: res.nodes.map((n) => ({ label: n.treatment, studies: n.studies })), edges: res.edges, mode: 'dark' });
    expect(svg).toContain('skupinové poradenství');
    expect(res.edges).toHaveLength(6);

    const ms = buildManuscript(demo, recs);
    const get = (id: string) => ms.sections.find((s) => s.id === id)!;
    expect(get('methods').generated).toContain('PRISMA-NMA');
    expect(get('m-synthesis').generated).toContain('síťová metaanalýza');
    expect(get('m-synthesis').generated).toContain('P-skóre');
    const rs = get('r-synthesis');
    expect(rs.generated).toContain('síť tvořily studie (n = 24, z toho se třemi a více rameny n = 2), které srovnávaly 4 léčby v 6 přímých srovnáních');
    expect(rs.generated).toContain('Nejvyšší P-skóre měla léčba „skupinové poradenství“');
    expect(rs.extras.filter((b) => b.t === 'figure')).toHaveLength(2);
    expect(rs.extras.filter((b) => b.t === 'table')).toHaveLength(2);
    const league = rs.extras.find((b) => b.t === 'table' && b.caption.includes('vzájemná srovnání'));
    expect(league?.t === 'table' && league.rows).toHaveLength(4);

    // Chybějící název léčby a nesouvislá síť se ohlásí, nespadnou.
    const broken = recs.map((r, i) => (i === 0 ? { ...r, effects: { [demo.outcomes[0].id]: r.effects[demo.outcomes[0].id].map((row) => ({ ...row, _t2: '' })) } } : r));
    expect(analyzeNetwork(demo, broken, demo.outcomes[0]).unnamed).toHaveLength(1);
    const two = analyzeNetwork(demo, recs.filter((r) => r.title.includes('Reid')), demo.outcomes[0]);
    expect(two.outcomeResult.ok).toBe(false);
  });
});

describe('stáří zálohy', () => {
  it('slovní vyjádření', () => {
    const now = new Date(2026, 10, 14, 15, 30);
    expect(ago(new Date(2026, 10, 14, 9, 5).toISOString(), now)).toBe('dnes 9:05');
    expect(ago(new Date(2026, 10, 13, 23, 59).toISOString(), now)).toBe('včera');
    expect(ago(new Date(2026, 10, 9, 12, 0).toISOString(), now)).toBe('před 5 dny');
    expect(ago('', now)).toBe('');
  });
});
