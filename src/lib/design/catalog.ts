// Obsah průvodce návrhem aplikace: otázky o vlastnostech, typy řešení, možnosti nasazení
// a otázky pro školu.
//
// Průvodce nic nedoporučuje – předkládá možnosti a jejich důsledky. Důsledky nejsou výsledkem
// výzkumu, ale vyplývají z podmínek poskytovatelů a z předpisů. Údaje, které se mohou změnit
// (ceny, limity, podmínky), jsou proto zapsány jako `Fact` se zdrojem a datem ověření.
// Při úpravě katalogu vždy ověřte údaj u zdroje a aktualizujte datum.

export interface Source {
  label: string;
  url: string;
}

export interface Fact {
  text: string;
  source: Source;
  /** Den, kdy byl údaj naposledy ověřen u zdroje (RRRR-MM-DD). */
  verified: string;
}

/** Datum poslední kontroly celého katalogu. */
export const CATALOG_VERIFIED = '2026-11-15';

const V = CATALOG_VERIFIED;
const fact = (text: string, label: string, url: string): Fact => ({ text, source: { label, url }, verified: V });

// ---- Zdroje použité na více místech ----------------------------------------------

const GDPR: Source = { label: 'Nařízení (EU) 2016/679 (GDPR)', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' };
const MDR: Source = { label: 'Nařízení (EU) 2017/745 o zdravotnických prostředcích', url: 'https://eur-lex.europa.eu/eli/reg/2017/745/oj' };
const AZ: Source = { label: 'Zákon č. 121/2000 Sb., autorský zákon, § 35 a § 60', url: 'https://www.zakonyprolidi.cz/cs/2000-121#p60' };

export const FACTS = {
  gdprController: fact('Správcem osobních údajů je ten, kdo určuje účel a prostředky jejich zpracování (čl. 4 bod 7). Správce odpovídá za to, že zpracování má právní základ a je zabezpečené.', GDPR.label, GDPR.url),
  gdprSpecial: fact('Údaje o zdravotním stavu patří mezi zvláštní kategorie osobních údajů, jejichž zpracování je zakázáno, pokud neplatí některá z výjimek, například výslovný souhlas (čl. 9).', GDPR.label, GDPR.url),
  gdprDpia: fact('Je-li pravděpodobné, že zpracování povede k vysokému riziku pro práva lidí, musí správce předem provést posouzení vlivu na ochranu osobních údajů; platí to mimo jiné pro rozsáhlé zpracování zvláštních kategorií údajů (čl. 35).', GDPR.label, GDPR.url),
  mdr: fact('Software, který je určen k diagnostice, prevenci, monitorování, predikci, prognóze, léčbě nebo zmírnění nemoci, je zdravotnickým prostředkem (čl. 2 bod 1). Jak se software posuzuje, vykládá pokyn MDCG 2019-11.', MDR.label, MDR.url),
  schoolWork: fact('Dílo vytvořené studentem ke splnění studijních povinností je školní dílo. Škola má za obvyklých podmínek právo na uzavření licenční smlouvy o jeho užití; autor je jinak může užít sám nebo k němu poskytnout licenci, pokud to není v rozporu s oprávněnými zájmy školy.', AZ.label, AZ.url),
  safariStorage: fact(
    'Safari smaže data, která si stránka uložila v prohlížeči (včetně IndexedDB a LocalStorage), po sedmi dnech používání prohlížeče, během nichž uživatel stránku nenavštívil. Webových aplikací přidaných na plochu se to podle WebKitu netýká.',
    'WebKit: Full Third-Party Cookie Blocking and More',
    'https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/',
  ),
  iosPush: fact('Na iPhonu a iPadu může webová aplikace posílat upozornění až od systému 16.4 a jen tehdy, když si ji uživatel přidá na plochu.', 'WebKit: Web Push for Web Apps on iOS and iPadOS', 'https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/'),
  supabasePause: fact('Supabase v bezplatném tarifu pozastaví projekt po týdnu nečinnosti a dovolí nejvýše dva aktivní projekty.', 'Supabase: Pricing', 'https://supabase.com/pricing'),
  firebaseSpark: fact('Firebase má bezplatný tarif Spark s denními limity (u databáze Firestore 1 GiB dat a 50 000 čtení denně); nad ně je potřeba přejít na tarif Blaze placený podle spotřeby.', 'Firebase: Pricing', 'https://firebase.google.com/pricing'),
  herokuEnd: fact('Heroku zrušilo všechny bezplatné tarify k 28. listopadu 2022; bezplatné databáze začalo od téhož dne mazat.', 'Heroku Changelog: Free Heroku Dynos, Postgres and Data for Redis are no longer available', 'https://devcenter.heroku.com/changelog-items/2502'),
  renderSleep: fact('Render v bezplatném tarifu uspí webovou službu po 15 minutách bez provozu. Bezplatná databáze Postgres vyprší 30 dní po vytvoření a po dalších 14 dnech se smaže, pokud ji nepřevedete na placenou.', 'Render Docs: Deploy for Free', 'https://render.com/docs/free'),
  vercelHobby: fact('Vercel dovoluje bezplatný tarif Hobby jen pro osobní nekomerční použití.', 'Vercel Docs: Fair use guidelines', 'https://vercel.com/docs/limits/fair-use-guidelines'),
  appleFee: fact('Členství v Apple Developer Program, nutné pro zveřejnění v App Store, stojí 99 USD za rok.', 'Apple Developer Program', 'https://developer.apple.com/programs/'),
  googleFee: fact('Založení vývojářského účtu Google Play stojí jednorázově 25 USD.', 'Nápověda Play Console: Začínáme', 'https://support.google.com/googleplay/android-developer/answer/6112435'),
  googleTesting: fact(
    'Osobní vývojářské účty Google Play založené po 13. listopadu 2023 musí před zveřejněním aplikace provést uzavřený test s nejméně 12 testery po dobu 14 dnů.',
    'Nápověda Play Console: Požadavky na testování aplikací u nových osobních účtů',
    'https://support.google.com/googleplay/android-developer/answer/14151465',
  ),
} satisfies Record<string, Fact>;

// ---- Záměr: nabídky odpovědí -------------------------------------------------------

export interface Choice {
  id: string;
  label: string;
}

export const CONTEXTS: Choice[] = [
  { id: 'bachelor', label: 'Bakalářská práce' },
  { id: 'master', label: 'Diplomová práce' },
  { id: 'research', label: 'Výzkumný projekt' },
  { id: 'teaching', label: 'Výuka' },
  { id: 'other', label: 'Jiné' },
];

export const BUILDERS: Choice[] = [
  { id: 'self', label: 'Já sám/sama' },
  { id: 'self-ai', label: 'Já s pomocí nástroje AI' },
  { id: 'developer', label: 'Někdo jiný (vývojář, spolužák)' },
  { id: 'team', label: 'Tým' },
];

export const EXPERIENCE: Choice[] = [
  { id: 'none', label: 'Žádná' },
  { id: 'basic', label: 'Základy' },
  { id: 'advanced', label: 'Pokročilá' },
];

export const HORIZONS: Choice[] = [
  { id: 'defence', label: 'Do obhajoby' },
  { id: 'years', label: 'Jeden až dva roky' },
  { id: 'long', label: 'Dlouhodobě' },
];

// ---- Požadavky -------------------------------------------------------------------------

export const PRIORITIES: { id: 'must' | 'should' | 'could'; label: string; hint: string }[] = [
  { id: 'must', label: 'Musí', hint: 'bez toho aplikace neplní účel' },
  { id: 'should', label: 'Měla by', hint: 'důležité, ale první verze se bez toho obejde' },
  { id: 'could', label: 'Mohla by', hint: 'jen když zbude čas' },
];

export const REQ_SOURCES: { id: 'assignment' | 'users' | 'standard' | 'literature' | 'experience' | 'assumption'; label: string; hint: string }[] = [
  { id: 'assignment', label: 'Zadání', hint: 'požaduje to vedoucí, zadavatel nebo zadání práce' },
  { id: 'users', label: 'Budoucí uživatelé', hint: 'vyplynulo z rozhovorů, dotazníku nebo pozorování' },
  { id: 'standard', label: 'Norma nebo předpis', hint: 'doporučený postup, standard, zákon' },
  { id: 'literature', label: 'Literatura', hint: 'jednotlivé publikace bez systematické rešerše' },
  { id: 'experience', label: 'Odborný úsudek', hint: 'vlastní praxe nebo zkušenost odborníka' },
  { id: 'assumption', label: 'Předpoklad', hint: 'zatím neověřená domněnka' },
];

// ---- Vlastnosti aplikace ---------------------------------------------------------------

export interface ProfileQuestion {
  id: string;
  label: string;
  hint: string;
  options: Choice[];
}

const YES_NO: Choice[] = [
  { id: 'no', label: 'Ne' },
  { id: 'yes', label: 'Ano' },
];

export const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: 'devices',
    label: 'Kde se bude aplikace používat?',
    hint: 'Určuje, jak moc se musí rozhraní přizpůsobit malé obrazovce a ovládání dotykem.',
    options: [
      { id: 'desktop', label: 'Hlavně na počítači' },
      { id: 'phone', label: 'Hlavně na telefonu' },
      { id: 'both', label: 'Na počítači i na telefonu' },
    ],
  },
  {
    id: 'store',
    label: 'Musí být aplikace v obchodě s aplikacemi (App Store, Google Play)?',
    hint: 'Webovou aplikaci otevře kdokoli přes odkaz a lze si ji přidat na plochu telefonu. Obchod je potřeba, jen když ho někdo vyžaduje nebo když aplikace potřebuje funkce, které web neumí.',
    options: [
      { id: 'no', label: 'Ne, stačí odkaz' },
      { id: 'yes', label: 'Ano, je to podmínka' },
    ],
  },
  {
    id: 'hardware',
    label: 'Potřebuje aplikace přístup k zařízení?',
    hint: 'Kameru, mikrofon a polohu zvládne i webová aplikace. Zdravotní data z telefonu, propojení s náramkem přes Bluetooth nebo práce na pozadí obvykle vyžadují aplikaci z obchodu.',
    options: [
      { id: 'none', label: 'Ne' },
      { id: 'basic', label: 'Kamera, mikrofon nebo poloha' },
      { id: 'advanced', label: 'Zdravotní data telefonu, Bluetooth, běh na pozadí' },
    ],
  },
  {
    id: 'offline',
    label: 'Musí aplikace fungovat bez připojení k internetu?',
    hint: 'Například v terénu, v tělocvičně nebo v nemocnici se slabým signálem.',
    options: YES_NO,
  },
  {
    id: 'accounts',
    label: 'Budou se uživatelé přihlašovat?',
    hint: 'Přihlášení je potřeba, když má aplikace poznat téhož člověka na různých zařízeních nebo oddělit data různých lidí na serveru. Zůstávají-li data v zařízení uživatele, přihlášení nutné není.',
    options: YES_NO,
  },
  {
    id: 'data',
    label: 'Kde zůstanou data, která uživatel v aplikaci vytvoří?',
    hint: 'Od odpovědi se odvíjí, zda aplikace potřebuje server.',
    options: [
      { id: 'none', label: 'Aplikace nic neukládá' },
      { id: 'local', label: 'Jen v zařízení uživatele' },
      { id: 'sync', label: 'Na všech zařízeních téhož uživatele' },
      { id: 'shared', label: 'Uvidí je i jiní uživatelé' },
    ],
  },
  {
    id: 'collect',
    label: 'Potřebujete vy sami vidět data, která uživatelé zadají?',
    hint: 'Například při sběru dat pro výzkum, nebo když má vyučující vidět výsledky studentů. Bez serveru to jde jen tak, že uživatel svá data vyexportuje a pošle sám.',
    options: YES_NO,
  },
  {
    id: 'personal',
    label: 'Jaké údaje o lidech aplikace zpracuje?',
    hint: 'Osobní údaj je vše, co lze přiřadit ke konkrétnímu člověku. Údaje o zdraví patří mezi zvláštní kategorie s přísnějšími pravidly.',
    options: [
      { id: 'none', label: 'Žádné osobní údaje' },
      { id: 'basic', label: 'Běžné (jméno, e-mail, věk)' },
      { id: 'special', label: 'Citlivé (zdraví, původ, přesvědčení)' },
    ],
  },
  {
    id: 'notify',
    label: 'Má aplikace sama upozorňovat, i když ji uživatel nemá otevřenou?',
    hint: 'Například připomínky cvičení, léků nebo termínů.',
    options: YES_NO,
  },
  {
    id: 'secrets',
    label: 'Bude aplikace volat placenou nebo přihlašovanou službu (model AI, mapy, SMS, platby)?',
    hint: 'Takové služby vydávají tajný klíč. Vše, co je v kódu webové stránky, si může přečíst každý návštěvník, takže klíč musí zůstat na serveru.',
    options: YES_NO,
  },
  {
    id: 'medical',
    label: 'Má aplikace sloužit k diagnostice, léčbě, sledování nebo prevenci nemoci u konkrétního člověka?',
    hint: 'Software s takovým určením může být zdravotnickým prostředkem a jeho uvedení do provozu má vlastní pravidla.',
    options: [
      { id: 'no', label: 'Ne' },
      { id: 'unsure', label: 'Nevím' },
      { id: 'yes', label: 'Ano' },
    ],
  },
  {
    id: 'scale',
    label: 'Kolik lidí bude aplikaci používat?',
    hint: 'Stačí řádový odhad pro dobu, po kterou má aplikace běžet.',
    options: [
      { id: 'few', label: 'Jednotky až desítky' },
      { id: 'hundreds', label: 'Stovky' },
      { id: 'thousands', label: 'Tisíce a víc' },
    ],
  },
  {
    id: 'budget',
    label: 'Kolik lze ročně platit za provoz?',
    hint: 'Počítejte i s dobou po obhajobě. Platbu z vlastní kapsy po ukončení studia obvykle nikdo neproplatí.',
    options: [
      { id: 'zero', label: 'Nic' },
      { id: 'low', label: 'Do 1 000 Kč' },
      { id: 'more', label: 'Víc, nebo to zaplatí pracoviště' },
    ],
  },
];

