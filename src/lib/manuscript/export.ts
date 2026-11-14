// Export rukopisu do dokumentu Word (DOCX) a do Markdownu.

import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
} from 'docx';
import { svgSize } from '../figures';
import type { Project } from '../types';
import { APP_NAME, APP_VERSION, TEMPLATE_LABELS, TODO, toBlocks, type Block, type Manuscript } from './build';

const FONT = 'Times New Roman';
const CM = 567; // 1 cm v jednotkách Wordu (twip)

/** Rozdělí text na běžné úseky a místa k doplnění, která se v dokumentu zvýrazní. */
export function splitTodos(text: string): { text: string; todo: boolean }[] {
  return text
    .split(/(\[DOPLŇTE[^\]]*\])/)
    .filter(Boolean)
    .map((part) => ({ text: part, todo: part.startsWith(TODO) }));
}

const runs = (text: string, base: { size?: number; bold?: boolean; italics?: boolean } = {}) =>
  splitTodos(text).map((part) => new TextRun({ text: part.text, ...base, ...(part.todo ? { highlight: 'yellow' as const } : {}) }));

function cell(text: string, bold = false): TableCell {
  return new TableCell({
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ spacing: { line: 240, lineRule: LineRuleType.AUTO, after: 0 }, children: [new TextRun({ text, bold, size: 18 })] })],
  });
}

async function blockToDocx(b: Block, thesis: boolean, rasterize: (svg: string) => Promise<Uint8Array>): Promise<FileChild[]> {
  switch (b.t) {
    case 'h':
      return [new Paragraph({ text: b.text, heading: b.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2, pageBreakBefore: thesis && b.level === 1 })];
    case 'p':
      return [new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: runs(b.text) })];
    case 'todo':
      return [new Paragraph({ children: runs(b.text, { italics: true }) })];
    case 'ref':
      return [
        new Paragraph({
          indent: { left: 567, hanging: 567 },
          spacing: { line: 276, lineRule: LineRuleType.AUTO, after: 120 },
          children: b.spans.map((s) => new TextRun({ text: s.text, italics: s.italic })),
        }),
      ];
    case 'table':
      return [
        new Paragraph({ keepNext: true, spacing: { before: 240, after: 80, line: 276, lineRule: LineRuleType.AUTO }, children: [new TextRun({ text: b.caption, bold: true, size: 20 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({ tableHeader: true, children: b.head.map((h) => cell(h, true)) }), ...b.rows.map((row) => new TableRow({ children: row.map((c) => cell(c)) }))],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    case 'figure': {
      const { width, height } = svgSize(b.svg);
      const scale = Math.min(1, 600 / width);
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: true,
          // Jednoduché řádkování s výslovným pravidlem – jinak některé editory obrázek oříznou na výšku řádku.
          spacing: { before: 240, after: 80, line: 240, lineRule: LineRuleType.AUTO },
          children: [new ImageRun({ type: 'png', data: await rasterize(b.svg), transformation: { width: Math.round(width * scale), height: Math.round(height * scale) }, altText: { name: b.caption, description: b.caption, title: b.caption } })],
        }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240, line: 276, lineRule: LineRuleType.AUTO }, children: [new TextRun({ text: b.caption, italics: true, size: 20 })] }),
      ];
    }
  }
}

function titlePage(project: Project): FileChild[] {
  const m = project.manuscript;
  const line = (text: string, o: { size?: number; bold?: boolean; before?: number; caps?: boolean } = {}) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: o.before ?? 0, after: 200, line: 300, lineRule: LineRuleType.AUTO }, children: runs(text, { size: o.size ?? 24, bold: o.bold }).map((r) => r) });
  return [
    line(m.institution.trim() || `${TODO}: název školy a fakulty]`, { size: 28, bold: true }),
    line(TEMPLATE_LABELS[m.template], { size: 28, before: 3200 }),
    line(project.title, { size: 36, bold: true, before: 600 }),
    line(m.author.trim() || `${TODO}: jméno autora]`, { before: 2400 }),
    line(`Vedoucí práce: ${m.supervisor.trim() || `${TODO}: jméno vedoucího]`}`),
    line(m.year.trim() || String(new Date().getFullYear()), { before: 3000 }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

/**
 * Sestaví dokument Word. Funkce `rasterize` převádí obrázek SVG na PNG
 * (v prohlížeči přes plátno; v testech ji lze nahradit).
 */
export async function buildDocx(project: Project, ms: Manuscript, rasterize: (svg: string) => Promise<Uint8Array>): Promise<Document> {
  const thesis = project.manuscript.template !== 'article';
  const children: FileChild[] = [];
  if (thesis) {
    children.push(...titlePage(project));
    children.push(new TableOfContents('Obsah', { hyperlink: true, headingStyleRange: '1-2' }));
  } else {
    children.push(new Paragraph({ text: project.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
    if (project.manuscript.author.trim()) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: project.manuscript.author.trim() })] }));
    if (project.manuscript.institution.trim()) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: project.manuscript.institution.trim(), italics: true })] }));
  }
  for (const b of toBlocks(ms, project)) children.push(...(await blockToDocx(b, thesis, rasterize)));

  const heading = (size: number) => ({ run: { font: FONT, size, bold: true, color: '000000' }, paragraph: { spacing: { before: 360, after: 160, line: 300, lineRule: LineRuleType.AUTO } } });
  return new Document({
    creator: project.manuscript.author.trim() || APP_NAME,
    title: project.title,
    description: `Vytvořeno v aplikaci ${APP_NAME} ${APP_VERSION}`,
    features: { updateFields: thesis },
    styles: {
      default: {
        document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: thesis ? 360 : 300, lineRule: LineRuleType.AUTO, after: 160 } } },
        title: { run: { font: FONT, size: 36, bold: true, color: '000000' }, paragraph: { spacing: { after: 240 } } },
        heading1: heading(32),
        heading2: heading(26),
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: Math.round(2.5 * CM), bottom: Math.round(2.5 * CM), left: Math.round((thesis ? 3.5 : 2.5) * CM), right: Math.round(2.5 * CM) } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 20 })] })] }) },
        children,
      },
    ],
  });
}

// ---- Markdown ----------------------------------------------------------------

const mdCell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function toMarkdown(project: Project, ms: Manuscript): string {
  const m = project.manuscript;
  const out: string[] = [`# ${project.title}`, ''];
  const meta = [m.author.trim(), m.institution.trim(), m.template !== 'article' && m.supervisor.trim() ? `Vedoucí práce: ${m.supervisor.trim()}` : '', m.year.trim()].filter(Boolean);
  if (meta.length) out.push(meta.join(' · '), '');
  for (const b of toBlocks(ms, project)) {
    switch (b.t) {
      case 'h':
        out.push(`${'#'.repeat(b.level + 1)} ${b.text}`, '');
        break;
      case 'p':
        out.push(b.text, '');
        break;
      case 'todo':
        out.push(`*${b.text}*`, '');
        break;
      case 'ref':
        out.push(`- ${b.spans.map((s) => (s.italic ? `*${s.text}*` : s.text)).join('')}`);
        break;
      case 'table':
        out.push(`**${b.caption}**`, '', `| ${b.head.map(mdCell).join(' | ')} |`, `| ${b.head.map(() => '---').join(' | ')} |`, ...b.rows.map((row) => `| ${row.map(mdCell).join(' | ')} |`), '');
        break;
      case 'figure':
        out.push(`*${b.caption}* (obrázek stáhněte v aplikaci a vložte sem)`, '');
        break;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
