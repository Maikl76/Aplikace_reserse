// Obrázky jako čisté SVG: vývojový diagram, lesní graf, trychtýřový graf a sloupcové grafy.
// Funkce vracejí text SVG, takže stejný obrázek jde zobrazit v aplikaci, stáhnout
// i vložit do dokumentu Word. Jedna datová řada = jedna barva; text nikdy nenese barvu dat.

import type { FlowCounts } from './flow';
import { escapeXml as esc, fmt } from './util';

export type FigMode = 'light' | 'dark';

interface Theme {
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  series: string;
  band: string;
}

const THEMES: Record<FigMode, Theme> = {
  light: { surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', series: '#2a78d6', band: '#f0efec' },
  dark: { surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835', series: '#3987e5', band: '#2c2c2a' },
};

const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';

/** Odhad šířky textu v pixelech (SVG se skládá bez přístupu k prohlížeči). */
const tw = (s: string, size: number) => s.length * size * 0.56;

function open(w: number, h: number, t: Theme, label: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" font-family="${FONT}">` +
    `<rect width="${w}" height="${h}" fill="${t.surface}"/>`
  );
}

function text(x: number, y: number, s: string, t: Theme, o: { size?: number; anchor?: string; fill?: string; bold?: boolean; rotate?: number } = {}): string {
  const rot = o.rotate ? ` transform="rotate(${o.rotate} ${x} ${y})"` : '';
  return `<text x="${r(x)}" y="${r(y)}" font-size="${o.size ?? 12}" text-anchor="${o.anchor ?? 'start'}" fill="${o.fill ?? t.ink}"${o.bold ? ' font-weight="600"' : ''}${rot}>${esc(s)}</text>`;
}

const r = (x: number) => Math.round(x * 10) / 10;

export function wrapText(s: string, maxChars: number): string[] {
  const out: string[] = [];
  let line = '';
  // Dělíme jen v běžných mezerách; pevná mezera drží „(n = 13)“ pohromadě.
  for (const word of s.split(/[ \t\n]+/)) {
    if (line && (line + ' ' + word).length > maxChars) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const start = Math.floor(min / step + 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
  return ticks;
}

// ---- Vývojový diagram PRISMA 2020 -------------------------------------------

interface BoxLine {
  text: string;
  bold?: boolean;
  indent?: boolean;
}

export type FlowUnit = 'studie' | 'přehledy' | 'zdroje';

export function prismaSvg(c: FlowCounts, opts: { mode: FigMode; unit: FlowUnit }): string {
  const t = THEMES[opts.mode];
  const SIZE = 13;
  const LH = 18;
  const PAD = 11;
  const LW = 300;
  const RW = 290;
  const X0 = 46;
  const GAP = 52;
  const RX = X0 + LW + GAP;
  const W = RX + RW + 14;
  const chars = (w: number) => Math.floor((w - 2 * PAD) / (SIZE * 0.54));

  const box = (title: string, details: string[], width: number): BoxLine[] => [
    ...wrapText(title, chars(width)).map((s) => ({ text: s, bold: true })),
    ...details.flatMap((d) => wrapText(d, chars(width) - 2).map((s) => ({ text: s, indent: true }))),
  ];
  const n = (x: number) => `(n\u00a0=\u00a0${x})`;
  const included = { studie: 'Studie zařazené do přehledu', přehledy: 'Přehledy zařazené do zastřešujícího přehledu', zdroje: 'Zdroje zařazené do přehledu' }[opts.unit];

  type Row = { phase: string; left: BoxLine[]; right?: BoxLine[] };
  const rows: Row[] = [
    {
      phase: 'Identifikace',
      left: box(`Záznamy nalezené v databázích a dalších zdrojích ${n(c.identified)}`, c.bySource.map((s) => `${s.source} ${n(s.n)}`), LW),
      right: box('Záznamy odstraněné před tříděním', [`duplicity ${n(c.duplicates)}`], RW),
    },
    {
      phase: 'Třídění',
      left: box(`Záznamy tříděné podle názvu a abstraktu ${n(c.screened)}`, [], LW),
      right: box(`Vyřazené záznamy ${n(c.excluded1)}`, [], RW),
    },
  ];
  if (c.twoStage) {
    rows.push(
      {
        phase: 'Třídění',
        left: box(`Plné texty, které bylo třeba získat ${n(c.sought)}`, [], LW),
        right: box(`Nezískané plné texty ${n(c.notRetrieved)}`, [], RW),
      },
      {
        phase: 'Třídění',
        left: box(`Plné texty posouzené z hlediska způsobilosti ${n(c.assessed)}`, [], LW),
        right: box(`Vyřazené plné texty ${n(c.excluded2Total)}`, c.excluded2.map((e) => `${e.reason} ${n(e.n)}`), RW),
      },
    );
  }
  rows.push({ phase: 'Zařazení', left: box(`${included} ${n(c.included)}`, [], LW) });

  const heightOf = (lines: BoxLine[]) => lines.length * LH + 2 * PAD - 4;
  const VGAP = 30;
  let y = 14;
  const placed = rows.map((row) => {
    const lh = heightOf(row.left);
    const rh = row.right ? heightOf(row.right) : 0;
    const h = Math.max(lh, rh);
    const item = { ...row, top: y, h, ly: y + (h - lh) / 2, lh, ry: y + (h - rh) / 2, rh };
    y += h + VGAP;
    return item;
  });
  const H = y - VGAP + 14;

  let s = open(W, H, t, 'Vývojový diagram výběru studií podle PRISMA 2020');
  s += `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${t.ink2}"/></marker></defs>`;

  // Pásy fází vlevo.
  for (const phase of [...new Set(placed.map((p) => p.phase))]) {
    const group = placed.filter((p) => p.phase === phase);
    const top = group[0].top;
    const bottom = group[group.length - 1].top + group[group.length - 1].h;
    s += `<rect x="8" y="${r(top)}" width="24" height="${r(bottom - top)}" rx="4" fill="${t.band}"/>`;
    s += text(24.5, (top + bottom) / 2, phase, t, { size: 11.5, anchor: 'middle', fill: t.ink2, bold: true, rotate: -90 });
  }

  const drawBox = (x: number, top: number, w: number, h: number, lines: BoxLine[]) => {
    let o = `<rect x="${x}" y="${r(top)}" width="${w}" height="${r(h)}" rx="4" fill="${t.surface}" stroke="${t.axis}" stroke-width="1"/>`;
    lines.forEach((ln, i) => {
      o += text(x + PAD + (ln.indent ? 12 : 0), top + PAD + 9 + i * LH, ln.text, t, { size: SIZE, fill: ln.indent ? t.ink2 : t.ink, bold: ln.bold });
    });
    return o;
  };

  placed.forEach((p, i) => {
    s += drawBox(X0, p.ly, LW, p.lh, p.left);
    const mid = p.top + p.h / 2;
    if (p.right) {
      s += drawBox(RX, p.ry, RW, p.rh, p.right);
      s += `<line x1="${X0 + LW}" y1="${r(mid)}" x2="${RX - 2}" y2="${r(mid)}" stroke="${t.ink2}" stroke-width="1.2" marker-end="url(#arr)"/>`;
    }
    const next = placed[i + 1];
    if (next) {
      s += `<line x1="${X0 + LW / 2}" y1="${r(p.ly + p.lh)}" x2="${X0 + LW / 2}" y2="${r(next.ly - 2)}" stroke="${t.ink2}" stroke-width="1.2" marker-end="url(#arr)"/>`;
    }
  });
  return s + '</svg>';
}

// ---- Lesní graf ---------------------------------------------------------------

export interface ForestRow {
  kind: 'study' | 'summary' | 'subsummary' | 'group';
  label: string;
  yi?: number;
  lo?: number;
  hi?: number;
  /** Váha v procentech. */
  weight?: number;
  /** Predikční interval (jen u souhrnu). */
  pi?: [number, number] | null;
}

export type FigScale = 'identity' | 'log' | 'z';

export interface ForestSpec {
  rows: ForestRow[];
  scale: FigScale;
  /** Název míry do záhlaví sloupce, např. „RR“. */
  measure: string;
  footer: string[];
  mode: FigMode;
}

const LOG_TICKS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** Hodnota na zobrazované škále (poměr, korelace, nebo beze změny). */
const shown = (scale: FigScale, v: number) => (scale === 'log' ? Math.exp(v) : scale === 'z' ? Math.tanh(v) : v);
/** Poloha na ose: u poměrů logaritmická, u korelací po převodu zpět na r. */
const axisValue = (scale: FigScale, v: number) => (scale === 'z' ? Math.tanh(v) : v);

function axisTicks(scale: FigScale, min: number, max: number): { at: number; label: string }[] {
  if (scale === 'log') {
    let ticks = LOG_TICKS.filter((x) => Math.log(x) >= min - 1e-9 && Math.log(x) <= max + 1e-9);
    if (ticks.length > 7) ticks = ticks.filter((x) => Number.isInteger(Math.log10(x)) || x === 1);
    if (ticks.length < 2) return niceTicks(min, max, 4).map((v) => ({ at: v, label: fmt(Math.exp(v), 2) }));
    return ticks.map((x) => ({ at: Math.log(x), label: String(x).replace('.', ',') }));
  }
  const ticks = niceTicks(min, max, 5).filter((v) => v >= min - 1e-9 && v <= max + 1e-9);
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : 1;
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return ticks.map((v) => ({ at: v, label: fmt(v, digits) }));
}

export function forestSvg(spec: ForestSpec): string {
  const t = THEMES[spec.mode];
  const ROW = 24;
  const HEAD = 30;
  const rows = spec.rows;
  const labelW = Math.min(280, Math.max(150, Math.max(...rows.map((x) => tw(x.label, x.kind === 'study' ? 12 : 12.5))) + 24));
  const PLOT = 300;
  const NUM = 150;
  const WGT = 58;
  const X0 = 12 + labelW;
  const W = X0 + PLOT + 16 + NUM + WGT + 8;
  const plotTop = HEAD + 8;
  const plotBottom = plotTop + rows.length * ROW;
  const H = plotBottom + 34 + spec.footer.length * 17 + 12;

  const valued = rows.filter((x) => x.yi != null && x.lo != null && x.hi != null);
  const a = (v: number) => axisValue(spec.scale, v);
  let min = Math.min(0, ...valued.map((x) => a(x.lo!)));
  let max = Math.max(0, ...valued.map((x) => a(x.hi!)));
  if (spec.scale === 'identity' || spec.scale === 'z') {
    const ticks = niceTicks(min, max, 5);
    min = Math.min(min, ticks[0]);
    max = Math.max(max, ticks[ticks.length - 1]);
    if (spec.scale === 'z') {
      min = Math.max(-1, min);
      max = Math.min(1, max);
    }
  } else {
    const pad = (max - min) * 0.04 || 0.1;
    min -= pad;
    max += pad;
  }
  const x = (v: number) => X0 + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * PLOT;

  let s = open(W, H, t, `Lesní graf: ${spec.measure}`);
  // Záhlaví sloupců.
  s += text(12, HEAD - 8, 'Studie', t, { size: 12, fill: t.ink2, bold: true });
  s += text(X0 + PLOT + 16 + NUM - 8, HEAD - 8, `${spec.measure} [95% CI]`, t, { size: 12, anchor: 'end', fill: t.ink2, bold: true });
  s += text(W - 10, HEAD - 8, 'Váha', t, { size: 12, anchor: 'end', fill: t.ink2, bold: true });
  s += `<line x1="12" y1="${HEAD}" x2="${W - 8}" y2="${HEAD}" stroke="${t.grid}"/>`;

  // Osa a čára nulového účinku.
  const ticks = axisTicks(spec.scale, min, max);
  s += `<line x1="${X0}" y1="${plotBottom + 6}" x2="${X0 + PLOT}" y2="${plotBottom + 6}" stroke="${t.axis}"/>`;
  for (const tick of ticks) {
    s += `<line x1="${r(x(tick.at))}" y1="${plotBottom + 6}" x2="${r(x(tick.at))}" y2="${plotBottom + 10}" stroke="${t.axis}"/>`;
    s += text(x(tick.at), plotBottom + 23, tick.label, t, { size: 11, anchor: 'middle', fill: t.muted });
  }
  s += `<line x1="${r(x(0))}" y1="${plotTop}" x2="${r(x(0))}" y2="${plotBottom + 6}" stroke="${t.axis}"/>`;

  const maxW = Math.max(1, ...rows.filter((x) => x.kind === 'study').map((x) => x.weight ?? 0));
  const ci = (row: ForestRow) => `${fmt(shown(spec.scale, row.yi!), 2)} [${fmt(shown(spec.scale, row.lo!), 2)}; ${fmt(shown(spec.scale, row.hi!), 2)}]`;

  rows.forEach((row, i) => {
    const cy = plotTop + i * ROW + ROW / 2;
    const bold = row.kind !== 'study';
    s += text(row.kind === 'study' ? 12 : 12, cy + 4, row.label, t, { size: bold ? 12.5 : 12, bold, fill: row.kind === 'group' ? t.ink2 : t.ink });
    if (row.yi == null || row.lo == null || row.hi == null) return;
    const tip = `<title>${esc(`${row.label}: ${spec.measure} ${ci(row)}${row.weight != null ? `, váha ${fmt(row.weight, 1)} %` : ''}`)}</title>`;
    if (row.kind === 'study') {
      const lo = a(row.lo);
      const hi = a(row.hi);
      s += `<g>${tip}<line x1="${r(x(lo))}" y1="${cy}" x2="${r(x(hi))}" y2="${cy}" stroke="${t.ink2}" stroke-width="1.5"/>`;
      // Šipka, pokud interval přesahuje osu.
      if (lo < min) s += `<path d="M${X0},${cy} l6,-4 v8 z" fill="${t.ink2}"/>`;
      if (hi > max) s += `<path d="M${X0 + PLOT},${cy} l-6,-4 v8 z" fill="${t.ink2}"/>`;
      const side = 5 + 9 * Math.sqrt((row.weight ?? maxW) / maxW);
      s += `<rect x="${r(x(a(row.yi)) - side / 2)}" y="${r(cy - side / 2)}" width="${r(side)}" height="${r(side)}" fill="${t.series}" stroke="${t.surface}" stroke-width="1"/>`;
      // Neviditelná plocha přes celý řádek usnadňuje najetí myší.
      s += `<rect x="${X0}" y="${cy - ROW / 2}" width="${PLOT}" height="${ROW}" fill="transparent"/></g>`;
    } else {
      const dh = row.kind === 'summary' ? 7 : 5.5;
      if (row.pi) {
        s += `<line x1="${r(x(a(row.pi[0])))}" y1="${cy + dh + 3}" x2="${r(x(a(row.pi[1])))}" y2="${cy + dh + 3}" stroke="${t.ink}" stroke-width="2.5"><title>${esc(
          `Predikční interval: ${fmt(shown(spec.scale, row.pi[0]), 2)} až ${fmt(shown(spec.scale, row.pi[1]), 2)}`,
        )}</title></line>`;
      }
      s += `<path d="M${r(x(a(row.lo)))},${cy} L${r(x(a(row.yi)))},${cy - dh} L${r(x(a(row.hi)))},${cy} L${r(x(a(row.yi)))},${cy + dh} Z" fill="${row.kind === 'summary' ? t.ink : t.ink2}">${tip}</path>`;
    }
    s += text(X0 + PLOT + 16 + NUM - 8, cy + 4, ci(row), t, { size: 12, anchor: 'end', bold });
    if (row.weight != null) s += text(W - 10, cy + 4, `${fmt(row.weight, 1)} %`, t, { size: 12, anchor: 'end', fill: t.ink2 });
  });

  spec.footer.forEach((line, i) => {
    s += text(12, plotBottom + 46 + i * 17, line, t, { size: 11.5, fill: t.ink2 });
  });
  return s + '</svg>';
}

// ---- Trychtýřový graf ---------------------------------------------------------

export interface FunnelSpec {
  points: { label: string; yi: number; se: number }[];
  pooled: number;
  scale: FigScale;
  measure: string;
  mode: FigMode;
}

export function funnelSvg(spec: FunnelSpec): string {
  const t = THEMES[spec.mode];
  const W = 520;
  const H = 380;
  const L = 62;
  const R = 18;
  const T = 16;
  const B = 52;
  const maxSe = Math.max(...spec.points.map((p) => p.se)) * 1.08 || 1;
  const half = 1.96 * maxSe;
  let min = Math.min(spec.pooled - half, ...spec.points.map((p) => p.yi));
  let max = Math.max(spec.pooled + half, ...spec.points.map((p) => p.yi));
  const pad = (max - min) * 0.04;
  min -= pad;
  max += pad;
  const x = (v: number) => L + ((v - min) / (max - min)) * (W - L - R);
  const y = (se: number) => T + (se / maxSe) * (H - T - B);

  let s = open(W, H, t, `Trychtýřový graf: ${spec.measure}`);
  const yTicks = niceTicks(0, maxSe, 4).filter((v) => v <= maxSe);
  const yDigits = (yTicks[1] ?? 1) >= 0.1 ? 1 : 2;
  for (const v of yTicks) {
    s += `<line x1="${L}" y1="${r(y(v))}" x2="${W - R}" y2="${r(y(v))}" stroke="${t.grid}"/>`;
    s += text(L - 8, y(v) + 4, fmt(v, yDigits), t, { size: 11, anchor: 'end', fill: t.muted });
  }
  const xTicks =
    spec.scale === 'log'
      ? axisTicks('log', min, max)
      : niceTicks(min, max, 5)
          .filter((v) => v >= min && v <= max)
          .map((v) => ({ at: v, label: fmt(shown(spec.scale, v), 2) }));
  s += `<line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="${t.axis}"/>`;
  for (const tick of xTicks) {
    s += `<line x1="${r(x(tick.at))}" y1="${H - B}" x2="${r(x(tick.at))}" y2="${H - B + 4}" stroke="${t.axis}"/>`;
    s += text(x(tick.at), H - B + 18, tick.label, t, { size: 11, anchor: 'middle', fill: t.muted });
  }
  // Trychtýř: oblast, kde by při absenci zkreslení a heterogenity leželo 95 % studií.
  s += `<path d="M${r(x(spec.pooled))},${T} L${r(x(spec.pooled - half))},${H - B} M${r(x(spec.pooled))},${T} L${r(x(spec.pooled + half))},${H - B}" stroke="${t.axis}" fill="none"/>`;
  s += `<line x1="${r(x(spec.pooled))}" y1="${T}" x2="${r(x(spec.pooled))}" y2="${H - B}" stroke="${t.ink2}" stroke-width="1"/>`;
  for (const p of spec.points) {
    s += `<g><title>${esc(`${p.label}: ${spec.measure} ${fmt(shown(spec.scale, p.yi), 2)}, SE ${fmt(p.se, 3)}`)}</title>`;
    s += `<circle cx="${r(x(p.yi))}" cy="${r(y(p.se))}" r="12" fill="transparent"/>`;
    s += `<circle cx="${r(x(p.yi))}" cy="${r(y(p.se))}" r="5" fill="${t.series}" stroke="${t.surface}" stroke-width="2"/></g>`;
  }
  s += text((L + W - R) / 2, H - 12, spec.scale === 'log' ? `${spec.measure} (logaritmická osa)` : spec.measure, t, { size: 12, anchor: 'middle', fill: t.ink2 });
  s += text(16, (T + H - B) / 2, 'Směrodatná chyba', t, { size: 12, anchor: 'middle', fill: t.ink2, rotate: -90 });
  return s + '</svg>';
}

// ---- Sloupcové grafy četností -------------------------------------------------

export interface Count {
  label: string;
  value: number;
}

/** Vodorovné pruhy – pro kategorie (design, země…). */
export function barsSvg(items: Count[], opts: { mode: FigMode; title: string }): string {
  const t = THEMES[opts.mode];
  const cut = (s: string) => (s.length > 34 ? s.slice(0, 33) + '…' : s);
  const labelW = Math.min(240, Math.max(60, Math.max(...items.map((i) => tw(cut(i.label), 12))) + 14));
  const PLOT = 300;
  const ROW = 28;
  const BAR = 16;
  const W = labelW + PLOT + 56;
  const H = items.length * ROW + 18;
  const max = Math.max(1, ...items.map((i) => i.value));
  let s = open(W, H, t, opts.title);
  s += `<line x1="${labelW}" y1="6" x2="${labelW}" y2="${H - 8}" stroke="${t.axis}"/>`;
  items.forEach((item, i) => {
    const cy = 10 + i * ROW + ROW / 2;
    const w = (item.value / max) * PLOT;
    const top = cy - BAR / 2;
    const rad = Math.min(4, w);
    s += `<g><title>${esc(`${item.label}: ${item.value}`)}</title>`;
    s += `<rect x="0" y="${cy - ROW / 2}" width="${W}" height="${ROW}" fill="transparent"/>`;
    s += text(labelW - 8, cy + 4, cut(item.label), t, { size: 12, anchor: 'end', fill: t.ink2 });
    if (w > 0) {
      // Konec pruhu u hodnoty je zaoblený, u osy rovný.
      s += `<path d="M${labelW},${top} H${r(labelW + w - rad)} Q${r(labelW + w)},${top} ${r(labelW + w)},${top + rad} V${top + BAR - rad} Q${r(labelW + w)},${top + BAR} ${r(labelW + w - rad)},${top + BAR} H${labelW} Z" fill="${t.series}"/>`;
    }
    s += text(labelW + w + 6, cy + 4, String(item.value), t, { size: 12, fill: t.ink });
    s += '</g>';
  });
  return s + '</svg>';
}

/** Svislé sloupce – pro časovou řadu (počty podle let). */
export function columnsSvg(items: Count[], opts: { mode: FigMode; title: string }): string {
  const t = THEMES[opts.mode];
  const n = Math.max(1, items.length);
  const SLOT = Math.max(16, Math.min(44, Math.floor(600 / n)));
  const L = 40;
  const T = 22;
  const PLOT_H = 170;
  const W = L + n * SLOT + 14;
  const H = T + PLOT_H + 34;
  const ticks = niceTicks(0, Math.max(1, ...items.map((i) => i.value)), 4).filter((v) => Number.isInteger(v));
  const top = ticks[ticks.length - 1] || 1;
  const y = (v: number) => T + PLOT_H - (v / top) * PLOT_H;
  let s = open(W, H, t, opts.title);
  for (const v of ticks) {
    s += `<line x1="${L}" y1="${r(y(v))}" x2="${W - 8}" y2="${r(y(v))}" stroke="${v === 0 ? t.axis : t.grid}"/>`;
    s += text(L - 7, y(v) + 4, String(v), t, { size: 11, anchor: 'end', fill: t.muted });
  }
  const every = Math.ceil((n * 30) / (n * SLOT)); // popisky let tak, aby se nepřekrývaly
  const bw = Math.min(24, SLOT - 4);
  const peak = Math.max(...items.map((i) => i.value));
  items.forEach((item, i) => {
    const cx = L + i * SLOT + SLOT / 2;
    const h = (item.value / top) * PLOT_H;
    const rad = Math.min(4, h);
    const x0 = cx - bw / 2;
    const base = T + PLOT_H;
    s += `<g><title>${esc(`${item.label}: ${item.value}`)}</title>`;
    s += `<rect x="${cx - SLOT / 2}" y="${T}" width="${SLOT}" height="${PLOT_H}" fill="transparent"/>`;
    if (h > 0) {
      s += `<path d="M${r(x0)},${base} V${r(base - h + rad)} Q${r(x0)},${r(base - h)} ${r(x0 + rad)},${r(base - h)} H${r(x0 + bw - rad)} Q${r(x0 + bw)},${r(base - h)} ${r(x0 + bw)},${r(base - h + rad)} V${base} Z" fill="${t.series}"/>`;
    }
    // Hodnotu popisujeme jen u nejvyššího sloupce; ostatní čte osa a tabulka.
    if (item.value === peak && item.value > 0) s += text(cx, base - h - 5, String(item.value), t, { size: 11, anchor: 'middle' });
    if (i % every === 0) s += text(cx, base + 16, item.label, t, { size: 11, anchor: 'middle', fill: t.muted });
    s += '</g>';
  });
  return s + '</svg>';
}

// ---- Převod na PNG (pro Word) -------------------------------------------------

export function svgSize(svg: string): { width: number; height: number } {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return { width: m ? Number(m[1]) : 600, height: m ? Number(m[2]) : 400 };
}

/** Vykreslí SVG do PNG pomocí plátna prohlížeče. */
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const { width, height } = svgSize(svg);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Obrázek se nepodařilo vykreslit.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Převod na PNG selhal.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
