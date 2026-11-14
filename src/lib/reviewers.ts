// Nezávislé třídění dvěma hodnotiteli: výsledné rozhodnutí z hlasů, neshody a míra shody.
//
// Každý hodnotitel rozhoduje sám a rozhodnutí druhého nevidí. Výsledné rozhodnutí vzniká,
// až když se oba shodnou; při neshodě zůstává záznam otevřený, dokud ji hodnotitelé
// nevyřeší dohodou (případně s třetí osobou).

import type { Project, RecordItem, Reviewer, Screen1, Screen2, Team, Vote2 } from './types';
import { uid } from './util';

export function defaultTeam(): Team {
  return { double: false, reviewers: [{ id: uid(), name: 'Hodnotitel A' }, { id: uid(), name: 'Hodnotitel B' }] };
}

/** Postupuje záznam po třídění podle abstraktu dál (zařadit nebo možná)? */
export const passes = (v: Screen1) => v === 'include' || v === 'maybe';

const voted1 = (r: Pick<RecordItem, 'votes1'>, id: string): Screen1 => r.votes1?.[id] ?? 'pending';
const voted2 = (r: Pick<RecordItem, 'votes2'>, id: string): Vote2 => r.votes2?.[id] ?? { decision: 'pending', reason: '' };

export type PairState = 'waiting' | 'agree' | 'conflict';

/** Stav dvojice hlasů při třídění podle abstraktu. „Zařadit“ a „možná“ se neliší – obojí posílá záznam dál. */
export function state1(r: Pick<RecordItem, 'votes1'>, reviewers: Reviewer[]): PairState {
  const votes = reviewers.map((x) => voted1(r, x.id));
  if (votes.some((v) => v === 'pending')) return 'waiting';
  return votes.every((v) => passes(v) === passes(votes[0])) ? 'agree' : 'conflict';
}

/** Výsledné rozhodnutí při shodě; při čekání nebo neshodě „pending“. */
export function consensus1(r: Pick<RecordItem, 'votes1'>, reviewers: Reviewer[]): Screen1 {
  if (state1(r, reviewers) !== 'agree') return 'pending';
  const votes = reviewers.map((x) => voted1(r, x.id));
  if (!passes(votes[0])) return 'exclude';
  return votes.every((v) => v === 'include') ? 'include' : 'maybe';
}

export function state2(r: Pick<RecordItem, 'votes2'>, reviewers: Reviewer[]): PairState {
  const votes = reviewers.map((x) => voted2(r, x.id).decision);
  if (votes.some((v) => v === 'pending')) return 'waiting';
  return votes.every((v) => v === votes[0]) ? 'agree' : 'conflict';
}

/** Výsledné rozhodnutí o plném textu při shodě; liší-li se jen důvod vyřazení, bere se důvod prvního hodnotitele. */
export function consensus2(r: Pick<RecordItem, 'votes2'>, reviewers: Reviewer[]): { decision: Screen2; reason: string } {
  if (state2(r, reviewers) !== 'agree') return { decision: 'pending', reason: '' };
  const first = voted2(r, reviewers[0].id);
  return { decision: first.decision, reason: first.decision === 'exclude' ? first.reason || reviewers.map((x) => voted2(r, x.id).reason).find(Boolean) || '' : '' };
}

/** Shodli se hodnotitelé na vyřazení, ale každý z jiného důvodu? */
export function reasonMismatch(r: Pick<RecordItem, 'votes2'>, reviewers: Reviewer[]): boolean {
  if (state2(r, reviewers) !== 'agree') return false;
  const votes = reviewers.map((x) => voted2(r, x.id));
  return votes[0].decision === 'exclude' && new Set(votes.map((v) => v.reason.trim())).size > 1;
}

// ---- Míra shody ---------------------------------------------------------------

export interface Agreement {
  /** Počet záznamů posouzených oběma hodnotiteli. */
  n: number;
  agree: number;
  /** Pozorovaná shoda (podíl). */
  po: number;
  /** Shoda očekávaná náhodou. */
  pe: number;
  /** Cohenovo kappa; null, pokud ho nelze spočítat (jeden z hodnotitelů rozhodl vždy stejně). */
  kappa: number | null;
  /** Tabulka 2 × 2: [oba ano, A ano / B ne, A ne / B ano, oba ne]. */
  table: [number, number, number, number];
}

