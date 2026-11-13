import { Packer } from 'docx';
import { useMemo, useState } from 'react';
import { STYLE_LABELS } from '../lib/citations';
import { mergeProject, setSectionText } from '../lib/db';
import { svgToPng } from '../lib/figures';
import { TEMPLATE_LABELS, buildManuscript, countTodos, isEdited, toBlocks, type Block, type Section } from '../lib/manuscript/build';
import { buildDocx, toMarkdown } from '../lib/manuscript/export';
import type { CitationStyle, ManuscriptState, Template } from '../lib/types';
import { download, plural, slug } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Field, Notice, Seg, TextArea, TextInput, WithTodos, useFigMode } from '../ui';

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function WriteStep({ project, records }: StepProps) {
  const mode = useFigMode();
  const m = project.manuscript;
  const set = (partial: Partial<ManuscriptState>) => mergeProject(project.id, 'manuscript', partial);
  const ms = useMemo(() => buildManuscript(project, records, mode), [project, records, mode]);
  const todos = useMemo(() => countTodos(toBlocks(ms, project)), [ms, project]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const thesis = m.template !== 'article';

  const exportDocx = async () => {
    setBusy(true);
    setError('');
    try {
      // Do dokumentu jdou obrázky vždy ve světlém provedení.
      const light = buildManuscript(project, records, 'light');
      const doc = await buildDocx(project, light, async (svg) => new Uint8Array(await (await svgToPng(svg, 3)).arrayBuffer()));
      download(`${slug(project.title)}.docx`, await Packer.toBlob(doc));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dokument se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <section className="card">
        <h3>Podoba dokumentu</h3>
        <div className="row top" style={{ gap: 22, marginBottom: 14 }}>
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Typ textu</div>
            <Seg<Template> ariaLabel="Typ textu" value={m.template} options={(Object.keys(TEMPLATE_LABELS) as Template[]).map((id) => ({ id, label: TEMPLATE_LABELS[id] }))} onChange={(template) => set({ template })} />
          </div>
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Citační styl</div>
            <Seg<CitationStyle> ariaLabel="Citační styl" value={m.style} options={(Object.keys(STYLE_LABELS) as CitationStyle[]).map((id) => ({ id, label: STYLE_LABELS[id] }))} onChange={(style) => set({ style })} />
          </div>
        </div>
        <div className="grid2">
          <Field label="Autor">
            <TextInput value={m.author} onCommit={(author) => set({ author })} />
          </Field>
          {thesis ? (
            <Field label="Vedoucí práce">
              <TextInput value={m.supervisor} onCommit={(supervisor) => set({ supervisor })} />
            </Field>
          ) : null}
          <Field label={thesis ? 'Škola a fakulta' : 'Pracoviště'}>
            <TextInput value={m.institution} onCommit={(institution) => set({ institution })} />
          </Field>
          <Field label="Rok">
            <TextInput value={m.year} onCommit={(year) => set({ year })} inputMode="numeric" />
          </Field>
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Klíčová slova" hint="Tři až pět, oddělená čárkou.">
            <TextInput value={m.keywords} onCommit={(keywords) => set({ keywords })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <div className="row between">
          <div>
            <h3 style={{ marginBottom: 2 }}>Stažení</h3>
            <span className="small muted">Dokument Word obsahuje {thesis ? 'titulní stranu, obsah, ' : ''}text, tabulky, obrázky, seznam literatury a přílohy. Místa k doplnění jsou v něm žlutě.</span>
          </div>
          <div className="row">
            <button type="button" className="btn primary" disabled={busy} onClick={exportDocx}>
              {busy ? 'Připravuji…' : 'Stáhnout Word (DOCX)'}
            </button>
            <button type="button" className="btn" onClick={() => download(`${slug(project.title)}.md`, toMarkdown(project, ms), 'text/markdown;charset=utf-8')}>
              Stáhnout Markdown
            </button>
          </div>
        </div>
        <div className="stack" style={{ marginTop: 12 }}>
          {todos > 0 ? (
            <Notice kind="warn">V textu zbývá {plural(todos, 'místo', 'místa', 'míst')} k doplnění. Jsou označena [DOPLŇTE: …] – některá vyplníte v předchozích krocích, jiná přímo zde.</Notice>
          ) : (
            <Notice kind="good">V textu nezbývá žádné označené místo k doplnění.</Notice>
          )}
          {thesis ? <Notice>Obsah se ve Wordu vyplní při otevření dokumentu – na dotaz, zda aktualizovat pole, odpovězte „Ano“. Formální úpravu (okraje, písmo, titulní strana) přizpůsobte šabloně své fakulty.</Notice> : null}
          {error ? <Notice kind="bad">{error}</Notice> : null}
        </div>
      </section>

      {ms.sections.map((s) => (
        <SectionCard key={s.id} project={project} section={s} />
      ))}
    </div>
  );
}

function SectionCard({ project, section }: { project: StepProps['project']; section: Section }) {
  const edited = isEdited(project, section);
  const own = project.manuscript.sections[section.id] ?? '';
  const human = section.kind === 'human';
  const showEditor = edited || (human && !section.generated);
  const text = edited ? own : section.generated;

  return (
    <section className="card section-card" style={section.level === 2 ? { marginLeft: 22 } : undefined}>
      <div className="row between" style={{ marginBottom: 4 }}>
        {section.level === 1 ? (
          <h2 style={{ fontSize: 19 }}>
            {section.number ? `${section.number} ` : ''}
            {section.title}
          </h2>
        ) : (
          <h3 style={{ margin: 0 }}>
            {section.number ? `${section.number} ` : ''}
            {section.title}
          </h3>
        )}
        <span className="row">
          {text.trim() ? <span className="small muted">{plural(words(text), 'slovo', 'slova', 'slov')}</span> : null}
          <span className={`pill ${human ? 'warn' : edited ? 'accent' : ''}`}>{human ? 'píšete vy' : edited ? 'upraveno ručně' : 'z dat projektu'}</span>
        </span>
      </div>
      {section.guidance ? <p className="small muted">{section.guidance}</p> : null}

      {showEditor ? (
        <>
          <TextArea value={own} rows={Math.min(18, Math.max(5, Math.ceil(own.length / 110) + 2))} ariaLabel={section.title} placeholder="Pište sem. Odstavce oddělte prázdným řádkem." onCommit={(v) => setSectionText(project.id, section.id, v)} />
          {section.generated ? (
            <div className="row" style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => window.confirm('Zahodit vlastní úpravy tohoto oddílu a vrátit text vygenerovaný z dat projektu?') && setSectionText(project.id, section.id, '')}
              >
                Vrátit vygenerovaný text
              </button>
              <span className="small muted">Ručně upravený oddíl se už podle dat projektu sám nemění.</span>
            </div>
          ) : null}
        </>
      ) : section.generated ? (
        <>
          <div className="generated">
            <WithTodos text={section.generated} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn small" onClick={() => setSectionText(project.id, section.id, section.generated)}>
              {human ? 'Převzít návrh a upravit' : 'Upravit ručně'}
            </button>
            {human ? null : <span className="small muted">Text se mění s daty projektu, dokud ho neupravíte ručně.</span>}
          </div>
        </>
      ) : null}

      {section.extras.length ? (
        <div className="stack" style={{ marginTop: 14 }}>
          <Extras blocks={section.extras} />
        </div>
      ) : null}
    </section>
  );
}

function Extras({ blocks }: { blocks: Block[] }) {
  const refs = blocks.filter((b) => b.t === 'ref');
  return (
    <>
      {blocks.map((b, i) => {
        if (b.t === 'table') {
          const shown = b.rows.slice(0, 8);
          return (
            <div key={i}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>{b.caption}</div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      {b.head.map((h, j) => (
                        <th key={j}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((row, r) => (
                      <tr key={r}>
                        {row.map((c, j) => (
                          <td key={j} style={{ overflowWrap: 'anywhere' }}>{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {b.rows.length > shown.length ? <div className="small muted" style={{ marginTop: 4 }}>… a dalších {b.rows.length - shown.length} řádků v dokumentu.</div> : null}
              {b.rows.length === 0 ? <div className="small muted" style={{ marginTop: 4 }}>Tabulka je zatím prázdná.</div> : null}
            </div>
          );
        }
        if (b.t === 'figure') {
          return (
            <figure key={i} className="figure" style={{ margin: 0 }}>
              <div className="canvas" dangerouslySetInnerHTML={{ __html: b.svg }} />
              <figcaption className="bar">{b.caption}</figcaption>
            </figure>
          );
        }
        return null;
      })}
      {refs.length ? (
        <ol className="small" style={{ paddingLeft: 22 }}>
          {refs.map((b, i) =>
            b.t === 'ref' ? (
              <li key={i} style={{ marginBottom: 6, overflowWrap: 'anywhere' }}>
                {b.spans.map((s, j) => (s.italic ? <em key={j}>{s.text}</em> : <span key={j}>{s.text}</span>))}
              </li>
            ) : null,
          )}
        </ol>
      ) : null}
    </>
  );
}
