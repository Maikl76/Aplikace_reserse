// Logika průvodce návrhem aplikace: co plyne z vlastností aplikace, které typy řešení
// a možnosti nasazení jim vyhovují, jaké otázky položit škole a jak rozvrhnout stavbu.
//
// Pravidla popisují technické a organizační souvislosti (bez serveru nejde sdílet data,
// obchody přijímají jen aplikace pro danou platformu…). Nejsou doporučením: rozhodnutí
// zůstává na člověku a aplikace jen ukazuje, co z něj plyne.

import type { DesignState, DesignStepId, Project, Requirement } from '../types';
import { DEPLOY_OPTIONS, FACTS, PROFILE_QUESTIONS, SCHOOL_QUESTIONS, SOLUTION_TYPES, type DeployId, type DeployOption, type Fact, type SchoolQuestion, type SolutionId, type SolutionType } from './catalog';

// ---- Kroky -------------------------------------------------------------------------------

export const DESIGN_STEPS: { id: DesignStepId; label: string }[] = [
  { id: 'd-intent', label: 'Záměr' },
  { id: 'd-reqs', label: 'Požadavky' },
  { id: 'd-profile', label: 'Vlastnosti aplikace' },
  { id: 'd-solution', label: 'Typ řešení' },
  { id: 'd-deploy', label: 'Nasazení' },
  { id: 'd-rules', label: 'Škola a pravidla' },
  { id: 'd-plan', label: 'Plán etap' },
  { id: 'd-output', label: 'Výstup' },
];

export const DESIGN_STEP_LABELS = Object.fromEntries(DESIGN_STEPS.map((s) => [s.id, s.label])) as Record<DesignStepId, string>;

export function newDesign(): DesignState {
  return {
    intent: { problem: '', users: '', goal: '', success: '', context: '', builder: '', experience: '', horizon: '', maintainer: '' },
    requirements: [],
    profile: {},
    solution: { type: '', why: '', tech: '' },
    deploy: { choice: '', extras: [], why: '' },
    school: {},
    rules: { licence: '', dataNote: '', handover: '' },
    plan: {},
    author: '',
    institution: '',
  };
}

/** Doplní návrhu části, které ve starší verzi dat chyběly. */
export function normalizeDesign(d: Partial<DesignState> | undefined): DesignState {
  const base = newDesign();
  if (!d) return base;
  return {
    ...base,
    ...d,
    intent: { ...base.intent, ...d.intent },
    solution: { ...base.solution, ...d.solution },
    deploy: { ...base.deploy, ...d.deploy, extras: d.deploy?.extras ?? [] },
    rules: { ...base.rules, ...d.rules },
    requirements: d.requirements ?? [],
    profile: d.profile ?? {},
    school: d.school ?? {},
    plan: d.plan ?? {},
  };
}

/** Návrh projektu; u projektu bez této části prázdný. */
export const designOf = (project: Pick<Project, 'design'>): DesignState => project.design ?? newDesign();

// ---- Co plyne z vlastností -----------------------------------------------------------------

export interface Needs {
  /** Důvody, proč aplikace potřebuje server (prázdné = nepotřebuje). */
  server: string[];
  /** Důvody, proč musí jít o aplikaci z obchodu. */
  native: string[];
  /** Upozornění při zavřené aplikaci: web je umí jen přes server, aplikace z obchodu i bez něj. */
  push: boolean;
  offline: boolean;
  personal: 'none' | 'basic' | 'special';
  /** Osobní údaje se dostanou mimo zařízení uživatele (na server). */
  personalLeavesDevice: boolean;
  medical: 'no' | 'unsure' | 'yes';
  /** Kolik otázek o vlastnostech je zodpovězeno. */
  answered: number;
}

