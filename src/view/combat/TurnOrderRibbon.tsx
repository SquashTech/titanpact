import type { CSSProperties, ReactNode } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes } from '../../engine/state';
import { REST_PRIORITY_BRACKET, SWITCH_PRIORITY_BRACKET } from '../../engine/combat/priority';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatGlyph } from '../shared/statIcons';
import { getTypeColorRgb } from './typeColors';

export interface RibbonEntry {
  combatantId: string;
  hero: HeroDefinition;
  combatant: Combatant;
  /** The player's side, so the ribbon can tell the two sides apart without a label. */
  ally: boolean;
  /** The bracket the entry is placed in — `null` for a move whose bracket is rolled at resolution. */
  priority: number | null;
  speed: number;
  /** Same bracket and same Speed as the entry before it: the RNG decides between them. */
  tiedWithPrevious: boolean;
  /** Playback only: where the round's playback stands against this entry. Absent while commanding. */
  phase?: 'done' | 'current' | 'pending';
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
 * Whether a bracket put this entry somewhere Speed alone would not have: a cut ahead of a faster
 * combatant, or a hold behind a slower one. Read against the ribbon's own entries, so a +1 on the
 * fastest hero — which changes nothing — is a pip and no more.
 */
function bracketEffect(entries: readonly RibbonEntry[], i: number): 'cut' | 'held' | null {
  const p = entries[i].priority ?? 0;
  if (p === 0) return null;
  if (p > 0) return entries.slice(i + 1).some((e) => e.speed > entries[i].speed) ? 'cut' : null;
  return entries.slice(0, i).some((e) => e.speed < entries[i].speed) ? 'held' : null;
}

/**
 * The order this round resolves in, read left to right — the Speed stat's own glyph leads it,
 * since Speed is what it sorts on until a bracket says otherwise. A tie is the two portraits joined
 * by "=" instead of a chevron: the RNG decides, and the ribbon says so rather than picking one. A
 * non-zero bracket wears its pip on the portrait, and where it actually moved the entry — past a
 * faster combatant, or behind a slower one — the socket is lit for it and the chevron ahead of a
 * cut doubles. While commanding the enemy sits at bracket 0, since what it declared is not known
 * until the round plays; during playback every bracket is the real one, and `phase` walks the
 * ribbon along with the beats — done entries fall back, the current one stands forward.
 */
export function TurnOrderRibbon({ entries }: { entries: readonly RibbonEntry[] }) {
  if (entries.length < 2) return null;
  const summary = entries.map((e) => e.hero.name).join(', ');
  return (
    <div className="turn-order" role="status" aria-label={`Resolves in this order: ${summary}`}>
      <StatGlyph stat="speed" tone="inherit" className="turn-order-lead" />
      {entries.map((entry, i) => {
        const pip = bracketPip(entry.priority);
        const effect = bracketEffect(entries, i);
        const types = effectiveTypes(entry.hero, entry.combatant);
        const socketClass = [
          'turn-order-socket',
          entry.ally ? 'is-ally' : 'is-enemy',
          entry.tiedWithPrevious || entries[i + 1]?.tiedWithPrevious ? 'is-tied' : '',
          effect ? `is-${effect}` : '',
          entry.phase ? `is-${entry.phase}` : '',
          entry.combatant.fainted ? 'is-fainted' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <span key={entry.combatantId} className={`turn-order-step${entry.phase ? ` is-${entry.phase}` : ''}`}>
            {i > 0 && (
              <span
                className={`turn-order-sep${entry.tiedWithPrevious ? ' is-tie' : ''}${effect === 'cut' ? ' is-cut' : ''}`}
                aria-hidden="true"
              >
                {entry.tiedWithPrevious ? '=' : effect === 'cut' ? '»' : '›'}
              </span>
            )}
            <span
              className={socketClass}
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
