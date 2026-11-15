import { useState } from 'react';
import { CHECKLISTS } from '../lib/checklists';
import { GLOSSARY } from '../lib/content/glossary';
import { CATALOG_VERIFIED } from '../lib/design/catalog';
import { APP_VERSION } from '../lib/manuscript/build';
import { QUALITY_TOOLS } from '../lib/quality';
import { FRAMEWORKS, REVIEW_TYPES, STEP_LABELS, TYPE_ORDER } from '../lib/reviewTypes';
import { formatDate, stripDiacritics } from '../lib/util';
import { href } from '../ui';

const TABS = [
  { id: 'typy', label: 'Typy přehledů' },
  { id: 'slovnicek', label: 'Slovníček' },
  { id: 'o-aplikaci', label: 'O aplikaci' },
];

const AIM: Record<string, string> = {
  narrative: 'Vyložit a shrnout téma',
  scoping: 'Zmapovat, jaký výzkum existuje',
  systematic: 'Odpovědět na úzkou otázku',
  meta: 'Odhadnout velikost účinku',
  umbrella: 'Shrnout existující přehledy',
};
const SEARCH: Record<string, string> = {
  narrative: 'Popsané, nemusí být vyčerpávající',
  scoping: 'Systematické, široké',
  systematic: 'Systematické, vyčerpávající',
  meta: 'Systematické, vyčerpávající',
  umbrella: 'Systematické, zaměřené na přehledy',
};
const SYNTH: Record<string, string> = {
  narrative: 'Tematická, slovní',
  scoping: 'Četnosti, mapa, mezery',
  systematic: 'Strukturovaná slovní syntéza',
  meta: 'Statistické sloučení, lesní graf',
  umbrella: 'Srovnání závěrů, překryv studií',
};

export default function Help({ tab }: { tab: string }) {
  return (
    <main className="page">
      <h1 style={{ marginBottom: 16 }}>Nápověda</h1>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => (window.location.hash = href('napoveda', t.id))}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'slovnicek' ? <Glossary /> : tab === 'o-aplikaci' ? <About /> : <Types />}
    </main>
  );
}

