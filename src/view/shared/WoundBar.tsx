import type { CSSProperties } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry } from '../../run/state';
import { standingHp, standingMana } from '../../run/wounds';
import { entryStatTotals } from './entryStatTotals';
import { hpTier } from './StatBars';

/** Where a roster hero's HP stands going into its next fight (run/wounds.ts), off the same totals the sheet prints — 0 while it is down. */
export function entryHp(hero: HeroDefinition, entry: RosterEntry, relicIds: readonly string[]): { hp: number; maxHp: number } {
  const maxHp = entryStatTotals(hero, entry, relicIds).hp;
  return { hp: standingHp(maxHp, entry), maxHp };
}

/** Where a roster hero's Mana stands going into its next fight (run/wounds.ts). */
export function entryMana(hero: HeroDefinition, entry: RosterEntry, relicIds: readonly string[]): { mana: number; maxMana: number } {
  const maxMana = entryStatTotals(hero, entry, relicIds).manaPool;
  return { mana: standingMana(maxMana, entry), maxMana };
}

const MANA_FILL = { '--wound-rgb': 'var(--mana)' } as CSSProperties;

/** The out-of-combat Mana bar, drawn under a WoundBar: Mana carries between an act's fights. */
export function ManaBar({ mana, maxMana, figure = false, className }: { mana: number; maxMana: number; figure?: boolean; className?: string }) {
  const fraction = maxMana > 0 ? Math.max(0, Math.min(1, mana / maxMana)) : 0;
  return (
    <span className={`wound-bar is-mana${className ? ` ${className}` : ''}`} style={MANA_FILL} role="img" aria-label={`${mana} of ${maxMana} Mana`}>
      <span className="wound-bar-track">
        <span className="wound-bar-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </span>
      {figure && (
        <span className="wound-bar-figure">
          {mana}/{maxMana}
        </span>
      )}
    </span>
  );
}

interface WoundBarProps {
  hp: number;
  maxHp: number;
  /** The number beside the bar. Off by default: on a card the tier colour is the read, the figure is the sheet's. */
  figure?: boolean;
  className?: string;
}

/**
 * The out-of-combat HP bar: the same three-tier colour the fight's bars use, so "getting low"
 * is one threshold everywhere. Drawn wherever a wounded hero is picked from — the squad, the
 * map's roster peek, the Rest — and always drawn full too, since a bar that only appears when
 * something is wrong cannot be compared against the ones that are fine.
 */
export function WoundBar({ hp, maxHp, figure = false, className }: WoundBarProps) {
  const fraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  return (
    <span
      className={`wound-bar is-${hpTier(fraction)}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`${hp} of ${maxHp} HP`}
    >
      <span className="wound-bar-track">
        <span className="wound-bar-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
      </span>
      {figure && (
        <span className="wound-bar-figure">
          {hp}/{maxHp}
        </span>
      )}
    </span>
  );
}