// ---- Typy řešení -----------------------------------------------------------------------

export type SolutionId = 'static' | 'baas' | 'server' | 'native' | 'nocode';

export interface SolutionType {
  id: SolutionId;
  name: string;
  description: string;
  can: string[];
  cannot: string[];
  /** Co začátečník podcení. */
  underestimated: string[];
  facts: Fact[];
  /** Obvyklé technologie a co z jejich volby plyne. */
  tech: { name: string; note: string }[];
  skills: string;
  running: string;
}

export const SOLUTION_TYPES: SolutionType[] = [
  {
    id: 'static',
    name: 'Webová aplikace bez serveru',
    description: 'Aplikace se celá stáhne do prohlížeče a běží v něm. Data zůstávají v zařízení uživatele. Lze ji připravit tak, aby šla přidat na plochu a fungovala bez připojení (označuje se PWA).',
    can: ['Funguje na počítači i na telefonu, stačí odkaz.', 'Provoz je zdarma a server není potřeba udržovat.', 'Data uživatele neopouštějí jeho zařízení.', 'Může fungovat bez připojení k internetu.'],
    cannot: ['Nepozná téhož uživatele na jiném zařízení.', 'Neumí sdílet data mezi uživateli ani je sbírat pro autora.', 'Nemůže bezpečně držet tajný klíč k cizí službě.', 'Neupozorní uživatele, když ji nemá otevřenou.'],
    underestimated: [
      'Data jsou jen v jednom prohlížeči. Bez exportu a zálohy o ně uživatel přijde, když smaže data prohlížeče nebo vymění zařízení.',
      'Kód aplikace si může přečíst každý návštěvník. Nic tajného v něm být nesmí.',
      'Bez serveru se nedozvíte, kolik lidí aplikaci používá ani jak; i takové měření je zpracování údajů.',
    ],
    facts: [FACTS.safariStorage],
    tech: [
      { name: 'HTML, CSS a JavaScript', note: 'Základ, který běží v každém prohlížeči. Malé aplikaci stačí bez dalších nástrojů a nemá co zastarat.' },
      { name: 'TypeScript s knihovnou (React, Vue, Svelte)', note: 'Přehlednější u větších aplikací. Přidává sestavovací krok a závislosti, které je potřeba aktualizovat.' },
      { name: 'Generátor statických stránek', note: 'Vhodný, když jde hlavně o obsah (texty, návody) a interakce je málo.' },
    ],
    skills: 'Základy tvorby webu. S nástrojem AI zvládnutelné i pro začátečníka, pokud rozumí tomu, co výsledný kód dělá.',
    running: 'Soubory stačí nahrát na jakýkoli webový hosting. Údržba se omezí na občasnou aktualizaci závislostí.',
  },
  {
    id: 'baas',
    name: 'Webová aplikace s hotovou serverovou službou',
    description: 'Rozhraní běží v prohlížeči; přihlašování a databázi obstarává hotová služba (například Firebase nebo Supabase). Vlastní server se neprogramuje.',
    can: ['Účty, synchronizace mezi zařízeními, sdílení i sběr dat bez vlastního serveru.', 'Rychlý začátek; malým projektům stačí bezplatný tarif.'],
    cannot: ['Data leží u komerčního poskytovatele a řídí se jeho podmínkami.', 'Aplikace je svázaná s jedním poskytovatelem a jeho ceníkem.', 'Bez připojení funguje jen s další prací navíc.'],
    underestimated: [
      'Pravidla, kdo smí která data číst a měnit, se nastavují ručně. Chyba v nich znamená databázi čitelnou pro kohokoli.',
      'Osobní údaje u poskytovatele vyžadují smlouvu o zpracování a ověření, ve které zemi data leží.',
      'Přechod k jinému poskytovateli znamená přepsat část aplikace a přenést účty uživatelů.',
    ],
    facts: [FACTS.supabasePause, FACTS.firebaseSpark],
    tech: [
      { name: 'JavaScript nebo TypeScript a knihovna poskytovatele', note: 'Rozhraní se píše jako u aplikace bez serveru; ke službě se připojuje hotovou knihovnou.' },
      { name: 'Relační databáze (Supabase – PostgreSQL)', note: 'Data mají pevnou strukturu a lze je vyexportovat standardním způsobem.' },
      { name: 'Dokumentová databáze (Firebase – Firestore)', note: 'Snadný začátek, ale struktura dat i dotazy jsou specifické pro poskytovatele.' },
    ],
    skills: 'Tvorba webu, základy databází a nastavení přístupových práv.',
    running: 'O servery se stará poskytovatel. Na vás zůstávají pravidla přístupu, zálohy a hlídání limitů tarifu.',
  },
  {
    id: 'server',
    name: 'Webová aplikace s vlastním serverem a databází',
    description: 'Rozhraní v prohlížeči komunikuje s programem na serveru, který ukládá data do databáze. Server si provozujete sami nebo ho poskytne škola.',
    can: ['Účty, sdílení, sběr dat, upozornění i tajné klíče.', 'Plná kontrola nad tím, kde data leží a kdo k nim má přístup.', 'Může běžet na infrastruktuře školy.'],
    cannot: ['Neobejde se bez člověka, který server provozuje po celou dobu života aplikace.', 'Bez připojení funguje jen s další prací navíc.'],
    underestimated: [
      'Bezpečnostní aktualizace nekončí obhajobou. Neudržovaný server s osobními údaji je riziko pro uživatele i pro školu.',
      'Záloha, kterou nikdo nezkusil obnovit, není záloha.',
      'Provoz serveru vždy někdo platí: vy, pracoviště, nebo poskytovatel bezplatného tarifu, který ho může kdykoli omezit.',
    ],
    facts: [FACTS.herokuEnd, FACTS.renderSleep],
    tech: [
      { name: 'Python (Django, Flask, FastAPI)', note: 'Rozšířený ve výuce a ve vědě, snadno se k němu hledá pomoc.' },
      { name: 'JavaScript nebo TypeScript (Node.js)', note: 'Jeden jazyk pro prohlížeč i server.' },
      { name: 'PHP', note: 'Běží na většině levných hostingů a často i na webových serverech škol.' },
      { name: 'Databáze: PostgreSQL, MariaDB, SQLite', note: 'SQLite stačí malým aplikacím a zálohuje se zkopírováním jednoho souboru.' },
    ],
    skills: 'Programování na serveru, databáze, zabezpečení a nasazení. Pro úplného začátečníka nejnáročnější varianta.',
    running: 'Průběžné aktualizace systému a knihoven, zálohy, sledování dostupnosti, obnova po výpadku.',
  },
  {
    id: 'native',
    name: 'Mobilní aplikace do obchodů',
    description: 'Aplikace instalovaná z App Store nebo Google Play. Píše se zvlášť pro každou platformu, nebo jednou v multiplatformním nástroji. Má-li sdílet data, potřebuje navíc server.',
    can: ['Přístup k senzorům, zdravotním datům telefonu a zařízením přes Bluetooth.', 'Upozornění naplánovaná v telefonu, bez serveru.', 'Uživatelé ji najdou v obchodě.'],
    cannot: ['Nedostane se k uživatelům bez schválení obchodem.', 'Neběží na počítači; pro něj je potřeba webová verze.'],
    underestimated: [
      'Dvě platformy znamenají dva vývojářské účty, dvojí schvalování a dvojí testování.',
      'Schvalování může aplikaci vrátit. Počítejte s rezervou před termínem odevzdání.',
      'Obchody vyžadují průběžné aktualizace pro nové verze systémů; aplikaci, která se neaktualizuje, mohou přestat nabízet.',
    ],
    facts: [FACTS.appleFee, FACTS.googleFee, FACTS.googleTesting],
    tech: [
      { name: 'Swift (iPhone) a Kotlin (Android)', note: 'Dva oddělené kódy; nejlepší přístup k funkcím systému.' },
      { name: 'Flutter (Dart) nebo React Native (JavaScript, TypeScript)', note: 'Jeden kód pro obě platformy. Verzi pro iPhone lze sestavit jen na počítači Mac nebo v placené sestavovací službě.' },
      { name: 'Webová aplikace zabalená do nativní (Capacitor)', note: 'Nejkratší cesta z webu do obchodu. Obchody mohou odmítnout aplikaci, která je jen obalem webové stránky.' },
    ],
    skills: 'Mobilní vývoj, práce s vývojářskými účty a schvalovacím procesem obchodů.',
    running: 'Aktualizace pro nové verze systémů, obnova členství, reakce na požadavky obchodů; případně provoz serveru.',
  },
  {
    id: 'nocode',
    name: 'Hotový nástroj bez programování',
    description: 'Vlastní aplikace někdy není potřeba. Dotazníkový systém, e-learningový kurz, sdílená tabulka nebo nástroj pro tvorbu aplikací bez kódu udělají totéž dřív a s menším rizikem.',
    can: ['Sběr odpovědí, kurzy a jednoduché evidence hotové během dnů.', 'Provoz a zabezpečení řeší dodavatel nástroje nebo škola.'],
    cannot: ['Nabízí jen vzhled a logiku, které nástroj umožňuje.', 'Přínosem práce pak není software, ale obsah a metodika.'],
    underestimated: [
      'Školní licence a účet končí se studiem. Data a formuláře je potřeba včas vyexportovat nebo předat.',
      'U bezplatných verzí komerčních nástrojů ověřte, kde leží data a zda je smíte použít pro výzkum.',
    ],
    facts: [],
    tech: [
      { name: 'Dotazníkové systémy (LimeSurvey, REDCap, Microsoft Forms)', note: 'Vhodné pro sběr dat. Zeptejte se, které z nich škola provozuje.' },
      { name: 'E-learning (Moodle)', note: 'Vhodný pro kurzy a testy; bývá součástí školních systémů.' },
      { name: 'Nástroje pro tvorbu aplikací bez kódu', note: 'Rychlý prototyp. Aplikaci obvykle nejde přenést jinam a cena roste s počtem uživatelů.' },
    ],
    skills: 'Práce s daným nástrojem; žádné programování.',
    running: 'Podle nástroje: u školního se stará škola, u vlastního účtu vy.',
  },
];

