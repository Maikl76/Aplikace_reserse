import { mergeProject, patchProject, setDoubleMode } from '../lib/db';
import { FRAMEWORKS, REVIEW_TYPES } from '../lib/reviewTypes';
import type { Project, Protocol } from '../lib/types';
import { download, formatDate, lines, nowIso, slug } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Field, Notice, Seg, TextArea, TextInput } from '../ui';

/** Protokol jako samostatný dokument (Markdown) – k registraci nebo ke schválení vedoucím. */
export function protocolMarkdown(project: Project): string {
  const conf = REVIEW_TYPES[project.type];
  const q = project.question;
  const p = project.protocol;
  const list = (text: string) => (lines(text).length ? lines(text).map((l) => `- ${l}`).join('\n') : '- (nevyplněno)');
  const fw = FRAMEWORKS[q.framework];
  return [
    `# Protokol: ${project.title}`,
    '',
    `Typ přehledu: ${conf.name} · Standard: ${conf.standard.name} · Datum: ${formatDate(nowIso())}`,
    '',
    '## Východiska a cíl',
    q.rationale.trim() || '(nevyplněno)',
    '',
    `**Cíl:** ${q.aim.trim() || '(nevyplněno)'}`,
    '',
    `**Výzkumná otázka:** ${q.text.trim() || '(nevyplněno)'}`,
    '',
    `## Prvky otázky (${fw.name})`,
    ...fw.elements.map((e) => `- **${e.label}:** ${(q.elements[e.id] ?? '').trim() || '(nevyplněno)'}`),
    '',
    '## Kritéria zařazení',
    list(p.include),
    '',
    '## Kritéria vyřazení',
    list(p.exclude),
    '',
    '## Omezení',
    `- Typy publikací a designy: ${p.designs.trim() || '(bez omezení)'}`,
    `- Období: ${p.yearFrom.trim() || '…'}–${p.yearTo.trim() || '…'}`,
    `- Jazyky: ${p.languages.trim() || '(bez omezení)'}`,
    '',
    '## Informační zdroje',
    list(p.sources),
    '',
    '## Výběr studií',
    project.team.double
      ? `Třídění provádějí nezávisle dva hodnotitelé (${project.team.reviewers.map((r) => r.name.trim()).filter(Boolean).join(', ') || 'jména nevyplněna'}); neshody řeší dohodou, případně s třetí osobou.`
      : 'Třídění provádí jeden hodnotitel.',
    `Upřesnění: ${p.reviewers.trim() || '(nevyplněno)'}`,
    '',
    'Důvody vyřazení plných textů (v tomto pořadí):',
    list(p.excludeReasons),
    '',
    '## Registrace',
    p.registration.trim() || conf.registry,
    '',
  ].join('\n');
}

