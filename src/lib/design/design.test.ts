// Průvodce návrhem aplikace: úplnost katalogu, odvození důsledků z vlastností, vhodnost
// typů řešení a možností nasazení, plán etap, výstup a uložení v projektu.
import 'fake-indexeddb/auto';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { addRequirement, createDesignProject, createProject, db, exportBackup, importBackup, mergeDesign, newProject, normalizeProject, partsOf, patchRequirement, removeRequirement, setStage } from '../db';
import { blocksToMarkdown, buildBlocksDocx } from '../manuscript/export';
import type { DesignState, Project } from '../types';
import { CATALOG_VERIFIED, CONSEQUENCE_LABELS, DEPLOY_OPTIONS, PROFILE_QUESTIONS, SCHOOL_QUESTIONS, SOLUTION_TYPES, allFacts } from './catalog';
import { createDesignDemo, designDemoProject } from './demo';
import { DESIGN_GUIDES } from './guides';
import { DESIGN_STEPS, deployFit, deriveNeeds, designOf, implications, newDesign, normalizeDesign, openPoints, planFor, relevantQuestions, solutionFit } from './logic';
import { NO_REVIEW_NOTE, buildDesignDoc, designBrief } from './output';

const demo = (): DesignState => designOf(designDemoProject());
const withProfile = (d: DesignState, profile: Record<string, string>): DesignState => ({ ...d, profile: { ...d.profile, ...profile } });
const fresh = async (id: string) => (await db.projects.get(id))!;

// ---- Katalog ---------------------------------------------------------------------------

