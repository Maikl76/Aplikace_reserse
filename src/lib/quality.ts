// Nástroje pro hodnocení kvality (rizika zkreslení). Aplikace uvádí názvy domén a
// stručné vysvětlení vlastními slovy; při hodnocení je nutné pracovat s úplným
// zněním nástroje a jeho návodem (odkaz u každého nástroje).

import type { Project, RecordItem } from './types';
import { lines } from './util';

export interface QLevel {
  id: string;
  label: string;
  /** Znak do tabulky (aby úroveň nebyla rozlišena jen barvou). */
  symbol: string;
  tone: 'good' | 'warn' | 'serious' | 'critical' | 'none';
}

export interface QItem {
  id: string;
  label: string;
  hint: string;
  critical?: boolean;
}

export interface QTool {
  id: string;
  name: string;
  forWhat: string;
  items: QItem[];
  levels: QLevel[];
  overallLabel: string;
  overallLevels: QLevel[];
  /** Návrh celkového hodnocení z dílčích odpovědí; člověk ho může změnit. */
  suggest?: (answers: Record<string, string>, items: QItem[]) => string | null;
  source: { label: string; url: string };
}

const ROB_LEVELS: QLevel[] = [
  { id: 'low', label: 'Nízké riziko', symbol: '+', tone: 'good' },
  { id: 'some', label: 'Určité obavy', symbol: '?', tone: 'warn' },
  { id: 'high', label: 'Vysoké riziko', symbol: '−', tone: 'critical' },
];

const ROBINS_LEVELS: QLevel[] = [
  { id: 'low', label: 'Nízké', symbol: '+', tone: 'good' },
  { id: 'moderate', label: 'Střední', symbol: '~', tone: 'warn' },
  { id: 'serious', label: 'Závažné', symbol: '−', tone: 'serious' },
  { id: 'critical', label: 'Kritické', symbol: '!', tone: 'critical' },
  { id: 'ni', label: 'Bez informací', symbol: '?', tone: 'none' },
];

const YES_NO: QLevel[] = [
  { id: 'yes', label: 'Ano', symbol: '+', tone: 'good' },
  { id: 'partial', label: 'Částečně', symbol: '~', tone: 'warn' },
  { id: 'no', label: 'Ne', symbol: '−', tone: 'critical' },
  { id: 'na', label: 'Netýká se', symbol: '·', tone: 'none' },
];

const allAnswered = (answers: Record<string, string>, items: QItem[]) => items.every((i) => answers[i.id]);

