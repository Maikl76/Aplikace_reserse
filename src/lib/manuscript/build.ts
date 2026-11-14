// Sestavení textu práce z dat projektu.
// Metodika a výsledky se generují z toho, co je v projektu skutečně zapsáno;
// úvod, diskusi a závěr píše člověk. Každý oddíl lze převzít a upravit.

import { GRADE_DOMAINS, analyzeNetwork, analyzeOutcome, analyzeRegression, countBy, countByYear, forestFooter, forestRows, gradeCertainty, heterogeneityText, overlapOf, studyLabels } from '../analysis';
import { CHECKLISTS } from '../checklists';
import { buildCitations, type Span } from '../citations';
import { bubbleSvg, columnsSvg, forestSvg, networkSvg, prismaSvg, type FigMode, type FlowUnit, type ForestRow } from '../figures';
import { flowCounts, fulltextQueue, includedRecords } from '../flow';
import { levelOf, toolFor } from '../quality';
import { FRAMEWORKS, REVIEW_TYPES, hasStep } from '../reviewTypes';
import { interpretKappa, isDouble, reviewerName, stage1Stats, stage2Stats } from '../reviewers';
import { MEASURES, backTransform } from '../stats/effects';
import { interpretI2 } from '../stats/meta';
import type { Project, RecordItem, Template } from '../types';
import { fmt, fmtP, formatDate, lines, plural } from '../util';

export const APP_NAME = 'Průvodce přehledem';
export const APP_VERSION = '0.2';

export type Block =
  | { t: 'h'; level: 1 | 2; text: string }
  | { t: 'p'; text: string }
  | { t: 'table'; caption: string; head: string[]; rows: string[][] }
  | { t: 'figure'; caption: string; svg: string }
  | { t: 'todo'; text: string }
  | { t: 'ref'; spans: Span[] };

export interface Section {
  id: string;
  title: string;
  /** Číslo kapitoly (jen u kvalifikační práce), např. „4.2“. */
  number: string;
  level: 1 | 2;
  /** human = píše člověk; auto = generuje aplikace z dat projektu. */
  kind: 'human' | 'auto';
  guidance: string;
  /** Vygenerovaný text; odstavce odděluje prázdný řádek. */
  generated: string;
  /** Tabulky, obrázky a seznam literatury, které k oddílu patří vždy. */
  extras: Block[];
}

export interface Manuscript {
  title: string;
  sections: Section[];
}

export const TEMPLATE_LABELS: Record<Template, string> = {
  article: 'Odborný článek (IMRaD)',
  bachelor: 'Bakalářská práce',
  master: 'Diplomová práce',
};

/** Značka místa, které musí doplnit člověk. */
export const TODO = '[DOPLŇTE';
const todo = (what: string) => `${TODO}: ${what}]`;

const UNITS: Record<FlowUnit, { nom: string; gen: string; one: string }> = {
  studie: { nom: 'studie', gen: 'studií', one: 'studie' },
  přehledy: { nom: 'přehledy', gen: 'přehledů', one: 'přehled' },
  zdroje: { nom: 'zdroje', gen: 'zdrojů', one: 'zdroj' },
};

export function unitOf(project: Pick<Project, 'type'>): FlowUnit {
  return project.type === 'umbrella' ? 'přehledy' : project.type === 'narrative' ? 'zdroje' : 'studie';
}