describe('katalog', () => {
  it('každý údaj, který se může změnit, má zdroj a datum ověření', () => {
    const facts = allFacts();
    expect(facts.length).toBeGreaterThan(20);
    for (const f of facts) {
      expect(f.text.length).toBeGreaterThan(30);
      expect(f.source.label.length).toBeGreaterThan(5);
      expect(f.source.url).toMatch(/^https:\/\/[a-z0-9.-]+\//);
      expect(f.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(f.verified).getTime())).toBe(false);
      expect(f.verified <= CATALOG_VERIFIED).toBe(true);
    }
  });

  it('možnosti nasazení odpovídají na stejné otázky a odkazují na existující otázky pro školu', () => {
    const questionIds = new Set(SCHOOL_QUESTIONS.map((q) => q.id));
    const keys = Object.keys(CONSEQUENCE_LABELS);
    expect(new Set(DEPLOY_OPTIONS.map((o) => o.id)).size).toBe(DEPLOY_OPTIONS.length);
    for (const o of DEPLOY_OPTIONS) {
      expect(Object.keys(o.consequences).sort()).toEqual([...keys].sort());
      for (const k of keys) expect(o.consequences[k as keyof typeof o.consequences].length).toBeGreaterThan(5);
      expect(o.underestimated.length).toBeGreaterThan(0);
      for (const q of o.ask) expect(questionIds.has(q)).toBe(true);
      expect(o.suits.length).toBeGreaterThan(0);
    }
  });

  it('každý typ řešení má kde běžet a má popsané důsledky', () => {
    expect(new Set(SOLUTION_TYPES.map((s) => s.id)).size).toBe(SOLUTION_TYPES.length);
    for (const s of SOLUTION_TYPES) {
      expect(DEPLOY_OPTIONS.some((o) => o.role !== 'extra' && o.suits.includes(s.id))).toBe(true);
      expect(s.can.length && s.cannot.length && s.underestimated.length && s.tech.length).toBeTruthy();
    }
  });

  it('otázky o vlastnostech a kroky mají jedinečná označení a každý krok má výukový text', () => {
    expect(new Set(PROFILE_QUESTIONS.map((q) => q.id)).size).toBe(PROFILE_QUESTIONS.length);
    for (const q of PROFILE_QUESTIONS) expect(q.options.length).toBeGreaterThanOrEqual(2);
    expect(new Set(SCHOOL_QUESTIONS.map((q) => q.id)).size).toBe(SCHOOL_QUESTIONS.length);
    for (const s of DESIGN_STEPS) {
      const g = DESIGN_GUIDES[s.id];
      expect(g.goal && g.why && g.app && g.you).toBeTruthy();
      expect(g.how.length).toBeGreaterThan(1);
      expect(g.refs.length).toBeGreaterThan(0);
      for (const r of g.refs) expect(r.url).toMatch(/^https:\/\//);
    }
  });
});

// ---- Co plyne z vlastností -----------------------------------------------------------------

describe('důsledky vlastností aplikace', () => {
  it('bez odpovědí nic netvrdí', () => {
    expect(deriveNeeds({}).answered).toBe(0);
    expect(implications({})).toEqual([]);
    for (const s of SOLUTION_TYPES) expect(solutionFit(s.id, newDesign())).toEqual({ level: 'ok', reasons: [] });
  });

  it('aplikace s daty jen v zařízení server nepotřebuje', () => {
    const n = deriveNeeds(demo().profile);
    expect(n.server).toEqual([]);
    expect(n.native).toEqual([]);
    expect(n.personal).toBe('special');
    expect(n.personalLeavesDevice).toBe(false);
    expect(n.medical).toBe('unsure');
    expect(n.answered).toBe(PROFILE_QUESTIONS.length);
    const titles = implications(demo().profile).map((i) => i.title);
    expect(titles).toContain('Aplikace se obejde bez serveru');
    expect(titles).toContain('Osobní údaje zůstávají v zařízení uživatele');
    expect(titles).toContain('Ověřte, zda aplikace není zdravotnickým prostředkem');
  });

  it('přihlašování, sdílení, sběr dat i tajný klíč vyžadují server; každý důvod je uveden zvlášť', () => {
    expect(deriveNeeds({ accounts: 'yes' }).server).toHaveLength(1);
    expect(deriveNeeds({ data: 'sync' }).server).toHaveLength(1);
    expect(deriveNeeds({ data: 'shared' }).server).toHaveLength(1);
    expect(deriveNeeds({ collect: 'yes' }).server).toHaveLength(1);
    expect(deriveNeeds({ secrets: 'yes' }).server).toHaveLength(1);
    expect(deriveNeeds({ accounts: 'yes', data: 'shared', collect: 'yes', secrets: 'yes' }).server).toHaveLength(4);
    const n = deriveNeeds({ collect: 'yes', personal: 'special' });
    expect(n.personalLeavesDevice).toBe(true);
    const imp = implications({ collect: 'yes', personal: 'special' });
    expect(imp.find((i) => i.title === 'Osobní údaje opustí zařízení uživatele')?.fact?.source.url).toContain('eur-lex');
    expect(imp.find((i) => i.title === 'Citlivé údaje')?.fact?.text).toContain('čl. 35');
  });

  it('obchod a pokročilý přístup k zařízení vyžadují aplikaci z obchodu', () => {
    expect(deriveNeeds({ store: 'yes' }).native).toHaveLength(1);
    expect(deriveNeeds({ hardware: 'advanced' }).native).toHaveLength(1);
    expect(deriveNeeds({ hardware: 'basic' }).native).toHaveLength(0);
  });
});

// ---- Vhodnost typů řešení --------------------------------------------------------------------

describe('vhodnost typů řešení', () => {
  it('ukázkový návrh: aplikace bez serveru vyhovuje s výhradou k datům v jednom prohlížeči', () => {
    const d = demo();
    const f = solutionFit('static', d);
    expect(f.level).toBe('warn');
    expect(f.reasons.join(' ')).toContain('jen v jednom prohlížeči');
    // Server ani hotová služba nejsou potřeba – průvodce to řekne, ale nezakazuje je.
    expect(solutionFit('server', d).level).toBe('warn');
    expect(solutionFit('baas', d).reasons.join(' ')).toContain('server potřeba není');
    expect(solutionFit('native', d).reasons.join(' ')).toContain('obchod potřeba není');
    // Práce bez připojení vylučuje hotový nástroj.
    expect(solutionFit('nocode', d).level).toBe('no');
  });

  it('potřeba serveru vylučuje aplikaci bez serveru a uvádí důvody', () => {
    const d = withProfile(demo(), { accounts: 'yes', data: 'shared' });
    const f = solutionFit('static', d);
    expect(f.level).toBe('no');
    expect(f.reasons).toHaveLength(2);
    expect(solutionFit('server', d).level).not.toBe('no');
    expect(solutionFit('baas', d).level).not.toBe('no');
  });

  it('upozornění při zavřené aplikaci neumí aplikace bez serveru', () => {
    const f = solutionFit('static', withProfile(demo(), { notify: 'yes' }));
    expect(f.level).toBe('no');
    expect(f.reasons.join(' ')).toContain('Upozornění');
  });

  it('podmínka obchodu vylučuje všechna webová řešení; aplikace z obchodu neběží na počítači', () => {
    const d = withProfile(demo(), { store: 'yes' });
    for (const id of ['static', 'baas', 'server', 'nocode'] as const) expect(solutionFit(id, d).level).toBe('no');
    expect(solutionFit('native', d).level).toBe('warn'); // nulový rozpočet a potřeba webové verze pro počítač
    expect(solutionFit('native', withProfile(d, { devices: 'desktop' })).level).toBe('no');
  });

  it('citlivé údaje u hotové služby a začátečník u vlastního serveru jsou výhrady, ne zákaz', () => {
    const d = withProfile(demo(), { collect: 'yes' });
    expect(solutionFit('baas', d).reasons.join(' ')).toContain('Citlivé údaje');
    const beginner: DesignState = { ...d, intent: { ...d.intent, experience: 'none', builder: 'self' } };
    expect(solutionFit('server', beginner).reasons.join(' ')).toContain('začátečníka');
    expect(solutionFit('server', beginner).level).toBe('warn');
  });
});

// ---- Vhodnost nasazení ------------------------------------------------------------------------

describe('vhodnost možností nasazení', () => {
  it('ukázkový návrh: hosting z repozitáře vyhovuje, server a obchody se pro typ nehodí', () => {
    const d = demo();
    expect(deployFit('repo', d)).toEqual({ level: 'ok', reasons: [] });
    expect(deployFit('archive', d).level).toBe('ok');
    expect(deployFit('download', d).level).toBe('ok');
    expect(deployFit('einfra', d).level).toBe('no');
    expect(deployFit('stores', d).level).toBe('no');
    expect(deployFit('tool', d).level).toBe('no');
    // Bezplatný cloud jde, ale aplikace má běžet roky.
    const cloud = deployFit('cloud-free', d);
    expect(cloud.level).toBe('warn');
    expect(cloud.reasons.join(' ')).toContain('není sázka na roky');
    // Škola: záleží na její odpovědi, kterou ukázka nemá.
    expect(deployFit('school', d).reasons.join(' ')).toContain('odpovědi školy');
    expect(deployFit('paid', d).reasons.join(' ')).toContain('nulový');
  });

  it('server s citlivými údaji: repozitář nejde, u bezplatného cloudu je výhrada k údajům', () => {
    const base = withProfile(demo(), { collect: 'yes', accounts: 'yes' });
    const d: DesignState = { ...base, solution: { ...base.solution, type: 'server' } };
    expect(deployFit('repo', d).level).toBe('no');
    expect(deployFit('download', d).level).toBe('no');
    expect(deployFit('cloud-free', d).reasons.join(' ')).toContain('Citlivé údaje');
    expect(deployFit('einfra', d).level).not.toBe('no');
    expect(deployFit('school', d).level).toBe('warn');
    // Jakmile je zapsaná odpověď školy a garant, výhrada u školy mizí.
    const answered: DesignState = { ...d, school: { 'q-hosting': 'Katedra provozuje server pro studentské projekty.', 'q-guarantor': 'Dr. Nováková' } };
    expect(deployFit('school', answered)).toEqual({ level: 'ok', reasons: [] });
  });

  it('bez zvoleného typu řešení je vhodnost jen orientační', () => {
    const d: DesignState = { ...demo(), solution: { type: '', why: '', tech: '' } };
    expect(deployFit('repo', d).reasons.join(' ')).toContain('orientační');
    const needsServer = withProfile(d, { accounts: 'yes' });
    expect(deployFit('repo', needsServer).level).toBe('no');
  });
});

// ---- Otázky pro školu, plán, otevřené body ------------------------------------------------------

describe('otázky pro školu', () => {
  it('vybírá otázky podle návrhu', () => {
    const ids = relevantQuestions(demo()).map((q) => q.id);
    for (const id of ['q-guarantor', 'q-thesis', 'q-licence', 'q-ai', 'q-domain', 'q-gdpr', 'q-medical', 'q-account']) expect(ids).toContain(id);
    expect(ids).not.toContain('q-costs');
    expect(ids).not.toContain('q-ethics');
    const collecting = relevantQuestions(withProfile(demo(), { collect: 'yes', budget: 'low' })).map((q) => q.id);
    expect(collecting).toContain('q-ethics');
    expect(collecting).toContain('q-costs');
    const plain = relevantQuestions(newDesign()).map((q) => q.id);
    expect(plain).toContain('q-hosting');
    expect(plain).not.toContain('q-gdpr');
  });
});

describe('plán etap', () => {
  const ids = (d: DesignState) => planFor(d).map((s) => s.id);

  it('aplikace bez serveru: nasazení hned po prototypu, záloha dat, osobní údaje, předání', () => {
    const list = ids(demo());
    expect(list).toEqual(['s-confirm', 's-prototype', 's-skeleton', 's-core', 's-data', 's-privacy', 's-test', 's-docs', 's-release', 's-handover']);
    const stages = planFor(demo());
    expect(stages.find((s) => s.id === 's-skeleton')!.steps.join(' ')).toContain('hosting z repozitáře kódu');
    expect(stages.find((s) => s.id === 's-data')!.doneWhen).toContain('dostat ven');
    expect(stages.find((s) => s.id === 's-release')!.steps.join(' ')).toContain('Uložte ji do archivu');
    expect(stages.find((s) => s.id === 's-confirm')!.steps.join(' ')).toContain('zdravotnickým prostředkem');
  });

  it('vlastní server přidává zabezpečení, obchod schvalování, hotový nástroj má vlastní postup', () => {
    const server: DesignState = { ...demo(), solution: { type: 'server', why: '', tech: '' } };
    expect(ids(server)).toContain('s-server');
    expect(planFor(server).find((s) => s.id === 's-data')!.doneWhen).toContain('Cizí účet');
    const native: DesignState = { ...demo(), solution: { type: 'native', why: '', tech: '' } };
    expect(ids(native)).toContain('s-store');
    expect(ids(native)).not.toContain('s-server');
    const nocode: DesignState = { ...demo(), solution: { type: 'nocode', why: '', tech: '' } };
    expect(ids(nocode)).toEqual(['s-confirm', 's-tool', 's-pilot', 's-privacy', 's-release', 's-handover']);
    expect(ids(newDesign())).not.toContain('s-privacy');
  });

  it('etapy mají jedinečná označení a kritérium hotovosti', () => {
    for (const type of ['', ...SOLUTION_TYPES.map((s) => s.id)]) {
      const stages = planFor({ ...demo(), solution: { type, why: '', tech: '' } });
      expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length);
      for (const s of stages) expect(s.steps.length > 0 && s.doneWhen.length > 10 && s.mistake.length > 10).toBe(true);
    }
  });
});

