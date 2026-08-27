import type { CSSProperties } from 'react';
import type { HeroDefinition, MoveDefinition, TypeId } from '../../engine/content';
import type { Combatant } from '../../engine/state';
import { effectiveTypes, getMaxHp, getMaxMana, hasAffordableMove } from '../../engine/state';
import { resolveTypeMult, TYPE_MULT_FLOOR, type TypeChart } from '../../engine/damage/typeMult';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { StatGlyph, hpTier } from '../shared/StatBars';
import { StatusGlyph, statusColor, statusTint } from '../shared/statusIcons';
import { getTypeColorRgb } from './typeColors';

/** One bench hero, already resolved by the caller (FightScreen owns the roster/pending lookups). */
export interface SwitchOption {
  combatantId: string;
  hero: HeroDefinition;
  combatant: Combatant;
  /** This hero's unlocked movepool — what "can still act" is measured against. */
  moveIds: readonly string[];
  /** Currently the declared replacement for the active hero this panel was opened for. */
  selected: boolean;
  /** Already queued as the OTHER active hero's replacement this round, so it can't also come in here. */
  claimedByOther: boolean;
}

interface Props {
  /** The active hero being replaced — the half of the trade the old panel never showed. */
  outgoingHero: HeroDefinition;
  outgoing: Combatant;
  options: readonly SwitchOption[];
  /** Enemy heroes still standing in an active slot — the other half of every matchup readout. */
  enemies: readonly { hero: HeroDefinition; combatant: Combatant }[];
  typeChart: TypeChart;
  moves: Record<string, MoveDefinition>;
  onPick: (benchCombatantId: string) => void;
  onInspect: (benchCombatantId: string) => void;
  onClose: () => void;
}

/**
 * The hardest number this side of the field can put on `defenderTypes` using
 * its own types, and the softest — i.e. what a STAB hit would multiply by.
 *
 * Types, not movepools, on purpose. A bench hero's actual damage depends on
 * which move gets picked next round, which hasn't happened yet; what the
 * player can act on at the instant of the trade is the standing type matchup,
 * which is the same read a VGC player makes before clicking Switch. Showing
 * the best case for the outgoing direction and the WORST case for the
 * incoming one is deliberate: switching is a defensive decision, so the panel
 * should quote the risk at its ceiling, never at its average.
 */
function bestMultAgainst(chart: TypeChart, attackerTypes: readonly TypeId[], defenderTypes: readonly TypeId[]): number {
  let best = TYPE_MULT_FLOOR;
  for (const attackType of attackerTypes) {
    best = Math.max(best, resolveTypeMult(chart, attackType, defenderTypes));
  }
  return best;
}

function formatMult(mult: number): string {
  return `${Math.round(mult * 100) / 100}×`;
}

/**
 * Direction-aware coloring. The same 2× is good news on the line that says
 * what this hero DEALS and bad news on the line that says what they TAKE, so
 * the two chips can't share one mult→class map — hence `good`/`bad`/`flat`
 * rather than the move grid's eff-super/eff-resist naming, which encodes the
 * multiplier rather than its consequence.
 */
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
  return (
    <div className="switch-gauge">
      <span className="switch-gauge-label">{kind === 'hp' ? 'HP' : 'MP'}</span>
      <span className="bar-track switch-gauge-track">
        <span
          className={`bar-fill ${kind === 'hp' ? hpTier(fraction) : 'mana'}`}
          style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
        />
      </span>
      <span className="switch-gauge-value">
        {value}
        <span className="switch-gauge-max">/{max}</span>
      </span>
    </div>
  );
}

/**
 * The switch-in picker (FightScreen's Switch key).
 *
 * Replaces a plain `.bench-row` of shrunken battlefield cards. Two problems
 * with reusing the battlefield card here: it answered "who is this" (which
 * the player already knows — it's their own four-hero squad) and not "why
 * would I bring them in", and a row of small vertical cards gave the single
 * most consequential tap in a fight the visual weight of a thumbnail strip.
 *
 * So this is authored for the decision instead. Each candidate is a full-width
 * row — sprite in a type-lit socket, name and types, HP/MP gauges with real
 * numerals, and the matchup pair the trade actually turns on: what this hero's
 * types DEAL to the enemy actives and what they TAKE from them. The header
 * names the hero going out, because a switch is a trade and the old panel only
 * ever showed one side of it.
 *
 * Everything here is presentation-only — a read of the engine's own type
 * resolution and stat helpers (CLAUDE.md "Resolution and presentation are
 * separate layers"). Nothing in this file decides anything; picking a row
 * hands the id straight back to FightScreen.
 */
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

  return (
    <div className="log-overlay" onClick={onClose}>
      <div className="log-panel switch-panel" onClick={(e) => e.stopPropagation()}>
        <div className="log-panel-header">
          <span>Switch In</span>
          <button className="log-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* The other half of the trade. Small, dim, and stated as a fact
            rather than offered as a control — it is context for the choice
            below, not one of the choices. */}
        <div className="switch-outgoing" style={{ '--socket-rgb': getTypeColorRgb(outgoingTypes[0]) } as CSSProperties}>
          <span className="switch-outgoing-socket">
            <HeroPortrait heroId={outgoingHero.id} className="switch-outgoing-portrait" />
          </span>
          <span className="switch-outgoing-text">
            <strong>{outgoingHero.name}</strong> steps out
          </span>
          {/* The same pair every candidate below carries, for the hero
              leaving — without it the numbers on the options are absolute
              when the decision is a comparison. */}
          {enemyTypes.length > 0 && (
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
            const ready = hasAffordableMove(combatant.currentMana, moveIds, moves);
            // No enemy on the field (the last one just fainted mid-selection)
            // means there is no matchup to quote — drop the pair rather than
            // print a meaningless 1×.
            const hasMatchup = enemyTypes.length > 0;

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

                  {/* Bottom line: the two matchup numbers, whatever statuses
                      travel in with this hero, and — only when it's false —
                      the fact that they'd arrive unable to afford a move.
                      "Ready" is not printed: the common case earns no ink. */}
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

                {/* State stamp, top-right. Only ever one of the two, and both
                    are states the row is IN rather than actions on it. */}
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