export function deriveNeeds(profile: Record<string, string>): Needs {
  const server: string[] = [];
  if (profile.accounts === 'yes') server.push('Přihlašování vyžaduje službu, která účty ověřuje a uchovává.');
  if (profile.data === 'sync') server.push('Synchronizace mezi zařízeními vyžaduje úložiště mimo zařízení uživatele.');
  if (profile.data === 'shared') server.push('Sdílení dat mezi uživateli vyžaduje společné úložiště.');
  if (profile.collect === 'yes') server.push('Abyste viděli data uživatelů, musí se někam odesílat.');
  if (profile.secrets === 'yes') server.push('Tajný klíč k cizí službě nesmí být v kódu, který se stahuje do prohlížeče.');

  const native: string[] = [];
  if (profile.store === 'yes') native.push('Obchody přijímají jen aplikace sestavené pro danou platformu.');
  if (profile.hardware === 'advanced') native.push('Zdravotní data telefonu, zařízení přes Bluetooth a běh na pozadí webová aplikace obvykle nezvládne.');

  const personal = profile.personal === 'special' ? 'special' : profile.personal === 'basic' ? 'basic' : 'none';
  return {
    server,
    native,
    push: profile.notify === 'yes',
    offline: profile.offline === 'yes',
    personal,
    personalLeavesDevice: personal !== 'none' && server.length > 0,
    medical: profile.medical === 'yes' ? 'yes' : profile.medical === 'unsure' ? 'unsure' : 'no',
    answered: PROFILE_QUESTIONS.filter((q) => profile[q.id]).length,
  };
}

export interface Implication {
  kind: 'info' | 'warn';
  title: string;
  text: string;
  reasons?: string[];
  fact?: Fact;
}

/** Shrnutí toho, co odpovědi znamenají pro další rozhodování. */
export function implications(profile: Record<string, string>): Implication[] {
  const n = deriveNeeds(profile);
  const out: Implication[] = [];
  if (n.answered === 0) return out;
  if (n.server.length) {
    out.push({ kind: 'warn', title: 'Aplikace potřebuje server', text: 'Někdo ho musí provozovat, zabezpečit a platit po celou dobu, kdy má aplikace běžet. Pokud to nejde zajistit, zvažte, kterého z těchto požadavků se lze vzdát.', reasons: n.server });
  } else {
    out.push({ kind: 'info', title: 'Aplikace se obejde bez serveru', text: 'Může běžet celá v prohlížeči uživatele. To je nejlevnější a nejtrvalejší varianta provozu.' });
  }
  if (n.native.length) out.push({ kind: 'warn', title: 'Je potřeba aplikace z obchodu', text: 'Počítejte s poplatky, schvalováním a průběžnými aktualizacemi pro každou platformu zvlášť.', reasons: n.native });
  if (n.push) {
    out.push({
      kind: 'warn',
      title: 'Upozornění při zavřené aplikaci',
      text: n.native.length ? 'Aplikace z obchodu si upozornění umí naplánovat sama, bez serveru.' : 'U webové aplikace musí upozornění odeslat server. Aplikace z obchodu si je umí naplánovat sama.',
      fact: FACTS.iosPush,
    });
  }
  if (n.offline) out.push({ kind: 'info', title: 'Práce bez připojení', text: 'Aplikace musí mít vše potřebné uložené v zařízení. U řešení se serverem to znamená navíc řešit, co se stane s daty zadanými bez připojení.' });
  if (n.personal !== 'none') {
    out.push({
      kind: 'warn',
      title: n.personalLeavesDevice ? 'Osobní údaje opustí zařízení uživatele' : 'Osobní údaje zůstávají v zařízení uživatele',
      text: n.personalLeavesDevice
        ? 'Někdo se stává jejich správcem a odpovídá za ně. Vyjasněte se školou, kdo to bude, ještě před stavbou.'
        : 'Dokud údaje neopouštějí zařízení uživatele, nikdo další je nezpracovává. Uživateli přesto vysvětlete, co se ukládá a jak to smazat.',
      fact: n.personalLeavesDevice ? FACTS.gdprController : undefined,
    });
  }
  if (n.personal === 'special') out.push({ kind: 'warn', title: 'Citlivé údaje', text: 'Platí pro ně přísnější pravidla. Pokud je aplikace k plnění účelu nepotřebuje, nesbírejte je.', fact: n.personalLeavesDevice ? FACTS.gdprDpia : FACTS.gdprSpecial });
  if (n.medical !== 'no') {
    out.push({
      kind: 'warn',
      title: n.medical === 'yes' ? 'Aplikace může být zdravotnickým prostředkem' : 'Ověřte, zda aplikace není zdravotnickým prostředkem',
      text: 'Rozhoduje účel, ke kterému aplikaci určíte. Posouzení si vyžádejte dřív, než ji dáte lidem k používání.',
      fact: FACTS.mdr,
    });
  }
  return out;
}

// ---- Vhodnost typů řešení -------------------------------------------------------------------

