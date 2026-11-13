import { useState } from 'react';
import { CHECKLISTS } from '../lib/checklists';
import { GLOSSARY } from '../lib/content/glossary';
import { APP_VERSION } from '../lib/manuscript/build';
import { QUALITY_TOOLS } from '../lib/quality';
import { FRAMEWORKS, REVIEW_TYPES, STEP_LABELS, TYPE_ORDER } from '../lib/reviewTypes';
import { stripDiacritics } from '../lib/util';
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
      </section>
      <section className="card">
        <h2>Kde jsou vaše data</h2>
        <p>
          Aplikace nemá server. Projekty, záznamy i přiložené plné texty se ukládají jen do úložiště vašeho prohlížeče na tomto počítači. Při přímém vyhledávání odesílá prohlížeč dotaz přímo do zvolené databáze
          (PubMed, Europe PMC, ERIC).
        </p>
        <p>Vymazáním dat prohlížeče o projekty přijdete. Zálohu projektu (soubor JSON) proto stahujte pravidelně; přiložené soubory PDF záloha neobsahuje.</p>
      </section>
      <section className="card">
        <h2>Jak jsou ověřené výpočty</h2>
        <p>
          Statistické funkce (velikosti účinku, model s pevným a náhodnými efekty, odhad τ² metodou REML a DerSimoniana–Lairda, Knappova–Hartungova úprava, predikční interval, Eggerův test) jsou pokryty
          automatickými testy. Výsledky se porovnávají s nezávislým výpočtem v knihovně SciPy a s publikovaným výstupem balíku metafor pro datovou sadu studií vakcíny BCG. Stejná data obsahuje ukázkový projekt.
        </p>
      </section>
      <section className="card">
        <h2>Omezení</h2>
        <ul>
          <li>Scopus, Web of Science, SPORTDiscus a další placené databáze nelze prohledat přímo; výsledky z nich se nahrávají jako soubor.</li>
          <li>Aplikace je určena pro jednoho uživatele. Nezávislé třídění dvěma hodnotiteli nepodporuje – uveďte to mezi omezeními své práce.</li>
          <li>Metaanalýza pracuje s jedním efektem na studii a výstup; síťovou metaanalýzu, metaregresi ani vícenásobné efekty z jedné studie neřeší.</li>
          <li>Znění kontrolních seznamů a nástrojů je zkrácené. Při práci používejte původní dokumenty, na které aplikace odkazuje.</li>
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
