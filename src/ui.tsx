// Sdílené prvky rozhraní: směrování, formulářová pole, průvodce krokem, obrázky.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GUIDES } from './lib/content/guides';
import { svgToPng, type FigMode } from './lib/figures';
import { TODO } from './lib/manuscript/build';
import type { ReviewType, StepId } from './lib/types';
import { download } from './lib/util';

// ---- Směrování přes část adresy za # (funguje i na GitHub Pages) -------------

function readHash(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useHashRoute(): string[] {
  const [parts, setParts] = useState(readHash);
  useEffect(() => {
    const onChange = () => {
      setParts(readHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parts;
}

export function href(...parts: string[]): string {
  return '#/' + parts.map(encodeURIComponent).join('/');
}

export function navigate(...parts: string[]) {
  window.location.hash = href(...parts);
}

// ---- Světlý / tmavý režim pro obrázky ------------------------------------------

export function useFigMode(): FigMode {
  const query = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark ? 'dark' : 'light';
}

// ---- Formulářová pole ------------------------------------------------------------
// Pole si drží rozepsaný text u sebe a do úložiště ho zapisuje s krátkým zpožděním,
// aby psaní nebrzdil zápis do databáze a kurzor neposkakoval.

function useDraft(value: string, onCommit: (v: string) => void) {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(draft);
  const commit = useRef(onCommit);
  commit.current = onCommit;

  useEffect(() => {
    if (!dirty.current) {
      setDraft(value);
      latest.current = value;
    }
  }, [value]);

  const flush = () => {
    window.clearTimeout(timer.current);
    if (dirty.current) {
      dirty.current = false;
      commit.current(latest.current);
    }
  };
  // Při odchodu z obrazovky se rozepsaný text uloží.
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (v: string) => {
    setDraft(v);
    latest.current = v;
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 350);
  };
  return { draft, change, flush };
}

interface InputProps {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'password';
  list?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  inputMode?: 'decimal' | 'numeric' | 'text';
}

export function TextInput({ value, onCommit, placeholder, type = 'text', list, ariaLabel, style, inputMode }: InputProps) {
  const { draft, change, flush } = useDraft(value, onCommit);
  return <input type={type} value={draft} placeholder={placeholder} list={list} aria-label={ariaLabel} style={style} inputMode={inputMode} onChange={(e) => change(e.target.value)} onBlur={flush} />;
}

export function TextArea({ value, onCommit, placeholder, rows = 3, ariaLabel, mono }: { value: string; onCommit: (v: string) => void; placeholder?: string; rows?: number; ariaLabel?: string; mono?: boolean }) {
  const { draft, change, flush } = useDraft(value, onCommit);
  return <textarea value={draft} rows={rows} placeholder={placeholder} aria-label={ariaLabel} className={mono ? 'mono' : undefined} onChange={(e) => change(e.target.value)} onBlur={flush} />;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange, ariaLabel }: { value: T | ''; options: { id: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.id} type="button" className={value === o.id ? 'on' : ''} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({ kind, children }: { kind?: 'warn' | 'bad' | 'good'; children: ReactNode }) {
  return <div className={`notice ${kind ?? ''}`}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub ? <div className="s">{sub}</div> : null}
    </div>
  );
}

// ---- Průvodce krokem ---------------------------------------------------------------

export function GuidePanel({ step, type, done }: { step: StepId; type: ReviewType; done: boolean }) {
  const g = GUIDES[step];
  const key = `guide:${step}`;
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved == null ? !done : saved === '1';
  });
  const toggle = () => {
    localStorage.setItem(key, open ? '0' : '1');
    setOpen(!open);
  };
  const extra = g.byType?.[type];
  return (
    <section className="guide" aria-label="Průvodce krokem">
      <button type="button" className="guide-head" onClick={toggle} aria-expanded={open}>
        <span className="goal">
          <strong>Cíl kroku:</strong> {g.goal}
        </span>
        <span className="toggle">{open ? 'Skrýt průvodce' : 'Zobrazit průvodce'}</span>
      </button>
      {open ? (
        <div className="guide-body">
          <p style={{ margin: 0 }}>{g.why}</p>
          {extra ? <Notice>{extra}</Notice> : null}
          <div className="guide-cols">
            <div>
              <h4>Jak postupovat</h4>
              <ol>
                {g.how.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </div>
            <div>
              <h4>Časté chyby</h4>
              <ul>
                {g.mistakes.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="who">
            <div>
              <strong>Co udělá aplikace</strong>
              {g.app}
            </div>
            <div>
              <strong>Co je na vás</strong>
              {g.you}
            </div>
          </div>
          <div className="small">
            <h4>Kde se dozvíte víc</h4>
            {g.refs.map((ref, i) => (
              <span key={ref.url}>
                {i > 0 ? ' · ' : ''}
                <a href={ref.url} target="_blank" rel="noreferrer">
                  {ref.label}
                </a>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---- Obrázek se stažením ---------------------------------------------------------------

/**
 * Zobrazí obrázek v barvách aktuálního režimu; ke stažení nabízí vždy světlou
 * variantu (do tištěné práce). `render` vrací SVG pro daný režim.
 */
export function Figure({ render, name, caption }: { render: (mode: FigMode) => string; name: string; caption?: string }) {
  const mode = useFigMode();
  const [busy, setBusy] = useState(false);
  const png = async () => {
    setBusy(true);
    try {
      download(`${name}.png`, await svgToPng(render('light'), 3));
    } finally {
      setBusy(false);
    }
  };
  return (
    <figure className="figure" style={{ margin: 0 }}>
      <div className="canvas" dangerouslySetInnerHTML={{ __html: render(mode) }} />
      <figcaption className="bar">
        <span className="grow">{caption}</span>
        <button type="button" className="btn small" onClick={() => download(`${name}.svg`, render('light'), 'image/svg+xml')}>
          Stáhnout SVG
        </button>
        <button type="button" className="btn small" onClick={png} disabled={busy}>
          Stáhnout PNG
        </button>
      </figcaption>
    </figure>
  );
}

/** Text se zvýrazněnými místy k doplnění. */
export function WithTodos({ text }: { text: string }) {
  const parts = text.split(/(\[DOPLŇTE[^\]]*\])/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith(TODO) ? (
          <span key={i} className="todo-mark">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

/** Zkopíruje text do schránky a krátce to potvrdí. */
export function CopyButton({ text, label = 'Kopírovat' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn small"
      disabled={!text}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? 'Zkopírováno' : label}
    </button>
  );
}
