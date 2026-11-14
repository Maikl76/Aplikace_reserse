import { useMemo, useState } from 'react';
import { GRADE_DOMAINS, analyzeOutcome, countBy, countByYear, forestFooter, forestRows, gradeCertainty, overlapOf, studyLabels, type OutcomeAnalysis } from '../lib/analysis';
import { mergeProject, patchRecord, setGrade } from '../lib/db';
import { barsSvg, columnsSvg, forestSvg, funnelSvg } from '../lib/figures';
import { includedRecords } from '../lib/flow';
import { unitOf } from '../lib/manuscript/build';
import { REVIEW_TYPES } from '../lib/reviewTypes';
import { MEASURES, backTransform } from '../lib/stats/effects';
import { interpretI2 } from '../lib/stats/meta';
import type { GradeRating, RecordItem, SynthesisState, Theme } from '../lib/types';
import { fmt, fmtP, slug, uid } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Check, Empty, Field, Figure, Notice, Seg, Stat, TextArea, TextInput, href } from '../ui';

const Z = 1.959963984540054;

export default function SynthesisStep({ project, records }: StepProps) {
  const included = useMemo(() => includedRecords(records, project.type), [records, project.type]);
  const modes = REVIEW_TYPES[project.type].synthesis;
  const unit = unitOf(project);
  if (included.length === 0) return <Empty title={`Zatím nejsou zařazeny žádné ${unit}`}>Syntéza pracuje se zařazenými {unit === 'studie' ? 'studiemi' : unit === 'přehledy' ? 'přehledy' : 'zdroji'} a s daty z extrakce.</Empty>;
  return (
    <div className="stack">
      {modes.includes('meta') ? <MetaSection project={project} included={included} /> : null}
      {modes.includes('charting') ? <ChartingSection project={project} included={included} /> : null}
      {modes.includes('overlap') ? <OverlapSection project={project} included={included} /> : null}
      <ThemesSection project={project} included={included} secondary={modes.length > 1} />
    </div>
  );
}

interface SectionProps {
  project: StepProps['project'];
  included: RecordItem[];
}

// ---- Metaanalýza --------------------------------------------------------------------------

/** Slovní výklad výsledku pro čtenáře, který se metaanalýzu teprve učí. */
function reading(a: OutcomeAnalysis): string[] {
  const r = a.result!;
  const m = MEASURES[a.outcome.measure];
  const est = backTransform(a.outcome.measure, r.estimate);
  const lo = backTransform(a.outcome.measure, r.ciLow);
  const hi = backTransform(a.outcome.measure, r.ciHigh);
  const out: string[] = [];
  if (m.scale === 'log') {
    const pct = Math.abs(1 - est) * 100;
    out.push(`${m.short} = ${fmt(est, 2)} znamená, že ${m.id === 'OR' ? 'šance' : 'riziko'} události je v intervenční skupině o ${fmt(pct, 0)} % ${est < 1 ? 'nižší' : 'vyšší'} než v kontrolní. Hodnota 1 by znamenala žádný rozdíl.`);
  } else if (m.id === 'SMD') {
    const size = Math.abs(est) < 0.2 ? 'zanedbatelný' : Math.abs(est) < 0.5 ? 'malý' : Math.abs(est) < 0.8 ? 'střední' : 'velký';
    out.push(`Standardizovaný rozdíl ${fmt(est, 2)} se orientačně označuje jako ${size} účinek (hranice 0,2 – 0,5 – 0,8). Znaménko říká, která skupina měla vyšší hodnoty: kladné znamená vyšší průměr v intervenční skupině.`);
  } else if (m.id === 'COR') {
    out.push(`Souhrnná korelace r = ${fmt(est, 2)}. Orientačně: 0,1 slabý, 0,3 střední, 0,5 silný vztah.`);
  } else {
    out.push(`Souhrnný odhad je ${fmt(est, 2)} v jednotkách původní škály. Hodnota 0 by znamenala žádný rozdíl.`);
  }
  const nullInside = lo <= m.nullValue && hi >= m.nullValue;
  out.push(
    nullInside
      ? `95% interval spolehlivosti (${fmt(lo, 2)} až ${fmt(hi, 2)}) obsahuje hodnotu bez účinku (${m.nullValue}) – data jsou slučitelná s prospěchem i s jeho absencí.`
      : `95% interval spolehlivosti (${fmt(lo, 2)} až ${fmt(hi, 2)}) neobsahuje hodnotu bez účinku (${m.nullValue}), výsledek je statisticky významný.`,
  );
  if (r.k > 1) out.push(`I² = ${fmt(r.I2, 0)} %: heterogenita ${interpretI2(r.I2)}. I² říká, jak velká část rozdílů mezi studiemi není náhodná, ne jak velké ty rozdíly jsou.`);
  if (r.piLow != null && r.piHigh != null) {
    const plo = backTransform(a.outcome.measure, r.piLow);
    const phi = backTransform(a.outcome.measure, r.piHigh);
    out.push(`Predikční interval ${fmt(plo, 2)} až ${fmt(phi, 2)} ukazuje, jaký účinek lze čekat v nové podobné studii. ${plo <= m.nullValue && phi >= m.nullValue ? 'Zahrnuje i hodnotu bez účinku – v některých podmínkách intervence působit nemusí.' : 'Hodnotu bez účinku nezahrnuje.'}`);
  }
  if (r.k < 5 && r.model === 'random') out.push(`Studií je jen ${r.k}. Odhad rozptylu mezi studiemi je při tak malém počtu nejistý; zvažte Knappovu–Hartungovu úpravu a závěry formulujte opatrně.`);
  return out;
}

