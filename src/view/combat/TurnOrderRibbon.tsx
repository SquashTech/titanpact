import type { CSSProperties, ReactNode } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes } from '../../engine/state';
import type { OrderPreviewEntry } from '../../engine/combat/priority';
import { REST_PRIORITY_BRACKET, SWITCH_PRIORITY_BRACKET } from '../../engine/combat/priority';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatGlyph } from '../shared/statIcons';
import { getTypeColorRgb } from './typeColors';

export interface RibbonEntry extends OrderPreviewEntry {
  hero: HeroDefinition;
  combatant: Combatant;
  /** The player's side, so the ribbon can tell the two sides apart without a label. */
  ally: boolean;
}

/** What a non-zero bracket is shown as on the portrait: the sign and size, or the verb that has no number. */
function bracketPip(priority: number | null): ReactNode {
  if (priority === null) return '?';
  if (priority === SWITCH_PRIORITY_BRACKET) return '⇄';
  if (priority === REST_PRIORITY_BRACKET) return '☾';
  if (priority === 0) return null;
  return priority > 0 ? `+${priority}` : `${priority}`;
}

/**
 * The order this round would resolve in, read left to right — the Speed stat's own glyph leads it,
 * since Speed is what it sorts on until a bracket says otherwise. A tie is the two portraits joined
 * by "=" instead of a chevron: the RNG decides, and the ribbon says so rather than picking one. A
 * declared action that moved its hero carries its bracket as a pip on the portrait. Enemies are
 * placed at bracket 0, since what they declared is not known until the round plays.
 */
export function TurnOrderRibbon({ entries }: { entries: readonly RibbonEntry[] }) {
  if (entries.length < 2) return null;
  const summary = entries.map((e) => e.hero.name).join(', ');
  return (
    <div className="turn-order" role="status" aria-label={`Resolves in this order: ${summary}`}>
      <StatGlyph stat="speed" tone="inherit" className="turn-order-lead" />
      {entries.map((entry, i) => {
        const pip = bracketPip(entry.priority);
        const types = effectiveTypes(entry.hero, entry.combatant);
        return (
          <span key={entry.combatantId} className="turn-order-step">
            {i > 0 && (
              <span className={`turn-order-sep${entry.tiedWithPrevious ? ' is-tie' : ''}`} aria-hidden="true">
                {entry.tiedWithPrevious ? '=' : '›'}
              </span>
            )}
            <span
              className={`turn-order-socket${entry.ally ? ' is-ally' : ' is-enemy'}${entry.tiedWithPrevious || entries[i + 1]?.tiedWithPrevious ? ' is-tied' : ''}`}
              style={{ '--socket-rgb': getTypeColorRgb(types[0]) } as CSSProperties}
              title={`${entry.hero.name} — Speed ${entry.speed}`}
            >
              <HeroPortrait heroId={entry.hero.id} className="turn-order-portrait" />
              {pip !== null && <span className="turn-order-pip">{pip}</span>}
            </span>
          </span>
        );
      })}
    </div>
  );
}