export type FitLevel = 'ok' | 'warn' | 'no';

export interface Fit {
  level: FitLevel;
  reasons: string[];
}

export const FIT_LABELS: Record<FitLevel, string> = { ok: 'Vyhovuje', warn: 'S výhradou', no: 'Nevyhovuje' };

const fit = (no: string[], warn: string[]): Fit => (no.length ? { level: 'no', reasons: [...no, ...warn] } : warn.length ? { level: 'warn', reasons: warn } : { level: 'ok', reasons: [] });

/** Jak typ řešení odpovídá vlastnostem aplikace. Bez odpovědí nic netvrdí. */
export function solutionFit(id: SolutionId, design: Pick<DesignState, 'profile' | 'intent'>): Fit {
  const p = design.profile;
  const n = deriveNeeds(p);
  const no: string[] = [];
  const warn: string[] = [];
  const beginner = design.intent.experience === 'none' && (design.intent.builder === 'self' || design.intent.builder === 'self-ai');

  if (id !== 'native' && n.native.length) no.push(...n.native);

  switch (id) {
    case 'static':
      no.push(...n.server);
      if (n.push) no.push('Upozornění při zavřené aplikaci bez serveru neumí.');
      if (p.data === 'local') warn.push('Data jsou jen v jednom prohlížeči; počítejte s exportem a zálohou.');
      break;
    case 'baas':
      if (p.secrets === 'yes') warn.push('Tajný klíč patří do serverové funkce služby, ne do prohlížeče. Ověřte, zda ji zvolený tarif nabízí.');
      if (n.personal === 'special' && n.personalLeavesDevice) warn.push('Citlivé údaje by ležely u komerčního poskytovatele.');
      else if (n.personalLeavesDevice) warn.push('Osobní údaje by ležely u komerčního poskytovatele; je potřeba smlouva o zpracování.');
      if (n.offline) warn.push('Práce bez připojení vyžaduje další úsilí.');
      if (!n.server.length && n.answered > 0) warn.push('Podle odpovědí server potřeba není; služba by přidala závislost bez užitku.');
      break;
    case 'server':
      if (p.budget === 'zero') warn.push('Provoz serveru někdo platí; při nulovém rozpočtu ho musí poskytnout škola.');
      if (beginner) warn.push('Pro začátečníka nejnáročnější varianta; zabezpečení serveru se nedá odbýt.');
      if (n.offline) warn.push('Práce bez připojení vyžaduje další úsilí.');
      if (!n.server.length && n.answered > 0) warn.push('Podle odpovědí server potřeba není; přidal by náklady a údržbu bez užitku.');
      break;
    case 'native':
      if (p.devices === 'desktop') no.push('Aplikace z obchodu neběží na počítači.');
      if (p.budget === 'zero') warn.push('Poplatky obchodů se při nulovém rozpočtu nedají pokrýt.');
      if (p.devices === 'both') warn.push('Pro počítač bude potřeba ještě webová verze.');
      if (n.server.length) warn.push('Kromě aplikace bude potřeba i server.');
      if (!n.native.length && n.answered > 0) warn.push('Podle odpovědí obchod potřeba není; webová aplikace by byla levnější.');
      break;
    case 'nocode':
      if (n.offline) no.push('Hotové nástroje obvykle vyžadují připojení.');
      if (n.push) warn.push('Upozornění umí jen některé nástroje.');
      if (p.data === 'shared') warn.push('Sdílení mezi uživateli záleží na možnostech nástroje.');
      if (n.personal !== 'none') warn.push('Ověřte, kde nástroj ukládá data a kdo k nim má přístup.');
      break;
  }
  return fit(no, warn);
}

export const solutionOf = (id: string): SolutionType | undefined => SOLUTION_TYPES.find((s) => s.id === id);
export const deployOf = (id: string): DeployOption | undefined => DEPLOY_OPTIONS.find((d) => d.id === id);

// ---- Vhodnost možností nasazení ---------------------------------------------------------------

