import { useState, type CSSProperties } from 'react';
import type { HeroDefinition, MoveDefinition, TypeId } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana, hasAffordableMove } from '../../engine/state';
import { resolveTypeMult, TYPE_MULT_FLOOR, type TypeChart } from '../../engine/damage/typeMult';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { StatGlyph, hpTier, ShieldFill, ShieldLabel } from '../shared/StatBars';
import { PlateButton } from '../shared/PlateButton';
import { MatchupArrow } from '../shared/MatchupArrows';
import { shieldHeld } from '../../engine/status/shield';
import { statuses } from '../../data/statuses';
import { StatusGlyph, statusColor, statusTint } from '../shared/statusIcons';
import { formatMult } from './MoveDetailOverlay';
import { getTypeColor, getTypeColorRgb } from './typeColors';

/** One bench hero, already resolved by the caller. */
export interface SwitchOption {
  combatantId: string;
  hero: HeroDefinition;
  combatant: Combatant;
  /** This hero's unlocked movepool — what "can still act" is measured against. */
  moveIds: readonly string[];
  /** Currently the declared replacement for the active hero this panel was opened for. */
  selected: boolean;
  /** Already queued as the OTHER active hero's replacement this round. */
  claimedByOther: boolean;
}

interface Props {
  outgoingHero: HeroDefinition;
  outgoing: Combatant;
  options: readonly SwitchOption[];
  /** Enemy heroes still standing in an active slot. */
  enemies: readonly { hero: HeroDefinition; combatant: Combatant }[];
  typeChart: TypeChart;
  moves: Record<string, MoveDefinition>;
  onPick: (benchCombatantId: string) => void;
  onInspect: (benchCombatantId: string) => void;
  onClose: () => void;
}

// Types, not movepools: the standing type matchup is what the player can act on at the instant of the trade.
function bestMultAgainst(chart: TypeChart, attackerTypes: readonly TypeId[], defenderTypes: readonly TypeId[]): number {
  let best = TYPE_MULT_FLOOR;
  for (const attackType of attackerTypes) {
    best = Math.max(best, resolveTypeMult(chart, attackType, defenderTypes));
  }
  return best;
}

type Verdict = 'up' | 'down' | null;

/** One hero against one enemy, both ways; the verdict is the lead pick's (a full doubling ahead or behind). */
function duel(chart: TypeChart, heroTypes: readonly TypeId[], enemyTypes: readonly TypeId[]) {
  const deals = bestMultAgainst(chart, heroTypes, enemyTypes);
  const takes = bestMultAgainst(chart, enemyTypes, heroTypes);
  const net = Math.log2(deals) - Math.log2(takes);
  const verdict: Verdict = net >= 1 ? 'up' : net <= -1 ? 'down' : null;
  return { deals, takes, verdict };
}

// Direction-aware: 2× is good on the deals line and bad on the takes line.
function toneFor(mult: number, higherIsBetter: boolean): string {
  if (mult === 1) return 'flat';
  return mult > 1 === higherIsBetter ? 'good' : 'bad';
}

function Gauge({ kind, value, max, shield = 0 }: { kind: 'hp' | 'mana'; value: number; max: number; shield?: number }) {
  const fraction = max > 0 ? value / max : 0;
  // Mana can exceed its pool (docs/mana.md "Overflow"); the surplus gets its own band.
  const overFraction = kind === 'mana' && max > 0 ? Math.max(0, Math.min(1, (value - max) / max)) : 0;
  return (
    <div className="switch-gauge">
      <span className="bar-track switch-gauge-track">
        <span
          className={`bar-fill ${kind === 'hp' ? hpTier(fraction) : 'mana'}`}
          style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
        />
        {overFraction > 0 && <span className="bar-fill mana-over" style={{ width: `${overFraction * 100}%` }} />}
        {kind === 'hp' && <ShieldFill currentHp={value} maxHp={max} shield={shield} as="span" />}
      </span>
      <span className={`switch-gauge-value${overFraction > 0 ? ' is-overcharged' : ''}`}>
        {value}
        <span className="switch-gauge-max">/{max}</span>
        <ShieldLabel shield={kind === 'hp' ? shield : 0} />
      </span>
    </div>
  );
}

/**
 * The switch-in picker (FightScreen's Switch key, and a pivot move's second stage): a face-off
 * stage for the hero being considered, the bench beneath it, and a plate that sends it in.
 * The scrim above the sheet closes it.
 */
