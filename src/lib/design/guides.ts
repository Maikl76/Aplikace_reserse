// Výukové texty ke krokům průvodce návrhem aplikace.

import type { Guide } from '../content/guides';
import type { DesignStepId } from '../types';

const GOVUK = { label: 'GOV.UK Service Manual', url: 'https://www.gov.uk/service-manual' };

export const DESIGN_GUIDES: Record<DesignStepId, Guide> = {
  'd-intent': {
    goal: 'Popsat, jaký problém aplikace řeší, pro koho a jak dlouho má sloužit.',
    why: 'Záměr rozhoduje o všem dalším. Aplikace, která má sloužit jen do obhajoby, se staví a provozuje jinak než aplikace, kterou mají lidé používat roky.',
    how: [
      'Popište problém slovy toho, kdo ho má, ne řešením („studenti nevědí, co cvičit doma“, ne „chybí aplikace“).',
      'Určete cílovou skupinu tak konkrétně, abyste věděli, koho se zeptat.',
      'Zapište, podle čeho poznáte, že aplikace plní účel.',
      'Rozhodněte, jak dlouho má běžet a kdo se o ni postará, až projekt skončí.',
    ],
    mistakes: ['Začít řešením místo problémem.', 'Cílová skupina „všichni“.', 'Nepočítat s tím, co bude po obhajobě.'],
    app: 'Zapíše záměr a použije ho v dalších krocích: podle doby provozu a zkušeností upozorní na rizika jednotlivých možností.',
    you: 'Záměr formulujete vy, nejlépe po rozhovoru s někým z cílové skupiny a s vedoucím.',
    refs: [GOVUK, { label: 'GOV.UK: Learning about users and their needs', url: 'https://www.gov.uk/service-manual/user-research/start-by-learning-user-needs' }],
  },
  'd-reqs': {
    goal: 'Sepsat, co má aplikace umět, jak je to důležité a o co se každý požadavek opírá.',
    why: 'Požadavky určují rozsah práce. Bez priorit se staví to nejzajímavější místo toho nejdůležitějšího; bez zdroje se nedá říct, proč v aplikaci něco je.',
    how: [
      'Pište každý požadavek jako jednu větu o tom, co uživatel s aplikací dokáže.',
      'Rozdělte je na „musí“, „měla by“ a „mohla by“. Povinných má být málo.',
      'U každého uveďte zdroj: zadání, rozhovor s uživateli, norma, literatura, odborný úsudek, nebo zatím jen předpoklad.',
      'Předpoklady ověřte u budoucích uživatelů dřív, než je začnete stavět.',
    ],
    mistakes: ['Všechno má prioritu „musí“.', 'Požadavek popisuje technické řešení místo potřeby („databáze uživatelů“ místo „uživatel uvidí svůj postup“).', 'Vlastní domněnka vydávaná za potřebu uživatelů.'],
    app: 'Eviduje požadavky, jejich prioritu a zdroj a ve výstupu přizná, na čem každý stojí.',
    you: 'Požadavky i jejich zdroje zapisujete vy. Tento návrh se neopírá o rešerši; pokud ji chcete, proveďte ji v této aplikaci jako samostatný přehled.',
    refs: [{ label: 'GOV.UK: Writing user stories', url: 'https://www.gov.uk/service-manual/agile-delivery/writing-user-stories' }, GOVUK],
  },
  'd-profile': {
    goal: 'Odpovědět na otázky, které rozhodují o tom, jak složitá a nákladná aplikace bude.',
    why: 'Několik vlastností – přihlašování, sdílení dat, sběr dat, upozornění – rozhoduje o tom, zda aplikace potřebuje server. A server je to, co po obhajobě někdo musí provozovat a platit.',
    how: [
      'Odpovídejte podle požadavků s prioritou „musí“, ne podle toho, co by bylo hezké mít.',
      'U každé odpovědi „ano“ si přečtěte, co z ní plyne.',
      'Pokud vyjde, že je potřeba server, zvažte, zda se bez dané vlastnosti první verze obejde.',
    ],
    mistakes: ['Přihlašování „pro jistotu“.', 'Sběr dat od uživatelů bez rozmyšlení, kdo za ně odpovídá.', 'Podcenění osobních a zdravotních údajů.'],
    app: 'Z odpovědí odvodí, zda aplikace potřebuje server nebo obchod s aplikacemi, a upozorní na osobní údaje a zdravotnický účel.',
    you: 'Odpovědi jsou vaše rozhodnutí o rozsahu. Aplikace neříká, co je správně; ukazuje, co každá volba stojí.',
    refs: [
      { label: 'MDN: Progressive web apps', url: 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps' },
      { label: 'MDN: Storage quotas and eviction criteria', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria' },
      { label: 'Nařízení (EU) 2016/679 (GDPR)', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
    ],
  },
  'd-solution': {
    goal: 'Vybrat typ řešení s vědomím toho, co umí, co neumí a co obnáší jeho provoz.',
    why: 'Typ řešení určuje, kde může aplikace běžet, kolik stojí a kdo ji musí udržovat. Změnit ho uprostřed stavby znamená začít skoro znovu.',
    how: [
      'Projděte všechny typy včetně těch, které jste nezvažovali – i možnost aplikaci vůbec neprogramovat.',
      'U typů označených „nevyhovuje“ si přečtěte důvod. Někdy je snazší vzdát se jedné vlastnosti než stavět složitější řešení.',
      'Zvolte typ a vlastními slovy zapište proč. Zdůvodnění se objeví ve výstupu.',
      'Technologie vyberte až potom, podle toho, co umíte vy a kdo bude aplikaci udržovat.',
    ],
    mistakes: ['Volba podle technologie, která je zrovna v módě.', 'Nejsložitější typ „pro budoucí rozšíření“.', 'Přehlédnutí hotového nástroje, který by stačil.'],
    app: 'Ukáže u každého typu, zda odpovídá vlastnostem aplikace a proč, a vypíše, co se u něj často podcení.',
    you: 'Volba je na vás. Vhodnost je odvozena z technických souvislostí, ne z výzkumu; je to vodítko, ne doporučení.',
    refs: [
      { label: 'The Twelve-Factor App', url: 'https://12factor.net/' },
      { label: 'OWASP Top Ten', url: 'https://owasp.org/www-project-top-ten/' },
      { label: 'MDN: Progressive web apps', url: 'https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps' },
    ],
  },
  'd-deploy': {
    goal: 'Rozhodnout, kde aplikace poběží, a znát důsledky té volby pro dobu po obhajobě.',
    why: 'O místě provozu se rozhoduje před stavbou, ne po ní. Hotová aplikace, pro kterou se nenajde místo ani správce, po obhajobě zanikne a odkaz v práci přestane fungovat.',
    how: [
      'Porovnejte možnosti podle stejných otázek: cena teď, cena za tři roky, kdo se stará po absolvování, osobní údaje, čí je adresa, jak těžké je odejít.',
      'U každé možnosti si přečtěte, co se často podcení, a údaje se zdrojem a datem ověření.',
      'Zvolte místo provozu a zvažte doplněk: archiv s trvalým identifikátorem nebo soubor ke stažení.',
      'Zapište, proč jste se tak rozhodli.',
    ],
    mistakes: ['Bezplatný tarif komerční služby jako trvalé řešení.', 'Vše na osobním účtu bez plánu předání.', 'Osobní údaje u poskytovatele bez smlouvy a bez vědomí školy.'],
    app: 'Předloží možnosti s důsledky, označí ty, které neodpovídají zvolenému typu řešení a vlastnostem, a u měnících se údajů uvede zdroj a datum ověření.',
    you: 'Rozhodujete vy. Údaje o cenách a podmínkách se mění; před rozhodnutím je ověřte u zdroje.',
    refs: [
      { label: 'Zenodo', url: 'https://zenodo.org/' },
      { label: 'Software Heritage: Save Code Now', url: 'https://archive.softwareheritage.org/save/' },
      { label: 'e-INFRA CZ', url: 'https://www.e-infra.cz/' },
    ],
  },
  'd-rules': {
    goal: 'Zjistit od školy to, co nelze vyčíst z žádného návodu, a vyjasnit práva, osobní údaje a předání.',
    why: 'Pravidla pro provoz studentských aplikací se mezi školami liší a často nejsou sepsaná. Odpovědi zabírají týdny, proto se na ně ptá dřív, než se začne stavět.',
    how: [
      'Projděte otázky a položte je vedoucímu, správcům IT a pověřenci pro ochranu osobních údajů.',
      'Zapište odpověď i s tím, kdo a kdy ji dal.',
      'Dohodněte licenci a způsob odevzdání aplikace jako součásti práce.',
      'Sepište, co se s aplikací stane po obhajobě: kdo ji převezme, nebo kdy se vypne.',
    ],
    mistakes: ['Ptát se až s hotovou aplikací.', 'Spoléhat na ústní příslib bez jména a data.', 'Předpokládat, že osobní údaje „to nejsou“.'],
    app: 'Vybere otázky, které se týkají vašeho návrhu, uchová odpovědi a nezodpovězené uvede ve výstupu jako otevřené body.',
    you: 'Odpovědi musíte získat vy. Aplikace neví, jak to chodí na vaší škole.',
    refs: [
      { label: 'Choose a License', url: 'https://choosealicense.com/' },
      { label: 'Úřad pro ochranu osobních údajů', url: 'https://uoou.gov.cz/' },
      { label: 'Zákon č. 121/2000 Sb., autorský zákon', url: 'https://www.zakonyprolidi.cz/cs/2000-121' },
    ],
  },
  'd-plan': {
    goal: 'Rozvrhnout stavbu do etap, z nichž každá má jasné kritérium hotovosti.',
    why: 'Etapy chrání před dvěma častými konci: aplikací, která má spoustu funkcí, ale nikde neběží, a aplikací, která běží, ale nikdo ji nepřevzal.',
    how: [
      'Projděte etapy v uvedeném pořadí; nasazení na cílové místo patří na začátek, ne na konec.',
      'U každé etapy si přečtěte, podle čeho se pozná, že je hotová.',
      'Průběh si poznamenávejte; poznámky se objeví ve výstupu.',
    ],
    mistakes: ['Nasazení až na konci.', 'Zkouška s uživateli vynechaná pro nedostatek času.', 'Žádné předání.'],
    app: 'Sestaví etapy podle zvoleného typu řešení, místa provozu a vlastností aplikace.',
    you: 'Plán je obecný postup, ne návod krok za krokem pro vaši konkrétní aplikaci. Podrobnosti doplní ten, kdo bude stavět.',
    refs: [
      { label: 'GOV.UK: How the alpha phase works', url: 'https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works' },
      { label: 'W3C: Web Content Accessibility Guidelines', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/' },
    ],
  },
  'd-output': {
    goal: 'Získat dokument s návrhem a stručné zadání pro toho, kdo bude aplikaci stavět.',
    why: 'Sepsaný návrh se dá probrat s vedoucím, předat vývojáři a po letech z něj zjistit, proč aplikace vypadá tak, jak vypadá.',
    how: [
      'Projděte otevřené body a doplňte, co jde.',
      'Stáhněte dokument a proberte ho s vedoucím.',
      'Zadání zkopírujte a předejte tomu, kdo bude stavět – člověku nebo nástroji AI.',
    ],
    mistakes: ['Předat zadání s nevyřešenými otevřenými body, aniž by o nich druhá strana věděla.', 'Považovat zadání za hotový návod; je to výchozí bod pro rozhovor.'],
    app: 'Sestaví dokument z vašich rozhodnutí, uvede zdroj každého požadavku, zdroje údajů s datem ověření a seznam otevřených bodů.',
    you: 'Za obsah návrhu odpovídáte vy. Pokud zadání předáte nástroji AI, výsledek zkontrolujte a jeho použití uveďte podle pravidel školy.',
    refs: [GOVUK, { label: 'Choose a License', url: 'https://choosealicense.com/' }],
  },
};