/** Jak možnost nasazení odpovídá zvolenému typu řešení a vlastnostem aplikace. */
export function deployFit(id: DeployId, design: DesignState): Fit {
  const option = deployOf(id);
  if (!option) return { level: 'no', reasons: ['Neznámá možnost.'] };
  const p = design.profile;
  const n = deriveNeeds(p);
  const type = solutionOf(design.solution.type);
  const no: string[] = [];
  const warn: string[] = [];

  if (type && !option.suits.includes(type.id)) no.push(`Nehodí se pro zvolený typ řešení (${type.name.toLowerCase()}).`);
  if (!type && id === 'repo' && n.server.length) no.push('Hosting z repozitáře jen rozdává soubory; server na něm neběží.');
  if (!type) warn.push('Zatím není zvolen typ řešení, vhodnost je jen orientační.');

  const long = design.intent.horizon === 'long' || design.intent.horizon === 'years';
  switch (id) {
    case 'repo':
      if (n.personalLeavesDevice) no.push('Osobní údaje na tomto hostingu nemá kdo přijmout ani uložit.');
      break;
    case 'school':
      if (!design.school['q-hosting']?.trim()) warn.push('Záleží na odpovědi školy; zatím ji nemáte zapsanou.');
      if (!design.school['q-guarantor']?.trim()) warn.push('Bez garanta mezi zaměstnanci aplikace dlouho nevydrží.');
      break;
    case 'einfra':
      if (design.intent.experience === 'none') warn.push('Vyžaduje znalost správy serverů.');
      if (long && !design.school['q-guarantor']?.trim()) warn.push('Po ukončení studia musí účet a službu převzít někdo z instituce.');
      break;
    case 'cloud-free':
      if (n.personal === 'special' && n.personalLeavesDevice) warn.push('Citlivé údaje u komerčního poskytovatele v bezplatném tarifu se obhajují těžko.');
      else if (n.personalLeavesDevice) warn.push('Osobní údaje u komerčního poskytovatele vyžadují smlouvu o zpracování a souhlas školy.');
      if (long) warn.push('Bezplatný tarif není sázka na roky; poskytovatel ho může změnit.');
      break;
    case 'paid':
      if (p.budget === 'zero') warn.push('Rozpočet na provoz je nulový.');
      if (long && !design.intent.maintainer.trim()) warn.push('Není určeno, kdo bude platit a spravovat po skončení projektu.');
      break;
    case 'stores':
      if (p.budget === 'zero') warn.push('Poplatky obchodů se při nulovém rozpočtu nedají pokrýt.');
      break;
    case 'tool':
      if (n.personal !== 'none') warn.push('Ověřte, kde nástroj ukládá data a zda je smíte použít k danému účelu.');
      break;
    case 'download':
      if (n.server.length) no.push('Aplikace, která potřebuje server, sama ze souboru neběží.');
      break;
    case 'archive':
      break;
  }
  return fit(no, warn);
}

// ---- Otázky pro školu --------------------------------------------------------------------------

/** Otázky, které se vzhledem k návrhu vyplatí položit; ostatní zůstávají v nabídce. */
export function relevantQuestions(design: DesignState): SchoolQuestion[] {
  const n = deriveNeeds(design.profile);
  const ids = new Set<string>(['q-guarantor', 'q-thesis', 'q-licence', 'q-ai']);
  for (const id of [design.deploy.choice, ...design.deploy.extras]) deployOf(id)?.ask.forEach((q) => ids.add(q));
  if (!design.deploy.choice) ids.add('q-hosting');
  if (n.personal !== 'none') ids.add('q-gdpr');
  if (n.personalLeavesDevice || design.profile.collect === 'yes') ids.add('q-ethics');
  if (n.medical !== 'no') ids.add('q-medical');
  if (design.profile.budget !== 'zero' && n.server.length) ids.add('q-costs');
  if (design.intent.horizon !== 'defence') ids.add('q-account');
  return SCHOOL_QUESTIONS.filter((q) => ids.has(q.id));
}

// ---- Plán etap ---------------------------------------------------------------------------------

export interface Stage {
  id: string;
  title: string;
  steps: string[];
  /** Podle čeho se pozná, že je etapa hotová. */
  doneWhen: string;
  /** Nejčastější chyba. */
  mistake: string;
}

