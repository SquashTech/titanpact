import type { CSSProperties } from 'react';
import type { HeroDefinition, MoveDefinition, TypeId } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana, hasAffordableMove } from '../../engine/state';
import { resolveTypeMult, TYPE_MULT_FLOOR, type TypeChart } from '../../engine/damage/typeMult';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { StatGlyph, hpTier } from '../shared/StatBars';
import { StatusGlyph, statusColor, statusTint } from '../shared/statusIcons';
import { formatMult } from './MoveDetailOverlay';
import { getTypeColorRgb } from './typeColors';

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

// Types, not movepools: the standing type matchup is what the player can act
// on at the instant of the trade. Best case outgoing, worst case incoming.
function bestMultAgainst(chart: TypeChart, attackerTypes: readonly TypeId[], defenderTypes: readonly TypeId[]): number {
  let best = TYPE_MULT_FLOOR;
  for (const attackType of attackerTypes) {
    best = Math.max(best, resolveTypeMult(chart, attackType, defenderTypes));
  }
  return best;
}

// Direction-aware: 2× is good on the DEALS line and bad on the TAKES line.
function toneFor(mult: number, higherIsBetter: boolean): string {
  if (mult === 1) return 'flat';
  return mult > 1 === higherIsBetter ? 'good' : 'bad';
}

function MatchupChip({ mult, higherIsBetter, stat, label }: { mult: number; higherIsBetter: boolean; stat: 'attack' | 'defense'; label: string }) {
  return (
    <span className={`switch-chip ${toneFor(mult, higherIsBetter)}`} title={label}>
      <StatGlyph stat={stat} tone="inherit" className="switch-chip-glyph" />
      {formatMult(mult)}
    </span>
  );
}

function Gauge({ kind, value, max }: { kind: 'hp' | 'mana'; value: number; max: number }) {
  const fraction = max > 0 ? value / max : 0;
  // Mana can exceed its pool (docs/mana.md "Overflow"); the surplus gets its own band.
  const overFraction = kind === 'mana' && max > 0 ? Math.max(0, Math.min(1, (value - max) / max)) : 0;
  return (
    <div className="switch-gauge">
      <span className="switch-gauge-label">{kind === 'hp' ? 'HP' : 'MP'}</span>
      <span className="bar-track switch-gauge-track">
        <span
          className={`bar-fill ${kind === 'hp' ? hpTier(fraction) : 'mana'}`}
          style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
        />
        {overFraction > 0 && <span className="bar-fill mana-over" style={{ width: `${overFraction * 100}%` }} />}
      </span>
      <span className={`switch-gauge-value${overFraction > 0 ? ' is-overcharged' : ''}`}>
        {value}
        <span className="switch-gauge-max">/{max}</span>
      </span>
    </div>
  );
}

/** The switch-in picker (FightScreen's Switch key). Presentation-only; picking a row hands the id back to FightScreen. */
export function SwitchInPanel({
  outgoingHero,
  outgoing,
  options,
  enemies,
  typeChart,
  moves,
  onPick,
  onInspect,
  onClose,
}: Props) {
  const outgoingTypes = effectiveTypes(outgoingHero, outgoing);
  const enemyTypes = enemies.flatMap(({ hero, combatant }) => effectiveTypes(hero, combatant));
  // No enemy on the field (the last one fainted mid-selection) means no matchup to quote.
  const hasMatchup = enemyTypes.length > 0;

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel switch-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Switch In</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="switch-outgoing" style={{ '--socket-rgb': getTypeColorRgb(outgoingTypes[0]) } as CSSProperties}>
          <span className="switch-outgoing-socket">
            <HeroPortrait heroId={outgoingHero.id} className="switch-outgoing-portrait" />
          </span>
          <span className="switch-outgoing-text">
            <strong>{outgoingHero.name}</strong> steps out
          </span>
          {hasMatchup && (
            <span className="switch-outgoing-chips">
              <MatchupChip
                mult={bestMultAgainst(typeChart, outgoingTypes, enemyTypes)}
                higherIsBetter
                stat="attack"
                label={`Best type multiplier ${outgoingHero.name} can put on an enemy active`}
              />
              <MatchupChip
                mult={bestMultAgainst(typeChart, enemyTypes, outgoingTypes)}
                higherIsBetter={false}
                stat="defense"
                label={`Worst type multiplier an enemy active can put on ${outgoingHero.name}`}
              />
            </span>
          )}
        </div>

        <div className="switch-options">
          {options.map((option) => {
            const { combatantId, hero, combatant, moveIds, selected, claimedByOther } = option;
            const types = effectiveTypes(hero, combatant);
            const statusList = Object.values(combatant.statuses);
            const ready = hasAffordableMove(combatant.currentMana, moveIds, moves, combatant.moveManaDiscounts);

            return (
              <button
                key={combatantId}
                type="button"
                className={[
                  'switch-option',
                  selected ? 'selected' : '',
                  claimedByOther ? 'claimed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--socket-rgb': getTypeColorRgb(types[0]) } as CSSProperties}
                aria-disabled={claimedByOther}
                onClick={() => {
                  if (!claimedByOther) onPick(combatantId);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onInspect(combatantId);
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

                  {/* "Ready" is not printed: the common case earns no ink. */}
                  <span className="switch-option-readout">
                    {hasMatchup && (
                      <>
                        <MatchupChip
                          mult={bestMultAgainst(typeChart, types, enemyTypes)}
                          higherIsBetter
                          stat="attack"
                          label={`Best type multiplier ${hero.name} can put on an enemy active`}
                        />
                        <MatchupChip
                          mult={bestMultAgainst(typeChart, enemyTypes, types)}
                          higherIsBetter={false}
                          stat="defense"
                          label={`Worst type multiplier an enemy active can put on ${hero.name}`}
                        />
                      </>
                    )}
                    {statusList.map((instance) => (
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
                  </span>
                </span>

                {claimedByOther && <span className="switch-stamp claimed-stamp">Taken</span>}
                {selected && !claimedByOther && <span className="switch-stamp">In</span>}
              </button>
            );
          })}
        </div>

        <p className="switch-note">The hero coming in doesn’t act this round.</p>
      </div>
    </div>
  );
}
