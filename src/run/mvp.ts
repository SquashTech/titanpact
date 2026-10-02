// The fight's MVP: one free Mastery pip to the hero that dominated a column, not the one that hit
// hardest (docs/xp-overhaul.md §5, measured on the four-acts branch). Pure: the caller builds the
// ledger off the fight's event stream.

export type MvpColumn = 'damage' | 'finishes' | 'support' | 'anchor' | 'control';

export const MVP_COLUMNS: readonly MvpColumn[] = ['damage', 'finishes', 'support', 'anchor', 'control'];

/** One player hero's fight, in the columns' own units — a share is read per column, so units never mix. */
export interface MvpLedger {
  rosterId: string;
  roundsActive: number;
  /** HP removed from enemies, Shield-absorbed and DoT ticks included. */
  damage: number;
  /** Knockouts landed. */
  finishes: number;
  /** Healing done (drain excluded) plus Shield this hero granted that a hit then emptied. */
  support: number;
  /** Damage taken from enemies, recoil and self-costs excluded. */
  anchor: number;
  /** Statuses and stat drops landed on enemies, buffs landed on allies. */
  control: number;
}

/** Finishes are lumpy — two of three knockouts is 67% — so the column counts a little less. */
export const MVP_COLUMN_WEIGHT: Record<MvpColumn, number> = { damage: 1, finishes: 0.8, support: 1, anchor: 1, control: 1 };

/** A hero must stand on the field this many rounds, or a one-turn switch-in takes a whole column. */
export const MVP_MIN_ROUNDS = 2;

export interface MvpPick {
  rosterId: string;
  column: MvpColumn;
  /** The hero's share of the team's column, 0..1. */
  share: number;
  score: number;
}

/** Every qualifying hero, best first, each scored by its weighted share of the one column it led most. */
export function rankMvp(ledgers: readonly MvpLedger[]): MvpPick[] {
  const totals = Object.fromEntries(MVP_COLUMNS.map((c) => [c, ledgers.reduce((sum, l) => sum + l[c], 0)])) as Record<MvpColumn, number>;
  const picks: MvpPick[] = [];
  for (const ledger of ledgers) {
    if (ledger.roundsActive < MVP_MIN_ROUNDS) continue;
    let best: MvpPick | undefined;
    for (const column of MVP_COLUMNS) {
      if (totals[column] <= 0) continue;
      const share = ledger[column] / totals[column];
      const score = share * MVP_COLUMN_WEIGHT[column];
      if (!best || score > best.score) best = { rosterId: ledger.rosterId, column, share, score };
    }
    if (best && best.score > 0) picks.push(best);
  }
  return picks.sort((a, b) => b.score - a.score || a.rosterId.localeCompare(b.rosterId));
}

export interface MvpRules {
  /** Heroes that cannot take a pip — at the Mastery cap. */
  capped: ReadonlySet<string>;
  /** Last fight's MVP: never twice running while anyone else qualifies. */
  lastMvpRosterId?: string;
}

/** The MVP after the two rules; undefined when nobody qualifies. */
export function chooseMvp(ledgers: readonly MvpLedger[], rules: MvpRules): MvpPick | undefined {
  const ranked = rankMvp(ledgers).filter((pick) => !rules.capped.has(pick.rosterId));
  return ranked.find((pick) => pick.rosterId !== rules.lastMvpRosterId) ?? ranked[0];
}