describe('otevřené body', () => {
  it('prázdný návrh vyjmenuje, co chybí v každém kroku', () => {
    const steps = new Set(openPoints(newDesign()).map((o) => o.step));
    for (const s of ['d-intent', 'd-reqs', 'd-profile', 'd-solution', 'd-deploy', 'd-rules']) expect(steps.has(s as never)).toBe(true);
  });

  it('ukázkový návrh má otevřené jen nezodpovězené otázky pro školu', () => {
    const open = openPoints(demo());
    expect(open).toHaveLength(1);
    expect(open[0].step).toBe('d-rules');
    // Relevantních otázek je osm, zodpovězeny tři.
    expect(open[0].text).toBe('5 otázek pro školu zůstává bez odpovědi.');
  });

  it('upozorní na volbu, která neodpovídá vlastnostem, a na požadavky bez zdroje', () => {
    const d = withProfile(demo(), { accounts: 'yes' });
    const texts = openPoints(d).map((o) => o.text);
    expect(texts.some((t) => t.startsWith('Zvolený typ řešení neodpovídá'))).toBe(true);
    const noSource: DesignState = { ...demo(), requirements: demo().requirements.map((r, i) => (i < 2 ? { ...r, source: '' } : r)) };
    expect(openPoints(noSource).map((o) => o.text)).toContain('U 2 požadavků není uveden zdroj.');
  });
});