function Types() {
  const row = (label: string, cell: (id: (typeof TYPE_ORDER)[number]) => React.ReactNode) => (
    <tr>
      <th scope="row">{label}</th>
      {TYPE_ORDER.map((id) => (
        <td key={id}>{cell(id)}</td>
      ))}
    </tr>
  );
  return (
    <div className="stack">
      <p style={{ maxWidth: 760 }}>
        Typ přehledu vyplývá z otázky, ne naopak. Ptáte-li se „co o tématu víme“, hodí se narativní nebo mapovací přehled. Ptáte-li se „funguje to?“, potřebujete systematický přehled, a pokud studie měří totéž
        srovnatelně, i metaanalýzu. Existuje-li už víc systematických přehledů, shrne je zastřešující přehled.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th />
              {TYPE_ORDER.map((id) => (
                <th key={id} scope="col" style={{ whiteSpace: 'normal', minWidth: 150 }}>
                  {REVIEW_TYPES[id].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {row('Cíl', (id) => AIM[id])}
            {row('Rámec otázky', (id) => FRAMEWORKS[REVIEW_TYPES[id].framework].name)}
            {row('Vyhledávání', (id) => SEARCH[id])}
            {row('Hodnocení kvality', (id) => {
              const tools = REVIEW_TYPES[id].qualityTools.filter((t) => t !== 'custom').map((t) => QUALITY_TOOLS[t].name);
              const optional = REVIEW_TYPES[id].steps.find((s) => s.id === 'quality')?.optional;
              return !REVIEW_TYPES[id].steps.some((s) => s.id === 'quality') ? 'Neprovádí se' : optional ? 'Volitelné' : tools.join(', ');
            })}
            {row('Syntéza', (id) => SYNTH[id])}
            {row('Standard zprávy', (id) => (
              <a href={REVIEW_TYPES[id].standard.url} target="_blank" rel="noreferrer">
                {REVIEW_TYPES[id].standard.name}
              </a>
            ))}
            {row('Protokol', (id) => REVIEW_TYPES[id].registry)}
            {row('Kroků v aplikaci', (id) => REVIEW_TYPES[id].steps.length)}
          </tbody>
        </table>
      </div>
      {TYPE_ORDER.map((id) => {
        const t = REVIEW_TYPES[id];
        return (
          <section key={id} className="card">
            <h2>{t.name}</h2>
            <p className="muted small" style={{ marginBottom: 8 }}>
              {t.english} · {CHECKLISTS[id].name}
            </p>
            <p>{t.description}</p>
            <div className="grid2">
              <div>
                <h4 style={{ marginBottom: 6 }}>Zvolte, když</h4>
                <ul>
                  {t.whenToUse.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ marginBottom: 6 }}>Na co si dát pozor</h4>
                <p>{t.notFor}</p>
                <h4 style={{ marginBottom: 6 }}>Kroky</h4>
                <p className="small">
                  {t.steps.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 ? ' → ' : ''}
                      {STEP_LABELS[s.id]}
                      {s.optional ? ' (volitelně)' : ''}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Glossary() {
  const [q, setQ] = useState('');
  const norm = (s: string) => stripDiacritics(s.toLowerCase());
  const items = GLOSSARY.filter((g) => !q.trim() || norm(`${g.term} ${g.english ?? ''} ${g.text}`).includes(norm(q.trim())));
  return (
    <div className="stack">
      <input type="search" placeholder="Hledat pojem…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Hledat ve slovníčku" style={{ maxWidth: 360 }} />
      <div className="card">
        {items.length === 0 ? <p className="muted">Žádný pojem neodpovídá.</p> : null}
        <dl style={{ margin: 0 }}>
          {items.map((g) => (
            <div key={g.term} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <dt>
                <strong>{g.term}</strong>
                {g.english ? <span className="muted small"> · {g.english}</span> : null}
              </dt>
              <dd style={{ margin: '2px 0 0' }}>{g.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function About() {
  return (
    <div className="stack" style={{ maxWidth: 780 }}>
      <section className="card">
        <h2>K čemu aplikace slouží</h2>
        <p>
          Průvodce přehledem (verze {APP_VERSION}) je výuková aplikace. Učí postup tvorby přehledových studií tím, že vás jím provede na vlastním tématu: u každého kroku vysvětlí cíl, postup a časté chyby a rozliší, co
          udělá aplikace a co musíte udělat sami.
        </p>
        <p>Aplikace nenahrazuje úsudek autora, vedoucího práce ani knihovníka. Nerozhoduje, které studie zařadit, a nepíše za vás diskusi.</p>
        <p>Obsahuje dva průvodce, které lze použít každý zvlášť: přehled literatury a návrh aplikace.</p>
      </section>
      <section className="card">
        <h2>Návrh aplikace</h2>
        <p>
          Druhý průvodce vede od záměru přes požadavky a vlastnosti aplikace k volbě typu řešení a místa, kde aplikace poběží. Smyslem je rozhodnout o provozu <strong>před stavbou</strong>: hotová aplikace, pro kterou se
          nenajde místo ani správce, po obhajobě zanikne a odkaz v práci přestane fungovat.
        </p>
        <ul>
          <li>
            <strong>Nic nedoporučuje.</strong> Předloží možnosti a u každé důsledky: cenu teď a za tři roky, kdo se stará po absolvování, co s osobními údaji, čí je adresa a jak těžké je odejít. Rozhodujete vy a své
            zdůvodnění zapíšete.
          </li>
          <li>
            <strong>Důsledky nejsou výsledkem výzkumu.</strong> Vyplývají z technických souvislostí, z podmínek poskytovatelů a z předpisů. Údaje, které se mění (ceny, limity, podmínky), mají u sebe zdroj a datum
            ověření; celý katalog byl naposledy zkontrolován {formatDate(CATALOG_VERIFIED)}. Před rozhodnutím je ověřte u zdroje.
          </li>
          <li>
            <strong>Požadavky nejsou podložené rešerší.</strong> Samostatný návrh se o přehled literatury neopírá, proto se u každého požadavku uvádí, na čem stojí: zadání, rozhovory s uživateli, norma, literatura,
            odborný úsudek, nebo zatím jen předpoklad. Výstup to přizná.
          </li>
          <li>
            <strong>Pravidla školy aplikace nezná.</strong> Připraví otázky pro vedoucího, správce IT a pověřence pro ochranu osobních údajů; odpovědi musíte získat sami.
          </li>
        </ul>
        <p className="muted">Výstupem je dokument s návrhem a stručné zadání pro toho, kdo bude stavět. Plán etap je obecný postup, ne návod krok za krokem pro konkrétní aplikaci.</p>
      </section>
      <section className="card">
        <h2>Kde jsou vaše data</h2>
        <p>
          Aplikace nemá server. Projekty, záznamy i přiložené plné texty se <strong>ukládají samy do úložiště vašeho prohlížeče</strong> na tomto počítači. Zůstávají tam i po zavření karty, vypnutí počítače nebo
          aktualizaci aplikace – při dalším otevření pokračujete tam, kde jste skončili. Při přímém vyhledávání odesílá prohlížeč dotaz přímo do zvolené databáze (PubMed, Europe PMC, ERIC); jinam se nic neposílá.
        </p>
        <p>O data můžete přijít jen tak, že v prohlížeči smažete data stránek, pracujete v anonymním okně nebo otevřete aplikaci v jiném prohlížeči či na jiném počítači (tam je úložiště prázdné). Proti tomu slouží:</p>
        <ul>
          <li>
            <strong>Záloha projektu</strong> – soubor JSON stažený tlačítkem v levém panelu. Načtete ho na úvodní stránce; slouží i k přenosu na jiný počítač. Přiložené soubory PDF záloha neobsahuje.
          </li>
          <li>
            <strong>Průběžné ukládání do souboru</strong> (Chrome, Edge, Opera) – projekt se po každé změně sám zapíše do souboru, který zvolíte. Když soubor leží ve složce synchronizované s cloudem (OneDrive, Disk
            Google), máte zálohu mimo počítač bez další práce. Po novém spuštění prohlížeče může být potřeba zápis jedním kliknutím znovu povolit.
          </li>
        </ul>
      </section>
      <section className="card">
        <h2>Dva hodnotitelé</h2>
        <p>
          Třídění dvěma nezávislými hodnotiteli se zapíná v kroku Protokol. Každý hodnotitel rozhoduje sám a rozhodnutí druhého nevidí; aplikace pak spočítá míru shody (Cohenovo κ) a ukáže neshody k vyřešení. Lze
          pracovat střídavě na jednom počítači, nebo každý na svém: hlavní hodnotitel pošle druhému „balíček“ (kopii projektu bez svých rozhodnutí) a ten mu vrátí soubor se svými rozhodnutími.
        </p>
        <p className="muted">Extrakci dat a hodnocení kvality aplikace vede jako jeden společný záznam; pokud je děláte ve dvou, shodněte se před zápisem.</p>
      </section>
      <section className="card">
        <h2>Jak jsou ověřené výpočty</h2>
        <p>
          Statistické funkce jsou pokryty automatickými testy a porovnávají se s výsledky balíku metafor pro R a s nezávislým výpočtem v knihovně SciPy:
        </p>
        <ul>
          <li>běžná metaanalýza a metaregrese – 13 studií vakcíny BCG (Colditz et al., 1994); stejná data obsahuje první ukázkový projekt;</li>
          <li>tříúrovňový model a sloučení efektů – data Konstantopoulos (2011) a Assink a Wibbelink (2016);</li>
          <li>síťová metaanalýza – odvykání kouření (Hasselblad, 1998; druhý ukázkový projekt) a léky na diabetes (Senn et al., 2013).</li>
        </ul>
        <p className="muted">Skript, který referenční hodnoty počítá, je součástí zdrojového kódu (tests/reference).</p>
      </section>
      <section className="card">
        <h2>Omezení</h2>
        <ul>
          <li>Scopus, Web of Science, SPORTDiscus a další placené databáze nelze prohledat přímo; výsledky z nich se nahrávají jako soubor.</li>
          <li>Spolupráce dvou hodnotitelů probíhá výměnou souborů, ne přes společný server; současná práce více lidí v jednom projektu možná není.</li>
          <li>
            Síťová metaanalýza používá frekventistický model se společnou heterogenitou. Neumí bayesovský odhad, metaregresi v síti ani kontrolní seznam PRISMA-NMA; tříúrovňový model nepočítá s korelací výběrových chyb
            (ta se řeší sloučením efektů).
          </li>
          <li>Znění kontrolních seznamů a nástrojů je zkrácené. Při práci používejte původní dokumenty, na které aplikace odkazuje.</li>
          <li>
            Návrh aplikace zatím nelze propojit s přehledem literatury ve stejném projektu; požadavky se proto neodvozují ze zjištění rešerše. Katalog možností nasazení vychází z českého akademického prostředí a
            stárne: údaje starší než rok berte jako orientační.
          </li>
          <li>Citační styl vygenerovaného seznamu literatury vždy zkontrolujte podle požadavků své školy.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Metodické zdroje</h2>
        <ul>
          <li>
            <a href="https://training.cochrane.org/handbook/current" target="_blank" rel="noreferrer">
              Cochrane Handbook for Systematic Reviews of Interventions
            </a>
          </li>
          <li>
            <a href="https://jbi-global-wiki.refined.site/space/MANUAL" target="_blank" rel="noreferrer">
              JBI Manual for Evidence Synthesis
            </a>
          </li>
          {[...new Set(Object.values(CHECKLISTS))].map((c) => (
            <li key={c.id}>
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.citation}
              </a>
            </li>
          ))}
          {Object.values(QUALITY_TOOLS)
            .filter((t) => t.id !== 'custom')
            .map((t) => (
              <li key={t.id}>
                <a href={t.source.url} target="_blank" rel="noreferrer">
                  {t.name}: {t.source.label}
                </a>
              </li>
            ))}
          <li>
            <a href="https://doi.org/10.18637/jss.v036.i03" target="_blank" rel="noreferrer">
              Viechtbauer (2010). Conducting meta-analyses in R with the metafor package. Journal of Statistical Software, 36(3).
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
