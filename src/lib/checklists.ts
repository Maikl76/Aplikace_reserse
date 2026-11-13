// Kontrolní seznamy pro psaní zprávy. Položky jsou stručně převyprávěny česky;
// závazné je vždy původní znění standardu (odkaz u každého seznamu).

import type { ReviewType, StepId } from './types';

export interface CheckItem {
  id: string;
  no: string;
  section: string;
  text: string;
  /** Krok aplikace, ve kterém podklady pro položku vznikají. */
  step?: StepId;
  optional?: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  citation: string;
  url: string;
  note: string;
  items: CheckItem[];
}

const it = (no: string, section: string, text: string, step?: StepId, optional?: boolean): CheckItem => ({ id: `i${no}`, no, section, text, step, optional });

const PRISMA_2020: Checklist = {
  id: 'prisma2020',
  name: 'PRISMA 2020',
  citation: 'Page et al. (2021). The PRISMA 2020 statement. BMJ, 372, n71.',
  url: 'https://doi.org/10.1136/bmj.n71',
  note: '27 položek pro zprávu o systematickém přehledu. Položky 13d–f, 14, 15 a 20–22 se u přehledu bez metaanalýzy vyplní podle použité syntézy.',
  items: [
    it('1', 'Název', 'Z názvu je zřejmé, že jde o systematický přehled.', 'write'),
    it('2', 'Abstrakt', 'Strukturovaný abstrakt podle seznamu PRISMA 2020 pro abstrakty.', 'write'),
    it('3', 'Úvod', 'Zdůvodnění přehledu v kontextu dosavadních poznatků.', 'question'),
    it('4', 'Úvod', 'Výslovně uvedené cíle nebo otázky přehledu.', 'question'),
    it('5', 'Metody', 'Kritéria zařazení a vyřazení a způsob seskupení studií pro syntézu.', 'protocol'),
    it('6', 'Metody', 'Všechny prohledané zdroje (databáze, registry, weby, seznamy literatury) a datum posledního hledání.', 'search'),
    it('7', 'Metody', 'Úplné vyhledávací strategie pro všechny zdroje včetně filtrů a omezení.', 'search'),
    it('8', 'Metody', 'Postup výběru studií: kolik osob třídilo, zda nezávisle, případné automatizační nástroje.', 'screen1'),
    it('9', 'Metody', 'Postup sběru dat: kolik osob extrahovalo, zda nezávisle, ověřování u autorů, nástroje.', 'extract'),
    it('10a', 'Metody', 'Seznam a definice výstupů, pro které se sbírala data, a pravidla výběru výsledků.', 'extract'),
    it('10b', 'Metody', 'Ostatní sbírané proměnné (charakteristiky účastníků, intervencí, financování) a předpoklady u chybějících údajů.', 'extract'),
    it('11', 'Metody', 'Hodnocení rizika zkreslení studií: nástroj, počet hodnotitelů, nezávislost.', 'quality'),
    it('12', 'Metody', 'Míra účinku použitá pro každý výstup (např. relativní riziko, rozdíl průměrů).', 'synthesis'),
    it('13a', 'Metody', 'Jak se rozhodovalo, které studie vstoupí do které syntézy.', 'synthesis'),
    it('13b', 'Metody', 'Příprava dat pro syntézu (dopočty chybějících statistik, převody).', 'synthesis'),
    it('13c', 'Metody', 'Způsob tabelace a grafického zobrazení výsledků studií a syntéz.', 'synthesis'),
    it('13d', 'Metody', 'Metody syntézy a jejich zdůvodnění; u metaanalýzy model, metoda odhadu heterogenity a software.', 'synthesis'),
    it('13e', 'Metody', 'Metody zkoumání příčin heterogenity (podskupiny, metaregrese).', 'synthesis'),
    it('13f', 'Metody', 'Citlivostní analýzy ověřující robustnost výsledků.', 'synthesis'),
    it('14', 'Metody', 'Hodnocení rizika zkreslení kvůli chybějícím výsledkům (publikační zkreslení).', 'synthesis'),
    it('15', 'Metody', 'Hodnocení jistoty důkazů pro jednotlivé výstupy (např. GRADE).', 'synthesis'),
    it('16a', 'Výsledky', 'Výsledky hledání a výběru – od počtu nalezených záznamů po počet zařazených studií, nejlépe vývojovým diagramem.', 'flow'),
    it('16b', 'Výsledky', 'Studie, které se zdály vyhovovat, ale byly vyřazeny, s důvodem vyřazení.', 'screen2'),
    it('17', 'Výsledky', 'Citace každé zařazené studie a její charakteristiky.', 'extract'),
    it('18', 'Výsledky', 'Hodnocení rizika zkreslení každé zařazené studie.', 'quality'),
    it('19', 'Výsledky', 'Pro každou studii a výstup: souhrnné statistiky skupin a odhad účinku s přesností (tabulka nebo graf).', 'synthesis'),
    it('20a', 'Výsledky', 'U každé syntézy stručně charakteristiky a riziko zkreslení přispívajících studií.', 'synthesis'),
    it('20b', 'Výsledky', 'Výsledky všech syntéz; u metaanalýzy souhrnný odhad, interval spolehlivosti a míry heterogenity.', 'synthesis'),
    it('20c', 'Výsledky', 'Výsledky zkoumání příčin heterogenity.', 'synthesis'),
    it('20d', 'Výsledky', 'Výsledky citlivostních analýz.', 'synthesis'),
    it('21', 'Výsledky', 'Hodnocení rizika zkreslení kvůli chybějícím výsledkům u každé syntézy.', 'synthesis'),
    it('22', 'Výsledky', 'Jistota důkazů pro každý hodnocený výstup.', 'synthesis'),
    it('23a', 'Diskuse', 'Obecná interpretace výsledků v kontextu dalších důkazů.', 'write'),
    it('23b', 'Diskuse', 'Omezení důkazů zařazených do přehledu.', 'write'),
    it('23c', 'Diskuse', 'Omezení samotného postupu přehledu.', 'write'),
    it('23d', 'Diskuse', 'Důsledky pro praxi, politiku a další výzkum.', 'write'),
    it('24a', 'Další údaje', 'Registrace přehledu (název registru a číslo), nebo uvedení, že registrován nebyl.', 'protocol'),
    it('24b', 'Další údaje', 'Kde je dostupný protokol, nebo uvedení, že nebyl připraven.', 'protocol'),
    it('24c', 'Další údaje', 'Popis a zdůvodnění změn oproti registraci nebo protokolu.', 'protocol'),
    it('25', 'Další údaje', 'Zdroje finanční i nefinanční podpory a role sponzorů.', 'write'),
    it('26', 'Další údaje', 'Střety zájmů autorů.', 'write'),
    it('27', 'Další údaje', 'Dostupnost dat, formulářů, analytického kódu a dalších materiálů.', 'write'),
  ],
};