// ---- Výstup --------------------------------------------------------------------------------

describe('dokument s návrhem', () => {
  const project = designDemoProject();
  const doc = buildDesignDoc(project);
  const text = doc.blocks.map((b) => (b.t === 'table' ? [b.caption, ...b.head, ...b.rows.flat()].join(' | ') : b.t === 'ref' ? b.spans.map((s) => s.text).join('') : 'text' in b ? b.text : '')).join('\n');

  it('přizná, že požadavky nevycházejí z rešerše, a u každého uvede zdroj', () => {
    expect(text).toContain(NO_REVIEW_NOTE);
    const reqs = doc.blocks.find((b) => b.t === 'table' && b.caption.includes('Požadavky na aplikaci'));
    expect(reqs?.t === 'table' && reqs.rows).toHaveLength(7);
    if (reqs?.t !== 'table') throw new Error('tabulka požadavků chybí');
    // Seřazeno podle priority; zdroj i s upřesněním.
    expect(reqs.rows.map((r) => r[2])).toEqual(['Musí', 'Musí', 'Musí', 'Měla by', 'Měla by', 'Mohla by', 'Mohla by']);
    expect(reqs.rows[0][3]).toBe('Zadání: zadání bakalářské práce');
    expect(text).toContain('2 požadavky stojí na neověřeném předpokladu a měly by se před stavbou ověřit u budoucích uživatelů.');
  });

  it('obsahuje volby, jejich zdůvodnění a důsledky', () => {
    expect(text).toContain('Zvolený typ: Webová aplikace bez serveru.');
    expect(text).toContain('Zvolené místo provozu: Hosting z repozitáře kódu');
    expect(text).toContain('Kdo se stará po absolvování');
    expect(text).toContain('Doplněk: archiv s trvalým identifikátorem');
    expect(text).toContain('Hosting z repozitáře kódu (zvoleno) | Vyhovuje');
    expect(text).toContain('Obchody s aplikacemi | Nevyhovuje');
    expect(text).toContain('nezjištěno');
    expect(text).not.toContain('[DOPLŇTE');
  });

  it('údaje z podmínek poskytovatelů mají číslovaný zdroj s datem ověření', () => {
    expect(doc.sources.length).toBeGreaterThan(8);
    doc.sources.forEach((f, i) => {
      expect(text).toContain(`[${i + 1}] ${f.source.label}. ${f.source.url} (ověřeno 15. 11. 2026)`);
      expect(text).toContain(` [${i + 1}]`);
    });
    // Žádný odkaz na zdroj, který v seznamu není.
    const cited = [...text.matchAll(/ \[(\d+)\](?! \S+\. https)/g)].map((m) => Number(m[1]));
    expect(Math.max(...cited)).toBe(doc.sources.length);
  });

  it('tabulky jsou číslovány souvisle', () => {
    const captions = doc.blocks.filter((b) => b.t === 'table').map((b) => (b.t === 'table' ? b.caption : ''));
    captions.forEach((c, i) => expect(c.startsWith(`Tabulka ${i + 1}. `)).toBe(true));
    expect(captions.length).toBe(8);
  });

  it('nevyplněný návrh označí místa k doplnění', () => {
    const empty = buildDesignDoc({ title: 'Prázdný', design: newDesign() });
    const marks = empty.blocks.filter((b) => ('text' in b ? b.text : '').includes('[DOPLŇTE'));
    expect(marks.length).toBeGreaterThanOrEqual(6);
    // Otázka na práva ke školnímu dílu se klade vždy, proto je jejím zdrojem autorský zákon.
    expect(empty.sources.map((f) => f.source.url)).toEqual(['https://www.zakonyprolidi.cz/cs/2000-121#p60']);
  });

  it('převod do Markdownu a Wordu', async () => {
    const md = blocksToMarkdown(project.title, ['Návrh aplikace'], doc.blocks);
    expect(md).toContain('# Cvičební deník po operaci kolene (ukázka)');
    expect(md).toContain('## Nasazení a provoz');
    expect(md).toContain('| Č. | Požadavek | Priorita | Zdroj |');
    const file = await buildBlocksDocx({ title: project.title, subtitle: 'Návrh aplikace', meta: ['Jana Nováková'], description: 'test' }, doc.blocks);
    const zip = await JSZip.loadAsync(await Packer.toBuffer(file));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Cvičební deník po operaci kolene (ukázka)');
    expect(xml).toContain('Jana Nováková');
    expect(xml.match(/<w:tbl>/g)).toHaveLength(8);
  });
});