/** Etapy stavby podle zvoleného typu řešení, místa provozu a vlastností aplikace. */
export function planFor(design: DesignState): Stage[] {
  const n = deriveNeeds(design.profile);
  const type = design.solution.type as SolutionId | '';
  const archive = design.deploy.extras.includes('archive');
  const place = deployOf(design.deploy.choice)?.name.toLowerCase() ?? 'zvolené místo provozu';
  const stages: Stage[] = [];

  stages.push({
    id: 's-confirm',
    title: 'Ověřit záměr a pravidla',
    steps: ['Projděte návrh s vedoucím nebo zadavatelem.', 'Získejte odpovědi školy na otevřené otázky.', ...(n.personal !== 'none' ? ['Vyjasněte, kdo je správcem osobních údajů a zda je potřeba souhlas etické komise.'] : []), ...(n.medical !== 'no' ? ['Nechte posoudit, zda aplikace není zdravotnickým prostředkem.'] : [])],
    doneWhen: 'Víte, kde aplikace poběží, kdo za ni odpovídá a jaká data smí zpracovávat.',
    mistake: 'Začít stavět dřív, než je jasné, kam se výsledek nasadí.',
  });

  if (type === 'nocode') {
    stages.push(
      { id: 's-tool', title: 'Vybrat a nastavit nástroj', steps: ['Zjistěte, které nástroje škola provozuje a podporuje.', 'Ověřte, že nástroj umí vše z požadavků s prioritou „musí“.', 'Vyzkoušejte export dat dřív, než začnete sbírat.'], doneWhen: 'Nástroj splňuje povinné požadavky a víte, jak z něj dostat data ven.', mistake: 'Vybrat nástroj podle vzhledu a na export přijít až na konci.' },
      { id: 's-pilot', title: 'Pilotní ověření', steps: ['Nechte řešení projít několik lidí z cílové skupiny.', 'Zapište, kde se zasekli, a upravte obsah i nastavení.'], doneWhen: 'Lidé z cílové skupiny zvládnou hlavní úkol bez vysvětlování.', mistake: 'Zkoušet jen na sobě a na spolužácích.' },
    );
  } else {
    stages.push(
      {
        id: 's-prototype',
        title: 'Prototyp na papíře',
        steps: ['Nakreslete obrazovky pro hlavní úkoly uživatele.', 'Projděte je s několika lidmi z cílové skupiny.', 'Upravte požadavky podle toho, co jste zjistili.'],
        doneWhen: 'Lidé z cílové skupiny zvládnou na prototypu hlavní úkol bez vysvětlování.',
        mistake: 'Zkoušet prototyp na spolužácích místo na skutečných uživatelích.',
      },
      {
        id: 's-skeleton',
        title: 'Kostra a první nasazení',
        steps: ['Založte repozitář pro kód a zapisujte do něj změny od prvního dne.', 'Vytvořte nejmenší možnou verzi: jednu obrazovku bez funkcí.', `Nasaďte ji hned na cílové místo (${place}).`],
        doneWhen: 'Na cílové adrese běží prázdná aplikace a každá další změna se tam dostane stejným postupem.',
        mistake: 'Nechat nasazení na konec. Potíže s provozem se pak objeví týden před odevzdáním.',
      },
      {
        id: 's-core',
        title: 'Hlavní funkce',
        steps: ['Stavte požadavky s prioritou „musí“, jeden po druhém.', 'Každý po dokončení vyzkoušejte na cílové adrese.', 'K požadavkům „měla by“ a „mohla by“ se vraťte, až když povinné fungují.'],
        doneWhen: 'Všechny požadavky s prioritou „musí“ fungují na cílové adrese.',
        mistake: 'Vylepšovat vzhled a přidávat doplňky dřív, než funguje jádro.',
      },
    );
    if (design.profile.data !== 'none') {
      const serverSide = type === 'baas' || type === 'server' || (type === 'native' && n.server.length > 0);
      stages.push({
        id: 's-data',
        title: 'Data a záloha',
        steps: serverSide
          ? ['Nastavte, kdo smí která data číst a měnit, a vyzkoušejte to z cizího účtu.', 'Zaveďte pravidelnou zálohu databáze.', 'Zkuste ze zálohy data skutečně obnovit.']
          : ['Přidejte export dat do souboru a jejich opětovné načtení.', 'Vysvětlete uživateli přímo v aplikaci, kde jeho data jsou a jak o ně může přijít.', 'Vyzkoušejte přenos dat na jiné zařízení.'],
        doneWhen: serverSide ? 'Cizí účet se k datům nedostane a obnova ze zálohy je vyzkoušená.' : 'Uživatel umí svá data dostat ven a zase zpět.',
        mistake: 'Spoléhat na zálohu, kterou nikdo nezkusil obnovit.',
      });
    }
    if (type === 'server') {
      stages.push({
        id: 's-server',
        title: 'Zabezpečení a provoz serveru',
        steps: ['Zapněte šifrované spojení (HTTPS) a automatické bezpečnostní aktualizace.', 'Omezte přístup na server jen na lidi, kteří ho spravují.', 'Nastavte upozornění na výpadek a na docházející místo na disku.', 'Sepište postup obnovy po výpadku.'],
        doneWhen: 'Server se aktualizuje sám, výpadek se dozvíte a víte, jak aplikaci obnovit.',
        mistake: 'Spustit server a už se na něj nepodívat.',
      });
    }
    if (type === 'native') {
      stages.push({
        id: 's-store',
        title: 'Vývojářské účty a schválení',
        steps: ['Založte vývojářské účty včas; ověření totožnosti trvá.', 'Připravte podklady pro obchod: popis, snímky obrazovek, zásady ochrany soukromí.', 'Projděte povinným testováním a odešlete aplikaci ke schválení s rezervou.'],
        doneWhen: 'Aplikace prošla schválením v obchodech, ve kterých má být.',
        mistake: 'Počítat se schválením napoprvé a do druhého dne.',
      });
    }
  }

  if (n.personal !== 'none') {
    stages.push({
      id: 's-privacy',
      title: 'Osobní údaje',
      steps: ['Sepište, jaké údaje aplikace zpracovává, proč, kde a jak dlouho.', 'Odstraňte údaje, které k účelu nejsou potřeba.', 'Napište informaci pro uživatele a zajistěte, aby šla data smazat.', ...(n.personalLeavesDevice ? ['Uzavřete potřebné smlouvy o zpracování a doložte souhlas školy.'] : [])],
      doneWhen: 'Popis zpracování odpovídá tomu, co aplikace skutečně dělá, a schválil ho ten, kdo za údaje odpovídá.',
      mistake: 'Sbírat údaje „pro jistotu“.',
    });
  }

  if (type !== 'nocode') {
    stages.push(
      {
        id: 's-test',
        title: 'Zkouška s uživateli',
        steps: ['Připravte několik úkolů, které má uživatel v aplikaci zvládnout.', 'Sledujte několik lidí z cílové skupiny, jak je plní, a nezasahujte.', 'Vyzkoušejte aplikaci na různých zařízeních a v různých prohlížečích.', 'Ověřte ovládání klávesnicí a čitelnost při zvětšeném písmu.'],
        doneWhen: 'Uživatelé zvládnou hlavní úkoly bez pomoci a nalezené chyby jsou opravené nebo zapsané.',
        mistake: 'Považovat za zkoušku to, že aplikace funguje autorovi.',
      },
      {
        id: 's-docs',
        title: 'Dokumentace a licence',
        steps: ['Popište v souboru README, co aplikace dělá, jak ji spustit a jak ji nasadit.', 'Přidejte licenci dohodnutou se školou.', 'Napište návod pro toho, kdo aplikaci převezme.'],
        doneWhen: 'Někdo jiný podle dokumentace aplikaci spustí a nasadí bez vaší pomoci.',
        mistake: 'Nechat postup nasazení jen v hlavě autora.',
      },
    );
  }

  stages.push({
    id: 's-release',
    title: type === 'nocode' ? 'Uchování výsledku' : 'Vydání a archivace',
    steps:
      type === 'nocode'
        ? ['Vyexportujte data i podobu řešení (otázky, obsah, nastavení).', 'Uložte je tam, kde přežijí konec vašeho školního účtu.', 'V práci popište řešení tak, aby šlo znovu sestavit.']
        : ['Označte verzi, kterou odevzdáváte.', ...(archive ? ['Uložte ji do archivu a poznamenejte si trvalý identifikátor.'] : ['Zvažte uložení do archivu s trvalým identifikátorem.']), 'V práci uveďte adresu aplikace, verzi, datum a identifikátor archivované kopie.'],
    doneWhen: type === 'nocode' ? 'Data i podoba řešení jsou uložené mimo nástroj a školní účet.' : 'V práci je odkaz na běžící aplikaci i na její stálou kopii.',
    mistake: 'Uvést v práci jen odkaz na živou adresu, která za rok nemusí existovat.',
  });

  stages.push({
    id: 's-handover',
    title: 'Předání',
    steps: ['Dohodněte, kdo aplikaci po vašem odchodu provozuje, a předejte mu přístupy.', 'Zapište, do kdy má aplikace běžet a kdo rozhodne o jejím vypnutí.', 'Určete, co se při vypnutí stane s daty uživatelů.'],
    doneWhen: 'Je písemně domluveno, kdo aplikaci provozuje po vašem odchodu, nebo kdy a jak se vypne.',
    mistake: 'Aplikaci tiše opustit: běží dál bez správce i s daty uživatelů.',
  });
  return stages;
}