const PRISMA_SCR: Checklist = {
  id: 'prisma-scr',
  name: 'PRISMA-ScR',
  citation: 'Tricco et al. (2018). PRISMA Extension for Scoping Reviews (PRISMA-ScR). Annals of Internal Medicine, 169(7), 467–473.',
  url: 'https://doi.org/10.7326/M18-0850',
  note: '22 položek pro zprávu o mapovacím přehledu; položky 12 a 16 (kritické hodnocení) jsou volitelné.',
  items: [
    it('1', 'Název', 'Z názvu je zřejmé, že jde o mapovací přehled.', 'write'),
    it('2', 'Abstrakt', 'Strukturované shrnutí: východiska, cíle, kritéria, zdroje, metody mapování, výsledky, závěry.', 'write'),
    it('3', 'Úvod', 'Zdůvodnění přehledu a toho, proč se otázka hodí pro mapovací přístup.', 'question'),
    it('4', 'Úvod', 'Výslovně uvedené otázky a cíle s odkazem na jejich klíčové prvky (populace, koncept, kontext).', 'question'),
    it('5', 'Metody', 'Zda existuje protokol, kde je dostupný, případně registrace.', 'protocol'),
    it('6', 'Metody', 'Charakteristiky zdrojů použité jako kritéria způsobilosti (roky, jazyk, typ publikace) se zdůvodněním.', 'protocol'),
    it('7', 'Metody', 'Všechny informační zdroje a datum posledního hledání.', 'search'),
    it('8', 'Metody', 'Úplná vyhledávací strategie alespoň pro jednu databázi včetně omezení, aby šla zopakovat.', 'search'),
    it('9', 'Metody', 'Postup výběru zdrojů (třídění a posouzení způsobilosti).', 'screen1'),
    it('10', 'Metody', 'Postup mapování dat (data charting): formulář, jeho ověření, počet osob, nezávislost.', 'extract'),
    it('11', 'Metody', 'Seznam a definice všech sbíraných proměnných a případná zjednodušení.', 'extract'),
    it('12', 'Metody', 'Pokud proběhlo: zdůvodnění a metody kritického hodnocení zařazených zdrojů.', 'quality', true),
    it('13', 'Metody', 'Způsob zpracování a shrnutí zmapovaných dat.', 'synthesis'),
    it('14', 'Výsledky', 'Počty zdrojů tříděných, posouzených a zařazených, s důvody vyřazení, nejlépe vývojovým diagramem.', 'flow'),
    it('15', 'Výsledky', 'Charakteristiky každého zařazeného zdroje s citací.', 'extract'),
    it('16', 'Výsledky', 'Pokud proběhlo: výsledky kritického hodnocení zařazených zdrojů.', 'quality', true),
    it('17', 'Výsledky', 'Pro každý zdroj relevantní zmapovaná data vztahující se k otázkám přehledu.', 'extract'),
    it('18', 'Výsledky', 'Shrnutí a prezentace výsledků mapování ve vztahu k otázkám a cílům.', 'synthesis'),
    it('19', 'Diskuse', 'Shrnutí hlavních výsledků (pojmy, témata, typy důkazů) a jejich význam pro cílové skupiny.', 'write'),
    it('20', 'Diskuse', 'Omezení postupu mapovacího přehledu.', 'write'),
    it('21', 'Diskuse', 'Obecná interpretace vzhledem k otázkám a cílům, důsledky a další kroky.', 'write'),
    it('22', 'Financování', 'Zdroje financování zařazených zdrojů i samotného přehledu a role sponzorů.', 'write'),
  ],
};

