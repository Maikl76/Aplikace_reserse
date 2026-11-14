import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { addManualRecord, addSearchResults, db, patchProject, removeSearch, setSetting } from '../lib/db';
import { FORMAT_LABELS, parseFile, type ImportFormat } from '../lib/importers';
import { FRAMEWORKS } from '../lib/reviewTypes';
import { API_LABELS, MAX_IMPORT, countHits, fetchRecords, type ApiSource } from '../lib/search/clients';
import { TARGETS, buildQuery, emptyBlocksFor, type Target } from '../lib/search/queryBuilder';
import type { BibRecord, ConceptBlock, Term, Vocab } from '../lib/types';
import { emptyBib, formatDate, lines, parseAuthor, parseYear, plural, uid } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { CopyButton, Empty, Field, Notice, TextArea, TextInput } from '../ui';

const COMMON_SOURCES = ['Scopus', 'Web of Science', 'SPORTDiscus', 'CINAHL', 'PsycINFO', 'Embase', 'Cochrane Library', 'Google Scholar', 'ProQuest', 'Citační manažer (Zotero, EndNote)'];
const VIA_LABELS = { api: 'přímé hledání', file: 'soubor', manual: 'ručně' } as const;

export default function SearchStep({ project, records }: StepProps) {
  return (
    <div className="stack">
      <Blocks project={project} records={records} />
      <Queries project={project} records={records} />
      <FileImport project={project} records={records} />
      <ManualAdd project={project} records={records} />
      <SearchLog project={project} records={records} />
    </div>
  );
}

// ---- 1. Pojmové bloky --------------------------------------------------------------