// ---- Co ještě chybí ------------------------------------------------------------------------------

export interface OpenPoint {
  step: DesignStepId;
  text: string;
}

const hasText = (r: Requirement) => r.text.trim().length > 0;

/** Místa, která je potřeba doplnit nebo rozhodnout, než bude návrh úplný. */
export function openPoints(design: DesignState): OpenPoint[] {
  const out: OpenPoint[] = [];
  const add = (step: DesignStepId, text: string) => out.push({ step, text });
  const i = design.intent;
  if (!i.problem.trim()) add('d-intent', 'Není popsán problém, který aplikace řeší.');
  if (!i.users.trim()) add('d-intent', 'Není uvedeno, pro koho je aplikace určena.');
  if (!i.horizon) add('d-intent', 'Není určeno, jak dlouho má aplikace běžet.');
  if (i.horizon && i.horizon !== 'defence' && !i.maintainer.trim()) add('d-intent', 'Není určeno, kdo se o aplikaci postará po skončení projektu.');

  const reqs = design.requirements.filter(hasText);
  if (!reqs.length) add('d-reqs', 'Nejsou zapsány žádné požadavky.');
  else {
    if (!reqs.some((r) => r.priority === 'must')) add('d-reqs', 'Žádný požadavek nemá prioritu „musí“.');
    const noSource = reqs.filter((r) => !r.source).length;
    if (noSource) add('d-reqs', `U ${noSource} ${noSource === 1 ? 'požadavku' : 'požadavků'} není uveden zdroj.`);
  }

  const n = deriveNeeds(design.profile);
  const missing = PROFILE_QUESTIONS.length - n.answered;
  if (missing) add('d-profile', missing === PROFILE_QUESTIONS.length ? 'Vlastnosti aplikace nejsou vyplněny.' : `Zbývá zodpovědět ${missing} ${missing === 1 ? 'otázku' : missing < 5 ? 'otázky' : 'otázek'} o vlastnostech aplikace.`);

  const type = solutionOf(design.solution.type);
  if (!type) add('d-solution', 'Není zvolen typ řešení.');
  else {
    const f = solutionFit(type.id, design);
    if (f.level === 'no') add('d-solution', `Zvolený typ řešení neodpovídá vlastnostem aplikace: ${f.reasons[0]}`);
    if (!design.solution.why.trim()) add('d-solution', 'Chybí zdůvodnění volby typu řešení.');
  }

  const place = deployOf(design.deploy.choice);
  if (!place) add('d-deploy', 'Není zvoleno, kde aplikace poběží.');
  else {
    const f = deployFit(place.id, design);
    if (f.level === 'no') add('d-deploy', `Zvolené nasazení neodpovídá návrhu: ${f.reasons[0]}`);
    if (!design.deploy.why.trim()) add('d-deploy', 'Chybí zdůvodnění volby nasazení.');
  }

  const unanswered = relevantQuestions(design).filter((q) => !design.school[q.id]?.trim()).length;
  if (unanswered) add('d-rules', `${unanswered} ${unanswered === 1 ? 'otázka pro školu zůstává' : unanswered < 5 ? 'otázky pro školu zůstávají' : 'otázek pro školu zůstává'} bez odpovědi.`);
  if (n.personal !== 'none' && !design.rules.dataNote.trim()) add('d-rules', 'Není popsáno zpracování osobních údajů.');
  if (type && type.id !== 'nocode' && !design.rules.licence.trim()) add('d-rules', 'Není zvolena licence.');
  if (!design.rules.handover.trim()) add('d-rules', 'Není popsáno, co se s aplikací stane po obhajobě.');
  return out;
}

/** Podíl hotových etap plánu. */
export function planProgress(design: DesignState): { done: number; total: number } {
  const stages = planFor(design);
  return { done: stages.filter((s) => design.plan[s.id]?.done).length, total: stages.length };
}
