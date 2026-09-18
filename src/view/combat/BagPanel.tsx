import { useState, type CSSProperties } from 'react';
import type { HeroDefinition } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana } from '../../engine/state';
import type { FightConsumableKind } from '../../engine/combat/consumables';
import { CONSUMABLE_BLURBS, CONSUMABLE_KINDS, CONSUMABLE_NAMES, CONSUMABLE_SHORT_NAMES } from '../../run/consumables';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { ResourceGlyph } from '../shared/RunGlyph';
import { hpTier } from '../shared/StatBars';
import { getTypeColorRgb } from './typeColors';
import { Coin } from '../shared/Coin';

/** One hero, already resolved by the caller, with why each kind is refused for it (null = usable). */
export interface BagTarget {
  combatantId: string;
  hero: HeroDefinition;
  combatant: Combatant;
  refusal: Record<FightConsumableKind, string | null>;
}

interface Props {
  /** What is left to use this fight, by kind. */
  purse: Record<FightConsumableKind, number>;
  /** The active heroes — the potions' rows. */
  targets: readonly BagTarget[];
  /** The fallen — the Revive's rows. */
  fallen: readonly BagTarget[];
  /** The hero the console is on — the row the panel opens pre-lit. */
  actingId: string | null;
  onDrink: (combatantId: string, kind: FightConsumableKind) => void;
  onClose: () => void;
}

function Gauge({ kind, value, max }: { kind: 'hp' | 'mana'; value: number; max: number }) {
  const fraction = max > 0 ? value / max : 0;
  const overFraction = kind === 'mana' && max > 0 ? Math.max(0, Math.min(1, (value - max) / max)) : 0;
  return (
    <div className="switch-gauge">
      <span className="switch-gauge-label">{kind === 'hp' ? 'HP' : 'MP'}</span>
      <span className="bar-track switch-gauge-track">
        <span className={`bar-fill ${kind === 'hp' ? hpTier(fraction) : 'mana'}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
        {overFraction > 0 && <span className="bar-fill mana-over" style={{ width: `${overFraction * 100}%` }} />}
      </span>
      <span className={`switch-gauge-value${overFraction > 0 ? ' is-overcharged' : ''}`}>
        {value}
        <span className="switch-gauge-max">/{max}</span>
      </span>
    </div>
  );
}

/**
 * The Bag: every consumable held, and which hero it is used on. The kinds are a chip row across
 * the top — a new consumable is one more chip, nothing else — with the panel opening on the first
 * kind that still has stock; the heroes below are the only other choice: the active pair for a
 * potion, the fallen for the Revive. Using is IMMEDIATE and has no Back — the row says so once, in
 * the note, the way Switch's does. Presentation-only; the engine call is FightScreen's.
 */
export function BagPanel({ purse, targets, fallen, actingId, onDrink, onClose }: Props) {
  const [kind, setKind] = useState<FightConsumableKind>(() => CONSUMABLE_KINDS.find((k) => purse[k] > 0) ?? CONSUMABLE_KINDS[0]);
  const held = purse[kind];
  const rows = kind === 'revive' ? fallen : targets;
  return (
    <div className="log-overlay" onClick={onClose}>
      <div className={`log-panel switch-panel flask-panel is-${kind}`} onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span className="flask-panel-title">Bag</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="bag-kinds" role="tablist">
          {CONSUMABLE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === kind}
              className={`bag-kind is-${k}${k === kind ? ' selected' : ''}${purse[k] === 0 ? ' empty' : ''}`}
              onClick={() => setKind(k)}
            >
              {/* The potion struck on a coin (shared/Coin.tsx), in its gauge's colour — the same die the order marks are. */}
              <span className="bag-kind-coin">
                <Coin />
                <ResourceGlyph kind={k} tone="inherit" className="bag-kind-coin-glyph" />
              </span>
              <span className="bag-kind-name">{CONSUMABLE_SHORT_NAMES[k]}</span>
              <span className="flask-kind-count">×{purse[k]}</span>
            </button>
          ))}
        </div>
        <p className="flask-blurb">
          {CONSUMABLE_BLURBS[kind]}. <strong>No turn spent.</strong>
        </p>

        <div className="switch-options">
          {rows.length === 0 && <p className="switch-note">Nobody is down.</p>}
          {rows.map(({ combatantId, hero, combatant, refusal }) => {
            const types = effectiveTypes(hero, combatant);
            const why = held === 0 ? `No ${CONSUMABLE_NAMES[kind]} left` : refusal[kind];
            const blocked = why !== null;
            return (
              <button
                key={combatantId}
                type="button"
                className={['switch-option', combatantId === actingId ? 'selected' : '', blocked ? 'claimed' : ''].filter(Boolean).join(' ')}
                style={{ '--socket-rgb': getTypeColorRgb(types[0]) } as CSSProperties}
                aria-disabled={blocked}
                onClick={() => {
                  if (!blocked) onDrink(combatantId, kind);
                }}
              >
                <span className="switch-option-socket">
                  <HeroPortrait heroId={hero.id} className="switch-option-portrait" />
                </span>
                <span className="switch-option-body">
                  <span className="switch-option-head">
                    <span className="switch-option-name">{hero.name}</span>
                    <span className="switch-option-types">
                      {types.map((type) => (
                        <TypeBadge key={type} type={type} />
                      ))}
                    </span>
                  </span>
                  <Gauge kind="hp" value={combatant.currentHp} max={getMaxHp(hero, combatant)} />
                  <Gauge kind="mana" value={combatant.currentMana} max={getMaxMana(hero, combatant)} />
                  {/* Always rendered: a row that only appears when blocked resized the panel on every tab change. */}
                  <span className="switch-option-readout flask-readout">{blocked && <span className="switch-flag">{why}</span>}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="switch-note">{kind === 'revive' ? 'Stands at once, onto the bench — there is no taking it back.' : 'Drinks at once — there is no taking it back.'}</p>
      </div>
    </div>
  );
}