function Blocks({ project }: StepProps) {
  const blocks = project.blocks;
  const save = (next: ConceptBlock[]) => patchProject(project.id, { blocks: next });
  const termsOf = (b: ConceptBlock, vocab: Vocab) => b.terms.filter((t) => t.vocab === vocab).map((t) => t.text).join('\n');
  const setTerms = (b: ConceptBlock, vocab: Vocab, text: string) => {
    const others = b.terms.filter((t) => t.vocab !== vocab);
    const mine: Term[] = lines(text).map((t) => ({ text: t, vocab }));
    save(blocks.map((x) => (x.id === b.id ? { ...x, terms: [...others, ...mine] } : x)));
  };
  const fromQuestion = () => {
    const fw = FRAMEWORKS[project.question.framework];
    // Výstupy a vymezení se do dotazu obvykle nedávají – snižují citlivost hledání.
    const skip = new Set(['O', 'scope']);
    const made = fw.elements.filter((e) => !skip.has(e.id) && (project.question.elements[e.id] ?? '').trim()).map((e) => ({ id: uid(), label: e.label, terms: [] }));
    save([...blocks, ...made]);
  };

  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>1. Pojmové bloky</h3>
        <div className="row">
          {blocks.length === 0 && Object.values(project.question.elements).some((v) => v.trim()) ? (
            <button type="button" className="btn small" onClick={fromQuestion}>
              Vytvořit bloky z otázky
            </button>
          ) : null}
          <button type="button" className="btn small" onClick={() => save([...blocks, { id: uid(), label: '', terms: [] }])}>
            Přidat blok
          </button>
        </div>
      </div>
      <p className="small muted">
        Každý blok je jeden pojem z otázky a jeho synonyma (jedno na řádek, obvykle anglicky). Synonyma se spojí operátorem OR, bloky mezi sebou operátorem AND. Hvězdička nahrazuje koncovku (<code>adolescen*</code>).
      </p>
      {blocks.length === 0 ? (
        <Empty title="Zatím žádný blok">Začněte dvěma až třemi bloky – typicky populace a intervence (nebo koncept).</Empty>
      ) : (
        <div className="stack">
          {blocks.map((b, i) => (
            <div key={b.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="pill accent">Blok {i + 1}</span>
                <span className="grow">
                  <TextInput value={b.label} placeholder="Název pojmu, např. Populace" ariaLabel={`Název bloku ${i + 1}`} onCommit={(label) => save(blocks.map((x) => (x.id === b.id ? { ...x, label } : x)))} />
                </span>
                <button type="button" className="btn small ghost danger" onClick={() => save(blocks.filter((x) => x.id !== b.id))}>
                  Odebrat
                </button>
              </div>
              <div className="grid3">
                <Field label="Volný text" hint="Hledá se v názvu a abstraktu ve všech databázích.">
                  <TextArea value={termsOf(b, 'free')} rows={4} mono placeholder={'adolescen*\nteenager*\nyouth'} onCommit={(v) => setTerms(b, 'free', v)} />
                </Field>
                <Field
                  label="Termíny MeSH"
                  hint={
                    <>
                      Jen pro PubMed.{' '}
                      <a href="https://www.ncbi.nlm.nih.gov/mesh/" target="_blank" rel="noreferrer">
                        Vyhledat v MeSH
                      </a>
                    </>
                  }
                >
                  <TextArea value={termsOf(b, 'mesh')} rows={4} mono placeholder="Adolescent" onCommit={(v) => setTerms(b, 'mesh', v)} />
                </Field>
                <Field
                  label="Deskriptory ERIC"
                  hint={
                    <>
                      Jen pro ERIC.{' '}
                      <a href="https://eric.ed.gov/?ti=all" target="_blank" rel="noreferrer">
                        Tezaurus ERIC
                      </a>
                    </>
                  }
                >
                  <TextArea value={termsOf(b, 'eric')} rows={4} mono placeholder="Adolescents" onCommit={(v) => setTerms(b, 'eric', v)} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- 2. Dotazy a přímé hledání --------------------------------------------------------

function Queries({ project }: StepProps) {
  const [target, setTarget] = useState<Target>('pubmed');
  const [manual, setManual] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [info, setInfo] = useState<{ total: number; translation?: string; notFound?: string[] } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const apiKey = useLiveQuery(() => db.settings.get('pubmedApiKey'), [])?.value ?? '';

  const tinfo = TARGETS.find((t) => t.id === target)!;
  const limits = { yearFrom: project.protocol.yearFrom, yearTo: project.protocol.yearTo };
  const generated = buildQuery(project.blocks, target, limits);
  const query = manual ?? generated;
  const unused = emptyBlocksFor(project.blocks, target);
  const pick = (t: Target) => {
    setTarget(t);
    setManual(null);
    setInfo(null);
    setError('');
    setDone('');
  };

  const run = async (kind: 'count' | 'fetch') => {
    setBusy(true);
    setError('');
    setDone('');
    setProgress('');
    try {
      const source = target as ApiSource;
      const opts = { pubmedApiKey: apiKey || undefined, onProgress: (d: number, total: number) => setProgress(`Staženo ${d} z ${total}`) };
      if (kind === 'count') {
        setInfo(await countHits(source, query, opts));
      } else {
        const out = await fetchRecords(source, query, MAX_IMPORT, opts);
        await addSearchResults(project, { source: API_LABELS[source], via: 'api', query, hits: out.total, note: manual != null ? 'Dotaz upraven ručně.' : '' }, out.records);
        setInfo(null);
        setDone(`Nahráno ${plural(out.records.length, 'záznam', 'záznamy', 'záznamů')} z databáze ${API_LABELS[source]}${out.total > out.records.length ? ` (databáze jich hlásí ${out.total})` : ''}. Hledání je zapsáno v deníku.`);
      }
    } catch (e) {
      setError(e instanceof Error && e.name !== 'TypeError' ? e.message : 'Databázi se nepodařilo kontaktovat. Zkontrolujte připojení k internetu a zkuste to znovu.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <section className="card">
      <h3>2. Dotaz pro databázi</h3>
      <div className="row" style={{ marginBottom: 12 }} role="group" aria-label="Databáze">
        {TARGETS.map((t) => (
          <button key={t.id} type="button" className={`btn small ${t.id === target ? 'active' : ''}`} onClick={() => pick(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      <p className="small muted">{tinfo.note}</p>
      {!query ? (
        <Empty title="Dotaz je prázdný">Vyplňte v blocích alespoň jeden termín, který tato databáze umí použít.</Empty>
      ) : (
        <>
          <textarea className="mono" rows={Math.min(10, Math.max(3, Math.ceil(query.length / 95)))} value={query} readOnly={manual == null} onChange={(e) => setManual(e.target.value)} aria-label="Vyhledávací dotaz" />
          <div className="row" style={{ marginTop: 8 }}>
            <CopyButton text={query} label="Kopírovat dotaz" />
            {manual == null ? (
              <button type="button" className="btn small" onClick={() => setManual(generated)}>
                Upravit ručně
              </button>
            ) : (
              <button type="button" className="btn small" onClick={() => setManual(null)}>
                Vrátit dotaz z bloků
              </button>
            )}
            <span className="grow" />
            {tinfo.api ? (
              <>
                <button type="button" className="btn" disabled={busy} onClick={() => run('count')}>
                  Zjistit počet výsledků
                </button>
                <button type="button" className="btn primary" disabled={busy} onClick={() => run('fetch')}>
                  Stáhnout záznamy do projektu
                </button>
              </>
            ) : (
              <span className="small muted">Dotaz spusťte v databázi a výsledky nahrajte níže jako soubor.</span>
            )}
          </div>
        </>
      )}
      <div className="stack" style={{ marginTop: 12 }}>
        {unused.length ? <Notice kind="warn">V této databázi se neuplatní {unused.length === 1 ? 'blok' : 'bloky'} {unused.map((b) => `„${b.label || 'bez názvu'}“`).join(', ')} – obsahují jen termíny slovníku jiné databáze. Doplňte do nich volný text.</Notice> : null}
        {busy ? <Notice>{progress || 'Dotazuji se databáze…'}</Notice> : null}
        {info ? (
          <Notice kind={info.total > MAX_IMPORT ? 'warn' : undefined}>
            Databáze hlásí <strong>{plural(info.total, 'výsledek', 'výsledky', 'výsledků')}</strong>.
            {info.total === 0 ? ' Zkontrolujte pravopis termínů nebo uberte blok.' : null}
            {info.total > MAX_IMPORT ? ` Aplikace stáhne nejvýše ${MAX_IMPORT} záznamů – dotaz zpřesněte.` : info.total > 1500 ? ' To je na ruční třídění hodně; zvažte zpřesnění dotazu.' : null}
            {info.translation ? (
              <details style={{ marginTop: 6 }}>
                <summary className="small">Jak dotaz pochopil PubMed</summary>
                <code style={{ display: 'block', marginTop: 4, whiteSpace: 'pre-wrap' }}>{info.translation}</code>
              </details>
            ) : null}
            {info.notFound?.length ? <div style={{ marginTop: 6 }}>PubMed nenašel tyto výrazy: {info.notFound.join(', ')}. Zkontrolujte pravopis.</div> : null}
          </Notice>
        ) : null}
        {done ? <Notice kind="good">{done}</Notice> : null}
        {error ? <Notice kind="bad">{error}</Notice> : null}
      </div>
      {target === 'pubmed' ? (
        <details style={{ marginTop: 12 }}>
          <summary className="small">Nastavení PubMedu (nepovinné)</summary>
          <div style={{ maxWidth: 420, marginTop: 8 }}>
            <Field label="Klíč NCBI API" hint="Bez klíče hledání funguje, jen pomaleji. Klíč zůstává uložen pouze v tomto prohlížeči.">
              <TextInput type="password" value={apiKey} onCommit={(v) => setSetting('pubmedApiKey', v.trim())} />
            </Field>
          </div>
        </details>
      ) : null}
    </section>
  );
}

// ---- 3. Import souboru ---------------------------------------------------------------

function FileImport({ project }: StepProps) {
  const [source, setSource] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState('');
  const [parsed, setParsed] = useState<{ name: string; format: ImportFormat; records: BibRecord[] } | null>(null);
  const [message, setMessage] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (file: File | undefined) => {
    setMessage(null);
    setParsed(null);
    if (!file) return;
    const out = parseFile(file.name, await file.text());
    if (!out.records.length) {
      setMessage({ kind: 'bad', text: 'V souboru se nepodařilo najít žádné záznamy. Exportujte z databáze ve formátu RIS (nebo CSV s názvy sloupců v prvním řádku).' });
      return;
    }
    setParsed({ name: file.name, ...out });
  };

  const save = async () => {
    if (!parsed) return;
    await addSearchResults(project, { source: source.trim() || 'Neuvedená databáze', via: 'file', query: query.trim(), hits: parseYearless(hits), note: `Soubor ${parsed.name} (${FORMAT_LABELS[parsed.format]}).` }, parsed.records);
    setMessage({ kind: 'good', text: `Nahráno ${plural(parsed.records.length, 'záznam', 'záznamy', 'záznamů')}. Hledání je zapsáno v deníku.` });
    setParsed(null);
    setQuery('');
    setHits('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const withAbstract = parsed ? parsed.records.filter((r) => r.abstract).length : 0;

  return (
    <section className="card">
      <h3>3. Nahrání výsledků z jiné databáze</h3>
      <p className="small muted">Pro Scopus, Web of Science, EBSCO a další. V databázi exportujte všechny výsledky ve formátu RIS včetně abstraktů. Aplikace čte i soubory NBIB z PubMedu, BibTeX a CSV.</p>
      <div className="grid2">
        <Field label="Databáze" hint="Název se objeví v deníku hledání a ve vývojovém diagramu.">
          <input type="text" list="common-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Např. Scopus" />
          <datalist id="common-sources">
            {COMMON_SOURCES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Počet výsledků podle databáze" hint="Číslo, které databáze ukázala po spuštění dotazu.">
          <input type="text" inputMode="numeric" value={hits} onChange={(e) => setHits(e.target.value)} />
        </Field>
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Použitý dotaz" hint="Vložte přesně to, co jste v databázi spustili – patří do přílohy práce.">
          <textarea className="mono" rows={2} value={query} onChange={(e) => setQuery(e.target.value)} />
        </Field>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input ref={fileRef} type="file" accept=".ris,.nbib,.bib,.csv,.tsv,.txt" onChange={(e) => read(e.target.files?.[0])} aria-label="Soubor s exportem" />
        {parsed ? (
          <button type="button" className="btn primary" onClick={save}>
            Nahrát {plural(parsed.records.length, 'záznam', 'záznamy', 'záznamů')}
          </button>
        ) : null}
      </div>
      <div className="stack" style={{ marginTop: 12 }}>
        {parsed ? (
          <Notice kind={withAbstract < parsed.records.length * 0.7 ? 'warn' : undefined}>
            Rozpoznán formát {FORMAT_LABELS[parsed.format]}: {plural(parsed.records.length, 'záznam', 'záznamy', 'záznamů')}, abstrakt má {withAbstract}.
            {withAbstract < parsed.records.length * 0.7 ? ' Bez abstraktů se špatně třídí – zkuste export zopakovat s volbou „včetně abstraktů“.' : null} První záznam: „{parsed.records[0].title.slice(0, 110)}“.
          </Notice>
        ) : null}
        {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      </div>
    </section>
  );
}

const parseYearless = (s: string): number | null => {
  const n = Number(s.replace(/\s/g, ''));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};

// ---- 4. Ruční doplnění ---------------------------------------------------------------

function ManualAdd({ project }: StepProps) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', authors: '', year: '', journal: '', doi: '', abstract: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    await addManualRecord(project, { ...emptyBib(), title: f.title.trim(), authors: f.authors.split(';').map((a) => parseAuthor(a)).filter((a) => a.family), year: parseYear(f.year), journal: f.journal.trim(), doi: f.doi.trim(), abstract: f.abstract.trim() });
    setF({ title: '', authors: '', year: '', journal: '', doi: '', abstract: '' });
  };
  return (
    <section className="card">
      <div className="row between">
        <div>
          <h3 style={{ marginBottom: 2 }}>4. Záznamy z jiných zdrojů</h3>
          <span className="small muted">Publikace nalezené mimo databáze: v seznamech literatury, na doporučení, v šedé literatuře.</span>
        </div>
        <button type="button" className="btn small" onClick={() => setOpen(!open)}>
          {open ? 'Zavřít' : 'Přidat záznam ručně'}
        </button>
      </div>
      {open ? (
        <div className="stack" style={{ marginTop: 14 }}>
          <Field label="Název">
            <input type="text" value={f.title} onChange={set('title')} />
          </Field>
          <div className="grid2">
            <Field label="Autoři" hint="Ve tvaru Příjmení, Jméno; oddělte středníkem.">
              <input type="text" value={f.authors} onChange={set('authors')} placeholder="Novák, Jan; Svobodová, Eva" />
            </Field>
            <Field label="Rok">
              <input type="text" inputMode="numeric" value={f.year} onChange={set('year')} />
            </Field>
            <Field label="Časopis nebo vydavatel">
              <input type="text" value={f.journal} onChange={set('journal')} />
            </Field>
            <Field label="DOI">
              <input type="text" value={f.doi} onChange={set('doi')} />
            </Field>
          </div>
          <Field label="Abstrakt">
            <textarea rows={3} value={f.abstract} onChange={set('abstract')} />
          </Field>
          <div>
            <button type="button" className="btn primary" disabled={!f.title.trim()} onClick={save}>
              Přidat záznam
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---- 5. Deník hledání ------------------------------------------------------------------

function SearchLog({ project, records }: StepProps) {
  const remove = async (id: string, source: string, n: number) => {
    if (!window.confirm(`Odstranit hledání „${source}“ včetně ${plural(n, 'záznamu', 'záznamů', 'záznamů')}, které přineslo? Ztratí se i rozhodnutí o těchto záznamech.`)) return;
    await removeSearch(project, id);
  };
  return (
    <section className="card">
      <h3>5. Deník hledání</h3>
      {project.searches.length === 0 ? (
        <Empty title="Zatím žádné hledání">Každé stažení nebo nahrání záznamů se sem zapíše s datem, dotazem a počty. Deník se pak objeví v příloze práce.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Zdroj</th>
                  <th>Datum</th>
                  <th>Způsob</th>
                  <th className="num">Výsledků v databázi</th>
                  <th className="num">Nahráno</th>
                  <th>Dotaz</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {project.searches.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.source}</strong>
                    </td>
                    <td className="nowrap">{formatDate(s.date)}</td>
                    <td>{VIA_LABELS[s.via]}</td>
                    <td className="num">{s.hits ?? '–'}</td>
                    <td className="num">{records.filter((r) => r.searchId === s.id).length}</td>
                    <td style={{ maxWidth: 360 }}>
                      {s.query ? (
                        <details>
                          <summary className="small" style={{ fontWeight: 400 }}>
                            {s.query.slice(0, 50)}
                            {s.query.length > 50 ? '…' : ''}
                          </summary>
                          <code style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{s.query}</code>
                          {s.note ? <div className="small muted">{s.note}</div> : null}
                        </details>
                      ) : (
                        <span className="muted">neuveden</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn small ghost danger" onClick={() => remove(s.id, s.source, records.filter((r) => r.searchId === s.id).length)}>
                        Odstranit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Celkem v projektu: {plural(records.length, 'záznam', 'záznamy', 'záznamů')}. Pokračujte odstraněním duplicit.
          </p>
        </>
      )}
    </section>
  );
}
