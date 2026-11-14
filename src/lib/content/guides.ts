// Výukové texty ke krokům: k čemu krok slouží, jak postupovat, čeho se vyvarovat,
// co udělá aplikace a co musí udělat člověk.

import type { ReviewType, StepId } from '../types';

export interface Guide {
  goal: string;
  why: string;
  how: string[];
  mistakes: string[];
  /** Co v tomto kroku udělá aplikace. */
  app: string;
  /** Co je na člověku. */
  you: string;
  /** Doplněk pro konkrétní typ přehledu. */
  byType?: Partial<Record<ReviewType, string>>;
  refs: { label: string; url: string }[];
}

const COCHRANE = 'https://training.cochrane.org/handbook/current';
const JBI = 'https://jbi-global-wiki.refined.site/space/MANUAL';

export const GUIDES: Record<StepId, Guide> = {
  question: {
    goal: 'Zformulovat otázku tak přesně, aby z ní šla odvodit kritéria výběru i vyhledávací dotaz.',
    why: 'Otázka řídí všechny další kroky. Vágní otázka vede k tisícům nerelevantních záznamů a ke kritériím, podle kterých se nedá rozhodovat.',
    how: [
      'Rozložte otázku na prvky rámce a každý popište konkrétně (kdo, co, s čím, jaký výstup).',
      'Ověřte, že přehled na stejnou otázku už neexistuje: PROSPERO, Cochrane Library, Epistemonikos, Google Scholar.',
      'Sepište cíl přehledu jednou až dvěma větami.',
      'Zapište, proč je přehled potřeba – tím začne úvod práce.',
    ],
    mistakes: [
      'Příliš široká otázka nebo několik otázek najednou.',
      'Otázka formulovaná jako závěr („prokázat, že…“).',
      'Dodatečná úprava otázky podle toho, co se našlo.',
    ],
    app: 'Nabídne rámec podle typu přehledu a z prvků sestaví návrh znění otázky.',
    you: 'Otázku formulujete vy. Ideálně ji proberte s vedoucím práce dřív, než začnete hledat.',
    byType: {
      narrative: 'U narativního přehledu stačí vymezit téma a jeho hranice. I tak pomůže, když si téma rozdělíte na dílčí okruhy.',
      scoping: 'Mapovací přehled používá rámec PCC (populace, koncept, kontext). Otázka je širší a ptá se „co o tématu víme a jak se zkoumá“, ne „zda to funguje“.',
      umbrella: 'PICO se tu vztahuje k systematickým přehledům: hledáte přehledy, které zkoumají danou populaci, intervenci a výstupy.',
    },
    refs: [
      { label: 'Cochrane Handbook, kap. 2: Determining the scope of the review', url: `${COCHRANE}/chapter-02` },
      { label: 'JBI Manual for Evidence Synthesis', url: JBI },
    ],
  },
  protocol: {
    goal: 'Předem určit pravidla: co zařadíte, co vyřadíte a kde budete hledat.',
    why: 'Pravidla stanovená předem brání tomu, abyste je – třeba i nevědomky – přizpůsobili výsledkům. Proto se protokol zveřejňuje dřív, než začne třídění.',
    how: [
      'Kritéria zařazení odvoďte z prvků otázky; každé musí jít ověřit z textu studie.',
      'Ke kritériím vyřazení připravte krátké důvody v pevném pořadí – použijete je při posuzování plných textů.',
      'Určete designy studií, jazyky a období a každé omezení zdůvodněte.',
      'Vyberte alespoň dvě až tři databáze důležité pro váš obor a doplňkové zdroje (seznamy literatury, šedá literatura).',
      'Rozhodněte, kdo bude třídit: dva nezávislí hodnotitelé jsou standardem systematického přehledu; při jednom hodnotiteli to uveďte mezi omezeními.',
      'Protokol zaregistrujte nebo ho aspoň nechte schválit vedoucím práce a uložte s datem.',
    ],
    mistakes: [
      'Omezení jazyka nebo let bez zdůvodnění.',
      'Kritérium, které se z článku nedá zjistit.',
      'Změna kritérií v průběhu práce bez záznamu a vysvětlení.',
    ],
    app: 'Uloží kritéria, nabídne důvody vyřazení, nastaví třídění jedním nebo dvěma hodnotiteli a vyexportuje protokol jako dokument.',
    you: 'Kritéria stanovujete vy. Registraci (PROSPERO, OSF) provádíte sami na stránkách registru.',
    byType: {
      narrative: 'Protokol není povinný, ale krátký plán hledání a výběru zvyšuje důvěryhodnost přehledu a hodnotí ho i škála SANRA.',
      scoping: 'Protokol mapovacího přehledu se zveřejňuje na OSF; PROSPERO je nepřijímá.',
      umbrella: 'V kritériích definujte, co považujete za systematický přehled (např. popsaná rešerše alespoň ve dvou databázích a hodnocení kvality studií).',
    },
    refs: [
      { label: 'PRISMA-P: položky protokolu systematického přehledu', url: 'https://doi.org/10.1186/2046-4053-4-1' },
      { label: 'PROSPERO – registr protokolů', url: 'https://www.crd.york.ac.uk/prospero/' },
      { label: 'OSF Registries', url: 'https://osf.io/registries' },
    ],
  },
  search: {
    goal: 'Najít pokud možno všechny relevantní studie a postup zapsat tak, aby šel zopakovat.',
    why: 'Přehled je jen tak dobrý, jak dobré je hledání. Co nenajdete, nemůžete zařadit; co nezapíšete, nemůže nikdo ověřit.',
    how: [
      'Pro každý prvek otázky vytvořte blok synonym. Uvnitř bloku se termíny spojují OR, bloky mezi sebou AND.',
      'Kombinujte volný text (název a abstrakt) s řízeným slovníkem databáze (MeSH v PubMedu, tezaurus v ERIC).',
      'Použijte hvězdičku pro různé koncovky (adolescen*) a uvozovky pro přesné fráze.',
      'Výstupy (O) do dotazu obvykle nedávejte – bývají v abstraktech popsány nejednotně a hledání by studie minulo.',
      'V každé databázi zapište datum, přesný dotaz a počet výsledků. Aplikace to u přímého hledání dělá sama.',
      'Z databází bez otevřeného rozhraní (Scopus, Web of Science, SPORTDiscus) výsledky exportujte ve formátu RIS a nahrajte je sem.',
      'Doplňte hledání o seznamy literatury zařazených studií.',
    ],
    mistakes: [
      'Hledání v jediné databázi.',
      'Příliš mnoho bloků spojených AND – dotaz pak relevantní studie mine.',
      'Zapomenuté pravopisné varianty (behaviour/behavior) a synonyma.',
      'Nezapsaný dotaz nebo datum hledání.',
    ],
    app: 'Sestaví dotaz v zápisu každé databáze, prohledá PubMed, Europe PMC a ERIC, načte soubory z ostatních databází a vede deník hledání.',
    you: 'Termíny a synonyma volíte vy; pomůže knihovník. Scopus, Web of Science a EBSCO prohledáte přes školní přístup a výsledky nahrajete.',
    byType: {
      narrative: 'Hledání nemusí být vyčerpávající, ale má být popsané: kde, kdy a jakými výrazy jste hledali.',
      umbrella: 'Hledáte systematické přehledy. V PubMedu pomůže filtr typu publikace (systematic review[pt]), dále Cochrane Library a Epistemonikos.',
    },
    refs: [
      { label: 'PRISMA-S: jak popsat vyhledávání', url: 'https://doi.org/10.1186/s13643-020-01542-z' },
      { label: 'Cochrane Handbook, kap. 4: Searching for and selecting studies', url: `${COCHRANE}/chapter-04` },
      { label: 'PRESS: kontrola vyhledávací strategie', url: 'https://doi.org/10.1016/j.jclinepi.2016.01.021' },
    ],
  },
  dedup: {
    goal: 'Odstranit záznamy nalezené ve více databázích, aby se neposuzovaly dvakrát.',
    why: 'Databáze se překrývají. Počet odstraněných duplicit se uvádí ve vývojovém diagramu.',
    how: [
      'Nejprve hromadně slučte jisté shody (stejné DOI, PMID nebo shodný název).',
      'Pravděpodobné shody projděte jednu po druhé a rozhodněte.',
      'Při sloučení se ponechá úplnější záznam a doplní se do něj chybějící údaje.',
    ],
    mistakes: [
      'Sloučení různých publikací: konferenční abstrakt a pozdější článek, oprava (erratum), preprint a publikovaná verze.',
      'Sloučení různých článků se stejným krátkým názvem („Editorial“).',
    ],
    app: 'Najde jisté a pravděpodobné duplicity a na pokyn je sloučí.',
    you: 'U pravděpodobných shod rozhodujete vy.',
    refs: [{ label: 'Bramer et al. (2016): De-duplication of database search results', url: 'https://doi.org/10.3163/1536-5050.104.3.014' }],
  },
  screen1: {
    goal: 'Podle názvu a abstraktu vyřadit zjevně nerelevantní záznamy.',
    why: 'Většina nalezených záznamů otázce neodpovídá. První třídění šetří čas: plné texty se pak hledají jen pro nadějné záznamy.',
    how: [
      'Rozhodujte jen podle kritérií z protokolu.',
      'Při pochybnosti zvolte „Možná“ – rozhodne plný text. Chybně vyřazenou studii už nikdo nenajde.',
      'Důvody vyřazení se v této fázi neuvádějí.',
      'Nejdřív si kritéria vyzkoušejte na 20–50 záznamech a případné nejasnosti upřesněte.',
      'Standardem jsou dva nezávislí hodnotitelé (zapíná se v kroku Protokol): každý třídí sám, pak společně vyřeší neshody a v textu uvedou míru shody. Pokud třídíte sami, nechte vzorek ověřit vedoucím a uveďte to mezi omezeními.',
    ],
    mistakes: [
      'Vyřazování podle výsledků nebo kvality studie.',
      'Vyřazení záznamu jen proto, že nemá abstrakt.',
      'Třídění stovek záznamů bez přestávky – s únavou roste chybovost.',
    ],
    app: 'Ukazuje záznamy jeden po druhém, zvýrazňuje vámi zvolená slova a počítá postup. Při dvou hodnotitelích vede rozhodnutí každého zvlášť, počítá Cohenovo κ a sestaví seznam neshod.',
    you: 'O každém záznamu rozhodujete vy; neshody řešíte dohodou, ne hlasováním aplikace.',
    byType: {
      narrative: 'U narativního přehledu jde o jediný krok výběru: označte zdroje, které v přehledu použijete.',
    },
    refs: [
      { label: 'Cochrane Handbook, kap. 4.6: Selecting studies', url: `${COCHRANE}/chapter-04#section-4-6` },
      { label: 'Landis a Koch (1977): výklad hodnot kappa', url: 'https://doi.org/10.2307/2529310' },
    ],
  },
  screen2: {
    goal: 'Podle plného textu definitivně rozhodnout o zařazení a u vyřazených uvést důvod.',
    why: 'Abstrakt často neobsahuje vše potřebné. Důvody vyřazení plných textů se uvádějí ve vývojovém diagramu a v příloze.',
    how: [
      'Opatřete plné texty: školní knihovna, otevřený přístup, meziknihovní služba, případně e-mail autorovi.',
      'Text, který se nepodařilo získat, označte „Nezískán“ – v diagramu má vlastní kolonku.',
      'U každého vyřazeného textu uveďte právě jeden důvod: první nesplněné kritérium v pořadí z protokolu.',
      'Více publikací téže studie zařaďte jako jednu studii.',
      'Při dvou hodnotitelích posuzuje každý sám; společně pak vyřešíte rozdílná rozhodnutí i rozdílné důvody vyřazení.',
    ],
    mistakes: [
      'Nejednotné důvody vyřazení nebo několik důvodů najednou.',
      'Vyřazení studie kvůli nepříznivému výsledku.',
      'Opomenuté nezískané texty.',
    ],
    app: 'Vede seznam textů k posouzení, uloží přiložené PDF a sčítá důvody vyřazení. Při dvou hodnotitelích ukáže neshody a spočítá míru shody.',
    you: 'Plné texty sháníte, čtete a posuzujete vy.',
    refs: [{ label: 'PRISMA 2020, položka 16', url: 'https://doi.org/10.1136/bmj.n71' }],
  },
  extract: {
    goal: 'Vypsat ze všech zařazených studií stejným způsobem údaje potřebné k odpovědi na otázku.',
    why: 'Jednotný formulář zajistí, že se studie dají porovnat a že nic podstatného nechybí.',
    how: [
      'Pole formuláře určete předem a vyzkoušejte je na dvou až třech studiích.',
      'Opisujte, neinterpretujte. U čísel si poznamenejte, odkud jsou (tabulka, strana).',
      'Chybějící údaj označte „neuvedeno“; nedomýšlejte ho.',
      'Pro metaanalýzu potřebujete u každé skupiny průměr, směrodatnou odchylku a počet, nebo počet událostí a počet účastníků.',
      'Uvádí-li studie tentýž výstup vícekrát (více časových bodů, podskupin, intervenčních ramen), zapište každý efekt zvlášť a pojmenujte ho. Předem si určete, které efekty vás zajímají.',
      'U síťové metaanalýzy zapište ke každému efektu názvy obou srovnávaných léčeb – ve všech studiích stejně.',
    ],
    mistakes: [
      'Záměna směrodatné odchylky (SD) a směrodatné chyby (SE). Platí SD = SE × √n.',
      'Prohozené skupiny nebo obrácený směr škály.',
      'Dvojí započtení téže studie popsané ve více článcích.',
      'Výběr jednoho z více výsledků studie podle toho, který vyšel „lépe“.',
      'U studie se třemi rameny dvojí započtení kontrolní skupiny, jako by šlo o dvě nezávislé studie.',
    ],
    app: 'Nabídne formulář podle typu přehledu, který si upravíte, z vyplněných údajů sestaví tabulku charakteristik a z čísel hned spočítá velikost účinku – i pro více efektů z jedné studie.',
    you: 'Údaje ze studií vypisujete a kontrolujete vy.',
    byType: {
      scoping: 'U mapovacího přehledu se tomuto kroku říká „mapování dat“ (data charting). Pole typu kategorie se pak použijí pro četnosti.',
      umbrella: 'Jednotkou je systematický přehled. Zapište i seznam jeho primárních studií – z něj se počítá překryv.',
    },
    refs: [{ label: 'Cochrane Handbook, kap. 5: Collecting data', url: `${COCHRANE}/chapter-05` }],
  },
  quality: {
    goal: 'Posoudit, nakolik lze výsledkům každé studie věřit.',
    why: 'Závěr přehledu stojí na studiích, ze kterých vychází. Studie s vysokým rizikem zkreslení mohou účinek systematicky nadhodnocovat.',
    how: [
      'Nástroj vyberte podle designu studií.',
      'Hodnoťte po doménách podle návodu nástroje, ne celkovým dojmem.',
      'Hodnotí se provedení studie, ne úroveň časopisu ani velikost souboru.',
      'Ke každému úsudku si do poznámky zapište krátké zdůvodnění.',
      'S výsledkem hodnocení pracujte při interpretaci – tabulka sama nestačí.',
    ],
    mistakes: [
      'Sčítání položek do celkového skóre – nástroje s ním nepočítají.',
      'Zaměnění kvality zprávy (co je napsáno) s kvalitou provedení (co se stalo).',
      'Vyřazení studií kvůli kvalitě bez pravidla stanoveného v protokolu.',
    ],
    app: 'Nabídne domény zvoleného nástroje, navrhne celkové hodnocení podle jeho pravidel a sestaví přehlednou tabulku.',
    you: 'Úsudek v každé doméně je na vás; pracujte s úplným zněním nástroje.',
    byType: {
      scoping: 'Mapovací přehled kvalitu obvykle nehodnotí. Pokud ji hodnotíte, zdůvodněte to.',
      umbrella: 'Hodnotíte kvalitu systematických přehledů (AMSTAR 2 nebo ROBIS), ne primárních studií.',
    },
    refs: [
      { label: 'Cochrane Handbook, kap. 7 a 8: riziko zkreslení', url: `${COCHRANE}/chapter-07` },
      { label: 'Nástroje RoB 2 a ROBINS-I', url: 'https://www.riskofbias.info/' },
    ],
  },
  synthesis: {
    goal: 'Spojit výsledky studií do odpovědi na otázku přehledu.',
    why: 'Výčet studií není syntéza. Syntéza hledá, co studie říkají dohromady, kde se shodují a proč se liší.',
    how: [
      'Začněte tabulkou charakteristik zařazených studií.',
      'Studie seskupte podle hlediska určeného předem (výstup, typ intervence, populace).',
      'U každé skupiny shrňte směr, velikost a konzistenci zjištění a přihlédněte ke kvalitě studií.',
    ],
    mistakes: [
      'Počítání „hlasů“ podle statistické významnosti (kolik studií vyšlo významně).',
      'Slučování studií, které měří něco jiného.',
      'Přehlížení rozdílů mezi studiemi.',
    ],
    app: 'Podle typu přehledu spočítá četnosti, metaanalýzu s grafy (včetně více efektů na studii, metaregrese a sítě léčeb) nebo překryv přehledů a uloží vaše shrnutí témat.',
    you: 'Rozhodujete, co lze spojovat, a výsledky interpretujete.',
    byType: {
      narrative: 'Uspořádejte zdroje do témat a ke každému napište, co z literatury vyplývá a kde se autoři rozcházejí.',
      scoping: 'Výsledkem je mapa: kolik a jakého výzkumu existuje (podle let, zemí, designů, témat) a kde jsou mezery. Účinnost se nehodnotí.',
      systematic: 'Bez metaanalýzy popište výsledky po výstupech strukturovaně podle doporučení SWiM: jak jste studie seskupili a jakou míru použili.',
      meta:
        'Slučujte jen studie dostatečně podobné populací, intervencí i měřením. Výchozí je model s náhodnými efekty. Vedle I² sledujte predikční interval a u malého počtu studií interpretujte opatrně. Má-li studie více efektů, nepočítejte je jako nezávislé (sloučení nebo tříúrovňový model). Metaregresi a analýzu podskupin plánujte předem a berte je jako zdroj hypotéz. Síťová metaanalýza navíc předpokládá, že studie různých srovnání jsou si podobné (tranzitivita) a že přímé a nepřímé důkazy souhlasí (konzistence).',
      umbrella: 'Výsledky přehledů znovu neslučujte – jejich studie se překrývají. Shrňte závěry, porovnejte je a vyčíslete překryv primárních studií (CCA).',
    },
    refs: [
      { label: 'Cochrane Handbook, kap. 10: Analysing data and undertaking meta-analyses', url: `${COCHRANE}/chapter-10` },
      { label: 'SWiM: syntéza bez metaanalýzy', url: 'https://doi.org/10.1136/bmj.l6890' },
      { label: 'Pieper et al. (2014): překryv v přehledech přehledů', url: 'https://doi.org/10.1016/j.jclinepi.2013.11.007' },
      { label: 'Cochrane Handbook, kap. 11: síťová metaanalýza', url: `${COCHRANE}/chapter-11` },
      { label: 'Cheung (2014): tříúrovňová metaanalýza závislých efektů', url: 'https://doi.org/10.1037/a0032968' },
      { label: 'Rücker a Schwarzer (2015): pořadí léčeb podle P-skóre', url: 'https://doi.org/10.1186/s12874-015-0060-8' },
    ],
  },
  flow: {
    goal: 'Ukázat cestu záznamů přehledem od nalezení po zařazení.',
    why: 'Diagram umožňuje čtenáři jedním pohledem posoudit, kolik záznamů bylo nalezeno, vyřazeno a proč.',
    how: [
      'Počty vycházejí z vašich rozhodnutí v předchozích krocích – diagram se nepíše ručně.',
      'Zkontrolujte, že nezbývají neposouzené záznamy.',
      'Diagram patří na začátek výsledků.',
    ],
    mistakes: ['Počty, které na sebe nenavazují.', 'Chybějící důvody vyřazení plných textů.'],
    app: 'Spočítá všechny počty, nakreslí diagram a upozorní na nedokončené třídění.',
    you: 'Zkontrolujete, že čísla odpovídají skutečnosti, a diagram vložíte do práce.',
    refs: [{ label: 'Vývojový diagram PRISMA 2020', url: 'https://www.prisma-statement.org/prisma-2020-flow-diagram' }],
  },
  write: {
    goal: 'Sestavit text: metodiku a výsledky z dat, úvod, diskusi a závěr vlastními slovy.',
    why: 'Metodika má popsat přesně to, co jste udělali. Proto ji aplikace skládá z vašich záznamů, a ne z paměti.',
    how: [
      'Vygenerované oddíly přečtěte a upravte – odpovídáte za každou větu.',
      'Úvod: co se o tématu ví, co chybí a proč je přehled potřeba; končí cílem.',
      'Diskuse: hlavní zjištění, srovnání s literaturou, silné stránky a omezení, důsledky pro praxi a výzkum.',
      'O tom, co jste udělali, pište v minulém čase.',
      'Uveďte použití této aplikace a případných nástrojů umělé inteligence podle pravidel vaší školy.',
    ],
    mistakes: ['Výsledky v diskusi a hodnocení ve výsledcích.', 'Závěry, které jdou dál než data.', 'Chybějící omezení přehledu.'],
    app: 'Vygeneruje metodiku, výsledky, tabulky, obrázky a seznam literatury a vyexportuje dokument Word.',
    you: 'Úvod, diskusi a závěr píšete vy. Vygenerovaný text zkontrolujete a přeformulujete.',
    refs: [{ label: 'PRISMA 2020: vysvětlení a příklady', url: 'https://doi.org/10.1136/bmj.n160' }],
  },
  checklist: {
    goal: 'Ověřit, že text obsahuje vše, co standard pro daný typ přehledu vyžaduje.',
    why: 'Kontrolní seznam je to, podle čeho budou práci číst oponenti a recenzenti.',
    how: [
      'Projděte seznam položku po položce a u každé zapište, kde v textu je.',
      'Co chybí, doplňte, nebo v textu vysvětlete, proč to nebylo možné.',
      'Vyplněný seznam přiložte k práci jako přílohu.',
    ],
    mistakes: ['Odškrtnutí položky, která v textu ve skutečnosti není.'],
    app: 'Nabídne seznam podle typu přehledu a ukáže, který krok k položce dodává podklady.',
    you: 'Kontrolu textu provádíte vy.',
    refs: [{ label: 'EQUATOR Network: knihovna standardů', url: 'https://www.equator-network.org/' }],
  },
};
