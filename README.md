# Průvodce přehledem

Výuková webová aplikace, která krok za krokem provede tvorbou přehledové studie:
narativního, mapovacího (scoping), systematického a zastřešujícího (umbrella) přehledu
a systematického přehledu s metaanalýzou.

U každého kroku vysvětlí, k čemu slouží, jak postupovat a jakých chyb se vyvarovat,
a rozliší, co udělá aplikace a co musí udělat člověk. Z rozhodnutí a dat uživatele pak
sestaví podklad pro text – odborný článek, bakalářskou nebo diplomovou práci.

Aplikace běží celá v prohlížeči. Nemá server ani uživatelské účty; data zůstávají
v počítači uživatele.

## Co aplikace umí

| Krok | Co udělá aplikace | Co dělá člověk |
|---|---|---|
| Výzkumná otázka | nabídne rámec PICO / PCC, navrhne znění | formuluje otázku a cíl |
| Protokol a kritéria | uloží kritéria, vyexportuje protokol | stanoví kritéria, registruje protokol |
| Vyhledávání | sestaví dotaz pro 7 databází, prohledá PubMed, Europe PMC a ERIC, načte RIS / NBIB / BibTeX / CSV, vede deník hledání | volí termíny, prohledá Scopus, WoS, EBSCO a nahraje výsledky |
| Duplicity | najde jisté a pravděpodobné duplicity, sloučí je | rozhodne sporné dvojice |
| Třídění podle abstraktu | zobrazuje záznamy, zvýrazňuje slova, počítá postup | rozhoduje o každém záznamu |
| Posouzení plných textů | eviduje stav, PDF a důvody vyřazení | shání a čte plné texty |
| Extrakce dat | nabídne upravitelný formulář, počítá velikosti účinku | vypisuje údaje ze studií |
| Hodnocení kvality | RoB 2, ROBINS-I, AMSTAR 2, ROBIS, vlastní seznam; navrhne celkové hodnocení | hodnotí jednotlivé oblasti |
| Syntéza | metaanalýza, lesní a trychtýřový graf, podskupiny, citlivostní analýza, GRADE; četnosti; překryv přehledů (CCA) | rozhoduje, co slučovat, a interpretuje |
| Vývojový diagram | nakreslí diagram PRISMA 2020 z počtů | zkontroluje |
| Text práce | vygeneruje metodiku, výsledky, tabulky, obrázky, literaturu a přílohy; export do Wordu | píše úvod, diskusi a závěr |
| Kontrolní seznam | PRISMA 2020, PRISMA-ScR, PRIOR nebo SANRA | ověří úplnost textu |

Typy přehledů sdílejí stejné jádro a liší se nastavením v `src/lib/reviewTypes.ts`:
které kroky jsou povinné, jaký rámec otázky a jaký standard platí.

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
    db.ts                úložiště v prohlížeči (IndexedDB), záloha a obnova
    importers/           čtení souborů RIS, NBIB, BibTeX a CSV
    search/              sestavení dotazů a klienti PubMed, Europe PMC, ERIC
    dedup.ts             hledání duplicit
    flow.ts              počty pro vývojový diagram
    stats/               rozdělení pravděpodobnosti, velikosti účinku,
                         metaanalýza, překryv přehledů (CCA)
    analysis.ts          propojení dat projektu se statistikou
    figures.ts           obrázky jako SVG (diagram PRISMA, lesní graf…)
    quality.ts           nástroje hodnocení kvality
    checklists.ts        kontrolní seznamy pro psaní zprávy
    citations.ts         citace APA 7 a ČSN ISO 690
    manuscript/          sestavení textu práce a export do Wordu a Markdownu
    content/             výukové texty ke krokům a slovníček
    demo.ts              ukázkový projekt
  steps/               obrazovky jednotlivých kroků
  pages/               úvodní stránka, stránka projektu, nápověda
  ui.tsx               sdílené prvky rozhraní
tests/
  fixtures/            ukázky skutečných odpovědí databází pro testy
  reference/           nezávislý výpočet referenčních hodnot (Python, SciPy)
```

Použité technologie: TypeScript, React, Vite, Dexie (IndexedDB), docx, Vitest.

## Ověření správnosti

Automatické testy (`npm test`) pokrývají čtení souborů, sestavení dotazů, hledání
duplicit, počty vývojového diagramu, citace, statistiku i sestavení textu.

Statistické funkce se ověřují dvojím způsobem:

1. proti nezávislému výpočtu v Pythonu (`tests/reference/make_reference.py`, knihovny
   NumPy a SciPy), který pro odhad REML používá jiný postup než aplikace;
2. proti publikovanému výstupu balíku metafor pro datovou sadu 13 studií vakcíny BCG
   (Colditz et al., 1994): odhad −0,7145, směrodatná chyba 0,1798, τ² = 0,3132,
   I² = 92,22 %, Q(12) = 152,23.

Stejná data obsahuje ukázkový projekt v aplikaci, takže si výsledek může každý
porovnat s dokumentací metafor.

Čtení odpovědí databází se testuje na uložených ukázkách skutečných odpovědí
PubMed, Europe PMC a ERIC (`tests/fixtures`).

## Omezení

- Scopus, Web of Science, SPORTDiscus a další placené databáze nelze prohledat přímo;
  jejich výsledky se nahrávají jako soubor.
- Aplikace je pro jednoho uživatele; nezávislé třídění dvěma hodnotiteli nepodporuje.
- Metaanalýza pracuje s jedním efektem na studii a výstup. Neřeší síťovou metaanalýzu,
  metaregresi ani závislé efekty.
- Znění kontrolních seznamů a nástrojů hodnocení kvality je zkrácené a převyprávěné;
  závazné jsou původní dokumenty, na které aplikace odkazuje.
- Data jsou uložena jen v prohlížeči. Bez stažené zálohy je nelze obnovit po vymazání
  dat prohlížeče; přiložené soubory PDF záloha neobsahuje.
- Vygenerovaný text je podklad. Autor ho musí zkontrolovat, doplnit a umět obhájit.

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