function MetaSection({ project, included }: SectionProps) {
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const outcome = project.outcomes.find((o) => o.id === outcomeId) ?? project.outcomes[0];
  const syn = project.synthesis;
  const set = (partial: Partial<SynthesisState>) => mergeProject(project.id, 'synthesis', partial);
  const a = useMemo(() => (outcome ? analyzeOutcome(project, included, outcome) : null), [project, included, outcome]);

  if (!outcome || !a) {
    return (
      <Notice kind="warn">
        Pro metaanalýzu zatím není definován žádný výstup. Přidejte ho v kroku <a href={href('p', project.id, 'extract')}>Extrakce dat</a> a vyplňte u studií potřebná čísla.
      </Notice>
    );
  }
  const m = MEASURES[outcome.measure];
  const r = a.result;
  const sh = (v: number) => fmt(backTransform(outcome.measure, v), 2);
  const categoryFields = project.fields.filter((f) => f.kind === 'category');
  const name = `${slug(project.title)}-${slug(outcome.name)}`;

  return (
    <>
      <section className="card">
        <h3>Metaanalýza</h3>
        {project.outcomes.length > 1 ? (
          <div className="row" style={{ marginBottom: 14 }} role="group" aria-label="Výstup">
            {project.outcomes.map((o) => (
              <button key={o.id} type="button" className={`btn small ${o.id === outcome.id ? 'active' : ''}`} onClick={() => setOutcomeId(o.id)}>
                {o.name || 'Výstup bez názvu'}
              </button>
            ))}
          </div>
        ) : null}
        <div className="row top" style={{ gap: 22 }}>
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Model</div>
            <Seg ariaLabel="Model" value={syn.model} options={[{ id: 'random', label: 'Náhodné efekty' }, { id: 'fixed', label: 'Pevný efekt' }]} onChange={(model) => set({ model })} />
          </div>
          {syn.model === 'random' ? (
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Odhad τ²</div>
              <Seg ariaLabel="Odhad tau kvadrát" value={syn.tau2} options={[{ id: 'REML', label: 'REML' }, { id: 'DL', label: 'DerSimonian–Laird' }]} onChange={(tau2) => set({ tau2 })} />
            </div>
          ) : null}
          {syn.model === 'random' ? (
            <div style={{ marginTop: 22 }}>
              <Check checked={syn.knha} onChange={(knha) => set({ knha })}>
                Knappova–Hartungova úprava
              </Check>
            </div>
          ) : null}
          <div style={{ minWidth: 220 }}>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Podskupiny podle</div>
            <select value={syn.subgroupField} onChange={(e) => set({ subgroupField: e.target.value })} aria-label="Pole pro podskupiny">
              <option value="">bez podskupin</option>
              {categoryFields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Model volte předem podle toho, zda čekáte, že se skutečný účinek mezi studiemi liší (obvykle ano → náhodné efekty), ne podle toho, který výsledek vyjde lépe. Míra účinku: {m.name.toLowerCase()}.
        </p>
      </section>

      {!r ? (
        <Notice kind="warn">
          Žádná studie zatím nemá úplná data pro výstup „{outcome.name}“. Doplňte je v kroku <a href={href('p', project.id, 'extract')}>Extrakce dat</a>.
        </Notice>
      ) : (
        <>
          <div className="stats">
            <Stat label={`Souhrnný efekt (${m.short})`} value={sh(r.estimate)} sub={`95% CI ${sh(r.ciLow)} až ${sh(r.ciHigh)}`} />
            <Stat label="Statistická významnost" value={`p ${fmtP(r.p)}`} sub={`${syn.model === 'random' && syn.knha && r.k > 1 ? 't' : 'z'} = ${fmt(r.stat, 2)}`} />
            <Stat label="Počet studií" value={r.k} sub={r.model === 'random' ? 'model s náhodnými efekty' : 'model s pevným efektem'} />
            <Stat label="Heterogenita I²" value={r.k > 1 ? `${fmt(r.I2, 0)} %` : '–'} sub={r.k > 1 ? `Q(${r.df}) = ${fmt(r.Q, 1)}, p ${fmtP(r.pQ)}` : 'jedna studie'} />
            <Stat label="Rozptyl mezi studiemi τ²" value={r.model === 'random' ? fmt(r.tau2, 3) : '–'} sub={r.piLow != null && r.piHigh != null ? `predikční interval ${sh(r.piLow)} až ${sh(r.piHigh)}` : undefined} />
          </div>

          <section className="card">
            <h3>Jak výsledek číst</h3>
            <ul>
              {reading(a).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <Figure name={`${name}-lesni-graf`} caption={`Lesní graf – ${outcome.name}`} render={(mode) => forestSvg({ rows: forestRows(a), scale: a.scale, measure: m.short, footer: forestFooter(a), mode })} />

          <section className="card">
            <h3>Studie v analýze</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Studie</th>
                    {a.subgroups ? <th>Podskupina</th> : null}
                    <th className="num">{m.short}</th>
                    <th className="num">95% CI</th>
                    <th className="num">Váha</th>
                    <th className="num">{m.short} bez této studie</th>
                  </tr>
                </thead>
                <tbody>
                  {a.studies.map((s, i) => {
                    const se = Math.sqrt(s.vi);
                    const loo = a.loo.find((l) => l.omitted === s.id);
                    return (
                      <tr key={s.id}>
                        <td>{s.label}</td>
                        {a.subgroups ? <td>{s.subgroup || 'neuvedeno'}</td> : null}
                        <td className="num">{sh(s.yi)}</td>
                        <td className="num">
                          {sh(s.yi - Z * se)} až {sh(s.yi + Z * se)}
                        </td>
                        <td className="num">{fmt(r.weights[i], 1)} %</td>
                        <td className="num">{loo ? `${sh(loo.result.estimate)} (${sh(loo.result.ciLow)} až ${sh(loo.result.ciHigh)})` : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Poslední sloupec je citlivostní analýza: souhrnný odhad po vynechání dané studie. Pokud se po vynechání jedné studie výsledek výrazně změní, stojí závěr na ní.
            </p>
            {a.notes.length ? <p className="small muted" style={{ marginTop: 6, marginBottom: 0 }}>Poznámky k výpočtu: {a.notes.map((n) => `${n.label} – ${n.note}`).join('; ')}.</p> : null}
          </section>

          {a.skipped.length ? (
            <Notice kind="warn">
              Do analýzy nevstoupily studie s neúplnými nebo nepoužitelnými daty: {a.skipped.map((s) => `${s.label} (${s.error})`).join('; ')}
            </Notice>
          ) : null}

          {a.subgroups ? (
            <section className="card">
              <h3>Podskupiny</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Podskupina</th>
                      <th className="num">Studií</th>
                      <th className="num">{m.short}</th>
                      <th className="num">95% CI</th>
                      <th className="num">I²</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.subgroups.groups.map((g) => (
                      <tr key={g.name}>
                        <td>{g.name}</td>
                        <td className="num">{g.result.k}</td>
                        <td className="num">{sh(g.result.estimate)}</td>
                        <td className="num">
                          {sh(g.result.ciLow)} až {sh(g.result.ciHigh)}
                        </td>
                        <td className="num">{g.result.k > 1 ? `${fmt(g.result.I2, 0)} %` : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
                Test rozdílu mezi podskupinami: Q({a.subgroups.df}) = {fmt(a.subgroups.Qb, 2)}, p {fmtP(a.subgroups.p)}.{' '}
                <span className="muted">Analýza podskupin je observační – rozdíl mezi podskupinami nedokazuje příčinu. Při malém počtu studií v podskupině je málo spolehlivá.</span>
              </p>
            </section>
          ) : null}

          {r.k >= 3 ? (
            <section className="card">
              <h3>Publikační zkreslení</h3>
              <Figure name={`${name}-trychtyrovy-graf`} caption={`Trychtýřový graf – ${outcome.name}`} render={(mode) => funnelSvg({ points: a.studies.map((s) => ({ label: s.label, yi: s.yi, se: Math.sqrt(s.vi) })), pooled: r.estimate, scale: a.scale, measure: m.short, mode })} />
              <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
                {a.egger ? `Eggerův test: t(${a.egger.df}) = ${fmt(a.egger.t, 2)}, p ${fmtP(a.egger.p)}. ` : ''}
                <span className="muted">
                  {r.k < 10 ? `Studií je méně než deset (k = ${r.k}), test má malou sílu a v textu se z něj nevyvozují závěry. ` : ''}
                  Asymetrie grafu může mít i jiné příčiny než publikační zkreslení, zejména heterogenitu.
                </span>
              </p>
            </section>
          ) : null}

          <Grade project={project} outcomeId={outcome.id} outcomeName={outcome.name} />
        </>
      )}
    </>
  );
}

function Grade({ project, outcomeId, outcomeName }: { project: StepProps['project']; outcomeId: string; outcomeName: string }) {
  const rating = project.synthesis.grade[outcomeId];
  const blank: GradeRating = { rob: 0, inconsistency: 0, indirectness: 0, imprecision: 0, pubBias: 0, note: '' };
  return (
    <section className="card">
      <div className="row between">
        <div>
          <h3 style={{ marginBottom: 2 }}>Jistota důkazů (GRADE) – {outcomeName}</h3>
          <span className="small muted">Jak moc lze souhrnnému odhadu věřit. Výchozí úroveň je „vysoká“ (randomizované studie) a snižuje se podle pěti hledisek.</span>
        </div>
        {rating ? (
          <span className="pill accent" style={{ fontSize: 14 }}>{gradeCertainty(rating)}</span>
        ) : (
          <button type="button" className="btn small" onClick={() => setGrade(project.id, outcomeId, blank)}>
            Hodnotit jistotu
          </button>
        )}
      </div>
      {rating ? (
        <div className="stack" style={{ marginTop: 14 }}>
          {GRADE_DOMAINS.map((d) => (
            <div key={d.id} className="row top">
              <div className="grow" style={{ flexBasis: 300 }}>
                <strong style={{ fontSize: 14 }}>{d.label}</strong>
                <div className="small muted">{d.hint}</div>
              </div>
              <Seg ariaLabel={d.label} value={String(rating[d.id])} options={[{ id: '0', label: 'bez snížení' }, { id: '-1', label: '−1 závažné' }, { id: '-2', label: '−2 velmi závažné' }]} onChange={(v) => setGrade(project.id, outcomeId, { ...rating, [d.id]: Number(v) })} />
            </div>
          ))}
          <Field label="Zdůvodnění" hint="Proč jste jistotu snížili – objeví se v tabulce ve výsledcích.">
            <TextArea value={rating.note} rows={2} onCommit={(note) => setGrade(project.id, outcomeId, { ...rating, note })} />
          </Field>
          <div>
            <button type="button" className="btn small ghost" onClick={() => setGrade(project.id, outcomeId, null)}>
              Zrušit hodnocení
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---- Mapování (četnosti) ---------------------------------------------------------------------

function ChartingSection({ project, included }: SectionProps) {
  const chosen = project.synthesis.chartFields;
  const toggle = (id: string) => mergeProject(project.id, 'synthesis', { chartFields: chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id] });
  const years = countByYear(included);
  const name = slug(project.title);
  return (
    <>
      <section className="card">
        <h3>Mapa výzkumu</h3>
        <p className="small muted">Vyberte hlediska, podle kterých chcete zařazené studie spočítat. Nejlépe fungují pole typu kategorie s jednotně zapsanými hodnotami.</p>
        <div className="row">
          {project.fields.map((f) => (
            <Check key={f.id} checked={chosen.includes(f.id)} onChange={() => toggle(f.id)}>
              {f.label}
            </Check>
          ))}
        </div>
      </section>
      {years.length ? <Figure name={`${name}-roky`} caption="Počet zařazených studií podle roku publikace" render={(mode) => columnsSvg(years, { mode, title: 'Počet studií podle roku publikace' })} /> : null}
      {project.fields
        .filter((f) => chosen.includes(f.id))
        .map((f) => {
          const counts = countBy(included, f.id);
          return (
            <section key={f.id} className="card">
              <h3>{f.label}</h3>
              <div className="grid2">
                <Figure name={`${name}-${slug(f.label)}`} caption={`Počet studií – ${f.label.toLowerCase()}`} render={(mode) => barsSvg(counts.slice(0, 20), { mode, title: f.label })} />
                <div className="table-wrap" style={{ alignSelf: 'start' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{f.label}</th>
                        <th className="num">Počet</th>
                        <th className="num">Podíl</th>
                      </tr>
                    </thead>
                    <tbody>
                      {counts.map((c) => (
                        <tr key={c.label}>
                          <td>{c.label}</td>
                          <td className="num">{c.value}</td>
                          <td className="num">{fmt((100 * c.value) / included.length, 1)} %</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {counts.length > 20 ? <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>Graf ukazuje 20 nejčastějších hodnot. Příliš mnoho různých hodnot obvykle znamená, že je potřeba je sjednotit.</p> : null}
            </section>
          );
        })}
    </>
  );
}

// ---- Překryv přehledů -----------------------------------------------------------------------

function OverlapSection({ project, included }: SectionProps) {
  const ov = overlapOf(included);
  const missing = included.length - ov.c;
  return (
    <section className="card">
      <h3>Překryv primárních studií</h3>
      <p className="small muted">
        Přehledy na stejné téma často zahrnují tytéž primární studie. Kdyby se jejich závěry prostě sečetly, tytéž důkazy by se počítaly vícekrát. Ukazatel CCA (corrected covered area) vyjadřuje, jak velký tento překryv je.
      </p>
      {missing > 0 ? (
        <Notice kind="warn">
          U {missing} z {included.length} přehledů chybí seznam primárních studií. Doplňte ho v kroku <a href={href('p', project.id, 'extract')}>Extrakce dat</a>.
        </Notice>
      ) : null}
      {ov.cca == null ? (
        <p className="muted" style={{ marginTop: 10 }}>Pro výpočet jsou potřeba seznamy primárních studií alespoň u dvou přehledů.</p>
      ) : (
        <>
          <div className="stats" style={{ margin: '12px 0' }}>
            <Stat label="CCA" value={`${fmt(ov.cca, 1)} %`} sub={ov.level} />
            <Stat label="Přehledy (c)" value={ov.c} />
            <Stat label="Unikátní primární studie (r)" value={ov.r} />
            <Stat label="Zahrnutí celkem (N)" value={ov.N} />
          </div>
          <p className="small muted">
            CCA = (N − r) / (r × c − r). Do 5 % mírný, 6–10 % střední, 11–15 % vysoký, nad 15 % velmi vysoký překryv (Pieper et al., 2014). Při vysokém překryvu zvažte, zda závěry přehledů nestojí na stejných studiích.
          </p>
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Primární studie</th>
                  {ov.reviews.map((x) => (
                    <th key={x.id} style={{ textAlign: 'center' }}>{x.label}</th>
                  ))}
                  <th className="num">V kolika přehledech</th>
                </tr>
              </thead>
              <tbody>
                {ov.rows.slice(0, 300).map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {row.inReviews.map((b, i) => (
                      <td key={i} style={{ textAlign: 'center' }}>{b ? '×' : ''}</td>
                    ))}
                    <td className="num">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// ---- Témata a slovní syntéza ------------------------------------------------------------------

function ThemesSection({ project, included, secondary }: SectionProps & { secondary: boolean }) {
  const themes = project.synthesis.themes;
  const labels = useMemo(() => studyLabels(included), [included]);
  const ordered = useMemo(() => [...included].sort((a, b) => (labels.get(a.id) ?? '').localeCompare(labels.get(b.id) ?? '', 'cs')), [included, labels]);
  const save = (next: Theme[]) => mergeProject(project.id, 'synthesis', { themes: next });
  const unassigned = ordered.filter((r) => !r.themes.some((t) => themes.some((x) => x.id === t)));
  const toggle = (r: RecordItem, themeId: string) => patchRecord(r.id, { themes: r.themes.includes(themeId) ? r.themes.filter((t) => t !== themeId) : [...r.themes, themeId] });

  return (
    <section className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h3 style={{ margin: 0 }}>{secondary ? 'Slovní syntéza podle témat' : 'Syntéza podle témat'}</h3>
        <button type="button" className="btn small" onClick={() => save([...themes, { id: uid(), name: '', summary: '' }])}>
          Přidat téma
        </button>
      </div>
      <p className="small muted">
        Seskupte studie podle výstupu, typu intervence nebo jiného hlediska určeného předem. Ke každému tématu napište, co studie říkají dohromady: směr a velikost zjištění, shodu a rozdíly, kvalitu důkazů. Text se přenese do výsledků.
      </p>
      {themes.length === 0 ? (
        <Empty title="Zatím žádné téma">{secondary ? 'Témata jsou zde doplňkem – použijte je pro zjištění, která nejdou vyjádřit čísly.' : 'Začněte dvěma až pěti tématy.'}</Empty>
      ) : (
        <div className="stack">
          {themes.map((t, i) => (
            <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="pill accent">Téma {i + 1}</span>
                <span className="grow">
                  <TextInput value={t.name} placeholder="Název tématu" ariaLabel={`Název tématu ${i + 1}`} onCommit={(name) => save(themes.map((x) => (x.id === t.id ? { ...x, name } : x)))} />
                </span>
                <button type="button" className="btn small ghost danger" onClick={() => window.confirm(`Odebrat téma „${t.name}“?`) && save(themes.filter((x) => x.id !== t.id))}>
                  Odebrat
                </button>
              </div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>
                Studie v tématu ({ordered.filter((r) => r.themes.includes(t.id)).length})
              </div>
              <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                {ordered.map((r) => (
                  <button key={r.id} type="button" className={`btn small ${r.themes.includes(t.id) ? 'active' : ''}`} aria-pressed={r.themes.includes(t.id)} title={r.title} onClick={() => toggle(r, t.id)}>
                    {labels.get(r.id)}
                  </button>
                ))}
              </div>
              <Field label="Shrnutí tématu">
                <TextArea value={t.summary} rows={4} onCommit={(summary) => save(themes.map((x) => (x.id === t.id ? { ...x, summary } : x)))} />
              </Field>
            </div>
          ))}
        </div>
      )}
      {themes.length > 0 && unassigned.length > 0 ? (
        <div style={{ marginTop: 12 }}>
          <Notice kind="warn">Bez tématu zůstává: {unassigned.map((r) => labels.get(r.id)).join(', ')}.</Notice>
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <Field label="Doplňující shrnutí" hint="Volný text, který se připojí na konec výsledků syntézy.">
          <TextArea value={project.synthesis.narrative} rows={3} onCommit={(narrative) => mergeProject(project.id, 'synthesis', { narrative })} />
        </Field>
      </div>
    </section>
  );
}
