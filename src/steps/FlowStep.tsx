import { prismaSvg } from '../lib/figures';
import { flowCounts } from '../lib/flow';
import { unitOf } from '../lib/manuscript/build';
import { slug } from '../lib/util';
import type { StepProps } from '../pages/ProjectPage';
import { Empty, Figure, Notice } from '../ui';

export default function FlowStep({ project, records }: StepProps) {
  const c = flowCounts(records, project.type, project.protocol.excludeReasons);
  const unit = unitOf(project);
  if (records.length === 0) return <Empty title="Diagram zatím nemá z čeho vzniknout">Vznikne z počtů záznamů, jakmile proběhne vyhledávání a třídění.</Empty>;

  const noReason = c.excluded2.find((e) => e.reason === 'Důvod neuveden')?.n ?? 0;
  const rows: [string, number][] = [
    ['Nalezené záznamy', c.identified],
    ['Odstraněné duplicity', c.duplicates],
    ['Tříděno podle názvu a abstraktu', c.screened],
    ['Vyřazeno při třídění', c.excluded1],
    ...(c.twoStage
      ? ([
          ['Plné texty k získání', c.sought],
          ['Nezískané plné texty', c.notRetrieved],
          ['Posouzené plné texty', c.assessed],
          ['Vyřazené plné texty', c.excluded2Total],
        ] as [string, number][])
      : []),
    ['Zařazeno do přehledu', c.included],
  ];

  return (
    <div className="stack">
      {c.pending1 > 0 ? <Notice kind="warn">Třídění podle abstraktu není dokončeno: {c.pending1} záznamů čeká na rozhodnutí. Diagram zatím není konečný.</Notice> : null}
      {c.pending2 > 0 ? <Notice kind="warn">Posouzení plných textů není dokončeno: {c.pending2} textů čeká na rozhodnutí.</Notice> : null}
      {noReason > 0 ? <Notice kind="warn">U {noReason} vyřazených plných textů chybí důvod vyřazení.</Notice> : null}
      {c.pending1 === 0 && c.pending2 === 0 && noReason === 0 ? <Notice kind="good">Počty na sebe navazují a žádný záznam nečeká na rozhodnutí.</Notice> : null}

      <Figure name={`${slug(project.title)}-prisma`} caption="Vývojový diagram podle PRISMA 2020" render={(mode) => prismaSvg(c, { mode, unit })} />

      <section className="card">
        <h3>Počty v tabulce</h3>
        <div className="table-wrap" style={{ maxWidth: 520 }}>
          <table className="table">
            <tbody>
              {rows.map(([label, n]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td className="num">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {c.excluded2.length ? (
          <>
            <h4 style={{ margin: '16px 0 6px' }}>Důvody vyřazení plných textů</h4>
            <div className="table-wrap" style={{ maxWidth: 520 }}>
              <table className="table">
                <tbody>
                  {c.excluded2.map((e) => (
                    <tr key={e.reason}>
                      <td>{e.reason}</td>
                      <td className="num">{e.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
          Diagram vychází ze šablony PRISMA 2020 pro nové přehledy (Page et al., 2021). Pokud jste hledali i v registrech nebo jinými metodami, doplňte do stažené verze pravý sloupec podle{' '}
          <a href="https://www.prisma-statement.org/prisma-2020-flow-diagram" target="_blank" rel="noreferrer">
            úplné šablony
          </a>
          .
        </p>
      </section>
    </div>
  );
}