const PRIOR: Checklist = {
  id: 'prior',
  name: 'PRIOR',
  citation: 'Gates et al. (2022). Reporting guideline for overviews of reviews of healthcare interventions: PRIOR statement. BMJ, 378, e070849.',
  url: 'https://doi.org/10.1136/bmj-2022-070849',
  note: '27 položek pro zprávu o přehledu přehledů. „Doplňkové primární studie“ jsou studie zařazené nad rámec systematických přehledů.',
  items: [
    it('1', 'Název', 'Z názvu je zřejmé, že jde o přehled přehledů.', 'write'),
    it('2', 'Abstrakt', 'Úplné a přesné shrnutí účelu, metod a výsledků.', 'write'),
    it('3', 'Úvod', 'Zdůvodnění přehledu přehledů v kontextu dosavadních poznatků.', 'question'),
    it('4', 'Úvod', 'Výslovně uvedené cíle nebo otázky.', 'question'),
    it('5a', 'Metody', 'Kritéria zařazení a vyřazení; pokud byly zařazeny doplňkové primární studie, uvést to a zdůvodnit.', 'protocol'),
    it('5b', 'Metody', 'Definice „systematického přehledu“ použitá v kritériích zařazení.', 'protocol'),
    it('6', 'Metody', 'Všechny prohledané zdroje a datum posledního hledání v každém z nich.', 'search'),
    it('7', 'Metody', 'Úplné vyhledávací strategie pro všechny zdroje včetně filtrů a omezení.', 'search'),
    it('8a', 'Metody', 'Postup rozhodování, zda přehled (nebo doplňková studie) splňuje kritéria.', 'screen1'),
    it('8b', 'Metody', 'Jak byl při výběru zjišťován a řešen překryv přehledů v populacích, intervencích, srovnáních a výstupech.', 'screen2'),
    it('9a', 'Metody', 'Postup sběru dat ze zpráv.', 'extract'),
    it('9b', 'Metody', 'Jak byl zjišťován a řešen překryv primárních studií na úrovni srovnání a výstupu; metoda jeho znázornění či vyčíslení.', 'synthesis'),
    it('9c', 'Metody', 'Jak byly řešeny rozpory v datech mezi přehledy.', 'extract'),
    it('10', 'Metody', 'Seznam a definice všech sbíraných proměnných a výstupů; postup u chybějících údajů.', 'extract'),
    it('11a', 'Metody', 'Metody hodnocení rizika zkreslení nebo metodické kvality zařazených přehledů.', 'quality'),
    it('11b', 'Metody', 'Jak byla získána (z přehledů) nebo nově provedena hodnocení rizika zkreslení primárních studií.', 'quality'),
    it('11c', 'Metody', 'Metody hodnocení rizika zkreslení doplňkových primárních studií.', 'quality', true),
    it('12a', 'Metody', 'Metody shrnutí nebo syntézy výsledků a jejich zdůvodnění.', 'synthesis'),
    it('12b', 'Metody', 'Metody zkoumání příčin heterogenity výsledků.', 'synthesis'),
    it('12c', 'Metody', 'Citlivostní analýzy ověřující robustnost syntézy.', 'synthesis'),
    it('13', 'Metody', 'Jak bylo získáno nebo hodnoceno riziko zkreslení kvůli chybějícím výsledkům (publikační zkreslení).', 'synthesis'),
    it('14', 'Metody', 'Jak byla získána nebo hodnocena jistota důkazů pro výstupy.', 'synthesis'),
    it('15a', 'Výsledky', 'Výsledky hledání a výběru: počty tříděných, posouzených a zařazených, nejlépe vývojovým diagramem.', 'flow'),
    it('15b', 'Výsledky', 'Seznam studií, které se zdály vyhovovat, ale byly vyřazeny, s hlavním důvodem.', 'screen2'),
    it('16', 'Výsledky', 'Citace každého zařazeného přehledu (a doplňkové studie) a jeho charakteristiky.', 'extract'),
    it('17', 'Výsledky', 'Rozsah překryvu primárních studií mezi zařazenými přehledy.', 'synthesis'),
    it('18a', 'Výsledky', 'Hodnocení rizika zkreslení nebo metodické kvality každého zařazeného přehledu.', 'quality'),
    it('18b', 'Výsledky', 'Hodnocení rizika zkreslení primárních studií zařazených v přehledech (převzaté nebo nové).', 'quality'),
    it('18c', 'Výsledky', 'Hodnocení rizika zkreslení doplňkových primárních studií.', 'quality', true),
    it('19a', 'Výsledky', 'Pro všechny výstupy shrnutí důkazů z přehledů; u metaanalýz souhrnný odhad, přesnost a heterogenita.', 'synthesis'),
    it('19b', 'Výsledky', 'U metaanalýz výsledky zkoumání příčin heterogenity.', 'synthesis', true),
    it('19c', 'Výsledky', 'U metaanalýz výsledky citlivostních analýz.', 'synthesis', true),
    it('20', 'Výsledky', 'Hodnocení rizika zkreslení kvůli chybějícím studiím, analýzám nebo výsledkům.', 'synthesis'),
    it('21', 'Výsledky', 'Hodnocení jistoty důkazů pro každý výstup.', 'synthesis'),
    it('22a', 'Diskuse', 'Shrnutí hlavních zjištění včetně rozporů mezi zařazenými přehledy.', 'write'),
    it('22b', 'Diskuse', 'Obecná interpretace výsledků v kontextu dalších důkazů.', 'write'),
    it('22c', 'Diskuse', 'Omezení důkazů z přehledů a jejich primárních studií i omezení metod přehledu přehledů.', 'write'),
    it('22d', 'Diskuse', 'Důsledky pro praxi, politiku a další výzkum (přehledy i primární studie).', 'write'),
    it('23a', 'Další údaje', 'Registrace (registr a číslo), nebo uvedení, že přehled registrován nebyl.', 'protocol'),
    it('23b', 'Další údaje', 'Kde je dostupný protokol, nebo uvedení, že nebyl připraven.', 'protocol'),
    it('23c', 'Další údaje', 'Popis a zdůvodnění změn oproti registraci nebo protokolu a fáze, kdy k nim došlo.', 'protocol'),
    it('24', 'Další údaje', 'Zdroje finanční i nefinanční podpory a role sponzorů.', 'write'),
    it('25', 'Další údaje', 'Střety zájmů autorů.', 'write'),
    it('26a', 'Další údaje', 'Kontakt na korespondujícího autora.', 'write'),
    it('26b', 'Další údaje', 'Podíl jednotlivých autorů a garant přehledu.', 'write'),
    it('27', 'Další údaje', 'Dostupnost formulářů, sebraných dat, analytického kódu a dalších materiálů.', 'write'),
  ],
};

