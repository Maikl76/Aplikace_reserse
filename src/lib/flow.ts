// Počty pro vývojový diagram (PRISMA 2020) a výběr zařazených studií.

import type { RecordItem, ReviewType } from './types';
import { hasStep } from './reviewTypes';
import { lines } from './util';

export interface FlowCounts {
  bySource: { source: string; n: number }[];
  identified: number;
  duplicates: number;
  screened: number;
  excluded1: number;
  pending1: number;
  /** false u přehledů s jednostupňovým výběrem (narativní). */
  twoStage: boolean;
  sought: number;
  notRetrieved: number;
  assessed: number;
  excluded2: { reason: string; n: number }[];
  excluded2Total: number;
  pending2: number;
  included: number;
}

type Rec = Pick<RecordItem, 'source' | 'duplicateOf' | 'screen1' | 'fulltext' | 'screen2' | 'excludeReason'>;

const passed1 = (r: Rec) => !r.duplicateOf && (r.screen1 === 'include' || r.screen1 === 'maybe');

/** Je záznam zařazen do přehledu? */
export function isIncluded(r: Rec, type: ReviewType): boolean {
  if (r.duplicateOf) return false;
  if (!hasStep(type, 'screen2')) return r.screen1 === 'include';
  return passed1(r) && r.fulltext !== 'notRetrieved' && r.screen2 === 'include';
}

export function includedRecords<T extends Rec>(records: T[], type: ReviewType): T[] {
  return records.filter((r) => isIncluded(r, type));
}

/** Záznamy, které prošly prvním třídicím krokem a čekají na posouzení plného textu. */
export function fulltextQueue<T extends Rec>(records: T[]): T[] {
  return records.filter(passed1);
}

export function flowCounts(records: Rec[], type: ReviewType, reasonOrder = ''): FlowCounts {
  const twoStage = hasStep(type, 'screen2');
  const sources = new Map<string, number>();
  for (const r of records) sources.set(r.source || 'Neuvedený zdroj', (sources.get(r.source || 'Neuvedený zdroj') ?? 0) + 1);

  const active = records.filter((r) => !r.duplicateOf);
  const sought = active.filter(passed1);
  const assessed = sought.filter((r) => r.fulltext !== 'notRetrieved');
  const excluded2 = assessed.filter((r) => r.screen2 === 'exclude');

  const reasons = new Map<string, number>();
  for (const r of excluded2) {
    const reason = r.excludeReason.trim() || 'Důvod neuveden';
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  // Důvody řadíme podle pořadí v protokolu, ostatní podle četnosti.
  const order = lines(reasonOrder);
  const rank = (reason: string) => (order.indexOf(reason) >= 0 ? order.indexOf(reason) : order.length + 1);

  return {
    bySource: [...sources.entries()].map(([source, n]) => ({ source, n })).sort((a, b) => b.n - a.n),
    identified: records.length,
    duplicates: records.length - active.length,
    screened: active.length,
    excluded1: active.filter((r) => r.screen1 === 'exclude').length,
    pending1: active.filter((r) => r.screen1 === 'pending').length,
    twoStage,
    sought: sought.length,
    notRetrieved: sought.length - assessed.length,
    assessed: assessed.length,
    excluded2: [...reasons.entries()].map(([reason, n]) => ({ reason, n })).sort((a, b) => rank(a.reason) - rank(b.reason) || b.n - a.n),
    excluded2Total: excluded2.length,
    pending2: twoStage ? assessed.filter((r) => r.screen2 === 'pending').length : 0,
    included: twoStage ? assessed.filter((r) => r.screen2 === 'include').length : active.filter((r) => r.screen1 === 'include').length,
  };
}