export function SwitchInPanel({ outgoingHero, outgoing, options, enemies, typeChart, moves, onPick, onInspect, onClose }: Props) {
  const firstOpen = options.find((o) => o.selected && !o.claimedByOther) ?? options.find((o) => !o.claimedByOther);
  const [stagedId, setStagedId] = useState(firstOpen?.combatantId);
  const staged = options.find((o) => o.combatantId === stagedId && !o.claimedByOther) ?? firstOpen;
  if (!staged) return null;

  const outgoingTypes = effectiveTypes(outgoingHero, outgoing);
  const enemyTypings = enemies.map(({ hero, combatant }) => effectiveTypes(hero, combatant));
  const { hero, combatant } = staged;
  const types = effectiveTypes(hero, combatant);
  const ready = hasAffordableMove(combatant.currentMana, staged.moveIds, moves, combatant.moveManaDiscounts);

  return (
    <div className="log-overlay switch-overlay" onClick={onClose}>
      <div className="switch-sheet" onClick={(e) => e.stopPropagation()}>
        <div
          className="switch-stage"
          style={{ '--rgb': getTypeColorRgb(types[0]), '--out-rgb': getTypeColorRgb(outgoingTypes[0]) } as CSSProperties}
        >
          <button type="button" className="switch-close" onClick={onClose} aria-label="Close">
            ✕
          </button>

          <div className="switch-handoff">
            <div className="switch-handoff-bar is-from">
              <HeroPortrait heroId={outgoingHero.id} pathId={outgoing.formPathId} className="switch-handoff-face" />
              <span className="switch-handoff-name">{outgoingHero.name}</span>
            </div>
            <span className="switch-chevrons" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div className="switch-handoff-bar is-to" key={staged.combatantId}>
              <HeroPortrait heroId={hero.id} pathId={combatant.formPathId} className="switch-handoff-face" />
              <span className="switch-handoff-name">{hero.name}</span>
            </div>
          </div>

          <div className="switch-arrival" key={staged.combatantId}>
            <HeroPortrait heroId={hero.id} pathId={combatant.formPathId} seed={staged.combatantId} className="switch-arrival-sprite" />
          </div>

          <div className="switch-duels">
            {enemies.map(({ hero: enemy, combatant: enemyCombatant }, i) => {
              const { deals, takes, verdict } = duel(typeChart, types, enemyTypings[i]);
              return (
                <div className="switch-duel-lane" key={enemyCombatant.combatantId} style={{ animationDelay: `${i * 70}ms` }}>
                  <div className={`switch-duel${verdict ? ` is-${verdict}` : ''}`}>
                    <div className="switch-duel-line">
                      <StatGlyph stat="attack" tone="inherit" className="switch-duel-glyph" />
                      <span>deals</span>
                      <span className={`switch-mult ${toneFor(deals, true)}`}>{formatMult(deals)}</span>
                    </div>
                    <div className="switch-duel-line">
                      <StatGlyph stat="defense" tone="inherit" className="switch-duel-glyph" />
                      <span>takes</span>
                      <span className={`switch-mult ${toneFor(takes, false)}`}>{formatMult(takes)}</span>
                    </div>
                  </div>
                  <div className="switch-foe">
                    <HeroPortrait heroId={enemy.id} pathId={enemyCombatant.formPathId} seed={enemyCombatant.combatantId} className="switch-foe-sprite" />
                    <span className="switch-foe-name">{enemy.name}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="switch-stage-foot">
            <span className="switch-stage-types">
              {types.map((type) => (
                <TypeBadge key={type} type={type} />
              ))}
            </span>
            <span className="switch-stage-gauges">
              <Gauge kind="hp" value={combatant.currentHp} max={getMaxHp(hero, combatant)} shield={shieldHeld(combatant, statuses)} />
              <Gauge kind="mana" value={combatant.currentMana} max={getMaxMana(hero, combatant)} />
            </span>
          </div>
          {(Object.keys(combatant.statuses).length > 0 || !ready) && (
            <div className="switch-stage-flags">
              {Object.values(combatant.statuses).map((instance) => (
                <span
                  key={instance.statusId}
                  className="switch-status"
                  style={{ color: statusColor(instance.statusId), background: statusTint(instance.statusId, 0.16), borderColor: statusTint(instance.statusId, 0.5) }}
                  title={instance.statusId}
                >
                  <StatusGlyph statusId={instance.statusId} />
                </span>
              ))}
              {!ready && <span className="switch-flag">No mana</span>}
            </div>
          )}
        </div>

        <div className="switch-bench">
          {options.map((option, i) => {
            const optionTypes = effectiveTypes(option.hero, option.combatant);
            const max = getMaxHp(option.hero, option.combatant);
            const fraction = max > 0 ? option.combatant.currentHp / max : 0;
            return (
              <button
                key={option.combatantId}
                type="button"
                className={`switch-pick${option.combatantId === staged.combatantId ? ' is-staged' : ''}${option.claimedByOther ? ' is-claimed' : ''}`}
                style={{ '--rgb': getTypeColorRgb(optionTypes[0]), animationDelay: `${80 + i * 50}ms` } as CSSProperties}
                aria-disabled={option.claimedByOther}
                aria-pressed={option.combatantId === staged.combatantId}
                onClick={() => {
                  if (!option.claimedByOther) setStagedId(option.combatantId);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onInspect(option.combatantId);
                }}
              >
                {option.claimedByOther && <span className="switch-pick-stamp">Taken</span>}
                <HeroPortrait heroId={option.hero.id} pathId={option.combatant.formPathId} className="switch-pick-sprite" />
                <span className="switch-pick-name">{option.hero.name}</span>
                <span className="switch-pick-arrows">
                  {enemyTypings.map((enemyTypes, k) => (
                    <MatchupArrow key={k} verdict={duel(typeChart, optionTypes, enemyTypes).verdict} />
                  ))}
                </span>
                <span className="switch-pick-hp">
                  <span className={`bar-fill ${hpTier(fraction)}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
                </span>
              </button>
            );
          })}
        </div>

        <PlateButton compact tint={getTypeColor(types[0])} onClick={() => onPick(staged.combatantId)}>
          Send {hero.name} in
        </PlateButton>
        <p className="switch-note">Comes in without acting this round.</p>
      </div>
    </div>
  );
}
