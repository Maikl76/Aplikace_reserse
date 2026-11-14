// Společné prvky pro třídění dvěma hodnotiteli: kdo právě třídí, míra shody,
// výměna souborů mezi hodnotiteli a řešení neshod.

import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type ReactNode } from 'react';
import { exportReviewerPackage, exportVotes, getSetting, importVotes, setSetting } from '../lib/db';
import { interpretKappa, reviewerName, type StageStats } from '../lib/reviewers';
import type { Project } from '../lib/types';
import { download, fmt, slug } from '../lib/util';
import { Notice, Seg } from '../ui';

/** Kdo v tomto prohlížeči právě třídí. V kopii pro druhého hodnotitele je to dáno pevně. */
export function useReviewer(project: Project): { me: string; setMe: (id: string) => void; fixed: boolean } {
  const key = `reviewer:${project.id}`;
  const saved = useLiveQuery(() => getSetting(key), [key]);
  const fixed = !!project.reviewerCopy;
  const known = project.team.reviewers.some((r) => r.id === saved);
  const me = project.reviewerCopy ?? (known ? saved! : project.team.reviewers[0].id);
  return { me, setMe: (id) => void setSetting(key, id), fixed };
}

export type ReviewView = 'screen' | 'conflicts';

export function ReviewerBar({
  project,
  stats,
  me,
  setMe,
  fixed,
  view,
  setView,
  stageLabel,
}: {
  project: Project;
  stats: StageStats;
  me: string;
  setMe: (id: string) => void;
  fixed: boolean;
  view: ReviewView;
  setView: (v: ReviewView) => void;
  stageLabel: string;
}) {
  const [message, setMessage] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);
  const team = project.team;
  const other = team.reviewers.find((r) => r.id !== me) ?? team.reviewers[1];
  const ag = stats.agreement;
  const mineIndex = team.reviewers.findIndex((r) => r.id === me);

  const sendPackage = async () => download(`${slug(project.title)}-pro-hodnotitele-${slug(reviewerName(team, other.id))}.json`, JSON.stringify(await exportReviewerPackage(project.id, other.id)), 'application/json');
  const sendVotes = async () => download(`${slug(project.title)}-rozhodnuti-${slug(reviewerName(team, me))}.json`, JSON.stringify(await exportVotes(project.id, me)), 'application/json');
  const loadVotes = async (file: File | undefined) => {
    if (!file) return;
    try {
      const res = await importVotes(project.id, JSON.parse(await file.text()));
      setMessage({
        kind: 'good',
        text: `Načtena rozhodnutí hodnotitele ${res.reviewer}: třídění podle abstraktu ${res.stage1}, plné texty ${res.stage2}.${res.unknown ? ` ${res.unknown} rozhodnutí se nepodařilo přiřadit k záznamu.` : ''}`,
      });
    } catch (e) {
      setMessage({ kind: 'bad', text: e instanceof Error ? e.message : 'Soubor se nepodařilo načíst.' });
    }
  };

  return (
    <div className="card">
      <div className="row between">
        <div className="row">
          <strong>Třídíte jako</strong>
          {fixed ? (
            <span className="pill accent">{reviewerName(team, me)}</span>
          ) : (
            <Seg ariaLabel="Kdo právě třídí" value={me} options={team.reviewers.map((r) => ({ id: r.id, label: reviewerName(team, r.id) }))} onChange={setMe} />
          )}
        </div>
        <div className="row">
          {fixed ? (
            <button type="button" className="btn small primary" onClick={sendVotes}>
              Stáhnout moje rozhodnutí
            </button>
          ) : (
            <>
              <button type="button" className="btn small" onClick={sendPackage} title="Kopie projektu bez vašich rozhodnutí">
                Balíček pro: {reviewerName(team, other.id)}
              </button>
              <label className="btn small">
                Načíst rozhodnutí druhého hodnotitele
                <input
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => {
                    void loadVotes(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </>
          )}
        </div>
      </div>

      {fixed ? (
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          Toto je kopie projektu pro druhého hodnotitele. Posuďte záznamy podle kritérií, rozhodnutí druhého hodnotitele neuvidíte. Po dokončení ({stageLabel}) stáhněte svá rozhodnutí a pošlete soubor zpět. Posouzeno {stats.votedBy[mineIndex] ?? 0} z {stats.total}.
        </p>
      ) : (
        <>
          <div className="row" style={{ marginTop: 12, gap: 18 }}>
            {team.reviewers.map((r, i) => (
              <span key={r.id} className="small">
                {reviewerName(team, r.id)}: <strong>{stats.votedBy[i]}</strong> z {stats.total}
              </span>
            ))}
            <span className="small">
              Oba posoudili: <strong>{ag.n}</strong>
            </span>
            {ag.n > 0 ? (
              <span className="small">
                Shoda <strong>{fmt(100 * ag.po, 1)} %</strong>
                {ag.kappa != null ? (
                  <>
                    {' '}
                    · Cohenovo κ = <strong>{fmt(ag.kappa, 2)}</strong> ({interpretKappa(ag.kappa)})
                  </>
                ) : (
                  ' · κ nelze spočítat'
                )}
              </span>
            ) : null}
          </div>
          <div className="row" style={{ marginTop: 10 }} role="group" aria-label="Zobrazení">
            <button type="button" className={`btn small ${view === 'screen' ? 'active' : ''}`} onClick={() => setView('screen')}>
              Moje třídění
            </button>
            <button type="button" className={`btn small ${view === 'conflicts' ? 'active' : ''}`} onClick={() => setView('conflicts')}>
              Neshody {stats.conflicts}
              {stats.open ? ` (k vyřešení ${stats.open})` : ''}
            </button>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="small">Jak třídění dvěma hodnotiteli funguje</summary>
            <ul className="small muted" style={{ marginBottom: 0 }}>
              <li>Každý hodnotitel rozhoduje sám a rozhodnutí druhého při třídění nevidí. Záznam je rozhodnut, až když se oba shodnou.</li>
              <li>
                <strong>Na jednom počítači:</strong> nahoře přepněte, kdo právě třídí. Na záložku Neshody se dívejte až po dokončení obou.
              </li>
              <li>
                <strong>Na dvou počítačích:</strong> stáhněte „Balíček pro druhého hodnotitele“ a pošlete mu ho. Načte ho na úvodní stránce tlačítkem „Načíst zálohu“, roztřídí a pošle zpět soubor „Moje rozhodnutí“, který sem načtete.
              </li>
              <li>Neshody vyřešte společně na záložce Neshody; nedohodnete-li se, rozhodne třetí osoba (např. vedoucí práce).</li>
              <li>Cohenovo κ vyjadřuje shodu očištěnou o shodu náhodnou. Do textu práce se uvádí spolu s počtem neshod a způsobem jejich řešení.</li>
            </ul>
          </details>
        </>
      )}
      {message ? (
        <div style={{ marginTop: 10 }}>
          <Notice kind={message.kind}>{message.text}</Notice>
        </div>
      ) : null}
    </div>
  );
}

/** Jedna neshoda: záznam, hlasy obou hodnotitelů a tlačítka výsledného rozhodnutí. */
export function ConflictCard({ title, meta, abstract, votes, children, resolved }: { title: string; meta: string; abstract?: string; votes: { name: string; text: string }[]; children: ReactNode; resolved: boolean }) {
  return (
    <article className="card" style={resolved ? { opacity: 0.8 } : undefined}>
      <div className="row between top">
        <div className="grow" style={{ flexBasis: 320 }}>
          <strong>{title || 'Bez názvu'}</strong>
          <div className="small muted">{meta}</div>
        </div>
        {resolved ? <span className="pill accent">vyřešeno</span> : <span className="pill">k vyřešení</span>}
      </div>
      {abstract ? (
        <details style={{ margin: '8px 0' }}>
          <summary className="small">Abstrakt</summary>
          <p className="abstract" style={{ marginTop: 6 }}>
            {abstract}
          </p>
        </details>
      ) : null}
      <div className="row" style={{ margin: '8px 0', gap: 18 }}>
        {votes.map((v) => (
          <span key={v.name} className="small">
            {v.name}: <strong>{v.text}</strong>
          </span>
        ))}
      </div>
      {children}
    </article>
  );
}