// ---- Možnosti nasazení --------------------------------------------------------------

export type DeployId = 'repo' | 'school' | 'einfra' | 'cloud-free' | 'paid' | 'stores' | 'tool' | 'download' | 'archive';

/** Otázky, na které má každá možnost odpověď – aby šly možnosti porovnat. */
export const CONSEQUENCE_LABELS = {
  cost: 'Kolik to stojí teď',
  later: 'Co bude za tři roky',
  after: 'Kdo se stará po absolvování',
  data: 'Osobní údaje',
  address: 'Čí je adresa',
  exit: 'Jak těžké je odejít',
} as const;

export type ConsequenceKey = keyof typeof CONSEQUENCE_LABELS;

export interface DeployOption {
  id: DeployId;
  name: string;
  examples: string;
  description: string;
  /** Typy řešení, pro které možnost připadá v úvahu. */
  suits: SolutionId[];
  /** main = místo provozu; extra = jen doplněk k němu (archiv); both = obojí (soubor ke stažení). */
  role: 'main' | 'both' | 'extra';
  consequences: Record<ConsequenceKey, string>;
  underestimated: string[];
  facts: Fact[];
  /** Otázky pro školu, které s možností souvisejí. */
  ask: string[];
}

export const DEPLOY_OPTIONS: DeployOption[] = [
  {
    id: 'repo',
    name: 'Hosting z repozitáře kódu',
    examples: 'GitHub Pages, GitLab Pages, Cloudflare Pages',
    description: 'Služba, která z repozitáře s kódem zveřejní hotové soubory aplikace. Server, na kterém by běžel váš program nebo databáze, k dispozici není.',
    suits: ['static'],
    role: 'main',
    consequences: {
      cost: 'Zdarma.',
      later: 'Podmínky určuje poskytovatel a může je změnit. Soubory aplikace lze ale během hodiny přenést jinam.',
      after: 'Aplikace běží dál bez zásahu. Účet a repozitář jsou osobní: když o ně přijdete nebo je smažete, aplikace zmizí.',
      data: 'Na serveru žádná data uživatelů nejsou, hosting jen rozdává soubory. Poskytovatel přitom vidí technické údaje o návštěvách.',
      address: 'Adresa patří k vašemu účtu (například jmeno.github.io/nazev). Vlastní doména je možná, ale platí se zvlášť a každý rok se obnovuje.',
      exit: 'Snadné, soubory lze nahrát kamkoli. Změní se ale adresa, pokud nemáte vlastní doménu.',
    },
    underestimated: [
      'Adresa uvedená v práci je vázaná na osobní účet. Po přejmenování účtu nebo repozitáře odkaz přestane platit.',
      'V bezplatném tarifu GitHubu musí být repozitář veřejný, kód tedy uvidí kdokoli.',
      'Není to místo pro přihlašování ani pro platby.',
    ],
    facts: [
      fact('GitHub Pages je v bezplatném tarifu dostupné jen pro veřejné repozitáře. Zveřejněný web je veřejný vždy, i kdyby byl repozitář soukromý.', 'GitHub Docs: Creating a GitHub Pages site', 'https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site'),
      fact('Web na GitHub Pages smí mít nejvýše 1 GB a měkký limit přenosu je 100 GB za měsíc.', 'GitHub Docs: GitHub Pages limits', 'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits'),
      fact('GitHub Pages není určeno k provozu internetového obchodu ani komerční služby a nemá se používat pro citlivé operace, jako je posílání hesel nebo čísel karet.', 'GitHub Docs: GitHub Pages limits', 'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits'),
      fact('GitLab Pages je součástí bezplatné úrovně GitLabu, a to i u instalací, které si provozují instituce samy. Zda je zapnuté na GitLabu vaší školy, řekne její správce.', 'GitLab Docs: GitLab Pages', 'https://docs.gitlab.com/user/project/pages/'),
      fact('Cloudflare Pages dovoluje v bezplatném tarifu 500 sestavení za měsíc.', 'Cloudflare Docs: Pages – Limits', 'https://developers.cloudflare.com/pages/platform/limits/'),
    ],
    ask: ['q-thesis', 'q-licence', 'q-domain'],
  },
  {
    id: 'school',
    name: 'Web nebo server školy',
    examples: 'fakultní web, server katedry, univerzitní GitLab',
    description: 'Aplikace běží na technice školy a na její adrese. Zda a za jakých podmínek to jde, určuje škola; proto je potřeba se ptát dřív, než začnete stavět.',
    suits: ['static', 'server'],
    role: 'main',
    consequences: {
      cost: 'Pro vás obvykle zdarma; náklady nese pracoviště.',
      later: 'Záleží na tom, zda má aplikace garanta mezi zaměstnanci. Bez něj ji správci při nejbližší revizi vypnou.',
      after: 'Někdo ze zaměstnanců, pokud se na tom předem domluvíte. Vy po ukončení studia obvykle ztratíte přístup.',
      data: 'Škola má pověřence pro ochranu osobních údajů a vlastní pravidla. Pro osobní údaje bývá nejsnáze obhajitelným místem.',
      address: 'Adresa školy. Působí důvěryhodně, ale o jejím přidělení i zrušení rozhoduje škola.',
      exit: 'Kód si odnesete; adresa a data zůstávají škole.',
    },
    underestimated: [
      'Školy často nemají postup pro provoz studentských aplikací. Vyřízení může trvat týdny až měsíce.',
      'Správci mohou předepsat technologii (například PHP a MySQL) nebo bezpečnostní kontrolu před zveřejněním.',
      'Na aplikaci na adrese školy se mohou vztahovat pravidla jednotného vzhledu a přístupnosti.',
    ],
    facts: [
      fact(
        'Zákon o přístupnosti internetových stránek a mobilních aplikací se na vysoké školy vztahuje v rozsahu obsahu, který musí zveřejňovat podle jiného právního předpisu. Zda se týká vaší aplikace, posoudí škola.',
        'Zákon č. 99/2019 Sb., o přístupnosti internetových stránek a mobilních aplikací',
        'https://www.zakonyprolidi.cz/cs/2019-99',
      ),
    ],
    ask: ['q-hosting', 'q-guarantor', 'q-domain', 'q-security', 'q-access'],
  },
  {
    id: 'einfra',
    name: 'Národní akademická infrastruktura',
    examples: 'e-INFRA CZ: cloud MetaCentra, kontejnerová platforma CERIT-SC',
    description: 'Výpočetní a cloudové služby, které pro akademickou obec provozují CESNET, CERIT-SC a IT4Innovations. Lze na nich spustit vlastní server nebo kontejner.',
    suits: ['server'],
    role: 'main',
    consequences: {
      cost: 'Zdarma pro akademické uživatele.',
      later: 'Účet se prodlužuje každý rok a je vázaný na příslušnost k akademické instituci.',
      after: 'S koncem studia nárok na účet zaniká. Službu musí převzít někdo, kdo ho má – obvykle vedoucí nebo výzkumná skupina.',
      data: 'Infrastruktura leží v Česku a provozují ji akademické instituce. Pro citlivá data má zvláštní prostředí; podmínky ověřte u provozovatele.',
      address: 'Adresa infrastruktury, případně vlastní doména.',
      exit: 'Aplikaci v kontejneru lze přenést k jinému poskytovateli; vyžaduje to znalost správy serverů.',
    },
    underestimated: [
      'Je určena pro výzkum a vzdělávání, ne jako trvalý veřejný hosting, a běží bez záruky dostupnosti.',
      'Server nebo kontejner si spravujete sami, včetně aktualizací a zabezpečení.',
      'V publikacích, které se o infrastrukturu opírají, je povinné poděkování.',
    ],
    facts: [
      fact('Účet v MetaCentru mohou získat zaměstnanci a studenti českých akademických institucí. Služby jsou poskytovány zdarma, bez záruky dostupnosti, a smějí se používat jen k účelům souvisejícím s vědou, výzkumem a vzděláváním.', 'MetaCentrum: Pravidla využívání', 'https://www.metacentrum.cz/en/about/rules/'),
      fact('Účet je potřeba každoročně prodloužit; platnost končí vždy 2. února.', 'CERIT-SC Docs: How to get access', 'https://docs.cerit-sc.cz/en/docs/platform/access'),
    ],
    ask: ['q-guarantor', 'q-hosting'],
  },
  {
    id: 'cloud-free',
    name: 'Komerční cloud v bezplatném tarifu',
    examples: 'Render, Vercel, Netlify, Supabase, Firebase',
    description: 'Služby, které nabízejí provoz aplikací a databází zdarma do určitého limitu. Bezplatný tarif slouží hlavně k vyzkoušení služby.',
    suits: ['static', 'baas', 'server'],
    role: 'main',
    consequences: {
      cost: 'Zdarma v mezích tarifu.',
      later: 'Nejméně předvídatelná položka: poskytovatel může tarif omezit nebo zrušit se lhůtou v řádu měsíců.',
      after: 'Vy osobně. Účet je vázaný na váš e-mail; je-li školní, přijdete o něj s koncem studia.',
      data: 'Data leží u komerčního poskytovatele, často mimo EU. Pro osobní údaje je potřeba smlouva o zpracování a souhlas školy; u citlivých údajů se tato cesta obhajuje těžko.',
      address: 'Adresa poskytovatele (například nazev.onrender.com); vlastní doména podle podmínek služby.',
      exit: 'U souborů snadné. U databáze a přihlašování pracné: data je potřeba vyexportovat a část kódu přepsat.',
    },
    underestimated: [
      'Podmínky bezplatného tarifu se projeví až po obhajobě, kdy aplikaci nikdo nepoužívá: služba se uspí, pozastaví nebo smaže.',
      'Zrušení tarifu znamená buď začít platit, nebo aplikaci v krátké lhůtě přestěhovat.',
      'Bezplatný tarif bývá určen pro osobní projekty; použití ve výzkumu nebo ve výuce ověřte v podmínkách.',
    ],
    facts: [FACTS.renderSleep, FACTS.supabasePause, FACTS.vercelHobby, FACTS.firebaseSpark, FACTS.herokuEnd],
    ask: ['q-gdpr', 'q-costs', 'q-account'],
  },
  {
    id: 'paid',
    name: 'Placený hosting nebo cloud',
    examples: 'webhosting, virtuální server, placený tarif cloudu',
    description: 'Provoz u poskytovatele, kterému se platí měsíčně nebo ročně. Lze zvolit poskytovatele s datovým centrem v EU.',
    suits: ['static', 'baas', 'server'],
    role: 'main',
    consequences: {
      cost: 'Platí se měsíčně nebo ročně podle typu služby; aktuální cenu ověřte u poskytovatele.',
      later: 'Předvídatelné, dokud někdo platí. Neuhrazená služba se vypne a data se po čase smažou.',
      after: 'Ten, kdo platí a má přístup. Bez dohody o předání to zůstane na vás.',
      data: 'Lze vybrat poskytovatele v EU a uzavřít s ním smlouvu o zpracování. Správcem údajů zůstává ten, kdo aplikaci provozuje.',
      address: 'Vlastní doména. Zůstane stejná i při změně poskytovatele, ale musí se každý rok obnovit.',
      exit: 'Středně těžké: běžné technologie (PHP, PostgreSQL, kontejnery) lze přenést k jinému poskytovateli.',
    },
    underestimated: [
      'Platbu z osobní karty po obhajobě nikdo neproplatí, pokud to není domluveno předem.',
      'U virtuálního serveru odpovídáte za aktualizace a zabezpečení celého systému.',
      'Propadlou doménu může získat někdo jiný; odkaz v práci pak vede na cizí obsah.',
    ],
    facts: [],
    ask: ['q-costs', 'q-guarantor', 'q-gdpr'],
  },
  {
    id: 'stores',
    name: 'Obchody s aplikacemi',
    examples: 'App Store, Google Play',
    description: 'Jediná běžná cesta, jak dostat mobilní aplikaci k uživatelům. Každý obchod má vlastní poplatky, pravidla a schvalování.',
    suits: ['native'],
    role: 'main',
    consequences: {
      cost: 'Apple 99 USD ročně, Google jednorázově 25 USD.',
      later: 'Členství u Applu se platí každý rok, po celou dobu, kdy má být aplikace v obchodě. Obě platformy vyžadují průběžné aktualizace.',
      after: 'Vývojářský účet je osobní, nebo patří organizaci. U osobního zůstává vše na vás; převod aplikace na jiný účet je možný, ale musí se vyřídit.',
      data: 'Obchod vyžaduje popis zpracování údajů a zásady ochrany soukromí. Kde data leží, určuje server, který aplikace používá.',
      address: 'Stránka aplikace v obchodě.',
      exit: 'Odejít není kam; obchod je podmínkou přístupu k uživatelům dané platformy.',
    },
    underestimated: [
      'Nový osobní účet v Google Play musí před zveřejněním sehnat nejméně 12 testerů na 14 dnů.',
      'Schvalování může aplikaci vrátit. Počítejte s rezervou před termínem odevzdání.',
      'Pro zveřejnění v App Store je potřeba počítač Mac nebo placená sestavovací služba.',
    ],
    facts: [FACTS.appleFee, FACTS.googleFee, FACTS.googleTesting],
    ask: ['q-costs', 'q-guarantor'],
  },
  {
    id: 'tool',
    name: 'Provoz u poskytovatele hotového nástroje',
    examples: 'dotazníkový systém nebo e-learning školy, účet u dodavatele nástroje',
    description: 'Řešení bez programování běží tam, kde běží zvolený nástroj: ve škole, nebo u jeho dodavatele.',
    suits: ['nocode'],
    role: 'main',
    consequences: {
      cost: 'V rámci školní licence zdarma; u komerčních nástrojů podle tarifu.',
      later: 'Licence školy i ceník dodavatele se mohou změnit.',
      after: 'U školního nástroje jeho správce, u vlastního účtu vy.',
      data: 'U nástroje provozovaného školou platí její pravidla. U komerční služby ověřte, kde data leží a zda je smíte použít pro výzkum.',
      address: 'Adresa nástroje.',
      exit: 'Podle toho, co nástroj umí vyexportovat. Ověřte to před začátkem.',
    },
    underestimated: ['Školní účet končí se studiem a s ním i přístup k formulářům a nasbíraným datům.', 'Bezplatné verze mívají limit počtu odpovědí nebo uživatelů.'],
    facts: [],
    ask: ['q-account', 'q-gdpr', 'q-hosting'],
  },
  {
    id: 'download',
    name: 'Soubor ke stažení',
    examples: 'archiv ZIP s aplikací, která běží z disku; instalátor',
    description: 'Aplikace se nepřipojuje k žádnému serveru; uživatel si ji stáhne a spustí u sebe. Hodí se jako příloha práce a jako pojistka vedle běžící kopie.',
    suits: ['static'],
    role: 'both',
    consequences: {
      cost: 'Zdarma.',
      later: 'Nic se nemění. Soubor funguje, dokud existuje prohlížeč nebo systém, pro který vznikl.',
      after: 'Nikdo nemusí.',
      data: 'Vše zůstává u uživatele.',
      address: 'Žádná; soubor se šíří odkazem na úložiště nebo jako příloha.',
      exit: 'Není odkud odcházet.',
    },
    underestimated: ['Bez adresy se aplikace hůř šíří a uživatelé nedostanou opravy.', 'Webová aplikace otevřená přímo ze souboru má v prohlížeči omezení. Je potřeba ji na to připravit a vyzkoušet.'],
    facts: [],
    ask: ['q-thesis'],
  },
  {
    id: 'archive',
    name: 'Archiv s trvalým identifikátorem',
    examples: 'Zenodo, Software Heritage',
    description: 'Archiv aplikaci neprovozuje. Uchová její zdrojový kód a sestavenou verzi a přidělí jim trvalý identifikátor, který lze citovat v práci.',
    suits: ['static', 'baas', 'server', 'native'],
    role: 'extra',
    consequences: {
      cost: 'Zdarma.',
      later: 'Záznam zůstává. Nová verze dostane vlastní identifikátor, starší verze jsou dál dostupné.',
      after: 'Nikdo nemusí.',
      data: 'Archivuje se kód, ne data uživatelů. Hesla, klíče ani osobní údaje do archivu nepatří.',
      address: 'Trvalý identifikátor (DOI nebo SWHID), nezávislý na vašem účtu.',
      exit: 'Není potřeba; archiv je doplněk k místu provozu.',
    },
    underestimated: ['Zveřejnění v archivu je trvalé. Licenci a obsah si rozmyslete předem.', 'Archiv uchová stav k danému dni. Neřeší, že aplikace přestane fungovat v nových prohlížečích nebo systémech.'],
    facts: [
      fact('Zenodo uchovává záznamy po dobu existence repozitáře, tedy po dobu existence laboratoře CERN, jejíž program je stanoven nejméně na dalších 20 let.', 'Zenodo: General Policies', 'https://about.zenodo.org/policies/'),
      fact('Jeden záznam v Zenodu smí mít nejvýše 50 GB. Každá verze dostane vlastní DOI a všechny verze spojuje jedno společné.', 'Zenodo Help: What are the size limitations of Zenodo?', 'https://support.zenodo.org/help/en-gb/1-upload-deposit/80-what-are-the-size-limitations-of-zenodo'),
      fact('Software Heritage archivuje veřejné repozitáře včetně celé historie; uložení lze vyžádat formulářem Save Code Now bez registrace a každé verzi kódu náleží trvalý identifikátor SWHID.', 'Software Heritage: How to archive and reference your code', 'https://www.softwareheritage.org/howto-archive-and-reference-your-code/'),
    ],
    ask: ['q-thesis', 'q-licence'],
  },
];