const joinCz = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} a ${items[items.length - 1]}`);
const sentence = (s: string) => (/[.!?…\]]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const enumerate = (items: string[]) => items.map((x, i) => `(${i + 1}) ${lower(x.replace(/[.;]$/, ''))}`).join('; ');

export function buildManuscript(project: Project, records: RecordItem[], mode: FigMode = 'light'): Manuscript {
  const conf = REVIEW_TYPES[project.type];
  const ms = project.manuscript;
  const thesis = ms.template !== 'article';
  const unit = unitOf(project);
  const U = UNITS[unit];
  const included = includedRecords(records, project.type);
  const labels = studyLabels(included);
  const ordered = [...included].sort((a, b) => (labels.get(a.id) ?? '').localeCompare(labels.get(b.id) ?? '', 'cs'));
  const counts = flowCounts(records, project.type, project.protocol.excludeReasons);
  const cites = buildCitations(included, ms.style);
  const citeOf = new Map(cites.map((c) => [c.id, c]));
  const tool = hasStep(project.type, 'quality') ? toolFor(project) : null;
  const twoStage = hasStep(project.type, 'screen2');
  const double = isDouble(project);
  const p = project.protocol;
  const q = project.question;

  let figNo = 0;
  let tabNo = 0;
  const figure = (caption: string, svg: string): { block: Block; ref: string } => {
    figNo++;
    return { block: { t: 'figure', caption: `Obrázek ${figNo}: ${caption}`, svg }, ref: `obrázek ${figNo}` };
  };
  const table = (caption: string, head: string[], rows: string[][]): { block: Block; ref: string } => {
    tabNo++;
    return { block: { t: 'table', caption: `Tabulka ${tabNo}: ${caption}`, head, rows }, ref: `tabulka ${tabNo}` };
  };

  const sections: Section[] = [];
  let chapter = 0;
  let sub = 0;
  const add = (s: Omit<Section, 'number' | 'extras' | 'generated' | 'guidance'> & Partial<Pick<Section, 'extras' | 'generated' | 'guidance'>> & { numbered?: boolean }) => {
    let number = '';
    if (thesis && s.numbered !== false) {
      if (s.level === 1) {
        chapter++;
        sub = 0;
        number = String(chapter);
      } else {
        sub++;
        number = `${chapter}.${sub}`;
      }
    }
    sections.push({ id: s.id, title: s.title, level: s.level, kind: s.kind, number, guidance: s.guidance ?? '', generated: s.generated ?? '', extras: s.extras ?? [] });
  };

  // ---- Podklady ---------------------------------------------------------------
  const sources = [...new Set(project.searches.map((s) => s.source))];
  const lastSearch = project.searches.length ? formatDate([...project.searches].sort((a, b) => b.date.localeCompare(a.date))[0].date) : '';
  const framework = FRAMEWORKS[q.framework];
  const elements = framework.elements.filter((e) => (q.elements[e.id] ?? '').trim()).map((e) => `${lower(e.label)} – ${q.elements[e.id].trim()}`);
  const n = (x: number) => `n = ${x}`;

  // ---- Abstrakt ---------------------------------------------------------------
  add({
    id: 'abstract',
    title: 'Abstrakt',
    level: 1,
    kind: 'human',
    numbered: false,
    guidance:
      'Strukturovaný abstrakt (do 250 slov): východiska, cíl, metody, výsledky, závěry. Návrh níže obsahuje údaje z projektu; hlavní zjištění a závěry doplňte až po dokončení syntézy.',
    generated: [
      `Východiska: ${todo('jednou až dvěma větami, proč je téma důležité')}`,
      `Cíl: ${q.aim.trim() ? sentence(q.aim) : todo('cíl přehledu')}`,
      `Metody: Byl proveden ${lower(conf.name)} podle standardu ${conf.standard.name}.${sources.length ? ` Prohledány byly tyto zdroje: ${joinCz(sources)}${lastSearch ? ` (poslední vyhledávání ${lastSearch})` : ''}.` : ''}`,
      `Výsledky: Vyhledávání přineslo záznamy (${n(counts.identified)}), ze kterých byly po odstranění duplicit a třídění zařazeny ${U.nom} (${n(counts.included)}). ${todo('hlavní zjištění')}`,
      `Závěry: ${todo('co z výsledků plyne')}`,
      `Klíčová slova: ${ms.keywords.trim() || todo('tři až pět klíčových slov')}`,
    ].join('\n\n'),
  });

  // ---- Úvod -------------------------------------------------------------------
  add({
    id: 'intro',
    title: 'Úvod',
    level: 1,
    kind: 'human',
    guidance:
      'Postupujte od obecného ke konkrétnímu: co se o tématu ví, co chybí nebo je sporné, proč je přehled potřeba. Úvod končí cílem. Každé tvrzení doložte zdrojem.' +
      (thesis ? '' : ' V článku stačí tři až pět odstavců.'),
    generated: q.rationale.trim() || q.aim.trim() ? [q.rationale.trim() ? sentence(q.rationale) : '', q.aim.trim() ? `Cílem tohoto přehledu je ${lower(sentence(q.aim.replace(/^cílem\s+(je|bylo)\s+/i, '')))}` : ''].filter(Boolean).join('\n\n') : '',
  });

  if (thesis) {
    add({
      id: 'theory',
      title: 'Teoretická východiska',
      level: 1,
      kind: 'human',
      guidance:
        'Vymezte klíčové pojmy, shrňte dosavadní poznání a ukažte, na co vaše práce navazuje. Tato kapitola je narativním přehledem literatury – nezaměňujte ji s výsledky vaší rešerše.' +
        (ms.template === 'master' ? ' U diplomové práce se očekává kritické srovnání teoretických přístupů, ne jen jejich výčet.' : ''),
    });
    add({
      id: 'aims',
      title: 'Cíl a výzkumné otázky',
      level: 1,
      kind: 'auto',
      guidance: 'Vychází z kroku Výzkumná otázka.',
      generated: [
        q.aim.trim() ? `Cíl práce: ${sentence(q.aim)}` : todo('cíl práce – vyplňte v kroku Výzkumná otázka'),
        q.text.trim() ? `Výzkumná otázka: ${sentence(q.text)}` : todo('výzkumná otázka'),
        elements.length ? `Otázka byla formulována pomocí rámce ${framework.name}: ${elements.join('; ')}.` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  }

  // ---- Metodika ---------------------------------------------------------------
  add({
    id: 'methods',
    title: thesis ? 'Metodika' : 'Metody',
    level: 1,
    kind: 'auto',
    guidance: 'Úvodní odstavec metodiky: typ přehledu, standard a registrace protokolu.',
    generated: [
      `Byl proveden ${lower(conf.name)} (${conf.english}). Postup i struktura zprávy se řídí standardem ${conf.standard.name}${
        conf.synthesis.includes('meta') && project.outcomes.some((o) => o.network) ? ' a jeho rozšířením pro síťové metaanalýzy (PRISMA-NMA; Hutton et al., 2015)' : ''
      }.`,
      p.registration.trim() ? `Protokol přehledu: ${sentence(p.registration)}` : project.type === 'narrative' ? '' : 'Protokol přehledu nebyl registrován.',
      !thesis && q.text.trim() ? `Výzkumná otázka zněla: ${sentence(q.text)}${elements.length ? ` Byla formulována pomocí rámce ${framework.name}: ${elements.join('; ')}.` : ''}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  const incl = lines(p.include);
  const excl = lines(p.exclude);
  const years = p.yearFrom.trim() || p.yearTo.trim() ? `Zařazeny byly publikace vydané ${p.yearFrom.trim() ? `od roku ${p.yearFrom.trim()}` : ''}${p.yearFrom.trim() && p.yearTo.trim() ? ' ' : ''}${p.yearTo.trim() ? `do roku ${p.yearTo.trim()}` : ''}.` : '';
  add({
    id: 'm-criteria',
    title: 'Kritéria způsobilosti',
    level: 2,
    kind: 'auto',
    guidance: 'Vychází z kroku Protokol a kritéria. Každé omezení (roky, jazyk, design) má být zdůvodněno.',
    generated: [
      incl.length ? `Kritéria zařazení: ${enumerate(incl)}.` : todo('kritéria zařazení – vyplňte v kroku Protokol'),
      excl.length ? `Kritéria vyřazení: ${enumerate(excl)}.` : '',
      [p.designs.trim() ? `Typy zařazených publikací: ${sentence(p.designs)}` : '', years, p.languages.trim() ? `Jazyk publikací: ${sentence(p.languages)}` : ''].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join('\n\n'),
  });

  const blocks = project.blocks.filter((b) => b.terms.some((t) => t.text.trim()));
  add({
    id: 'm-search',
    title: 'Informační zdroje a vyhledávání',
    level: 2,
    kind: 'auto',
    guidance: 'Vychází z deníku hledání. Úplné znění dotazů je v příloze A.',
    generated: [
      sources.length
        ? `Vyhledávání proběhlo v těchto zdrojích: ${joinCz(sources)}.${lastSearch ? ` Poslední vyhledávání bylo provedeno ${lastSearch}.` : ''}`
        : todo('zdroje – proveďte vyhledávání v kroku Vyhledávání'),
      blocks.length
        ? `Vyhledávací dotaz tvořily pojmové bloky (${blocks.map((b) => lower(b.label)).join(', ')}). Synonyma uvnitř bloku byla spojena operátorem OR, bloky mezi sebou operátorem AND. Úplné znění dotazů pro jednotlivé databáze uvádí příloha A.`
        : 'Úplné znění vyhledávacích dotazů uvádí příloha A.',
      lines(p.sources).length ? `Plánované zdroje podle protokolu: ${joinCz(lines(p.sources))}.` : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  add({
    id: 'm-selection',
    title: `Výběr ${U.gen}`,
    level: 2,
    kind: 'auto',
    guidance: 'Uveďte, kdo třídil, zda nezávisle a jak se řešily neshody.',
    generated: [
      `Nalezené záznamy byly nahrány do aplikace ${APP_NAME} (verze ${APP_VERSION}), ve které byly odstraněny duplicity podle shody DOI, PMID nebo názvu.`,
      twoStage
        ? 'Záznamy byly nejprve tříděny podle názvu a abstraktu. U záznamů, které prošly, byly získány plné texty a posouzeny podle kritérií způsobilosti; u vyřazených plných textů byl zaznamenán důvod.'
        : 'Zdroje byly vybírány podle názvu, abstraktu a případně plného textu s ohledem na vymezení tématu.',
      double
        ? `Třídění${twoStage ? ' podle názvu a abstraktu i posouzení plných textů' : ''} prováděli nezávisle dva hodnotitelé (${project.team.reviewers.map((r) => reviewerName(project.team, r.id)).join(', ')}), kteří při rozhodování neznali rozhodnutí toho druhého. Neshody byly řešeny diskusí do dosažení shody. Míra shody před řešením neshod byla vyjádřena Cohenovým koeficientem κ.${p.reviewers.trim() ? ` ${sentence(p.reviewers)}` : ''}`
        : p.reviewers.trim()
          ? `Výběr prováděl: ${sentence(p.reviewers)}`
          : todo('kdo třídil a zda nezávisle – vyplňte v kroku Protokol'),
    ].join(' '),
  });

  const fieldNames = project.fields.map((f) => lower(f.label));
  const measureInputs = [...new Set(project.outcomes.map((o) => MEASURES[o.measure].name.toLowerCase()))];
  add({
    id: 'm-extraction',
    title: project.type === 'scoping' ? 'Mapování dat' : 'Extrakce dat',
    level: 2,
    kind: 'auto',
    guidance: 'Vychází z formuláře v kroku Extrakce dat.',
    generated: [
      fieldNames.length ? `Ze zařazených ${U.gen} byly do předem připraveného formuláře vypsány tyto údaje: ${joinCz(fieldNames)}.` : todo('extrahované údaje'),
      project.type === 'meta' && project.outcomes.length
        ? `Pro metaanalýzu byly dále vypsány číselné údaje potřebné k výpočtu velikosti účinku (${joinCz(measureInputs)}) pro tyto výstupy: ${joinCz(project.outcomes.map((o) => o.name))}.`
        : '',
      project.type === 'umbrella' ? 'U každého přehledu byl zaznamenán seznam zahrnutých primárních studií pro výpočet jejich překryvu.' : '',
    ]
      .filter(Boolean)
      .join(' '),
  });

  if (tool) {
    add({
      id: 'm-quality',
      title: project.type === 'umbrella' ? 'Hodnocení kvality přehledů' : 'Hodnocení rizika zkreslení',
      level: 2,
      kind: 'auto',
      guidance: 'Uveďte, kdo hodnotil a jak bylo hodnocení využito při interpretaci.',
      generated: tool.items.length
        ? `${
            tool.id === 'custom'
              ? `Zařazené ${U.nom} byly hodnoceny podle kontrolního seznamu s těmito položkami: ${tool.items.map((i) => `„${i.label}“`).join('; ')}.`
              : `Zařazené ${U.nom} byly hodnoceny nástrojem ${tool.name} (${tool.source.label}), který posuzuje tyto oblasti: ${joinCz(tool.items.map((i) => lower(i.label.replace(/^\d+\.\s*/, ''))))}.`
          } ${todo('kdo hodnotil a zda nezávisle')}`
        : todo('nástroj hodnocení kvality – zvolte v kroku Hodnocení kvality'),
    });
  }

  const syn = project.synthesis;
  const synth: string[] = [];
  // Analýzy počítáme jednou: z nich vychází popis metod i výsledky.
  const withMeta = conf.synthesis.includes('meta');
  const pairwise = withMeta ? project.outcomes.filter((o) => !o.network) : [];
  const networks = withMeta ? project.outcomes.filter((o) => o.network) : [];
  const analyses = pairwise.map((o) => analyzeOutcome(project, included, o));
  const regressions = analyses.map((a) => (a.result ? analyzeRegression(project, included, a) : null));
  const nets = networks.map((o) => analyzeNetwork(project, included, o));
  if (pairwise.length) {
    const anyMulti = analyses.some((a) => a.method === 'multilevel');
    const anyAggregate = analyses.some((a) => a.method === 'aggregate');
    const allMulti = analyses.length > 0 && analyses.every((a) => a.method === 'multilevel');
    if (!allMulti) {
      synth.push(
        `Pro každý výstup byla z údajů jednotlivých studií spočtena velikost účinku a její rozptyl. Studie byly sloučeny metodou inverzního rozptylu v modelu ${
          syn.model === 'random'
            ? `s náhodnými efekty; rozptyl mezi studiemi (τ²) byl odhadnut metodou ${syn.tau2 === 'REML' ? 'omezené maximální věrohodnosti (REML)' : 'DerSimoniana a Lairda'}${
                syn.knha ? ' a intervaly spolehlivosti byly upraveny podle Knappa a Hartunga' : ''
              }`
            : 's pevným efektem'
        }. Heterogenita byla hodnocena Cochranovým Q testem, statistikou I² a predikčním intervalem.`,
      );
    } else synth.push('Pro každý výstup byla z údajů jednotlivých studií spočtena velikost účinku a její rozptyl.');
    if (anyAggregate) {
      synth.push(
        `Pokud studie poskytla pro tentýž výstup více efektů (například pro více časových bodů nebo podskupin), byly tyto efekty sloučeny do jednoho efektu studie: použit byl jejich průměr a rozptyl byl spočten za předpokladu korelace ρ = ${fmt(syn.rho, 2)} mezi efekty téže studie (Borenstein et al., 2009). ${todo('zdůvodnění zvolené korelace a výsledek citlivostní analýzy s jinou hodnotou')}`,
      );
    }
    if (anyMulti) {
      synth.push(
        'Protože některé studie poskytly pro tentýž výstup více efektů, které nejsou nezávislé, byl použit tříúrovňový model s náhodnými efekty (efekty vnořené ve studiích; odhad REML). Model odděluje rozptyl mezi studiemi od rozptylu mezi efekty uvnitř téže studie (Cheung, 2014; Van den Noortgate et al., 2013).',
      );
    }
    const field = project.fields.find((f) => f.id === syn.subgroupField);
    if (field) synth.push(`Možné příčiny heterogenity byly zkoumány analýzou podskupin podle proměnné „${lower(field.label)}“.`);
    const mods = project.fields.filter((f) => syn.moderators.includes(f.id) && f.kind !== 'text');
    if (mods.length && regressions.some((r) => r?.coef.length)) {
      synth.push(`Souvislost velikosti účinku s vlastnostmi studií byla zkoumána metaregresí se smíšenými efekty; moderátory byly: ${joinCz(mods.map((f) => lower(f.label)))}.`);
    }
    synth.push(
      `Robustnost výsledků byla ověřena postupným vynecháním jednotlivých studií. Asymetrie trychtýřového grafu byla posouzena vizuálně a při alespoň deseti studiích Eggerovým testem. Výpočty provedla aplikace ${APP_NAME}, jejíž statistické funkce jsou ověřeny proti balíku metafor (Viechtbauer, 2010).`,
    );
  }
  if (networks.length) {
    synth.push(
      `Pro ${networks.length === 1 ? `výstup „${networks[0].name}“` : `výstupy ${joinCz(networks.map((o) => `„${o.name}“`))}`}, u kterého studie srovnávaly tři a více různých intervencí, byla provedena síťová metaanalýza. Použit byl frekventistický kontrastní model ${
        syn.model === 'random' ? 's náhodnými efekty; heterogenita (τ²) byla předpokládána stejná pro všechna srovnání a odhadnuta metodou REML' : 'se společným efektem'
      }. U studií se třemi a více rameny byla zohledněna korelace srovnání se společným ramenem. Intervence byly seřazeny podle P-skóre (Rücker a Schwarzer, 2015). Konzistence přímých a nepřímých důkazů byla posouzena rozkladem statistiky Q na heterogenitu uvnitř designů a nekonzistenci mezi designy (Higgins et al., 2012) a srovnáním přímých a nepřímých odhadů jednotlivých srovnání. Výpočty provedla aplikace ${APP_NAME}, ověřená proti balíku metafor (Viechtbauer, 2010). ${todo('posouzení předpokladu tranzitivity – zda jsou studie různých srovnání podobné v charakteristikách, které ovlivňují účinek')}`,
    );
  }
  if (withMeta && project.outcomes.length && Object.keys(syn.grade).length) synth.push('Jistota důkazů pro jednotlivé výstupy byla hodnocena přístupem GRADE.');
  if (conf.synthesis.includes('charting')) {
    const fields = project.fields.filter((f) => syn.chartFields.includes(f.id)).map((f) => lower(f.label));
    synth.push(`Zmapovaná data byla shrnuta četnostmi podle roku publikace${fields.length ? ` a podle těchto hledisek: ${joinCz(fields)}` : ''}.`);
  }
  if (conf.synthesis.includes('overlap')) {
    synth.push('Závěry zařazených přehledů byly shrnuty narativně a nebyly znovu statisticky slučovány. Překryv primárních studií mezi přehledy byl vyčíslen ukazatelem corrected covered area (CCA; Pieper et al., 2014).');
  }
  if (syn.themes.length) {
    synth.push(`${conf.synthesis.includes('meta') && project.outcomes.length ? 'Ostatní zjištění byla' : 'Zjištění byla'} syntetizována narativně: ${U.nom} byly seskupeny do témat (${joinCz(syn.themes.map((t) => lower(t.name)))}) a v rámci každého tématu byla shrnuta shoda a rozdíly jejich výsledků.`);
  }
  add({
    id: 'm-synthesis',
    title: 'Syntéza',
    level: 2,
    kind: 'auto',
    guidance: 'Vychází z nastavení v kroku Syntéza.',
    generated: synth.join(' ') || todo('způsob syntézy – dokončete krok Syntéza'),
  });

  // ---- Výsledky ---------------------------------------------------------------
  add({ id: 'results', title: 'Výsledky', level: 1, kind: 'auto', guidance: 'Samotná kapitola nemá úvodní text; výsledky jsou v podkapitolách.', generated: '' });

  const flowFig = figure(`Vývojový diagram výběru ${U.gen} (podle PRISMA 2020)`, prismaSvg(counts, { mode, unit }));
  const bySource = counts.bySource.map((s) => `${s.source} (${n(s.n)})`).join(', ');
  const selection = [
    `Vyhledávání přineslo celkem ${plural(counts.identified, 'záznam', 'záznamy', 'záznamů')}${counts.bySource.length > 1 ? `: ${bySource}` : ''}.`,
    `Po odstranění duplicit (${n(counts.duplicates)}) následovalo třídění podle názvu a abstraktu (${n(counts.screened)}), při kterém byly vyřazeny nevyhovující záznamy (${n(counts.excluded1)}).`,
  ];
  if (twoStage) {
    selection.push(
      `Plné texty byly vyhledávány pro záznamy, které třídění prošly (${n(counts.sought)})${counts.notRetrieved ? `; nepodařilo se je získat u části z nich (${n(counts.notRetrieved)})` : ''}. Způsobilost byla posouzena u získaných plných textů (${n(counts.assessed)}) a vyřazeny byly ty, které kritéria nesplnily (${n(counts.excluded2Total)})${
        counts.excluded2.length ? `: ${counts.excluded2.map((e) => `${lower(e.reason)} (${n(e.n)})`).join(', ')}` : ''
      }. Seznam vyřazených plných textů s důvody uvádí příloha B.`,
    );
  }
  if (double) {
    const describe = (label: string, st: ReturnType<typeof stage1Stats>) => {
      const ag = st.agreement;
      if (ag.n === 0) return '';
      return `${label} se hodnotitelé shodli u ${fmt(100 * ag.po, 1)} % záznamů posouzených oběma (${n(ag.n)}${ag.kappa != null ? `; Cohenovo κ = ${fmt(ag.kappa, 2)}, shoda ${interpretKappa(ag.kappa)}` : ''}); neshody (${n(st.conflicts)}) byly řešeny dohodou${st.open ? ` ${todo(plural(st.open, 'neshoda zatím není vyřešena', 'neshody zatím nejsou vyřešeny', 'neshod zatím není vyřešeno'))}` : ''}.`;
    };
    const a1 = describe('Při třídění podle názvu a abstraktu', stage1Stats(records, project.team));
    const a2 = twoStage ? describe('Při posuzování plných textů', stage2Stats(fulltextQueue(records), project.team)) : '';
    if (a1) selection.push(a1);
    if (a2) selection.push(a2);
  }
  selection.push(`Do přehledu byly zařazeny ${U.nom} (${n(counts.included)}; ${flowFig.ref}).`);
  if (counts.pending1 || counts.pending2) selection.push(todo(`třídění není dokončeno – neposouzeno zůstává ${counts.pending1 + counts.pending2} záznamů`));
  add({ id: 'r-selection', title: `Výběr ${U.gen}`, level: 2, kind: 'auto', guidance: 'Počty vycházejí z vašich rozhodnutí při třídění.', generated: selection.join(' '), extras: [flowFig.block] });

  const yearsIncl = ordered.map((r) => r.year).filter((y): y is number => y != null);
  const charTable = table(
    `Charakteristiky zařazených ${U.gen}`,
    [U.one.charAt(0).toUpperCase() + U.one.slice(1), ...project.fields.map((f) => f.label)],
    ordered.map((r) => [labels.get(r.id) ?? '', ...project.fields.map((f) => r.extraction[f.id]?.trim() || '–')]),
  );
  add({
    id: 'r-characteristics',
    title: `Charakteristiky zařazených ${U.gen}`,
    level: 2,
    kind: 'auto',
    guidance: 'Doplňte slovní shrnutí toho nejdůležitějšího z tabulky (kde studie probíhaly, jaké měly designy a soubory).',
    generated: ordered.length
      ? `Zařazené ${U.nom} (${n(ordered.length)})${yearsIncl.length ? ` byly publikovány v letech ${Math.min(...yearsIncl)}–${Math.max(...yearsIncl)}` : ''}. Jejich charakteristiky shrnuje ${charTable.ref}. ${todo('slovní shrnutí charakteristik')}`
      : todo(`zatím nejsou zařazeny žádné ${U.nom}`),
    extras: ordered.length ? [charTable.block] : [],
  });

  if (tool && tool.items.length) {
    const rated = ordered.filter((r) => r.qualityOverall || Object.keys(r.quality).length);
    const short = (i: number) => (tool.id === 'amstar2' ? String(i + 1) : tool.id === 'custom' ? `P${i + 1}` : `D${i + 1}`);
    const qTable = table(
      `Hodnocení nástrojem ${tool.name}. ${tool.items.map((it, i) => `${short(i)} – ${lower(it.label.replace(/^\d+\.\s*/, ''))}`).join('; ')}`,
      [U.one.charAt(0).toUpperCase() + U.one.slice(1), ...tool.items.map((_, i) => short(i)), 'Celkem'],
      ordered.map((r) => [labels.get(r.id) ?? '', ...tool.items.map((it) => levelOf(tool.levels, r.quality[it.id])?.label ?? '–'), levelOf(tool.overallLevels, r.qualityOverall)?.label ?? '–']),
    );
    const overall = tool.overallLevels.map((l) => ({ l, k: ordered.filter((r) => r.qualityOverall === l.id).length })).filter((x) => x.k > 0);
    add({
      id: 'r-quality',
      title: project.type === 'umbrella' ? 'Kvalita zařazených přehledů' : 'Riziko zkreslení',
      level: 2,
      kind: 'auto',
      guidance: 'Popište, ve kterých oblastech byly problémy nejčastější.',
      generated: rated.length
        ? `Hodnocení jednotlivých ${U.gen} uvádí ${qTable.ref}. ${tool.overallLabel}: ${overall.map((x) => `${lower(x.l.label)} (${n(x.k)})`).join(', ') || 'zatím neuvedeno'}. ${todo('nejčastější nedostatky')}`
        : todo('hodnocení kvality zatím nebylo provedeno'),
      extras: rated.length ? [qTable.block] : [],
    });
  }

  // Výsledky syntézy.
  const rs: string[] = [];
  const rsExtras: Block[] = [];
  if (withMeta) {
    analyses.forEach((a, ai) => {
      const outcome = a.outcome;
      const m = MEASURES[outcome.measure];
      const sh = (v: number) => fmt(backTransform(outcome.measure, v), 2);
      if (!a.result) {
        rs.push(`Výstup „${outcome.name}“: žádná studie neposkytla data potřebná k výpočtu.`);
        return;
      }
      const r = a.result;
      const multi = a.method === 'multilevel';
      const fig = figure(`Lesní graf – ${outcome.name} (${m.short})`, forestSvg({ rows: forestRows(a), scale: a.scale, measure: m.short, footer: forestFooter(a), mode }));
      const parts = [
        `Výstup „${outcome.name}“ (${m.name.toLowerCase()}): do metaanalýzy vstoupily studie v počtu k = ${a.nStudies}${a.nEffects > a.nStudies ? ` s celkem ${a.nEffects} efekty${a.method === 'aggregate' ? ', které byly v rámci studií sloučeny' : ''}` : ''}.`,
        `Souhrnný odhad v ${multi ? 'tříúrovňovém modelu' : `modelu ${r.model === 'random' ? 's náhodnými efekty' : 's pevným efektem'}`} byl ${m.short} = ${sh(r.estimate)} (95% CI ${sh(r.ciLow)} až ${sh(r.ciHigh)}; p ${fmtP(r.p)}; ${fig.ref}).`,
      ];
      if (r.k > 1) parts.push(multi ? `${heterogeneityText(r, a.ml)}.` : `${heterogeneityText(r)}, tedy heterogenita ${interpretI2(r.I2).split(' – ')[0]}.`);
      if (r.piLow != null && r.piHigh != null) parts.push(`95% predikční interval byl ${sh(r.piLow)} až ${sh(r.piHigh)}.`);
      if (a.subgroups) parts.push(`Analýza podskupin: ${a.subgroups.groups.map((g) => `${g.name} – ${m.short} = ${sh(g.result.estimate)} (95% CI ${sh(g.result.ciLow)} až ${sh(g.result.ciHigh)}; k = ${g.result.k})`).join('; ')}. Test rozdílu mezi podskupinami: Q(${a.subgroups.df}) = ${fmt(a.subgroups.Qb, 2)}, p ${fmtP(a.subgroups.p)}.`);
      if (a.loo.length) {
        const ests = a.loo.map((l) => l.result.estimate);
        parts.push(`Při postupném vynechání jednotlivých studií se souhrnný odhad pohyboval od ${sh(Math.min(...ests))} do ${sh(Math.max(...ests))}.`);
      }
      if (a.egger && r.k >= 10) parts.push(`Eggerův test asymetrie trychtýřového grafu: t(${a.egger.df}) = ${fmt(a.egger.t, 2)}, p ${fmtP(a.egger.p)}.`);
      else if (multi) parts.push('Eggerův test nebyl proveden, protože předpokládá nezávislé efekty.');
      else if (r.k > 1) parts.push('Publikační zkreslení nebylo testováno, protože studií bylo méně než deset.');
      if (a.skipped.length) parts.push(`Z analýzy byly vynechány efekty, které nešlo spočítat (${a.skipped.map((x) => x.label).join(', ')}).`);
      rsExtras.push(fig.block);

      const reg = regressions[ai];
      if (reg?.coef.length) {
        const unitName = reg.kind === 'three-level' ? 'efektů' : 'studií';
        const tb = table(
          `Metaregrese – ${outcome.name}. Koeficienty jsou na škále, na které se počítá${m.scale === 'log' ? ` (logaritmus ${m.short})` : m.scale === 'z' ? ' (Fisherovo z)' : ''}`,
          ['Koeficient', 'Odhad', 'SE', '95% CI', reg.test, 'p'],
          reg.coef.map((c) => [c.name, fmt(c.b, 3), fmt(c.se, 3), `${fmt(c.ciLow, 3)} až ${fmt(c.ciHigh, 3)}`, fmt(c.stat, 2), fmtP(c.p).replace(/^= /, '')]),
        );
        parts.push(
          `Metaregrese (${unitName} k = ${reg.k}; ${tb.ref}): test moderátorů ${reg.test === 't' ? `F(${reg.dfM}, ${reg.dfE})` : `Q(${reg.dfM})`} = ${fmt(reg.QM, 2)}, p ${fmtP(reg.pQM)}${
            reg.R2 != null ? `; moderátory vysvětlily ${fmt(reg.R2, 1)} % rozptylu mezi studiemi` : ''
          }; zbytková heterogenita Q(${reg.dfE}) = ${fmt(reg.QE, 2)}, p ${fmtP(reg.pQE)}${reg.I2 != null ? `, I² = ${fmt(reg.I2, 1)} %` : ''}.${reg.k / Math.max(1, reg.design.names.length - 1) < 10 ? ' Vzhledem k malému počtu studií na moderátor je třeba výsledek brát jako orientační.' : ''}`,
        );
        rsExtras.push(tb.block);
        if (reg.bubble) {
          const bf = figure(`Metaregrese – ${outcome.name} podle proměnné „${lower(reg.bubble.xLabel)}“. Velikost bodu odpovídá váze studie; pás ukazuje 95% interval spolehlivosti`, bubbleSvg({ ...reg.bubble, scale: a.scale, measure: m.short, mode }));
          parts.push(`Vztah znázorňuje ${bf.ref}.`);
          rsExtras.push(bf.block);
        }
      }
      parts.push(todo('slovní interpretace směru a velikosti účinku'));
      rs.push(parts.join(' '));
    });

    for (const net of nets) {
      const outcome = net.outcome;
      const m = MEASURES[outcome.measure];
      const sh = (v: number) => fmt(backTransform(outcome.measure, v), 2);
      const out = net.outcomeResult;
      if (!out.ok) {
        rs.push(`Výstup „${outcome.name}“ (síťová metaanalýza): ${out.error} ${todo('doplňte data v kroku Extrakce dat')}`);
        continue;
      }
      const res = out.result;
      const gfig = figure(`Síť léčeb – ${outcome.name}. Tloušťka spojnice a číslo u ní udávají počet studií s přímým srovnáním`, networkSvg({ nodes: res.nodes.map((x) => ({ label: x.treatment, studies: x.studies })), edges: res.edges, mode }));
      const ffig = figure(
        `Léčby oproti referenční („${res.reference}“) – ${outcome.name} (${m.short})`,
        forestSvg({
          rows: res.treatments.map((t, i): ForestRow => ({ kind: 'study', label: t, yi: res.vsReference[i].est, lo: res.vsReference[i].ciLow, hi: res.vsReference[i].ciHigh })).filter((row) => row.label !== res.reference),
          scale: net.scale,
          measure: m.short,
          labelHeader: `Léčba (oproti: ${res.reference})`,
          footer: [],
          mode,
        }),
      );
      const order = res.pscore.map((x) => x.treatment);
      const league = table(
        `Všechna vzájemná srovnání – ${outcome.name}. V buňce je ${m.short} léčby v řádku oproti léčbě ve sloupci (95% CI); léčby jsou seřazeny podle P-skóre`,
        ['', ...order],
        order.map((row) => [
          row,
          ...order.map((col) => {
            if (row === col) return '–';
            const e = res.league[res.treatments.indexOf(row)][res.treatments.indexOf(col)];
            return `${sh(e.est)} (${sh(e.ciLow)} až ${sh(e.ciHigh)})`;
          }),
        ]),
      );
      const rank = table(
        `Pořadí léčeb podle P-skóre – ${outcome.name}`,
        ['Pořadí', 'Léčba', 'P-skóre', `${m.short} oproti „${res.reference}“ (95% CI)`, 'Počet studií'],
        res.pscore.map((x, i) => {
          const e = res.vsReference[res.treatments.indexOf(x.treatment)];
          return [`${i + 1}.`, x.treatment, fmt(x.value, 2), x.treatment === res.reference ? 'referenční' : `${sh(e.est)} (${sh(e.ciLow)} až ${sh(e.ciHigh)})`, String(res.nodes.find((nd) => nd.treatment === x.treatment)?.studies ?? '')];
        }),
      );
      const parts = [
        `Výstup „${outcome.name}“ (${m.name.toLowerCase()}): síť tvořily studie (${n(res.studies)}${res.multiArm ? `, z toho se třemi a více rameny ${n(res.multiArm)}` : ''}), které srovnávaly ${plural(res.treatments.length, 'léčbu', 'léčby', 'léčeb')} v ${res.edges.length} přímých srovnáních (${gfig.ref}).`,
        `Odhady účinku jednotlivých léčeb oproti referenční léčbě „${res.reference}“ v modelu ${res.model === 'random' ? 's náhodnými efekty' : 'se společným efektem'} ukazuje ${ffig.ref}, všechna vzájemná srovnání ${league.ref} a pořadí léčeb ${rank.ref}.`,
        `Nejvyšší P-skóre měla léčba „${res.pscore[0].treatment}“ (${fmt(res.pscore[0].value, 2)}), nejnižší „${res.pscore[res.pscore.length - 1].treatment}“ (${fmt(res.pscore[res.pscore.length - 1].value, 2)}).`,
      ];
      if (res.df > 0) parts.push(`Heterogenita a nekonzistence v celé síti: Q(${res.df}) = ${fmt(res.Q, 2)}, p ${fmtP(res.pQ)}; I² = ${fmt(res.I2, 1)} %${res.model === 'random' ? `; τ² = ${fmt(res.tau2, 4)}` : ''}.`);
      if (res.dfBetween > 0) parts.push(`Test nekonzistence mezi designy: Q(${res.dfBetween}) = ${fmt(res.Qbetween, 2)}, p ${fmtP(res.pBetween)}.`);
      else parts.push('Konzistenci přímých a nepřímých důkazů nebylo možné testovat, protože síť neobsahuje uzavřené smyčky tvořené různými designy.');
      const incons = res.split.filter((x) => x.p != null && x.p < 0.05);
      if (res.split.some((x) => x.p != null)) parts.push(incons.length ? `Přímé a nepřímé odhady se významně lišily u srovnání: ${incons.map((x) => `${x.a} oproti ${x.b} (p ${fmtP(x.p!)})`).join('; ')}.` : 'U žádného srovnání se přímý a nepřímý odhad významně nelišily.');
      if (out.skipped.length || net.unnamed.length) parts.push(todo(`do sítě nevstoupily všechny studie (${[...out.skipped.map((x) => x.label), ...net.unnamed].join(', ')}) – zkontrolujte data v kroku Extrakce dat`));
      parts.push(todo('slovní interpretace: které léčby se od sebe spolehlivě liší a jak pevné jsou důkazy pro jednotlivá srovnání'));
      rs.push(parts.join(' '));
      rsExtras.push(gfig.block, ffig.block, rank.block, league.block);
    }
    const graded = project.outcomes.filter((o) => syn.grade[o.id]);
    if (graded.length) {
      const g = table(
        'Jistota důkazů podle GRADE',
        ['Výstup', 'Jistota důkazů', 'Důvody snížení', 'Poznámka'],
        graded.map((o) => {
          const rating = syn.grade[o.id];
          return [o.name, gradeCertainty(rating), GRADE_DOMAINS.filter((d) => rating[d.id] < 0).map((d) => `${lower(d.label)} (${rating[d.id]})`).join(', ') || 'žádné', rating.note || '–'];
        }),
      );
      rs.push(`Jistotu důkazů shrnuje ${g.ref}.`);
      rsExtras.push(g.block);
    }
  }
  if (conf.synthesis.includes('charting') && ordered.length) {
    const yearCounts = countByYear(ordered);
    if (yearCounts.length) {
      const fig = figure(`Počet zařazených ${U.gen} podle roku publikace`, columnsSvg(yearCounts, { mode, title: 'Počet podle roku publikace' }));
      rs.push(`Rozložení zařazených ${U.gen} v čase ukazuje ${fig.ref}.`);
      rsExtras.push(fig.block);
    }
    for (const f of project.fields.filter((x) => syn.chartFields.includes(x.id))) {
      const c = countBy(ordered, f.id);
      const tb = table(`Počet zařazených ${U.gen} podle hlediska „${lower(f.label)}“`, [f.label, 'Počet', 'Podíl'], c.map((x) => [x.label, String(x.value), `${fmt((100 * x.value) / ordered.length, 1)} %`]));
      rs.push(`Rozdělení podle hlediska „${lower(f.label)}“ uvádí ${tb.ref}; nejčastější hodnotou bylo „${c[0]?.label}“ (${n(c[0]?.value ?? 0)}).`);
      rsExtras.push(tb.block);
    }
  }
  if (conf.synthesis.includes('overlap') && ordered.length) {
    const ov = overlapOf(ordered);
    if (ov.cca != null) {
      rs.push(`Zařazené přehledy (${n(ov.c)}) zahrnovaly celkem ${ov.r} unikátních primárních studií při ${ov.N} zahrnutích. Ukazatel CCA činil ${fmt(ov.cca, 1)} %, což odpovídá hodnocení „${ov.level}“.`);
      if (ov.rows.length <= 80) {
        const tb = table('Matice zahrnutí primárních studií v jednotlivých přehledech', ['Primární studie', ...ov.reviews.map((x) => x.label)], ov.rows.map((row) => [row.label, ...row.inReviews.map((b) => (b ? '×' : ''))]));
        rsExtras.push(tb.block);
      }
    } else rs.push(todo('pro výpočet překryvu vyplňte u přehledů seznam primárních studií'));
  }
  for (const theme of syn.themes) {
    const members = ordered.filter((r) => r.themes.includes(theme.id));
    const refs = members.map((r) => citeOf.get(r.id)?.inText).filter(Boolean).join('; ');
    rs.push(`${theme.name}. ${theme.summary.trim() || todo('shrnutí tématu')}${refs ? ` (${refs})` : ''}`);
  }
  if (syn.narrative.trim()) rs.push(syn.narrative.trim());
  add({
    id: 'r-synthesis',
    title: project.type === 'scoping' ? 'Výsledky mapování' : 'Výsledky syntézy',
    level: 2,
    kind: 'auto',
    guidance: 'Čísla a grafy pocházejí z kroku Syntéza. Slovní interpretaci doplňte sami; hodnocení a srovnání s literaturou patří až do diskuse.',
    generated: rs.join('\n\n') || todo('dokončete krok Syntéza'),
    extras: rsExtras,
  });

  // ---- Diskuse a závěr --------------------------------------------------------
  add({
    id: 'discussion',
    title: 'Diskuse',
    level: 1,
    kind: 'human',
    guidance:
      'Doporučená stavba: (1) hlavní zjištění jednou až dvěma větami; (2) srovnání s jinými přehledy a studiemi; (3) možná vysvětlení rozdílů; (4) silné stránky a omezení – zvlášť omezení zařazených studií a zvlášť omezení vašeho postupu (například třídění jedním hodnotitelem, omezení jazyka, počet databází); (5) důsledky pro praxi a další výzkum.' +
      (ms.template === 'master' ? ' U diplomové práce věnujte omezením a alternativním výkladům samostatné odstavce.' : ''),
  });
  add({
    id: 'conclusion',
    title: 'Závěr',
    level: 1,
    kind: 'human',
    guidance: 'Odpovězte na výzkumnou otázku. Nepřinášejte nové informace a nejděte dál, než kam dosahují výsledky. Jeden až dva odstavce.',
  });

  add({
    id: 'tools',
    title: 'Prohlášení o použitých nástrojích',
    level: 1,
    kind: 'auto',
    numbered: false,
    guidance: 'Upravte podle pravidel vaší školy. Pokud jste použili nástroje umělé inteligence, uveďte které a k čemu.',
    generated: `Při zpracování přehledu byla použita aplikace ${APP_NAME} (verze ${APP_VERSION}) pro správu záznamů, odstranění duplicit, evidenci rozhodnutí při třídění, statistické výpočty a sestavení podkladů pro metodiku a výsledky. Všechna rozhodnutí o zařazení, extrakci dat, hodnocení kvality a interpretaci provedl autor. ${todo('případné použití nástrojů umělé inteligence')}`,
  });

  // ---- Literatura a přílohy ---------------------------------------------------
  add({
    id: 'references',
    title: thesis ? 'Seznam literatury' : 'Literatura',
    level: 1,
    kind: 'auto',
    numbered: false,
    guidance: `Seznam obsahuje zařazené ${U.nom}. Zdroje citované v úvodu a diskusi doplňte ručně nebo citačním manažerem a styl ověřte podle požadavků školy.`,
    generated: '',
    extras: cites.map((c) => ({ t: 'ref', spans: c.reference }) as Block),
  });

  add({
    id: 'app-search',
    title: 'Příloha A: Vyhledávací strategie',
    level: 1,
    kind: 'auto',
    numbered: false,
    guidance: 'Úplné znění dotazů umožňuje hledání zopakovat (PRISMA 2020, položka 7).',
    generated: '',
    extras: project.searches.length
      ? [{ t: 'table', caption: 'Deník vyhledávání', head: ['Zdroj', 'Datum', 'Dotaz', 'Počet výsledků', 'Nahráno'], rows: project.searches.map((s) => [s.source, formatDate(s.date), s.query || '–', s.hits == null ? '–' : String(s.hits), String(s.imported)]) }]
      : [],
  });

  if (twoStage) {
    const all = fulltextQueue(records).filter((r) => r.screen2 === 'exclude' || r.fulltext === 'notRetrieved');
    const exCites = new Map(buildCitations(all, ms.style).map((c) => [c.id, c.plain]));
    add({
      id: 'app-excluded',
      title: 'Příloha B: Vyřazené plné texty',
      level: 1,
      kind: 'auto',
      numbered: false,
      guidance: 'Seznam vyřazených plných textů s důvodem (PRISMA 2020, položka 16b).',
      generated: '',
      extras: all.length
        ? [{ t: 'table', caption: 'Plné texty vyřazené při posuzování způsobilosti', head: ['Publikace', 'Důvod vyřazení'], rows: all.map((r) => [exCites.get(r.id) ?? r.title, r.fulltext === 'notRetrieved' ? 'Plný text se nepodařilo získat' : r.excludeReason || 'Důvod neuveden']) }]
        : [],
    });
  }

  const checklist = CHECKLISTS[project.type];
  add({
    id: 'app-checklist',
    title: `Příloha ${twoStage ? 'C' : 'B'}: Kontrolní seznam ${checklist.name}`,
    level: 1,
    kind: 'auto',
    numbered: false,
    guidance: 'Vyplňuje se v kroku Kontrolní seznam.',
    generated: `Položky jsou uvedeny ve zkráceném českém znění; závazné je původní znění standardu: ${checklist.citation}`,
    extras: [
      {
        t: 'table',
        caption: `Kontrolní seznam ${checklist.name}`,
        head: ['Č.', 'Oddíl', 'Položka', 'Kde v textu'],
        rows: checklist.items.map((it) => [it.no, it.section, it.text, project.checklist[it.id]?.where?.trim() || (project.checklist[it.id]?.done ? 'ano' : '–')]),
      },
    ],
  });

  return { title: project.title, sections };
}

/** Text oddílu: vlastní znění uživatele má přednost před vygenerovaným. */
export function sectionText(project: Pick<Project, 'manuscript'>, section: Section): string {
  const own = project.manuscript.sections[section.id];
  return own != null && own.trim() !== '' ? own : section.generated;
}

export function isEdited(project: Pick<Project, 'manuscript'>, section: Section): boolean {
  const own = project.manuscript.sections[section.id];
  return own != null && own.trim() !== '';
}

/** Rozloží rukopis na posloupnost bloků pro náhled a export. */
export function toBlocks(ms: Manuscript, project: Pick<Project, 'manuscript'>): Block[] {
  const out: Block[] = [];
  for (const s of ms.sections) {
    out.push({ t: 'h', level: s.level, text: s.number ? `${s.number} ${s.title}` : s.title });
    const body = sectionText(project, s).trim();
    if (body) {
      for (const para of body.split(/\n\s*\n/)) if (para.trim()) out.push({ t: 'p', text: para.trim().replace(/\s*\n\s*/g, ' ') });
    } else if (s.kind === 'human') {
      out.push({ t: 'todo', text: `${TODO}: ${s.title}] ${s.guidance}` });
    }
    out.push(...s.extras);
  }
  return out;
}

/** Počet míst, která ještě čekají na doplnění. */
export function countTodos(blocks: Block[]): number {
  let nTodo = 0;
  for (const b of blocks) {
    if (b.t === 'todo') nTodo++;
    else if (b.t === 'p') nTodo += b.text.split(TODO).length - 1;
  }
  return nTodo;
}
