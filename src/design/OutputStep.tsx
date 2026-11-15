import { useMemo, useState } from 'react';
import { patchDesign } from '../lib/db';
import { DESIGN_STEP_LABELS, designOf, openPoints } from '../lib/design/logic';
import { buildDesignDoc, designBrief } from '../lib/design/output';
import { APP_NAME, APP_VERSION } from '../lib/manuscript/build';
import { download, formatDate, nowIso, slug } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { CopyButton, Field, Notice, TextInput, href } from '../ui';
import { DocPreview } from './shared';

export default function OutputStep({ project }: StepProps) {
  const design = designOf(project);
  const doc = useMemo(() => buildDesignDoc(project), [project]);
  const brief = useMemo(() => designBrief(project), [project]);
  const open = openPoints(design);
  const [busy, setBusy] = useState(false);
  const meta = [design.author.trim(), design.institution.trim(), formatDate(nowIso())].filter(Boolean);
  const subtitle = 'Návrh aplikace';

  const word = async () => {
    setBusy(true);
    try {
      const [{ Packer }, { buildBlocksDocx }] = await Promise.all([import('docx'), import('../lib/manuscript/export')]);
      const file = await buildBlocksDocx({ title: project.title, subtitle, meta, description: `Vytvořeno v aplikaci ${APP_NAME} ${APP_VERSION}` }, doc.blocks);
      download(`${slug(project.title)}-navrh.docx`, await Packer.toBlob(file));
    } finally {
      setBusy(false);
    }
  };
  const markdown = async () => {
    const { blocksToMarkdown } = await import('../lib/manuscript/export');
    download(`${slug(project.title)}-navrh.md`, blocksToMarkdown(project.title, [subtitle, ...meta], doc.blocks), 'text/markdown;charset=utf-8');
  };

  return (
    <div className="stack">
      <section className="card">
        <h3>Otevřené body</h3>
        {open.length ? (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Návrh lze stáhnout i tak; tato místa v něm zůstanou označená k doplnění.
            </p>
            <ul className="open-points">
              {open.map((o) => (
                <li key={o.step + o.text}>
                  <a href={href('p', project.id, o.step)}>{DESIGN_STEP_LABELS[o.step]}</a>: {o.text}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Notice kind="good">Všechna rozhodnutí, která průvodce sleduje, jsou zapsána.</Notice>
        )}
      </section>

      <section className="card">
        <h3>Dokument s návrhem</h3>
        <div className="grid-2">
          <Field label="Autor">
            <TextInput value={design.author} onCommit={(author) => patchDesign(project.id, { author })} />
          </Field>
          <Field label="Škola nebo pracoviště">
            <TextInput value={design.institution} onCommit={(institution) => patchDesign(project.id, { institution })} />
          </Field>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button type="button" className="btn primary" onClick={word} disabled={busy}>
            {busy ? 'Připravuji…' : 'Stáhnout Word'}
          </button>
          <button type="button" className="btn" onClick={markdown}>
            Stáhnout Markdown
          </button>
        </div>
        <details style={{ marginTop: 14 }} open>
          <summary>Náhled dokumentu</summary>
          <DocPreview blocks={doc.blocks} />
        </details>
      </section>

      <section className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Zadání pro toho, kdo bude stavět</h3>
          <div className="row">
            <CopyButton text={brief} label="Kopírovat zadání" />
            <button type="button" className="btn small" onClick={() => download(`${slug(project.title)}-zadani.md`, brief, 'text/markdown;charset=utf-8')}>
              Stáhnout
            </button>
          </div>
        </div>
        <p className="muted">
          Stručný souhrn účelu, požadavků a rozhodnutí. Lze ho předat vývojáři nebo vložit do nástroje AI. Je to výchozí bod pro rozhovor, ne hotový návod; výsledek je potřeba zkontrolovat.
        </p>
        <pre className="brief">{brief}</pre>
      </section>
    </div>
  );
}
