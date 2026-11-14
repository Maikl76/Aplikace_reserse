import { useMemo, useState } from 'react';
import { GRADE_DOMAINS, analyzeNetwork, analyzeOutcome, analyzeRegression, countBy, countByYear, forestFooter, forestRows, gradeCertainty, overlapOf, studyLabels, type OutcomeAnalysis } from '../lib/analysis';
import { mergeProject, patchProject, patchRecord, setGrade } from '../lib/db';
import { barsSvg, bubbleSvg, columnsSvg, forestSvg, funnelSvg, networkSvg, type ForestRow } from '../lib/figures';
import { includedRecords } from '../lib/flow';
import { unitOf } from '../lib/manuscript/build';
import { REVIEW_TYPES } from '../lib/reviewTypes';
import { MEASURES, backTransform } from '../lib/stats/effects';
import { interpretI2 } from '../lib/stats/meta';
import type { GradeRating, OutcomeDef, RecordItem, SynthesisState, Theme } from '../lib/types';
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
  if (a.ml) {
    out.push(
      `Model má dvě složky rozptylu: mezi studiemi (σ² = ${fmt(a.ml.sigma2Between, 3)}, ${fmt(a.ml.I2Between, 0)} % celkového rozptylu) a mezi efekty uvnitř téže studie (σ² = ${fmt(a.ml.sigma2Within, 3)}, ${fmt(a.ml.I2Within, 0)} %). Zbytek připadá na náhodnou chybu jednotlivých efektů.`,
    );
  } else if (r.k > 1) out.push(`I² = ${fmt(r.I2, 0)} %: heterogenita ${interpretI2(r.I2)}. I² říká, jak velká část rozdílů mezi studiemi není náhodná, ne jak velké ty rozdíly jsou.`);
  if (r.piLow != null && r.piHigh != null) {
    const plo = backTransform(a.outcome.measure, r.piLow);
    const phi = backTransform(a.outcome.measure, r.piHigh);
    out.push(`Predikční interval ${fmt(plo, 2)} až ${fmt(phi, 2)} ukazuje, jaký účinek lze čekat v nové podobné studii. ${plo <= m.nullValue && phi >= m.nullValue ? 'Zahrnuje i hodnotu bez účinku – v některých podmínkách intervence působit nemusí.' : 'Hodnotu bez účinku nezahrnuje.'}`);
  }
  if (a.nStudies < 5 && r.model === 'random') out.push(`Studií je jen ${a.nStudies}. Odhad rozptylu mezi studiemi je při tak malém počtu nejistý; zvažte Knappovu–Hartungovu úpravu a závěry formulujte opatrně.`);
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
  const outcomeSwitch =
    project.outcomes.length > 1 ? (
      <div className="row" style={{ marginBottom: 14 }} role="group" aria-label="Výstup">
        {project.outcomes.map((o) => (
          <button key={o.id} type="button" className={`btn small ${o.id === outcome.id ? 'active' : ''}`} onClick={() => setOutcomeId(o.id)}>
            {o.name || 'Výstup bez názvu'}
            {o.network ? ' (síť)' : ''}
          </button>
        ))}
      </div>
    ) : null;

  if (outcome.network) return <NetworkSection project={project} included={included} outcome={outcome} outcomeSwitch={outcomeSwitch} />;
  const multi = a.method === 'multilevel';

  return (
    <>
      <section className="card">
        <h3>Metaanalýza</h3>
        {outcomeSwitch}
        <div className="row top" style={{ gap: 22 }}>
          {multi ? null : (
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Model</div>
              <Seg ariaLabel="Model" value={syn.model} options={[{ id: 'random', label: 'Náhodné efekty' }, { id: 'fixed', label: 'Pevný efekt' }]} onChange={(model) => set({ model })} />
            </div>
          )}
          {syn.model === 'random' && !multi ? (
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Odhad τ²</div>
              <Seg ariaLabel="Odhad tau kvadrát" value={syn.tau2} options={[{ id: 'REML', label: 'REML' }, { id: 'DL', label: 'DerSimonian–Laird' }]} onChange={(tau2) => set({ tau2 })} />
            </div>
          ) : null}
          {syn.model === 'random' && !multi ? (
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
          {multi
            ? 'Tříúrovňový model má vždy náhodné efekty a odhaduje se metodou REML. '
            : 'Model volte předem podle toho, zda čekáte, že se skutečný účinek mezi studiemi liší (obvykle ano → náhodné efekty), ne podle toho, který výsledek vyjde lépe. '}
          Míra účinku: {m.name.toLowerCase()}.
        </p>
      </section>

      {a.nEffects > a.nStudies ? (
        <section className="card">
          <h3>Více efektů z jedné studie</h3>
          <p className="small muted">
            Některé studie přispívají více efekty ({a.nEffects} efektů z {a.nStudies} studií). Efekty z téže studie nejsou nezávislé – mají stejné účastníky, výzkumníky nebo kontrolní skupinu. Kdyby se počítaly jako samostatné studie, výsledek by vypadal přesnější, než je.
          </p>
          <div className="row top" style={{ gap: 22 }}>
            <div>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Jak s nimi naložit</div>
              <Seg
                ariaLabel="Zacházení se závislými efekty"
                value={syn.dependence}
                options={[
                  { id: 'aggregate', label: 'Sloučit do jednoho efektu na studii' },
                  { id: 'multilevel', label: 'Tříúrovňový model' },
                ]}
                onChange={(dependence) => set({ dependence })}
              />
            </div>
            {syn.dependence === 'aggregate' ? (
              <div style={{ width: 210 }}>
                <Field label="Korelace efektů uvnitř studie (ρ)" hint="0 až 0,99">
                  <TextInput
                    value={String(syn.rho).replace('.', ',')}
                    inputMode="decimal"
                    onCommit={(v) => {
                      const x = Number(v.replace(',', '.'));
                      if (Number.isFinite(x)) set({ rho: Math.min(0.99, Math.max(0, x)) });
                    }}
                  />
                </Field>
              </div>
            ) : null}
          </div>
          <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
            {syn.dependence === 'aggregate'
              ? 'Efekty studie se zprůměrují a rozptyl průměru se spočítá s ohledem na jejich korelaci (Borenstein et al., 2009). Korelaci studie obvykle neuvádějí: pro různé výstupy nebo časové body u stejných lidí se volí 0,5–0,8, pro nezávislé podskupiny 0. Vyzkoušejte více hodnot a uveďte, zda se závěr mění.'
              : 'Model odhaduje zvlášť rozptyl mezi studiemi a rozptyl mezi efekty uvnitř studie (Cheung, 2014). Korelaci není třeba zadávat, model ale potřebuje dost studií (orientačně aspoň deset) a nepočítá s korelací výběrových chyb – ta vzniká, když efekty sdílejí stejné účastníky nebo kontrolní skupinu.'}
          </p>
        </section>
      ) : null}

      {!r ? (
        <Notice kind="warn">
          Žádná studie zatím nemá úplná data pro výstup „{outcome.name}“. Doplňte je v kroku <a href={href('p', project.id, 'extract')}>Extrakce dat</a>.
        </Notice>
      ) : (
        <>
          <div className="stats">
            <Stat label={`Souhrnný efekt (${m.short})`} value={sh(r.estimate)} sub={`95% CI ${sh(r.ciLow)} až ${sh(r.ciHigh)}`} />
            <Stat label="Statistická významnost" value={`p ${fmtP(r.p)}`} sub={`${syn.model === 'random' && syn.knha && r.k > 1 ? 't' : 'z'} = ${fmt(r.stat, 2)}`} />
            <Stat label="Počet studií" value={a.nStudies} sub={multi ? `${a.nEffects} efektů, tříúrovňový model` : a.method === 'aggregate' ? `${a.nEffects} efektů sloučeno, ρ = ${fmt(syn.rho, 2)}` : r.model === 'random' ? 'model s náhodnými efekty' : 'model s pevným efektem'} />
            <Stat label="Heterogenita I²" value={r.k > 1 ? `${fmt(r.I2, 0)} %` : '–'} sub={r.k > 1 ? `Q(${r.df}) = ${fmt(r.Q, 1)}, p ${fmtP(r.pQ)}` : 'jedna studie'} />
            {a.ml ? (
              <Stat label="Rozptyl mezi studiemi σ²" value={fmt(a.ml.sigma2Between, 3)} sub={`uvnitř studií σ² = ${fmt(a.ml.sigma2Within, 3)}`} />
            ) : (
              <Stat label="Rozptyl mezi studiemi τ²" value={r.model === 'random' ? fmt(r.tau2, 3) : '–'} sub={r.piLow != null && r.piHigh != null ? `predikční interval ${sh(r.piLow)} až ${sh(r.piHigh)}` : undefined} />
            )}
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
            <h3>{multi ? 'Efekty v analýze' : 'Studie v analýze'}</h3>
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
                    // U tříúrovňového modelu se vynechává celá studie; hodnotu uvádíme u jejího prvního efektu.
                    const firstOfStudy = !multi || a.studies.findIndex((x) => x.cluster === s.cluster) === i;
                    const loo = firstOfStudy ? a.loo.find((l) => l.omitted === (multi ? s.cluster : s.id)) : undefined;
                    return (
                      <tr key={s.id}>
                        <td>{s.label}</td>
                        {a.subgroups ? <td>{s.subgroup || 'neuvedeno'}</td> : null}
                        <td className="num">{sh(s.yi)}</td>
                        <td className="num">
                          {sh(s.yi - Z * se)} až {sh(s.yi + Z * se)}
                        </td>
                        <td className="num">{fmt(r.weights[i], 1)} %</td>
                        <td className="num">{loo ? `${sh(loo.result.estimate)} (${sh(loo.result.ciLow)} až ${sh(loo.result.ciHigh)})` : firstOfStudy ? '–' : ''}</td>
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
                  {multi ? 'Eggerův test předpokládá nezávislé efekty, u tříúrovňového modelu se proto nepočítá. ' : r.k < 10 ? `Studií je méně než deset (k = ${r.k}), test má malou sílu a v textu se z něj nevyvozují závěry. ` : ''}
                  Asymetrie grafu může mít i jiné příčiny než publikační zkreslení, zejména heterogenitu.
                </span>
              </p>
            </section>
          ) : null}

          <Regression project={project} included={included} a={a} name={name} />

          <Grade project={project} outcomeId={outcome.id} outcomeName={outcome.name} />
        </>
      )}
    </>
  );
}