const SANRA: Checklist = {
  id: 'sanra',
  name: 'SANRA',
  citation: 'Baethge, Goldbeck-Wood & Mertens (2019). SANRA – a scale for the quality assessment of narrative review articles. Research Integrity and Peer Review, 4, 5.',
  url: 'https://doi.org/10.1186/s41073-019-0064-8',
  note: 'Šest položek kvality narativního přehledu. V originále se každá hodnotí 0–2 body; zde slouží jako kontrola, že text obsahuje vše podstatné.',
  items: [
    it('1', 'Úvod', 'Je zdůvodněno, proč je téma pro čtenáře důležité.', 'question'),
    it('2', 'Úvod', 'Jsou uvedeny konkrétní cíle nebo otázky přehledu.', 'question'),
    it('3', 'Metody', 'Je popsáno vyhledávání literatury: zdroje, hledané výrazy, kritéria výběru.', 'search'),
    it('4', 'Text', 'Klíčová tvrzení jsou doložena odkazy na literaturu.', 'write'),
    it('5', 'Text', 'Argumentace je vědecky podložená a přihlíží k síle důkazů (design studií).', 'synthesis'),
    it('6', 'Text', 'Relevantní výsledky jsou uvedeny přiměřeně – s konkrétními údaji, ne jen obecně.', 'synthesis'),
  ],
};

export const CHECKLISTS: Record<ReviewType, Checklist> = {
  narrative: SANRA,
  scoping: PRISMA_SCR,
  systematic: PRISMA_2020,
  meta: PRISMA_2020,
  umbrella: PRIOR,
};