describe('zadání pro toho, kdo bude stavět', () => {
  it('shrne účel, požadavky podle priority, rozhodnutí a čemu se vyhnout', () => {
    const brief = designBrief(designDemoProject());
    expect(brief.startsWith('# Zadání: Cvičební deník po operaci kolene (ukázka)\n')).toBe(true);
    expect(brief).toContain('Musí (bez toho aplikace neplní účel):\n- Pacient vidí cvičební plán');
    expect(brief.indexOf('Musí (')).toBeLessThan(brief.indexOf('Měla by ('));
    expect(brief).toContain('- Typ řešení: Webová aplikace bez serveru. Důvod:');
    expect(brief).toContain('- Provoz: Hosting z repozitáře kódu');
    expect(brief).toContain('- Navíc: archiv s trvalým identifikátorem, soubor ke stažení.');
    expect(brief).toContain('- Neposílat data uživatele mimo jeho zařízení a nepřidávat server.');
    expect(brief).toContain('- Nezpracovávat jiné osobní údaje, než jsou uvedeny výše.');
    expect(brief).toContain('1. Ověřit záměr a pravidla – hotovo, když:');
    expect(brief).toContain('## Otevřené body');
  });

  it('prázdný návrh dá zadání bez chyb', () => {
    const brief = designBrief({ title: 'Nic', design: newDesign() });
    expect(brief).toContain('- (zatím nezapsány)');
    expect(brief).toContain('## Postup');
  });
});

