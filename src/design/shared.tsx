// Prvky sdílené mezi kroky průvodce návrhem aplikace.

import type { ReactNode } from 'react';
import type { Fact } from '../lib/design/catalog';
import { FIT_LABELS, type Fit } from '../lib/design/logic';
import type { Block } from '../lib/manuscript/build';
import { formatDate } from '../lib/util';
import { WithTodos } from '../ui';

const FIT_CLASS = { ok: 'good', warn: 'warn', no: 'bad' } as const;

/**
 * Popisek se skupinou tlačítek. Na rozdíl od `Field` není prvkem label – klepnutí na popisek
 * by jinak stisklo první tlačítko ve skupině.
 */
export function Group({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

/** Štítek vhodnosti; bez odpovědí o vlastnostech se nezobrazuje. */
export function FitBadge({ fit, show = true }: { fit: Fit; show?: boolean }) {
  if (!show) return null;
  return <span className={`pill ${FIT_CLASS[fit.level]}`}>{FIT_LABELS[fit.level]}</span>;
}

export function Reasons({ fit }: { fit: Fit }) {
  if (!fit.reasons.length) return null;
  return (
    <ul className="small reasons">
      {fit.reasons.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

export function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mini-head">{title}</div>
      <ul className="small">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/** Údaj, který se může změnit: text, zdroj a datum ověření. */
export function FactLine({ fact }: { fact: Fact }) {
  return (
    <div className="fact small">
      {fact.text}{' '}
      <span className="muted">
        Zdroj:{' '}
        <a href={fact.source.url} target="_blank" rel="noreferrer">
          {fact.source.label}
        </a>
        , ověřeno {formatDate(fact.verified)}.
      </span>
    </div>
  );
}

export function Facts({ facts, title = 'Údaje se zdrojem' }: { facts: Fact[]; title?: string }) {
  if (!facts.length) return null;
  return (
    <div>
      <div className="mini-head">{title}</div>
      <div className="facts">
        {facts.map((f) => (
          <FactLine key={f.text} fact={f} />
        ))}
      </div>
    </div>
  );
}

/** Karta volitelné možnosti (typ řešení, místo provozu). */
export function OptionCard({ selected, muted, children }: { selected: boolean; muted?: boolean; children: ReactNode }) {
  return <section className={`card option ${selected ? 'sel' : ''} ${muted ? 'dim' : ''}`}>{children}</section>;
}

/** Náhled dokumentu sestaveného z bloků. */
export function DocPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div className="doc-preview">
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'h':
            return b.level === 1 ? <h2 key={i}>{b.text}</h2> : <h3 key={i}>{b.text}</h3>;
          case 'p':
            return (
              <p key={i}>
                <WithTodos text={b.text} />
              </p>
            );
          case 'todo':
            return (
              <p key={i}>
                <WithTodos text={b.text} />
              </p>
            );
          case 'ref':
            return (
              <p key={i} className="small" style={{ overflowWrap: 'anywhere' }}>
                {b.spans.map((s) => s.text).join('')}
              </p>
            );
          case 'table':
            return (
              <div key={i}>
                <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>
                  {b.caption}
                </div>
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
                      {b.rows.map((row, r) => (
                        <tr key={r}>
                          {row.map((c, j) => (
                            <td key={j} style={{ overflowWrap: 'anywhere' }}>
                              <WithTodos text={c} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