/** Cohenovo kappa pro dvojice rozhodnutí ano/ne (Cohen, 1960): κ = (po − pe) / (1 − pe). */
export function cohenKappa(pairs: [boolean, boolean][]): Agreement {
  const n = pairs.length;
  const a = pairs.filter(([x, y]) => x && y).length;
  const b = pairs.filter(([x, y]) => x && !y).length;
  const c = pairs.filter(([x, y]) => !x && y).length;
  const d = pairs.filter(([x, y]) => !x && !y).length;
  if (n === 0) return { n, agree: 0, po: NaN, pe: NaN, kappa: null, table: [a, b, c, d] };
  const po = (a + d) / n;
  const pe = ((a + b) / n) * ((a + c) / n) + ((c + d) / n) * ((b + d) / n);
  return { n, agree: a + d, po, pe, kappa: pe >= 1 ? null : (po - pe) / (1 - pe), table: [a, b, c, d] };
}

/** Slovní výklad kappa podle Landise a Kocha (1977). */
export function interpretKappa(k: number): string {
  if (k < 0) return 'horší než náhodná';
  if (k <= 0.2) return 'nepatrná';
  if (k <= 0.4) return 'slabá';
  if (k <= 0.6) return 'střední';
  if (k <= 0.8) return 'podstatná';
  return 'téměř úplná';
}

export interface StageStats {
  agreement: Agreement;
  /** Neshody celkem a z nich dosud nevyřešené. */
  conflicts: number;
  open: number;
  /** Kolik záznamů posoudil každý hodnotitel (v pořadí hodnotitelů). */
  votedBy: number[];
  total: number;
}

type Rec = Pick<RecordItem, 'duplicateOf' | 'screen1' | 'screen2' | 'fulltext' | 'votes1' | 'votes2'>;

/** Shoda při třídění podle abstraktu: ano = záznam postupuje dál. */
export function stage1Stats(records: Rec[], team: Team): StageStats {
  const active = records.filter((r) => !r.duplicateOf);
  const [a, b] = team.reviewers;
  const both = active.filter((r) => state1(r, team.reviewers) !== 'waiting');
  const conflicts = both.filter((r) => state1(r, team.reviewers) === 'conflict');
  return {
    agreement: cohenKappa(both.map((r) => [passes(voted1(r, a.id)), passes(voted1(r, b.id))])),
    conflicts: conflicts.length,
    open: conflicts.filter((r) => r.screen1 === 'pending').length,
    votedBy: team.reviewers.map((x) => active.filter((r) => voted1(r, x.id) !== 'pending').length),
    total: active.length,
  };
}

/** Shoda při posuzování plných textů: ano = zařadit do přehledu. `queue` jsou záznamy, které prošly tříděním. */
export function stage2Stats(queue: Rec[], team: Team): StageStats {
  const [a, b] = team.reviewers;
  const assessable = queue.filter((r) => r.fulltext !== 'notRetrieved');
  const both = assessable.filter((r) => state2(r, team.reviewers) !== 'waiting');
  const conflicts = both.filter((r) => state2(r, team.reviewers) === 'conflict');
  return {
    agreement: cohenKappa(both.map((r) => [voted2(r, a.id).decision === 'include', voted2(r, b.id).decision === 'include'])),
    conflicts: conflicts.length,
    open: conflicts.filter((r) => r.screen2 === 'pending').length,
    votedBy: team.reviewers.map((x) => assessable.filter((r) => voted2(r, x.id).decision !== 'pending').length),
    total: assessable.length,
  };
}

export const vote1Of = voted1;
export const vote2Of = voted2;

/** Jméno hodnotitele pro text (prázdné jméno nahradí pořadí). */
export function reviewerName(team: Team, id: string): string {
  const i = team.reviewers.findIndex((x) => x.id === id);
  return team.reviewers[i]?.name.trim() || `Hodnotitel ${i < 0 ? '?' : String.fromCharCode(65 + i)}`;
}

/** Klíč záznamu pro výměnu rozhodnutí mezi hodnotiteli. */
export const shareKey = (r: Pick<RecordItem, 'id' | 'originId'>) => r.originId ?? r.id;

export const isDouble = (project: Pick<Project, 'team'>) => !!project.team?.double;