export const QUALITY_TOOLS: Record<string, QTool> = {
  rob2: {
    id: 'rob2',
    name: 'RoB 2',
    forWhat: 'randomizované kontrolované studie',
    items: [
      { id: 'd1', label: 'Proces randomizace', hint: 'Byla posloupnost přidělení náhodná a utajená? Byly skupiny na začátku srovnatelné?' },
      { id: 'd2', label: 'Odchylky od zamýšlených intervencí', hint: 'Věděli účastníci a personál o přidělení? Vedlo to k odchylkám? Byla analýza vhodná (ITT)?' },
      { id: 'd3', label: 'Chybějící data o výstupech', hint: 'Jsou data dostupná pro téměř všechny účastníky? Mohlo chybění záviset na skutečné hodnotě výstupu?' },
      { id: 'd4', label: 'Měření výstupu', hint: 'Byla metoda měření vhodná a stejná v obou skupinách? Věděli hodnotitelé o přidělení?' },
      { id: 'd5', label: 'Výběr uváděného výsledku', hint: 'Odpovídá analýza předem danému plánu? Nebyl výsledek vybrán z více měření či analýz?' },
    ],
    levels: ROB_LEVELS,
    overallLabel: 'Celkové riziko zkreslení',
    overallLevels: ROB_LEVELS,
    suggest: (a, items) => {
      if (!allAnswered(a, items)) return null;
      const vals = items.map((i) => a[i.id]);
      if (vals.includes('high')) return 'high';
      if (vals.every((v) => v === 'low')) return 'low';
      return 'some';
    },
    source: { label: 'Sterne et al. (2019), BMJ 366:l4898', url: 'https://doi.org/10.1136/bmj.l4898' },
  },
  'robins-i': {
    id: 'robins-i',
    name: 'ROBINS-I',
    forWhat: 'nerandomizované studie intervencí',
    items: [
      { id: 'd1', label: 'Matoucí faktory', hint: 'Lišily se skupiny v prognostických faktorech, které ovlivňují i volbu intervence?' },
      { id: 'd2', label: 'Výběr účastníků do studie', hint: 'Souvisel výběr s intervencí i s výstupem?' },
      { id: 'd3', label: 'Klasifikace intervencí', hint: 'Byly skupiny jasně vymezeny a zařazení nezáviselo na znalosti výstupu?' },
      { id: 'd4', label: 'Odchylky od zamýšlených intervencí', hint: 'Lišila se mezi skupinami péče nad rámec zkoumané intervence?' },
      { id: 'd5', label: 'Chybějící data', hint: 'Chyběla data o výstupu, intervenci nebo matoucích faktorech nerovnoměrně?' },
      { id: 'd6', label: 'Měření výstupů', hint: 'Mohla znalost intervence ovlivnit měření? Bylo měření v obou skupinách stejné?' },
      { id: 'd7', label: 'Výběr uváděného výsledku', hint: 'Nebyl výsledek vybrán z více měření, analýz nebo podskupin?' },
    ],
    levels: ROBINS_LEVELS,
    overallLabel: 'Celkové riziko zkreslení',
    overallLevels: ROBINS_LEVELS,
    suggest: (a, items) => {
      if (!allAnswered(a, items)) return null;
      const vals = items.map((i) => a[i.id]);
      for (const level of ['critical', 'serious', 'moderate']) if (vals.includes(level)) return level;
      if (vals.includes('ni')) return 'ni';
      return 'low';
    },
    source: { label: 'Sterne et al. (2016), BMJ 355:i4919', url: 'https://doi.org/10.1136/bmj.i4919' },
  },
  amstar2: {
    id: 'amstar2',
    name: 'AMSTAR 2',
    forWhat: 'systematické přehledy (kvalita provedení)',
    items: [
      { id: 'q1', label: '1. Otázka a kritéria zahrnují prvky PICO', hint: 'Populace, intervence, srovnání a výstupy jsou jasně uvedeny.' },
      { id: 'q2', label: '2. Metody stanoveny předem v protokolu', hint: 'Přehled výslovně uvádí protokol či registraci a zdůvodňuje odchylky.', critical: true },
      { id: 'q3', label: '3. Zdůvodněn výběr designů studií', hint: 'Autoři vysvětlují, proč zařadili RCT, nerandomizované studie, nebo obojí.' },
      { id: 'q4', label: '4. Komplexní rešerše literatury', hint: 'Více databází, uvedená klíčová slova či strategie, zdůvodněná omezení.', critical: true },
      { id: 'q5', label: '5. Výběr studií dvěma osobami nezávisle', hint: 'Nebo ověřená shoda na vzorku.' },
      { id: 'q6', label: '6. Extrakce dat dvěma osobami nezávisle', hint: 'Nebo ověřená shoda na vzorku.' },
      { id: 'q7', label: '7. Seznam vyřazených studií se zdůvodněním', hint: 'Týká se studií vyřazených po posouzení plného textu.', critical: true },
      { id: 'q8', label: '8. Zařazené studie popsány dostatečně podrobně', hint: 'Populace, intervence, srovnání, výstupy, design.' },
      { id: 'q9', label: '9. Vhodné hodnocení rizika zkreslení studií', hint: 'Použit uznávaný nástroj odpovídající designu studií.', critical: true },
      { id: 'q10', label: '10. Uvedeny zdroje financování zařazených studií', hint: '' },
      { id: 'q11', label: '11. Vhodné statistické metody metaanalýzy', hint: 'Jen pokud byla provedena metaanalýza; jinak „Netýká se“.', critical: true },
      { id: 'q12', label: '12. Posouzen vliv rizika zkreslení na výsledek metaanalýzy', hint: 'Jen pokud byla provedena metaanalýza.' },
      { id: 'q13', label: '13. Riziko zkreslení zohledněno při interpretaci', hint: 'Autoři s ním pracují v diskusi a závěrech.', critical: true },
      { id: 'q14', label: '14. Heterogenita vysvětlena a diskutována', hint: '' },
      { id: 'q15', label: '15. Prověřeno publikační zkreslení', hint: 'Jen u kvantitativní syntézy; včetně diskuse dopadu na výsledky.', critical: true },
      { id: 'q16', label: '16. Uvedeny střety zájmů a financování přehledu', hint: '' },
    ],
    levels: YES_NO,
    overallLabel: 'Celková důvěra ve výsledky přehledu',
    overallLevels: [
      { id: 'high', label: 'Vysoká', symbol: '+', tone: 'good' },
      { id: 'moderate', label: 'Střední', symbol: '~', tone: 'warn' },
      { id: 'low', label: 'Nízká', symbol: '−', tone: 'serious' },
      { id: 'critically-low', label: 'Kriticky nízká', symbol: '!', tone: 'critical' },
    ],
    // Pravidlo podle Shea et al. (2017): rozhodují nedostatky v kritických doménách.
    suggest: (a, items) => {
      if (!allAnswered(a, items)) return null;
      const criticalFlaws = items.filter((i) => i.critical && a[i.id] === 'no').length;
      const otherFlaws = items.filter((i) => !i.critical && a[i.id] === 'no').length;
      if (criticalFlaws > 1) return 'critically-low';
      if (criticalFlaws === 1) return 'low';
      return otherFlaws > 1 ? 'moderate' : 'high';
    },
    source: { label: 'Shea et al. (2017), BMJ 358:j4008', url: 'https://doi.org/10.1136/bmj.j4008' },
  },
  robis: {
    id: 'robis',
    name: 'ROBIS',
    forWhat: 'systematické přehledy (riziko zkreslení)',
    items: [
      { id: 'd1', label: 'Kritéria způsobilosti studií', hint: 'Byla kritéria stanovena předem, jasná a přiměřená otázce?' },
      { id: 'd2', label: 'Vyhledání a výběr studií', hint: 'Mohly být vynechány studie, které kritéria splňovaly?' },
      { id: 'd3', label: 'Sběr dat a hodnocení studií', hint: 'Mohly sběr dat nebo hodnocení rizika zkreslení vnést chybu?' },
      { id: 'd4', label: 'Syntéza a zjištění', hint: 'Byly použity vhodné metody slučování a ošetřena heterogenita?' },
    ],
    levels: [
      { id: 'low', label: 'Nízké obavy', symbol: '+', tone: 'good' },
      { id: 'high', label: 'Vysoké obavy', symbol: '−', tone: 'critical' },
      { id: 'unclear', label: 'Nejasné', symbol: '?', tone: 'none' },
    ],
    overallLabel: 'Celkové riziko zkreslení přehledu',
    overallLevels: [
      { id: 'low', label: 'Nízké', symbol: '+', tone: 'good' },
      { id: 'high', label: 'Vysoké', symbol: '−', tone: 'critical' },
      { id: 'unclear', label: 'Nejasné', symbol: '?', tone: 'none' },
    ],
    source: { label: 'Whiting et al. (2016), J Clin Epidemiol 69:225–234', url: 'https://doi.org/10.1016/j.jclinepi.2015.06.005' },
  },
  custom: {
    id: 'custom',
    name: 'Vlastní kontrolní seznam',
    forWhat: 'jiné designy – například seznamy JBI pro kvalitativní, průřezové nebo kohortové studie',
    items: [],
    levels: [...YES_NO.slice(0, 3), { id: 'unclear', label: 'Nejasné', symbol: '?', tone: 'none' }, YES_NO[3]],
    overallLabel: 'Celkové hodnocení',
    overallLevels: [
      { id: 'high', label: 'Vysoká kvalita', symbol: '+', tone: 'good' },
      { id: 'moderate', label: 'Střední kvalita', symbol: '~', tone: 'warn' },
      { id: 'low', label: 'Nízká kvalita', symbol: '−', tone: 'critical' },
    ],
    source: { label: 'Kontrolní seznamy JBI', url: 'https://jbi.global/critical-appraisal-tools' },
  },
};

/** Nástroj včetně položek vlastního seznamu daného projektu. */
export function toolFor(project: Pick<Project, 'qualityTool' | 'customQualityItems'>): QTool | null {
  const tool = QUALITY_TOOLS[project.qualityTool];
  if (!tool) return null;
  if (tool.id !== 'custom') return tool;
  return { ...tool, items: lines(project.customQualityItems).map((label, i) => ({ id: `c${i + 1}`, label, hint: '' })) };
}

export function levelOf(levels: QLevel[], id: string): QLevel | undefined {
  return levels.find((l) => l.id === id);
}

export function qualityComplete(r: Pick<RecordItem, 'quality' | 'qualityOverall'>, tool: QTool): boolean {
  return tool.items.every((i) => r.quality[i.id]) && !!r.qualityOverall;
}
