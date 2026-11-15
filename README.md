# Průvodce přehledem

Výuková webová aplikace, která krok za krokem provede tvorbou přehledové studie:
narativního, mapovacího (scoping), systematického a zastřešujícího (umbrella) přehledu
a systematického přehledu s metaanalýzou.

U každého kroku vysvětlí, k čemu slouží, jak postupovat a jakých chyb se vyvarovat,
a rozliší, co udělá aplikace a co musí udělat člověk. Z rozhodnutí a dat uživatele pak
sestaví podklad pro text – odborný článek, bakalářskou nebo diplomovou práci.

Druhý průvodce, [návrh aplikace](#návrh-aplikace), vede od záměru k rozhodnutí, jaký typ
řešení postavit, kde poběží a kdo se o ně postará po obhajobě. Oba průvodce lze použít
každý zvlášť.

Aplikace běží celá v prohlížeči. Nemá server ani uživatelské účty; data zůstávají
v počítači uživatele a ukládají se sama (viz [Kde jsou data](#kde-jsou-data)).

## Co aplikace umí

| Krok | Co udělá aplikace | Co dělá člověk |
|---|---|---|
| Výzkumná otázka | nabídne rámec PICO / PCC, navrhne znění | formuluje otázku a cíl |
| Protokol a kritéria | uloží kritéria, nastaví jednoho nebo dva hodnotitele, vyexportuje protokol | stanoví kritéria, registruje protokol |
| Vyhledávání | sestaví dotaz pro 7 databází, prohledá PubMed, Europe PMC a ERIC, načte RIS / NBIB / BibTeX / CSV, vede deník hledání | volí termíny, prohledá Scopus, WoS, EBSCO a nahraje výsledky |
| Duplicity | najde jisté a pravděpodobné duplicity, sloučí je | rozhodne sporné dvojice |
| Třídění podle abstraktu | zobrazuje záznamy, zvýrazňuje slova, počítá postup; při dvou hodnotitelích vede hlasy zvlášť, počítá Cohenovo κ a ukáže neshody | rozhoduje o každém záznamu, řeší neshody |
| Posouzení plných textů | eviduje stav, PDF a důvody vyřazení; neshody v rozhodnutí i v důvodu | shání a čte plné texty |
| Extrakce dat | nabídne upravitelný formulář, počítá velikosti účinku, i více efektů z jedné studie a srovnání léčeb pro síť | vypisuje údaje ze studií |
| Hodnocení kvality | RoB 2, ROBINS-I, AMSTAR 2, ROBIS, vlastní seznam; navrhne celkové hodnocení | hodnotí jednotlivé oblasti |
| Syntéza | metaanalýza, lesní a trychtýřový graf, podskupiny, citlivostní analýza, GRADE; závislé efekty (sloučení nebo tříúrovňový model); metaregrese; síťová metaanalýza; četnosti; překryv přehledů (CCA) | rozhoduje, co slučovat, a interpretuje |
| Vývojový diagram | nakreslí diagram PRISMA 2020 z počtů | zkontroluje |
| Text práce | vygeneruje metodiku, výsledky, tabulky, obrázky, literaturu a přílohy; export do Wordu | píše úvod, diskusi a závěr |
| Kontrolní seznam | PRISMA 2020, PRISMA-ScR, PRIOR nebo SANRA | ověří úplnost textu |

Typy přehledů sdílejí stejné jádro a liší se nastavením v `src/lib/reviewTypes.ts`:
které kroky jsou povinné, jaký rámec otázky a jaký standard platí.

### Pokročilé analýzy

- **Více efektů z jedné studie.** Studie může k výstupu přispět více efekty (časové body,
  podskupiny, ramena). Analýza je buď sloučí do jednoho efektu studie s předpokládanou
  korelací (Borenstein et al., 2009), nebo použije tříúrovňový model se dvěma složkami
  rozptylu (Cheung, 2014).
- **Metaregrese.** Číselné i kategoriální moderátory z extrakce, test moderátorů, podíl
  vysvětlené heterogenity (R²), bublinový graf, volitelně Knappova–Hartungova úprava.
- **Síťová metaanalýza.** Frekventistický kontrastní model s korektním zacházením se
  studiemi o třech a více ramenech; graf sítě, odhady oproti referenční léčbě, tabulka
  všech srovnání, pořadí podle P-skóre, rozklad Q na heterogenitu a nekonzistenci,
  srovnání přímých a nepřímých důkazů.

Aplikace obsahuje dva ukázkové projekty: metaanalýzu s metaregresí (vakcína BCG)
a síťovou metaanalýzu (intervence pro odvykání kouření).

### Dva hodnotitelé

Třídění dvěma nezávislými hodnotiteli se zapíná v kroku Protokol. Hodnotitelé mohou
pracovat střídavě na jednom počítači, nebo každý na svém: hlavní hodnotitel pošle druhému
„balíček“ (kopii projektu bez svých rozhodnutí), ten ho načte, roztřídí a vrátí soubor se
svými rozhodnutími. Aplikace spočítá shodu a Cohenovo κ, ukáže neshody k vyřešení a vše
popíše v metodice a výsledcích.

## Návrh aplikace

Průvodce pro toho, kdo chce v rámci práce nebo projektu postavit aplikaci. Vznikl proto,
že o místě provozu se obvykle rozhoduje až s hotovou aplikací – a ta pak nemá kde běžet
ani kdo by se o ni staral. Průvodce nic nedoporučuje: předkládá možnosti s důsledky
a rozhodnutí i jeho zdůvodnění nechává na člověku.

| Krok | Co udělá aplikace | Co dělá člověk |
|---|---|---|
| Záměr | zapíše problém, uživatele a okolnosti | určí, jak dlouho má aplikace běžet a kdo se o ni postará |
| Požadavky | eviduje prioritu a zdroj každého požadavku | píše požadavky a uvádí, o co se opírají |
| Vlastnosti aplikace | z 13 odpovědí odvodí, zda je potřeba server nebo obchod s aplikacemi, a upozorní na osobní údaje a zdravotnický účel | odpovídá a rozhoduje o rozsahu |
| Typ řešení | u pěti typů ukáže, zda odpovídají vlastnostem, co umějí, neumějí a co se u nich podcení | volí typ a technologie, zapíše proč |
| Nasazení | u devíti možností odpoví na stejné otázky (cena teď a za tři roky, kdo se stará po absolvování, osobní údaje, adresa, odchod) a uvede údaje se zdrojem a datem ověření | volí místo provozu a doplňky, zapíše proč |
| Škola a pravidla | vybere otázky pro vedoucího, správce IT a pověřence | získá odpovědi; dohodne licenci a předání |
| Plán etap | sestaví etapy s kritériem hotovosti podle zvolených možností | plní a zapisuje průběh |
| Výstup | dokument s návrhem (Word, Markdown), zadání pro vývojáře nebo nástroj AI, seznam otevřených bodů | probere s vedoucím, předá |

Na čem průvodce stojí:

- **Vhodnost možností** je odvozena z technických souvislostí (bez serveru nelze sdílet
  data, obchody přijímají jen aplikace pro danou platformu). Není to výsledek výzkumu
  a průvodce to tak ani nepodává.
- **Údaje, které se mění** – ceny, limity, podmínky poskytovatelů, znění předpisů – jsou
  v katalogu (`src/lib/design/catalog.ts`) zapsány se zdrojem a datem ověření a tak se
  i zobrazují. Při úpravě katalogu je potřeba údaj ověřit u zdroje a datum aktualizovat;
  test hlídá, že žádný údaj není bez zdroje.
- **Požadavky v samostatném návrhu nejsou podložené rešerší.** U každého je proto uveden
  zdroj (zadání, uživatelé, norma, literatura, odborný úsudek, předpoklad) a výstup to
  přizná.

## Kde jsou data

Vše, co uživatel udělá, se **ukládá samo** do úložiště prohlížeče (IndexedDB). Data tam
zůstávají po zavření karty, vypnutí počítače i po aktualizaci aplikace; při přechodu na
novou verzi se starší data automaticky převedou.

Data nejsou vidět v jiném prohlížeči ani na jiném počítači a zmizí, pokud uživatel
v prohlížeči smaže data stránek nebo pracuje v anonymním okně. Proti tomu slouží:

- **záloha projektu** – soubor JSON ke stažení, který jde načíst kdekoli;
- **průběžné ukládání do souboru** (Chrome, Edge, Opera) – projekt se po každé změně
  zapíše do zvoleného souboru, například ve složce synchronizované s cloudem;
- žádost o **trvalé úložiště**, aby prohlížeč data nemazal při nedostatku místa.

## Spuštění

Potřebujete [Node.js](https://nodejs.org/) 22 nebo novější.

```bash
npm install
```

```bash
npm run dev
```

Aplikace poběží na adrese, kterou příkaz vypíše (obvykle http://localhost:5173).

Další příkazy:

```bash
npm test
```

```bash
npm run build
```

`npm run build` vytvoří hotovou aplikaci ve složce `dist`, kterou lze nahrát na
jakýkoli webový hosting.

## Zveřejnění na GitHub Pages

Repozitář obsahuje postup `.github/workflows/pages.yml`, který aplikaci po každé změně
ve větvi `main` otestuje, sestaví a zveřejní. Jednorázově je potřeba v nastavení
repozitáře zvolit **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Aplikace pak bude dostupná na adrese `https://<uživatel>.github.io/<repozitář>/`.

## Struktura projektu

```
src/
  lib/                 jádro bez závislosti na uživatelském rozhraní
    types.ts             datový model (projekt, záznam, hledání…)
    reviewTypes.ts       nastavení pěti typů přehledů
    db.ts                úložiště v prohlížeči (IndexedDB), záloha a obnova, převod starších dat
    storage.ts           trvalé úložiště, evidence záloh, průběžné ukládání do souboru
    reviewers.ts         dva hodnotitelé: shoda hlasů, neshody, Cohenovo kappa
    importers/           čtení souborů RIS, NBIB, BibTeX a CSV
    search/              sestavení dotazů a klienti PubMed, Europe PMC, ERIC
    dedup.ts             hledání duplicit
    flow.ts              počty pro vývojový diagram
    stats/               rozdělení pravděpodobnosti, velikosti účinku, metaanalýza,
                         metaregrese, tříúrovňový model, síťová metaanalýza,
                         překryv přehledů (CCA)
    analysis.ts          propojení dat projektu se statistikou
    figures.ts           obrázky jako SVG (diagram PRISMA, lesní graf, síť léčeb…)
    quality.ts           nástroje hodnocení kvality
    checklists.ts        kontrolní seznamy pro psaní zprávy
    citations.ts         citace APA 7 a ČSN ISO 690
    manuscript/          sestavení textu práce a export do Wordu a Markdownu
    content/             výukové texty ke krokům a slovníček
    demo.ts              ukázkové projekty
    design/              návrh aplikace: katalog možností se zdroji, odvození důsledků,
                         plán etap, sestavení výstupu, ukázkový návrh
  steps/               obrazovky kroků přehledu literatury
  design/              obrazovky kroků návrhu aplikace
  pages/               úvodní stránka, stránka projektu, nápověda
  ui.tsx               sdílené prvky rozhraní
tests/
  fixtures/            ukázky skutečných odpovědí databází pro testy
  reference/           výpočet referenčních hodnot (Python a SciPy; R a metafor)
```

Použité technologie: TypeScript, React, Vite, Dexie (IndexedDB), docx, Vitest.

## Ověření správnosti

Automatické testy (`npm test`) pokrývají čtení souborů, sestavení dotazů, hledání
duplicit, počty vývojového diagramu, citace, statistiku, třídění dvěma hodnotiteli,
převod starších dat i sestavení textu.

Statistické funkce se ověřují proti nezávislým výpočtům:

| Analýza | Referenční výpočet | Data |
|---|---|---|
| metaanalýza (pevný a náhodné efekty, REML, DL, Knapp–Hartung, predikční interval, Egger) | SciPy (`tests/reference/make_reference.py`) a publikovaný výstup metafor | 13 studií vakcíny BCG (Colditz et al., 1994) |
| metaregrese | `metafor::rma` | vakcína BCG, moderátor zeměpisná šířka |
| tříúrovňový model | `metafor::rma.mv` | Konstantopoulos (2011); Assink a Wibbelink (2016) |
| sloučení efektů uvnitř studie | `metafor::aggregate` | Assink a Wibbelink (2016) |
| síťová metaanalýza | `metafor::rma.mv` (kontrastní model) | Hasselblad (1998); Senn et al. (2013) |

Referenční hodnoty pro metafor vytváří skript `tests/reference/make_reference.R`
(R s balíky metafor a metadat); výsledek je uložen v `reference-metafor.json`, takže
testy běží i bez R. Shoda je na čtyři až šest platných míst. Například pro síť léčeb
diabetu vychází rozklad Q = 96,98 (df 18) na 74,45 uvnitř designů a 22,53 mezi designy,
stejně jako v dokumentaci balíku netmeta.

Oba ukázkové projekty používají referenční data, takže si výsledek může každý porovnat
s dokumentací metafor.

Čtení odpovědí databází se testuje na uložených ukázkách skutečných odpovědí
PubMed, Europe PMC a ERIC (`tests/fixtures`).

## Omezení

- Scopus, Web of Science, SPORTDiscus a další placené databáze nelze prohledat přímo;
  jejich výsledky se nahrávají jako soubor.
- Spolupráce dvou hodnotitelů probíhá výměnou souborů. Aplikace nemá server, takže
  více lidí nemůže pracovat v jednom projektu současně. Extrakce dat a hodnocení kvality
  se vedou jako jeden společný záznam.
- Síťová metaanalýza používá frekventistický model se společnou heterogenitou; neumí
  bayesovský odhad ani metaregresi v síti a nenabízí kontrolní seznam PRISMA-NMA.
  Srovnání přímých a nepřímých důkazů je u studií se třemi a více rameny přibližné.
- Tříúrovňový model nepočítá s korelací výběrových chyb (sdílení účastníků nebo kontrolní
  skupiny); pro takové případy je určeno sloučení efektů se zadanou korelací.
- Znění kontrolních seznamů a nástrojů hodnocení kvality je zkrácené a převyprávěné;
  závazné jsou původní dokumenty, na které aplikace odkazuje.
- Data leží v prohlížeči uživatele a ukládají se sama, nejsou ale sdílená mezi
  zařízeními. Záloha a průběžné ukládání do souboru neobsahují přiložené soubory PDF;
  průběžné ukládání do souboru funguje jen v prohlížečích Chrome, Edge a Opera.
- Vygenerovaný text je podklad. Autor ho musí zkontrolovat, doplnit a umět obhájit.
- Návrh aplikace zatím nelze propojit s přehledem literatury ve stejném projektu, takže
  se požadavky neodvozují ze zjištění rešerše. Katalog možností nasazení vychází z českého
  akademického prostředí a stárne; pravidla konkrétní školy aplikace nezná. Plán etap je
  obecný postup, ne návod pro konkrétní aplikaci.

## Metodické zdroje

- Higgins, J. P. T., et al. (Eds.). *Cochrane Handbook for Systematic Reviews of Interventions*. https://training.cochrane.org/handbook/current
- Aromataris, E., et al. (Eds.). *JBI Manual for Evidence Synthesis*. https://jbi-global-wiki.refined.site/space/MANUAL
- Page, M. J., et al. (2021). The PRISMA 2020 statement. *BMJ, 372*, n71. https://doi.org/10.1136/bmj.n71
- Tricco, A. C., et al. (2018). PRISMA Extension for Scoping Reviews (PRISMA-ScR). *Annals of Internal Medicine, 169*(7), 467–473. https://doi.org/10.7326/M18-0850
- Gates, M., et al. (2022). Reporting guideline for overviews of reviews of healthcare interventions: PRIOR statement. *BMJ, 378*, e070849. https://doi.org/10.1136/bmj-2022-070849
- Baethge, C., Goldbeck-Wood, S., & Mertens, S. (2019). SANRA – a scale for the quality assessment of narrative review articles. *Research Integrity and Peer Review, 4*, 5. https://doi.org/10.1186/s41073-019-0064-8
- Sterne, J. A. C., et al. (2019). RoB 2: a revised tool for assessing risk of bias in randomised trials. *BMJ, 366*, l4898. https://doi.org/10.1136/bmj.l4898
- Sterne, J. A. C., et al. (2016). ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions. *BMJ, 355*, i4919. https://doi.org/10.1136/bmj.i4919
- Shea, B. J., et al. (2017). AMSTAR 2: a critical appraisal tool for systematic reviews. *BMJ, 358*, j4008. https://doi.org/10.1136/bmj.j4008
- Whiting, P., et al. (2016). ROBIS: A new tool to assess risk of bias in systematic reviews was developed. *Journal of Clinical Epidemiology, 69*, 225–234. https://doi.org/10.1016/j.jclinepi.2015.06.005
- Pieper, D., et al. (2014). Systematic review finds overlapping reviews were not mentioned in every other overview. *Journal of Clinical Epidemiology, 67*(4), 368–375. https://doi.org/10.1016/j.jclinepi.2013.11.007
- Viechtbauer, W. (2010). Conducting meta-analyses in R with the metafor package. *Journal of Statistical Software, 36*(3), 1–48. https://doi.org/10.18637/jss.v036.i03
- Colditz, G. A., et al. (1994). Efficacy of BCG vaccine in the prevention of tuberculosis. *JAMA, 271*(9), 698–702.
- Borenstein, M., Hedges, L. V., Higgins, J. P. T., & Rothstein, H. R. (2009). *Introduction to meta-analysis*. Wiley.
- Cheung, M. W.-L. (2014). Modeling dependent effect sizes with three-level meta-analyses. *Psychological Methods, 19*(2), 211–229. https://doi.org/10.1037/a0032968
- Van den Noortgate, W., et al. (2013). Three-level meta-analysis of dependent effect sizes. *Behavior Research Methods, 45*, 576–594. https://doi.org/10.3758/s13428-012-0261-6
- Konstantopoulos, S. (2011). Fixed effects and variance components estimation in three-level meta-analysis. *Research Synthesis Methods, 2*(1), 61–76. https://doi.org/10.1002/jrsm.35
- Assink, M., & Wibbelink, C. J. M. (2016). Fitting three-level meta-analytic models in R: A step-by-step tutorial. *The Quantitative Methods for Psychology, 12*(3), 154–174.
- Salanti, G. (2012). Indirect and mixed-treatment comparison, network, or multiple-treatments meta-analysis. *Research Synthesis Methods, 3*(2), 80–97. https://doi.org/10.1002/jrsm.1037
- Higgins, J. P. T., et al. (2012). Consistency and inconsistency in network meta-analysis: concepts and models for multi-arm studies. *Research Synthesis Methods, 3*(2), 98–110. https://doi.org/10.1002/jrsm.1044
- Dias, S., et al. (2010). Checking consistency in mixed treatment comparison meta-analysis. *Statistics in Medicine, 29*(7–8), 932–944. https://doi.org/10.1002/sim.3767
- Rücker, G., & Schwarzer, G. (2015). Ranking treatments in frequentist network meta-analysis works without resampling methods. *BMC Medical Research Methodology, 15*, 58. https://doi.org/10.1186/s12874-015-0060-8
- Hutton, B., et al. (2015). The PRISMA extension statement for reporting of systematic reviews incorporating network meta-analyses. *Annals of Internal Medicine, 162*(11), 777–784. https://doi.org/10.7326/M14-2385
- Hasselblad, V. (1998). Meta-analysis of multitreatment studies. *Medical Decision Making, 18*(1), 37–43. https://doi.org/10.1177/0272989X9801800110
- Senn, S., et al. (2013). Issues in performing a network meta-analysis. *Statistical Methods in Medical Research, 22*(2), 169–189. https://doi.org/10.1177/0962280211432220
- Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement, 20*(1), 37–46.
- Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics, 33*(1), 159–174. https://doi.org/10.2307/2529310