// ---- Uložení v projektu --------------------------------------------------------------------------

describe('návrh aplikace jako část projektu', () => {
  it('nový návrh obsahuje jen část „návrh“; nový přehled jen rešerši', async () => {
    const d = await createDesignProject('  ');
    expect(d.title).toBe('Návrh aplikace');
    expect(partsOf(d)).toEqual({ review: false, design: true });
    expect(d.design).toEqual(newDesign());
    const r = await createProject('scoping', 'Přehled');
    expect(partsOf(r)).toEqual({ review: true, design: false });
    expect(r.design).toBeUndefined();
  });

  it('úpravy návrhu se ukládají po částech a nepřepisují se navzájem', async () => {
    const p = await createDesignProject('Zkouška');
    await Promise.all([mergeDesign(p.id, 'intent', { problem: 'Problém' }), mergeDesign(p.id, 'intent', { users: 'Studenti' }), mergeDesign(p.id, 'profile', { accounts: 'no' }), mergeDesign(p.id, 'profile', { data: 'local' })]);
    await addRequirement(p.id);
    await addRequirement(p.id);
    let d = designOf(await fresh(p.id));
    expect(d.intent.problem).toBe('Problém');
    expect(d.intent.users).toBe('Studenti');
    expect(d.profile).toEqual({ accounts: 'no', data: 'local' });
    expect(d.requirements).toHaveLength(2);
    expect(d.requirements[0]).toMatchObject({ text: '', priority: 'must', source: '' });

    await patchRequirement(p.id, d.requirements[0].id, { text: 'Uživatel zapíše cvičení.', source: 'users' });
    await removeRequirement(p.id, d.requirements[1].id);
    await setStage(p.id, 's-confirm', { note: 'Čeká na vedoucího' });
    await setStage(p.id, 's-confirm', { done: true });
    await mergeDesign(p.id, 'deploy', { choice: 'repo', extras: ['archive'] });
    d = designOf(await fresh(p.id));
    expect(d.requirements).toHaveLength(1);
    expect(d.requirements[0].text).toBe('Uživatel zapíše cvičení.');
    expect(d.plan['s-confirm']).toEqual({ done: true, note: 'Čeká na vedoucího' });
    expect(d.deploy).toEqual({ choice: 'repo', extras: ['archive'], why: '' });
    expect((await fresh(p.id)).updatedAt >= p.updatedAt).toBe(true);
  });

  it('záloha a její načtení návrh zachovají', async () => {
    const p = await createDesignDemo();
    const backup = JSON.parse(JSON.stringify(await exportBackup(p.id)));
    expect(backup.version).toBe(3);
    expect(backup.records).toEqual([]);
    const copy = await importBackup(backup);
    expect(copy.id).not.toBe(p.id);
    expect(partsOf(copy)).toEqual({ review: false, design: true });
    expect(copy.design).toEqual(p.design);
    expect(buildDesignDoc(copy).blocks).toEqual(buildDesignDoc(p).blocks);
  });

  it('starší projekty a zálohy bez údaje o částech jsou rešerše; neúplný návrh se doplní', () => {
    const legacy = { ...newProject('meta', 'Starý přehled') } as Partial<Project>;
    delete legacy.parts;
    const fixed = normalizeProject(legacy as Project);
    expect(fixed.parts).toEqual({ review: true, design: false });
    expect(fixed.design).toBeUndefined();
    expect(partsOf(legacy as Project)).toEqual({ review: true, design: false });

    const partial = normalizeProject({ ...newProject('narrative', 'Návrh'), parts: { review: false, design: true }, design: { intent: { problem: 'X' } } as unknown as DesignState });
    expect(partial.design?.intent).toMatchObject({ problem: 'X', users: '', horizon: '' });
    expect(partial.design?.deploy).toEqual({ choice: '', extras: [], why: '' });
    expect(normalizeDesign(undefined)).toEqual(newDesign());
  });
});