// ---- Otázky pro školu ------------------------------------------------------------------

export interface SchoolQuestion {
  id: string;
  group: 'Provoz' | 'Práva a odevzdání' | 'Osobní údaje a etika';
  question: string;
  why: string;
  fact?: Fact;
}

export const SCHOOL_QUESTIONS: SchoolQuestion[] = [
  { id: 'q-hosting', group: 'Provoz', question: 'Nabízí škola nebo fakulta místo pro provoz studentských aplikací? Za jakých podmínek a na jak dlouho?', why: 'Od odpovědi se odvíjí, jaký typ řešení má smysl stavět. Vyřízení může trvat týdny.' },
  { id: 'q-guarantor', group: 'Provoz', question: 'Kdo ze zaměstnanců bude za aplikaci odpovídat po mém odchodu?', why: 'Aplikace bez garanta se při nejbližší revizi vypne, nebo běží bez dozoru i s daty uživatelů.' },
  { id: 'q-domain', group: 'Provoz', question: 'Může aplikace běžet na adrese školy? Kdo to schvaluje?', why: 'Adresa školy přežije váš osobní účet, ale rozhoduje o ní škola.' },
  { id: 'q-account', group: 'Provoz', question: 'Co se stane s mým školním účtem a se službami na něj navázanými po ukončení studia?', why: 'Se školním e-mailem obvykle zaniká přístup ke všemu, co je na něj registrováno, včetně studentských výhod u poskytovatelů.' },
  { id: 'q-costs', group: 'Provoz', question: 'Může provoz zaplatit katedra nebo projekt? Z čeho se bude platit po jeho skončení?', why: 'Placené služby se vypnou, jakmile je nikdo neplatí.' },
  { id: 'q-security', group: 'Provoz', question: 'Vyžaduje škola před zveřejněním aplikace bezpečnostní posouzení nebo schválení správci?', why: 'Na adrese a technice školy to bývá podmínkou a zabere to čas.' },
  {
    id: 'q-access',
    group: 'Provoz',
    question: 'Vztahují se na aplikaci pravidla přístupnosti a jednotného vzhledu školy?',
    why: 'Dodatečné úpravy přístupnosti jsou dražší než její dodržení od začátku.',
  },
  { id: 'q-licence', group: 'Práva a odevzdání', question: 'Jak škola nakládá s právy ke školnímu dílu? Mohu kód zveřejnit pod otevřenou licencí?', why: 'Bez vyjasnění práv nejde aplikaci bezpečně zveřejnit ani předat někomu k dalšímu rozvoji.', fact: FACTS.schoolWork },
  { id: 'q-thesis', group: 'Práva a odevzdání', question: 'Jak se aplikace odevzdává jako součást závěrečné práce (příloha, odkaz, archiv)?', why: 'Odkaz na živou adresu nemusí za rok fungovat; oponent i archiv školy potřebují stálou podobu.' },
  { id: 'q-ai', group: 'Práva a odevzdání', question: 'Jaká pravidla má škola pro použití nástrojů AI při tvorbě kódu a textu práce?', why: 'Školy obvykle vyžadují, aby bylo použití AI v práci uvedeno; způsob se liší.' },
  { id: 'q-gdpr', group: 'Osobní údaje a etika', question: 'Kdo je správcem osobních údajů, které aplikace zpracuje? Co k tomu požaduje pověřenec školy?', why: 'Správce odpovídá za zákonnost zpracování. Student sám jím být obvykle nemá.', fact: FACTS.gdprController },
  { id: 'q-ethics', group: 'Osobní údaje a etika', question: 'Je potřeba souhlas etické komise?', why: 'Sběr dat od lidí pro výzkum ho často vyžaduje a nelze ho získat zpětně.' },
  { id: 'q-medical', group: 'Osobní údaje a etika', question: 'Kdo posoudí, zda aplikace není zdravotnickým prostředkem?', why: 'Rozhoduje určený účel aplikace. Pokud jím je, platí pro uvedení do provozu zvláštní pravidla.', fact: FACTS.mdr },
];

/** Všechny datované údaje katalogu (pro kontrolu úplnosti a pro seznam zdrojů). */
export function allFacts(): Fact[] {
  const out = new Map<string, Fact>();
  const add = (f: Fact) => out.set(f.text, f);
  Object.values(FACTS).forEach(add);
  SOLUTION_TYPES.forEach((s) => s.facts.forEach(add));
  DEPLOY_OPTIONS.forEach((d) => d.facts.forEach(add));
  SCHOOL_QUESTIONS.forEach((q) => q.fact && add(q.fact));
  return [...out.values()];
}