// ---- Metaregrese ---------------------------------------------------------------------------

function Regression({ project, included, a, name }: SectionProps & { a: OutcomeAnalysis; name: string }) {
  const syn = project.synthesis;
  const candidates = project.fields.filter((f) => f.kind !== 'text');
  const reg = useMemo(() => analyzeRegression(project, included, a), [project, included, a]);
  const m = MEASURES[a.outcome.measure];
  const toggle = (id: string) => mergeProject(project.id, 'synthesis', { moderators: syn.moderators.includes(id) ? syn.moderators.filter((x) => x !== id) : [...syn.moderators, id] });
  const perModerator = reg && reg.design.names.length > 1 ? reg.k / (reg.design.names.length - 1) : null;

  return (
    <section className="card">
      <h3>Metaregrese</h3>
      <p className="small muted">
        Metaregrese zkoumá, zda velikost účinku souvisí s vlastnostmi studií (moderátory) – například s délkou intervence nebo rokem vydání. Je to obdoba regrese, kde jednotkou není člověk, ale studie. Moderátory vybírejte předem a jen několik; nabízejí se pole typu číslo a kategorie z extrakce.
      </p>
      {candidates.length === 0 ? (
        <Notice>
          Ve formuláři pro extrakci zatím není žádné pole typu číslo nebo kategorie. Přidejte ho v kroku <a href={href('p', project.id, 'extract')}>Extrakce dat</a>.
        </Notice>
      ) : (
        <div className="row">
          {candidates.map((f) => (
            <Check key={f.id} checked={syn.moderators.includes(f.id)} onChange={() => toggle(f.id)}>
              {f.label} <span className="muted small">({f.kind === 'number' ? 'číslo' : 'kategorie'})</span>
            </Check>
          ))}
        </div>
      )}

      {reg ? (
        <div className="stack" style={{ marginTop: 14 }}>
          {reg.problems.map((x) => (
            <Notice key={x} kind="warn">
              {x}
            </Notice>
          ))}
          {reg.coef.length ? (
            <>
              {perModerator != null && perModerator < 10 ? (
                <Notice kind="warn">
                  Na jeden koeficient připadá jen {fmt(perModerator, 1)} {reg.kind === 'three-level' ? 'efektů' : 'studií'}. Doporučuje se aspoň deset studií na moderátor (Cochrane Handbook, kap. 10.11.5); při menším počtu jsou výsledky nespolehlivé a snadno vznikne náhodný nález.
                </Notice>
              ) : null}
              {reg.dropped > 0 ? <Notice>Do modelu nevstoupilo {reg.dropped} {reg.kind === 'three-level' ? 'efektů' : 'studií'}, protože jim chybí hodnota některého moderátoru.</Notice> : null}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Koeficient</th>
                      <th className="num">Odhad</th>
                      <th className="num">SE</th>
                      <th className="num">95% CI</th>
                      <th className="num">{reg.test}</th>
                      <th className="num">p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reg.coef.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className="num">{fmt(c.b, 3)}</td>
                        <td className="num">{fmt(c.se, 3)}</td>
                        <td className="num">
                          {fmt(c.ciLow, 3)} až {fmt(c.ciHigh, 3)}
                        </td>
                        <td className="num">{fmt(c.stat, 2)}</td>
                        <td className="num">{fmtP(c.p).replace(/^= /, '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small" style={{ margin: 0 }}>
                Test moderátorů: {reg.test === 't' ? `F(${reg.dfM}, ${reg.dfE})` : `Q(${reg.dfM})`} = {fmt(reg.QM, 2)}, p {fmtP(reg.pQM)}. Zbytková heterogenita: Q({reg.dfE}) = {fmt(reg.QE, 2)}, p {fmtP(reg.pQE)}
                {reg.I2 != null ? `; I² = ${fmt(reg.I2, 1)} %` : ''}; τ² = {fmt(reg.tau2, 4)}.
                {reg.R2 != null ? ` Moderátory vysvětlují ${fmt(reg.R2, 1)} % rozptylu mezi studiemi (R²).` : ''}
              </p>
              <ul className="small muted" style={{ margin: 0 }}>
                <li>
                  Koeficienty jsou na škále, na které se počítá{m.scale === 'log' ? ` (logaritmus ${m.short})` : m.scale === 'z' ? ' (Fisherovo z)' : ` (${m.short})`}. Sklon říká, o kolik se efekt změní při zvýšení moderátoru o jednotku
                  {m.scale === 'log' ? `; po odlogaritmování jde o násobek ${m.short}` : ''}.
                </li>
                {Object.entries(reg.design.reference).map(([id, level]) => (
                  <li key={id}>
                    U kategorie „{project.fields.find((f) => f.id === id)?.label}“ se úrovně srovnávají s referenční úrovní „{level}“ (nejčastější).
                  </li>
                ))}
                <li>Souvislost na úrovni studií je observační a neplatí automaticky pro jednotlivce (ekologický klam). Metaregresi berte jako zdroj hypotéz, ne důkaz příčiny.</li>
              </ul>
              {reg.bubble ? (
                <Figure
                  name={`${name}-metaregrese`}
                  caption={`Metaregrese – ${a.outcome.name} podle proměnné „${reg.bubble.xLabel}“`}
                  render={(mode) => bubbleSvg({ ...reg.bubble!, scale: a.scale, measure: m.short, mode })}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ---- Síťová metaanalýza ----------------------------------------------------------------------

function NetworkSection({ project, included, outcome, outcomeSwitch }: SectionProps & { outcome: OutcomeDef; outcomeSwitch: React.ReactNode }) {
  const syn = project.synthesis;
  const net = useMemo(() => analyzeNetwork(project, included, outcome), [project, included, outcome]);
  const m = MEASURES[outcome.measure];
  const sh = (v: number) => fmt(backTransform(outcome.measure, v), 2);
  const name = `${slug(project.title)}-${slug(outcome.name)}`;
  const saveOutcome = (partial: Partial<OutcomeDef>) => patchProject(project.id, { outcomes: project.outcomes.map((o) => (o.id === outcome.id ? { ...o, ...partial } : o)) });
  const out = net.outcomeResult;
  const res = out.ok ? out.result : null;
  const better = outcome.smallerBetter ? 'nižší' : 'vyšší';

  return (
    <>
      <section className="card">
        <h3>Síťová metaanalýza</h3>
        {outcomeSwitch}
        <p className="small muted">
          Síťová metaanalýza srovnává tři a více léčeb najednou. Kromě přímých důkazů (studie srovnávající A s B) využívá i nepřímé: pokud studie srovnávají A s C a B s C, lze z nich odvodit i rozdíl mezi A a B. Stojí na předpokladu, že studie různých srovnání jsou si podobné ve všem, co účinek ovlivňuje (tranzitivita).
        </p>
        <div className="row top" style={{ gap: 22 }}>
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Model</div>
            <Seg ariaLabel="Model" value={syn.model} options={[{ id: 'random', label: 'Náhodné efekty' }, { id: 'fixed', label: 'Společný efekt' }]} onChange={(model) => mergeProject(project.id, 'synthesis', { model })} />
          </div>
          {res ? (
            <div style={{ minWidth: 220 }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Referenční léčba</div>
              <select value={res.reference} onChange={(e) => saveOutcome({ reference: e.target.value })} aria-label="Referenční léčba">
                {res.treatments.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Lepší výsledek je</div>
            <Seg ariaLabel="Směr lepšího výsledku" value={outcome.smallerBetter ? 'low' : 'high'} options={[{ id: 'high', label: 'vyšší hodnota' }, { id: 'low', label: 'nižší hodnota' }]} onChange={(v) => saveOutcome({ smallerBetter: v === 'low' })} />
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Míra účinku: {m.name.toLowerCase()}. Heterogenita τ² se předpokládá stejná pro všechna srovnání a odhaduje se metodou REML. Jako referenční se obvykle volí placebo nebo běžná péče.
        </p>
      </section>

      {net.unnamed.length ? (
        <Notice kind="warn">
          U těchto studií chybí název některé ze srovnávaných léčeb, do sítě proto nevstoupily: {net.unnamed.join(', ')}. Doplňte ho v kroku <a href={href('p', project.id, 'extract')}>Extrakce dat</a>.
        </Notice>
      ) : null}
      {net.skipped.length ? <Notice kind="warn">Efekt nešel spočítat: {net.skipped.map((x) => `${x.label} (${x.error})`).join('; ')}</Notice> : null}
      {out.skipped.length ? <Notice kind="warn">Do sítě nešlo zařadit: {out.skipped.map((x) => `${x.label} – ${x.reason}`).join('; ')}.</Notice> : null}
      {!out.ok ? <Notice kind="warn">{out.error}</Notice> : null}

      {res ? (
        <>
          <div className="stats">
            <Stat label="Studie" value={res.studies} sub={res.multiArm ? `z toho ${res.multiArm} se třemi a více rameny` : 'všechny dvouramenné'} />
            <Stat label="Léčby" value={res.treatments.length} sub={`${res.edges.length} přímých srovnání z ${(res.treatments.length * (res.treatments.length - 1)) / 2} možných`} />
            <Stat label="Heterogenita τ²" value={res.model === 'random' ? fmt(res.tau2, 3) : '–'} sub={res.model === 'random' ? 'model s náhodnými efekty' : 'model se společným efektem'} />
            <Stat label="Heterogenita a nekonzistence" value={res.df > 0 ? `I² = ${fmt(res.I2, 0)} %` : '–'} sub={res.df > 0 ? `Q(${res.df}) = ${fmt(res.Q, 1)}, p ${fmtP(res.pQ)}` : 'nelze hodnotit'} />
            <Stat label="Nekonzistence mezi designy" value={res.dfBetween > 0 ? `p ${fmtP(res.pBetween)}` : '–'} sub={res.dfBetween > 0 ? `Q(${res.dfBetween}) = ${fmt(res.Qbetween, 1)}` : 'síť nemá uzavřené smyčky'} />
          </div>

          <Figure name={`${name}-sit`} caption={`Síť léčeb – ${outcome.name}`} render={(mode) => networkSvg({ nodes: res.nodes.map((n) => ({ label: n.treatment, studies: n.studies })), edges: res.edges, mode })} />

          <section className="card">
            <h3>Jak výsledek číst</h3>
            <ul>
              <li>
                Každá léčba se srovnává s referenční („{res.reference}“). {m.scale === 'log' ? `${m.short} menší než 1 znamená nižší výskyt události než u referenční léčby.` : 'Hodnota 0 znamená žádný rozdíl oproti referenční léčbě.'} Za lepší se zde považuje {better} hodnota.
              </li>
              <li>
                P-skóre (0 až 1) shrnuje, s jakou jistotou je léčba lepší než ostatní. Není to pravděpodobnost, že je nejlepší, a neříká nic o velikosti rozdílů – dvě léčby s rozdílným P-skóre se mohou lišit zanedbatelně. Pořadí vždy čtěte spolu s intervaly spolehlivosti.
              </li>
              <li>
                Konzistence znamená, že přímé a nepřímé důkazy říkají totéž. {res.dfBetween > 0 ? `Test nekonzistence mezi designy vyšel p ${fmtP(res.pBetween)}${res.pBetween < 0.05 ? ' – přímé a nepřímé důkazy se rozcházejí a výsledky sítě je třeba brát s rezervou.' : ' – rozpor nebyl prokázán; test má ale při malém počtu studií malou sílu.'}` : 'V této síti ji nelze testovat, protože žádné srovnání nemá zároveň přímé a nepřímé důkazy z různých typů studií.'}
              </li>
              {res.treatments.length > res.studies ? <li>Léčeb je víc než studií. Většina srovnání stojí na jediné studii nebo jen na nepřímých důkazech; závěry formulujte velmi opatrně.</li> : null}
            </ul>
          </section>

          <Figure
            name={`${name}-lecby`}
            caption={`Léčby oproti referenční („${res.reference}“) – ${outcome.name}`}
            render={(mode) =>
              forestSvg({
                rows: res.treatments
                  .map((t, i): ForestRow => ({ kind: 'study', label: t, yi: res.vsReference[i].est, lo: res.vsReference[i].ciLow, hi: res.vsReference[i].ciHigh }))
                  .filter((row) => row.label !== res.reference),
                scale: net.scale,
                measure: m.short,
                labelHeader: `Léčba (oproti: ${res.reference})`,
                footer: [res.df > 0 ? `Heterogenita a nekonzistence: Q(${res.df}) = ${fmt(res.Q, 2)}, p ${fmtP(res.pQ)}; I² = ${fmt(res.I2, 1)} %; τ² = ${fmt(res.tau2, 4)}` : 'Heterogenitu nelze hodnotit.'],
                mode,
              })
            }
          />

          <section className="card">
            <h3>Pořadí léčeb</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Pořadí</th>
                    <th>Léčba</th>
                    <th className="num">P-skóre</th>
                    <th className="num">{m.short} oproti „{res.reference}“</th>
                    <th className="num">95% CI</th>
                    <th className="num">Studií</th>
                  </tr>
                </thead>
                <tbody>
                  {res.pscore.map((p, i) => {
                    const e = res.vsReference[res.treatments.indexOf(p.treatment)];
                    return (
                      <tr key={p.treatment}>
                        <td>{i + 1}.</td>
                        <td>{p.treatment}</td>
                        <td className="num">{fmt(p.value, 2)}</td>
                        <td className="num">{p.treatment === res.reference ? 'referenční' : sh(e.est)}</td>
                        <td className="num">{p.treatment === res.reference ? '–' : `${sh(e.ciLow)} až ${sh(e.ciHigh)}`}</td>
                        <td className="num">{res.nodes.find((n) => n.treatment === p.treatment)?.studies}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Všechna srovnání</h3>
            <p className="small muted">
              V buňce je {m.short} léčby v řádku oproti léčbě ve sloupci s 95% intervalem spolehlivosti. Léčby jsou seřazeny podle P-skóre. Tučně jsou srovnání, jejichž interval neobsahuje hodnotu bez rozdílu ({m.nullValue}).
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    {res.pscore.map((p) => (
                      <th key={p.treatment} className="num">
                        {p.treatment}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.pscore.map((row) => (
                    <tr key={row.treatment}>
                      <th style={{ textAlign: 'left' }}>{row.treatment}</th>
                      {res.pscore.map((col) => {
                        if (row.treatment === col.treatment) return <td key={col.treatment} className="num muted">–</td>;
                        const e = res.league[res.treatments.indexOf(row.treatment)][res.treatments.indexOf(col.treatment)];
                        const sig = e.ciLow > 0 || e.ciHigh < 0;
                        return (
                          <td key={col.treatment} className="num nowrap" style={sig ? { fontWeight: 600 } : undefined}>
                            {sh(e.est)}
                            <div className="small muted" style={{ fontWeight: 400 }}>
                              {sh(e.ciLow)} až {sh(e.ciHigh)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h3>Přímé a nepřímé důkazy</h3>
            <p className="small muted">
              U každého srovnání, které některá studie zkoumala přímo, tabulka ukazuje přímý odhad, nepřímý odhad odvozený ze zbytku sítě a jejich rozdíl. Velký rozdíl (malé p) upozorňuje na nekonzistenci u daného srovnání.
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Srovnání</th>
                    <th className="num">Studií</th>
                    <th className="num">Přímý odhad</th>
                    <th className="num">Nepřímý odhad</th>
                    <th className="num">Síťový odhad</th>
                    <th className="num">p rozdílu</th>
                  </tr>
                </thead>
                <tbody>
                  {res.split.map((x) => (
                    <tr key={`${x.a}|${x.b}`}>
                      <td>
                        {x.a} oproti {x.b}
                      </td>
                      <td className="num">{x.k}</td>
                      <td className="num">{sh(x.direct.est)}</td>
                      <td className="num">{x.indirect ? sh(x.indirect.est) : <span className="muted">jen přímé</span>}</td>
                      <td className="num">{sh(x.network.est)}</td>
                      <td className="num">{x.p != null ? fmtP(x.p).replace(/^= /, '') : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Nepřímý odhad se počítá zpětně ze síťového a přímého odhadu; u srovnání, do kterých vstupují studie se třemi a více rameny, je jen přibližný. Mnoho testů najednou znamená i náhodně „významné“ rozdíly.
            </p>
          </section>
          {res.notes.length ? <Notice>Poznámky k výpočtu: {res.notes.join(' ')}</Notice> : null}

          <Grade project={project} outcomeId={outcome.id} outcomeName={outcome.name} />
        </>
      ) : null}
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