export default function ProtocolStep({ project }: StepProps) {
  const p = project.protocol;
  const conf = REVIEW_TYPES[project.type];
  const set = (partial: Partial<Protocol>) => mergeProject(project.id, 'protocol', partial);

  return (
    <div className="stack">
      <section className="card">
        <h3>Kritéria způsobilosti</h3>
        <div className="grid2">
          <Field label="Kritéria zařazení" hint="Jedno na řádek. Každé má jít ověřit z textu studie.">
            <TextArea value={p.include} rows={6} onCommit={(include) => set({ include })} placeholder={'Účastníci ve věku 12–18 let\nPohybová intervence v délce alespoň 4 týdny\nMěřené příznaky deprese'} />
          </Field>
          <Field label="Kritéria vyřazení" hint="Jedno na řádek.">
            <TextArea value={p.exclude} rows={6} onCommit={(exclude) => set({ exclude })} placeholder={'Studie bez kontrolní skupiny\nKonferenční abstrakty bez plného textu'} />
          </Field>
        </div>
        <div className="grid3" style={{ marginTop: 14 }}>
          <Field label="Typy studií a publikací" hint="Např. randomizované studie; recenzované články.">
            <TextInput value={p.designs} onCommit={(designs) => set({ designs })} />
          </Field>
          <Field label="Období od – do" hint="Rok vydání. Omezení zdůvodněte v textu.">
            <span className="row" style={{ flexWrap: 'nowrap' }}>
              <TextInput value={p.yearFrom} onCommit={(yearFrom) => set({ yearFrom })} placeholder="od" ariaLabel="Rok od" inputMode="numeric" />
              <TextInput value={p.yearTo} onCommit={(yearTo) => set({ yearTo })} placeholder="do" ariaLabel="Rok do" inputMode="numeric" />
            </span>
          </Field>
          <Field label="Jazyky" hint="Např. čeština, slovenština, angličtina.">
            <TextInput value={p.languages} onCommit={(languages) => set({ languages })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>Zdroje a postup výběru</h3>
        <div className="grid2">
          <Field label="Plánované informační zdroje" hint="Databáze a doplňkové zdroje, jeden na řádek.">
            <TextArea value={p.sources} rows={5} onCommit={(sources) => set({ sources })} placeholder={'PubMed\nScopus\nSPORTDiscus\nSeznamy literatury zařazených studií'} />
          </Field>
          <Field label="Důvody vyřazení plných textů" hint="V pořadí, v jakém je budete posuzovat. Nabídnou se při posuzování plných textů a objeví se v diagramu.">
            <TextArea value={p.excludeReasons} rows={5} onCommit={(excludeReasons) => set({ excludeReasons })} />
          </Field>
        </div>
        <div className="grid2" style={{ marginTop: 14 }}>
          <Field label="Kdo vybírá a hodnotí" hint="Např. „autor práce; 10 % záznamů nezávisle ověřil vedoucí práce“. Objeví se v metodice.">
            <TextInput value={p.reviewers} onCommit={(reviewers) => set({ reviewers })} />
          </Field>
          <Field label="Registrace protokolu" hint={conf.registry}>
            <TextInput value={p.registration} onCommit={(registration) => set({ registration })} placeholder="Např. OSF, https://osf.io/…, registrováno 3. 2. 2026" />
          </Field>
        </div>
      </section>

      <section className="card">
        <h3>Hodnotitelé</h3>
        <p className="small muted">
          Když záznamy třídí dva lidé nezávisle na sobě, sníží se riziko, že vhodná studie vypadne omylem nebo kvůli předpojatosti jednoho hodnotitele. U systematických přehledů se to očekává; u bakalářské práce obvykle třídí autor sám a uvede to mezi omezeními, případně část záznamů nezávisle ověří vedoucí.
        </p>
        {project.reviewerCopy ? (
          <Notice>Toto je kopie projektu pro druhého hodnotitele; nastavení hodnotitelů se mění v hlavním projektu.</Notice>
        ) : (
          <>
            <Seg
              ariaLabel="Počet hodnotitelů"
              value={project.team.double ? 'double' : 'single'}
              options={[
                { id: 'single', label: 'Jeden hodnotitel' },
                { id: 'double', label: 'Dva nezávislí hodnotitelé' },
              ]}
              onChange={(v) => {
                const double = v === 'double';
                if (double === project.team.double) return;
                if (window.confirm(double ? 'Zapnout třídění dvěma hodnotiteli? Dosavadní rozhodnutí se zapíšou jako rozhodnutí prvního hodnotitele a záznamy budou čekat na druhého.' : 'Vrátit se k jednomu hodnotiteli? U záznamů bez shody se použije rozhodnutí prvního hodnotitele.')) void setDoubleMode(project, double);
              }}
            />
            {project.team.double ? (
              <div className="grid2" style={{ marginTop: 14 }}>
                {project.team.reviewers.map((r, i) => (
                  <Field key={r.id} label={`${i + 1}. hodnotitel`} hint={i === 0 ? 'Jméno nebo iniciály; objeví se v metodice.' : undefined}>
                    <TextInput value={r.name} onCommit={(name) => patchProject(project.id, { team: { ...project.team, reviewers: project.team.reviewers.map((x) => (x.id === r.id ? { ...x, name } : x)) } })} />
                  </Field>
                ))}
              </div>
            ) : null}
            {project.team.double ? (
              <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
                Hodnotitelé mohou třídit střídavě na jednom počítači, nebo každý na svém – výměnu souborů najdete v krocích Třídění a Posouzení plných textů. Aplikace spočítá míru shody (Cohenovo κ) a ukáže neshody k vyřešení.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="card">
        <div className="row between">
          <div>
            <h3 style={{ marginBottom: 2 }}>Protokol jako dokument</h3>
            <span className="small muted">Shrnutí otázky, kritérií a zdrojů ke schválení vedoucím nebo k registraci.</span>
          </div>
          <button type="button" className="btn" onClick={() => download(`${slug(project.title)}-protokol.md`, protocolMarkdown(project), 'text/markdown;charset=utf-8')}>
            Stáhnout protokol
          </button>
        </div>
      </section>
    </div>
  );
}
