import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { statusApplicationsOf } from '../../engine/content';
import { heroes } from '../../data/heroes';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { equipment } from '../../data/equipment';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { relics } from '../../data/relics';
import type { CombatState, Side } from '../../engine/state';
import {
  activePartnerTypes,
  isLockedIn,
  effectiveManaCost,
  effectiveTypes,
  hasStatus,
  hasAffordableMoveInFight,
  resolveManaCost,
  resolveTargetMode,
  getEffectiveStat,
  getMaxHp,
} from '../../engine/state';
import type { HealCaster } from '../../engine/heal/healPipeline';
import { resolveRound } from '../../engine/combat/resolveRound';
import { applyForcedReplacement } from '../../engine/combat/switching';
import { selectableTargets, statusGatedTargets } from '../../engine/combat/statusEngine';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import type { Action } from '../../engine/combat/actions';
import type { CombatEvent } from '../../engine/events';
import type { MoveDefinition, StatKey, TargetMode } from '../../engine/content';
import { resolveTypeMult, TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { resolveElementalForceBonus } from '../../engine/damage/damagePipeline';
import type { RunState, RosterEntry } from '../../run/state';
import type { Squad } from '../../run/squad';
import type { EquipmentDefinition } from '../../run/equipment';
import { buildCombatState } from '../../run/buildCombatState';
import { relicTeamStatModifiers } from '../../run/relics';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicTeamStatusGrants } from '../../run/statusGrants';
import { CombatantCard, type Popup } from './CombatantCard';
import { HeroDetailOverlay } from './HeroDetailOverlay';
import { SwitchInPanel } from './SwitchInPanel';
import { FieldEffectDetailOverlay } from './FieldEffectDetailOverlay';
import { MoveDetailOverlay } from './MoveDetailOverlay';
import { formatEvents, type LogLine } from './formatEvent';
import { applyEventToState } from './applyEventToState';
import { buildBeats, type Beat } from './buildBeats';
import { playBeatSfx } from '../../audio/beatSfx';
import { getTypeColor, getTypeColorRgb } from './typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { MoveKindBadge, TARGET_MODE_LABELS, healReadout, moveEffectSummary, riderTargetLabel, useLongPress } from '../shared/MoveTile';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { AudioSettings } from '../shared/AudioSettings';
import { ManaCost } from '../shared/ManaCost';
import { HeroPortrait } from '../shared/HeroPortrait';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipmentEffectList, EquipmentIcon, EQUIP_SLOT_LABELS, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { HeroPreviewOverlay } from '../run/HeroPreviewOverlay';

function fmtGrant(amount: number): string {
  return amount > 0 ? `+${amount}` : `${amount}`;
}


/** One enemy's live matchup for a move row, precomputed by FightScreen so MoveRow needs no combat state of its own. */
interface MoveMatchup {
  id: string;
  name: string;
  mult: number;
}

interface MoveRowProps {
  move: MoveDefinition;
  /** Enough mana to actually press it. Unaffordable rows stay pressable at the DOM level (see below) and simply refuse to act. */
  affordable: boolean;
  /**
   * The move's status targeting gate is unmet right now — nothing on the
   * field is carrying what `requiresTargetStatus` demands (content.ts), so
   * there is nobody to aim it at. Same dead-but-inspectable treatment as an
   * unaffordable row, and for the same reason: the move a player most needs
   * explained is the one they cannot press yet. Kept a separate flag from
   * `affordable` because the mana gem must not grey out over it — the player
   * can pay for this one perfectly well.
   */
  gateUnmet: boolean;
  /** What it costs THIS hero right now (state.ts effectiveManaCost) — not `move.manaCost`, which is only the first cast's price on a move that ramps. Resolved by the caller, which is the one with the Combatant. */
  cost: number;
  selected: boolean;
  /** Elemental Force's contribution to this move's BasePower right now (damagePipeline.ts), already resolved by the caller. */
  forceBonus: number;
  /**
   * HP this hero has taken since its last turn (state.ts
   * damageTakenSinceLastTurn) — the number a retributionPercent move deals a
   * share of. Resolved by the caller for the same reason forceBonus is: it is
   * a fact about the caster, not about the move.
   */
  banked: number;
  /**
   * The total stat reduction currently standing on the active enemies — the
   * number a `doublesStatReductions` move (Mind's Brain Flay) would ADD if
   * pressed right now, which since it doubles is the same figure again.
   *
   * The exact reason `banked` exists, for the exact same failure: Brain Flay
   * carries no Base Power and no authored number, so without this the row
   * shows an 80-mana move with nothing on it, and pressing it on a clean board
   * spends the mana for literally nothing. Resolved by the caller off the live
   * board, same as `banked` and `cost`.
   */
  bankedReductions: number;
  /**
   * What a `selfHpCost` move would actually take off THIS hero's bar if
   * pressed right now (content.ts selfHpCost — Spirit's Soul Offering and
   * Last Rites), already resolved against its live max HP and current HP. 0
   * for every move that charges no HP.
   *
   * The same reasoning as `banked`: the authored figure is a fraction or a
   * floor, and what the player is deciding is whether to pay the number it
   * comes to on this hero, this turn. Resolved by the caller because it needs
   * the Combatant and the HeroDefinition, neither of which this row has.
   */
  selfHpCost: number;
  /**
   * Whether the half of a conditionalPower the player can already answer
   * WITHOUT declaring a target is met — the caster's own status (content.ts
   * conditionalPower.requiresUserStatus — Nature's Seed Shot and Branch Slam)
   * or the active field effect (requiresFieldEffect — Light's Smite). `true`
   * for every move that asks nothing but the target, which is the one question
   * the row genuinely cannot answer yet.
   *
   * Resolved by the caller for the same reason `banked` is: it is a fact about
   * the board, not about the move. Deliberately NOT folded into `gateUnmet` —
   * these conditions make the move weaker, never unpressable, and greying the
   * row out over a bonus the player is choosing to skip would be a lie about a
   * legal action.
   */
  userConditionMet: boolean;
  /**
   * Whether the caster's ACTIVE PARTNER satisfies a `conditionalStatDeltas`
   * row's type (content.ts — Beast's Prowl, "doubled if partner is a
   * Beast"). `false` for every move that authors none.
   *
   * Its own flag rather than a second reading of `userConditionMet`, which
   * answers for `conditionalPower` only: a move can author one, the other,
   * or both, and folding them would make Pack Hunt and Prowl share a chip
   * state they do not share a mechanic with. Resolved by the caller, same
   * as `banked` and `cost`, because it needs the board and the roster.
   */
  packBonusActive: boolean;
  /**
   * What this move will ACTUALLY target if pressed right now (engine/state.ts
   * resolveTargetMode) — which since Arcane's Overload is not always
   * `move.target` (content.ts conditionalTarget, "spread if Magical Surge is
   * active").
   *
   * Resolved by the caller off the live board, same as `cost` and `banked`.
   * The row uses it only to say whether the swap is ON; the player still
   * declares against the authored mode, so nothing about the target panel
   * changes.
   */
  liveTargetMode: MoveDefinition['target'];
  /** The commanding hero's live heal inputs (healPipeline.ts), resolved by the caller for the same reason forceBonus is — a heal's number is a fact about the caster, not about the move. */
  caster: HealCaster;
  matchups: readonly MoveMatchup[];
  multClass: (mult: number) => string;
  formatMult: (mult: number) => string;
  onSelect: () => void;
  onInspect: () => void;
}

/**
 * One facet of the console's move surface.
 *
 * Lifted out of FightScreen's `.map()` because `useLongPress` is a hook and
 * cannot be called inside a loop. That hook replaces the hand-rolled timer
 * this button used to carry — which is what
 * gives the row its hold charge (`data-holding`), cancels the gesture when the
 * pointer is really scrolling the list, and ticks the haptic.
 *
 * **Unaffordable rows are no longer `disabled`.** A `disabled` button receives
 * no pointer events at all, so the one move a player most wants explained —
 * the expensive one they cannot press yet — was the only move in the game that
 * could not be inspected. It now carries `.is-unaffordable` + `aria-disabled`
 * instead: identical dead-and-dimmed treatment (styles.css moved the same
 * rules off `:disabled`), still refuses to act on a tap, and still opens its
 * dossier on a hold.
 */
function MoveRow({ move, affordable, gateUnmet, cost, selected, forceBonus, banked, bankedReductions, selfHpCost, userConditionMet, packBonusActive, liveTargetMode, caster, matchups, multClass, formatMult, onSelect, onInspect }: MoveRowProps) {
  // Two independent ways a row can be dead, one shared treatment. `.is-unusable`
  // carries the dim; `.is-unaffordable` is kept as the narrower flag so the mana
  // gem only goes grey when mana is actually the problem (styles.css).
  const usable = affordable && !gateUnmet;
  const longPress = useLongPress(onInspect, () => {
    if (usable) onSelect();
  });
  const heal = healReadout(move, caster);

  return (
    <button
      className={`move-button${selected ? ' selected' : ''}${usable ? '' : ' is-unusable'}${affordable ? '' : ' is-unaffordable'}`}
      /* Type is carried by the button's own material now (a tinted wash +
         tinted rim, styles.css) instead of a 3px stripe glued to the left
         edge, so the whole control is type-coded rather than wearing a tag. */
      style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
      aria-disabled={!usable}
      {...longPress}
    >
      {/* One line, not two: at full row width the meta that used to need its
          own .move-row-mid fits beside the name, which frees the second line
          for what the button was missing entirely — the effect. */}
      <div className="move-row-top">
        <ManaCost cost={cost} />
        {/* Was a filled TypeBadge chip. One move button used to hold three
            sub-boxes (mana crystal, type chip, kind chip) inside an
            already-boxed control — the nesting problem
            docs/visual-language.md names one level down. The abbreviation
            still carries the exact type (color alone can't separate 15 of
            them), it just does it as colored text rather than as a third
            competing rectangle.

            It sits *before* the name rather than after it because the name is
            the row's flex:1 — anything downstream of it gets shoved to the
            right edge, and the right edge had grown to three unrelated
            readouts (type, power, category). Splitting it gives each side one
            question: the left is what this move IS (what it costs, what it
            draws on, what it's called), the right is what it DOES (how hard
            it hits, and how). */}
        {/* Glyph only, no abbreviation. The three letters existed because
            colour alone cannot separate 15 types — a real problem, and not
            one the letters were the only answer to. The glyph separates
            fifteen on its own, and dropping the text is what lets the type
            sit inside the left cluster without pushing the name's ellipsis
            in. The exact name is still one hold away (the move dossier), and
            on the tooltip for anyone on a pointer. */}
        <span className="move-type-code" title={move.type}>
          <ElementGlyph type={move.type} />
        </span>
        <span className="move-name">{move.name}</span>
        {move.kind === 'damage' && move.basePower != null && (
          <span
            className={`move-power${forceBonus > 0 ? ' move-boosted' : ''}`}
            title={forceBonus > 0 ? `Elemental Force: +${forceBonus} Base Power` : undefined}
          >
            <strong>{move.basePower + forceBonus}</strong>BP
            {forceBonus > 0 && <span className="move-boosted-arrow">▲</span>}
          </span>
        )}
        {/* No "HEAL" suffix beside the number, unlike the damage row's "BP".
            Base Power needs its unit spelled out because 60 alone could be
            anything; a heal amount is HP, the number is already in --hp-high
            green, and the badge at the row's far end is now the HP heart
            itself — three things saying "health" made the word the fourth.

            The number is THIS hero's heal, run through the formula
            (healReadout) rather than the move's authored HealPower — same
            reason the BP readout beside it folds in Elemental Force. */}
        {heal && (
          <span className="move-power move-heal">
            <strong>{heal.value}</strong>
          </span>
        )}
        {/* Holds the power slot open on a move that has no number to put in
            it (a buff). Without it the type code lands at one x on rows
            carrying a BP/HEAL readout and a different one on rows that don't,
            and a 3-4 row list rags visibly between the two. */}
        {move.kind === 'buff' && <span className="move-power move-power-empty" aria-hidden="true" />}
        <MoveKindBadge move={move} />
      </div>
      {/* The decision, on the face of the control instead of behind a 500ms
          hold on it. For an attack that is the live matchup against each enemy
          still standing — the most consequential fact in a doubles game, and
          one the player was re-deriving by holding every move, every turn. For
          everything else it is what the move actually grants or inflicts
          (moveEffectSummary). Always rendered, so a row's height never depends
          on its contents. */}
      <div className="move-row-effect">
        {move.kind === 'damage' ? (
          <span className="move-eff-row">
            {matchups.map(({ id, name, mult }) => (
              <span key={id} className={`move-eff-chip ${multClass(mult)}`}>
                <span className="move-eff-name">{name}</span>
                <span className="move-eff-mult">{formatMult(mult)}</span>
              </span>
            ))}
            {/* Three things a damage move's rider can be, and the bare
                "+Burn" this used to print was only honest about one of them:
                a chanced rider leads with its odds (Ember is a 10% Burn, not
                a Burn), and a self-targeted one says so (Volcanic Surge burns
                the caster, and reading it as "the target catches fire" is the
                exact wrong call). */}
            {/* One chip PER rider (content.ts statusApplication is a list
                since Beast's Toxic Fangs): a button showing only the first
                would price a move at half its payload, on the row where the
                decision is actually made. */}
            {statusApplicationsOf(move).map((app) => (
              <span key={app.statusId} className="move-eff-status">
                {app.chance != null ? `${Math.round(app.chance * 100)}% ` : '+'}
                {app.statusId}
                {/* Where it lands, whenever that is not simply what the move
                    hit — 'self' was the only such case until riders learned to
                    roll their own target (content.ts StatusApplication.target). */}
                {riderTargetLabel(app) ? ` (${riderTargetLabel(app)})` : ''}
              </span>
            ))}
            {/* A damage move's stat rider, which this row used to drop
                entirely: on Fire's Molten Lash the missing -10 DEF was merely
                incomplete beside its visible +Burn, but Water's Undertow has
                no status at all, so its whole payload was invisible and the
                row read as a plain 35 BP poke. The non-damage branch below has
                always printed these via moveEffectSummary. */}
            {move.statDeltas?.map(({ stat, amount }, i) => (
              <span key={stat} className="move-eff-status">
                {/* A chanced delta leads with its odds, for the same reason the
                    status chip above does: Psi Bolt is a 20% -20 Wisdom, not a
                    -20 Wisdom (content.ts statDeltaChance). Printed once, on
                    the first chip, because one roll gates the whole list. */}
                {move.statDeltaChance != null && i === 0 ? `${Math.round(move.statDeltaChance * 100)}% ` : ''}
                {amount >= 0 ? '+' : ''}
                {amount} {STAT_LABELS[stat]}
              </span>
            ))}
            {/* A conditional-power move's whole decision is whether the
                condition is met, so the rule belongs on the button. The live
                per-defender number it produces is in the dossier's forecast,
                which already runs the multiplier against each enemy. */}
            {move.conditionalPower && (
              <span
                className={`move-eff-status${
                  (move.conditionalPower.requiresUserStatus ||
                    move.conditionalPower.requiresFieldEffect ||
                    move.conditionalPower.requiresPartnerType ||
                    move.conditionalPower.requiresUserHpBelow != null) &&
                  !userConditionMet
                    ? ' move-eff-unmet'
                    : ''
                }`}
              >
                {/* The user-side form (content.ts requiresUserStatus) asks
                    about a hero the player is already looking at, and the
                    field form (requiresFieldEffect) about ground both sides
                    can see — so unlike the target-side one these chips can
                    answer themselves, and dim when the answer is no. "vs"
                    would be the wrong preposition twice over: wrong side of
                    the field, and wrong verb. */}
                ×{move.conditionalPower.multiplier}{' '}
                {/* The pack form answers itself off the slot beside this
                    hero, so like the user-side and field chips it dims
                    when the answer is no — and it says "partner" because
                    the thing being read is a hero, not a board state
                    (content.ts requiresPartnerType). */}
                {move.conditionalPower.requiresPartnerType
                  ? `with a ${move.conditionalPower.requiresPartnerType} partner`
                  : move.conditionalPower.requiresFieldEffect
                  ? `under ${fieldEffects[move.conditionalPower.requiresFieldEffect]?.name ?? move.conditionalPower.requiresFieldEffect}`
                  : move.conditionalPower.requiresUserHpBelow != null
                    ? // "while you are" rather than the execute's bare "under":
                      // the two chips would otherwise be the same six
                      // characters for opposite instructions, on rows a
                      // Spirit hero can hold at the same time.
                      `while you are under ${Math.round(move.conditionalPower.requiresUserHpBelow * 100)}% HP`
                    : move.conditionalPower.requiresTargetHpBelow != null
                      ? `under ${Math.round(move.conditionalPower.requiresTargetHpBelow * 100)}% HP`
                      : move.conditionalPower.requiresUserStatus
                        ? `with ${move.conditionalPower.requiresUserStatus}`
                        : `vs ${move.conditionalPower.requiresTargetStatus}`}
                {move.conditionalPower.consumesStatus && !move.conditionalPower.requiresFieldEffect ? ' (spent)' : ''}
              </span>
            )}
            {/* The detonation, on the button, because it is the difference
                between Miasma being a 50 BP poke and being a quarter of the
                target's max HP — and the size of that stack is something only
                the player has been tracking (content.ts detonatesStatus). */}
            {move.detonatesStatus && <span className="move-eff-status">Detonates {move.detonatesStatus}</span>}
            {/* The gate, and whether it is met, on the face of the button. A row
                that just said "Freeze only" while the whole enemy side is
                unmarked would read as a move the player forgot how to press;
                the unmet form names what is missing instead. */}
            {move.requiresTargetStatus && (
              <span className={`move-eff-status${gateUnmet ? ' move-eff-unmet' : ''}`}>
                {gateUnmet ? `Needs ${move.requiresTargetStatus}` : `${move.requiresTargetStatus} only`}
              </span>
            )}
            {/* A drain move's whole reason to be pressed over a bigger one is
                the HP it comes back with, so it says so beside the matchups
                rather than only in the dossier. A percentage, not a number:
                what it returns is a share of a hit that has not been rolled
                yet (content.ts drainPercent). */}
            {move.drainPercent != null && <span className="move-eff-status">Drain {Math.round(move.drainPercent * 100)}%</span>}
            {/* Which stat drives the hit. On the button because it is the
                difference between a 60-power move being weak and being this
                hero's best attack, and the matchup row beside it would
                otherwise be read against the wrong stat entirely
                (content.ts offStatOverride). */}
            {move.offStatOverride != null && (
              <span className="move-eff-status">Uses {STAT_LABELS[move.offStatOverride]}</span>
            )}
            {/* A retribution move has no Base Power, so without this chip the
                row shows a damage move with no damage on it. The LIVE banked
                figure rather than the authored percentage, because what the
                player is deciding is whether it is worth pressing RIGHT NOW
                (content.ts retributionPercent). */}
            {move.retributionPercent != null && (
              <span className={`move-eff-status${banked > 0 ? '' : ' move-eff-unmet'}`}>
                {Math.round(banked * move.retributionPercent)} dmg banked
              </span>
            )}
            {/* Recoil, as a share, for the same reason Drain is: the hit it
                bills against has not been rolled yet. */}
            {move.recoilPercent != null && <span className="move-eff-status">Recoil {Math.round(move.recoilPercent * 100)}%</span>}
            {/* The self-cost belongs on the button more than any other rider
                here, because it is the only one that is a PRICE: the mana gem
                on the left tells half the story of what Last Rites costs, and
                a player who reads only that is pressing a 100-mana move
                without seeing the rest of the bill (content.ts selfHpCost).
                The LIVE figure for the percentage mode, on the same reasoning
                as the retribution chip — what is being decided is whether it
                is worth paying RIGHT NOW. */}
            {move.selfHpCost != null && <span className="move-eff-status">-{selfHpCost} HP</span>}
            {/* The ramp, priced forward: the gem on the left already says what
                THIS cast costs, so the chip says what the next one will. */}
            {move.manaDiscountOnUse != null && (
              <span className="move-eff-status">Next {Math.max(0, cost - move.manaDiscountOnUse)} MP</span>
            )}
            {/* A bracket that depends on the board belongs on the button, not
                in the dossier: in a declare-then-resolve game "does this go
                first" is the decision. `cost` beside it is already the live
                price, so the chip states the CONDITION and lets the gem carry
                the current answer — the same split the ramp chip uses. */}
            {move.conditionalPriority && (
              <span className="move-eff-status">
                {move.conditionalPriority.bonus >= 0 ? '+' : ''}
                {move.conditionalPriority.bonus} priority vs {move.conditionalPriority.requiresTargetStatus}
              </span>
            )}
            {/* The count is the whole difference between the two sides
                (content.ts): Overcharge needs BOTH enemies marked, Metallic
                Blade needs one. `2×`/`1×` in front of the status name is the
                shortest thing that says which — the gem beside it already
                carries the live price. */}
            {move.conditionalManaCost && (
              <span className="move-eff-status">
                {/* The ally side (Pack Leader) is not a count of marked
                    enemies at all — it reads the slot beside this hero,
                    so it drops the 2×/1× vocabulary and names the
                    partner (content.ts requiresPartnerType). */}
                {move.conditionalManaCost.requiresPartnerType ? (
                  <>
                    {move.conditionalManaCost.manaCost} MP with a {move.conditionalManaCost.requiresPartnerType} partner
                  </>
                ) : (
                  <>
                    {move.conditionalManaCost.manaCost} MP vs{' '}
                    {move.conditionalManaCost.requiresAllEnemiesStatus
                      ? `2× ${move.conditionalManaCost.requiresAllEnemiesStatus}`
                      : `1× ${move.conditionalManaCost.requiresAnyEnemyStatus}`}
                  </>
                )}
              </span>
            )}
            {/* WHO it hits, when that depends on the board (content.ts
                conditionalTarget). It answers itself and dims when the answer
                is no, exactly like the user-side and field conditionalPower
                chips — and it has to, because the matchup chips beside it
                already list every enemy and would otherwise imply a spread the
                move is not currently going to do. */}
            {move.conditionalTarget && (
              <span className={`move-eff-status${liveTargetMode === move.conditionalTarget.target ? '' : ' move-eff-unmet'}`}>
                {TARGET_MODE_LABELS[move.conditionalTarget.target]} under{' '}
                {fieldEffects[move.conditionalTarget.requiresFieldEffect]?.name ?? move.conditionalTarget.requiresFieldEffect}
              </span>
            )}
          </span>
        ) : (
          <span className="move-eff-row">
            <span className="move-effect-text">{moveEffectSummary(move, caster)}</span>
            {/* What it is worth RIGHT NOW, not what it does — the retribution
                chip's problem exactly (content.ts doublesStatReductions).
                Brain Flay has no Base Power and no authored number, so on a
                clean board it is 80 mana for nothing, and the only thing that
                changes that is a stat line the player has to be reading off
                two enemy cards. Dims when there is nothing banked. */}
            {move.doublesStatReductions && (
              <span className={`move-eff-status${bankedReductions > 0 ? '' : ' move-eff-unmet'}`}>
                −{bankedReductions} more
              </span>
            )}
            {/* Soul Offering is the only selfHpCost move that is not a damage
                move, so without this the summary states the RULE ("25% of max
                HP") on the one row where the number matters most — it is the
                whole price of a move whose mana cost is only 30. Live figure,
                same reasoning as the chip above (content.ts selfHpCost). */}
            {move.selfHpCost != null && <span className="move-eff-status">-{selfHpCost} HP</span>}
            {/* Prowl is +10/+10 or +20/+20 depending on who is standing next
                to this hero. The summary beside it already states the RULE —
                it has to, since it is printed on the draft and level-up
                screens where there is no partner to read — so this chip
                ANSWERS instead of restating, the same split the gate chip
                above uses ("Needs Freeze" / "Freeze only") rather than
                printing the condition twice on one row (content.ts
                conditionalStatDeltas). */}
            {move.conditionalStatDeltas && (
              <span className={`move-eff-status${packBonusActive ? '' : ' move-eff-unmet'}`}>
                {packBonusActive
                  ? `×${move.conditionalStatDeltas.multiplier} now`
                  : `Needs a ${move.conditionalStatDeltas.requiresPartnerType} partner`}
              </span>
            )}
          </span>
        )}
      </div>
    </button>
  );
}

const PLAYER_SIDE: Side = 'A';
const AI_SIDE: Side = 'B';

/**
 * Ambient embers drifting up through the console — the same golden-angle
 * sequence the title screen's useEmbers and the draft's useMotes use (a pure
 * function of index, so the scatter is stable across re-renders with no seed to
 * store) and the same `title-ember-rise` keyframe.
 *
 * Nine rather than the draft's sixteen: this field is a third of the height and
 * sits behind text the player reads under time pressure, not behind a figure
 * they are admiring. They take `--console-rgb`, so the air below the horizon
 * carries the domain of whoever is currently commanding.
 */
const CONSOLE_EMBERS = Array.from({ length: 9 }, (_, i) => {
  const seed = i * 137.51;
  return {
    left: seed % 100,
    delay: (seed * 1.3) % 8,
    duration: 6.5 + ((seed * 0.29) % 4),
    size: 2 + ((seed * 0.17) % 2),
  };
});
const config = { typeChart, heroes: allCombatants, moves, statuses, passives, fieldEffects, benchHpRegenFlat: 5 };

// Hold-to-auto-play tuning (FightScreen's advance-overlay) — how long a
// press must be held before it commits to auto-play instead of a normal
// single-beat tap, and the pause between each auto-advanced beat once
// engaged. Both are easy to retune from playtesting.
const AUTO_ADVANCE_HOLD_MS = 350;
const AUTO_ADVANCE_STEP_MS = 450;

function rosterIdOf(combatantId: string): string {
  return combatantId.slice(combatantId.indexOf(':') + 1);
}

function entryFor(roster: readonly RosterEntry[], combatantId: string): RosterEntry {
  const entry = roster.find((r) => r.rosterId === rosterIdOf(combatantId));
  if (!entry) throw new Error(`No roster entry for ${combatantId}`);
  return entry;
}

function aliveActiveIdsOn(state: CombatState, side: Side): string[] {
  return state.active[side].filter((id): id is string => id !== null && !state.combatants[id].fainted);
}

function sideDefeated(state: CombatState, side: Side): boolean {
  const combatants = Object.values(state.combatants).filter((c) => c.side === side);
  return combatants.length > 0 && combatants.every((c) => c.fainted);
}

interface PendingAction {
  kind: 'move' | 'switch' | 'rest';
  moveId?: string;
  declaredTarget?: string | null;
  benchedCombatantId?: string;
  /**
   * Who comes in when a switchesUserOut move sends its caster out — the pivot
   * half of a Tailwind declaration (engine/combat/actions.ts MoveAction). Kept
   * separate from `benchedCombatantId`, which belongs to a switch ACTION: the
   * two carry the same kind of value but a move and a switch are not
   * interchangeable to the engine, and merging them would let one be read as
   * the other.
   */
  switchToCombatantId?: string | null;
}

/**
 * The command crest — what replaced "Select Aegis' Move:" / "Select a Target:".
 *
 * A doubles turn is two decisions taken in sequence, and the console said
 * nothing about that: not which of the two you were on, and not what you had
 * already locked in for the other. It said the acting hero's name, in words,
 * beside a hero the arena was already lighting — a form label for a fact
 * something else was carrying better.
 *
 * So it becomes the two heroes themselves, in the same socket idiom the draft
 * uses for the pact (docs/visual-language.md third pass) and the Field Effect
 * plaque uses for its duration: a fixed-denominator track whose full shape is
 * learned once and then read at a glance. One socket per active hero at 24px —
 * the one clean downscale of a 48px source. The one in command is lit in its
 * own domain color, the same light the whole console is filled with; a
 * committed one wears the mana crystal of the move it is holding.
 *
 * The SAME object renders for move selection and for targeting, with only the
 * acting slot's label changing (the commander's name, then the move being
 * aimed). That is the persistent console shell open item 3 asked for, at the
 * one level that actually matters to the player: the header does not restyle
 * itself halfway through a decision.
 *
 * The two sockets are pushed to the crest's two ends and mirrored (user
 * direction, 2026-08-26): the hero standing on the LEFT of the battlefield
 * reports from the left edge with its label to its right, the hero on the
 * RIGHT reports from the right edge with its label to its left. So the crest
 * is a map of the arena rather than a list — you read a hero's state at the
 * end of the bar its card is on, and the two decisions of a doubles turn stop
 * competing for the same strip of text.
 */
function ConsoleCrest({
  state,
  activeSlots,
  actingId,
  combatants,
  pending,
  isComplete,
  label,
  labelRgb,
}: {
  /**
   * The whole fight, not just `combatants`, purely so the committed-move gem
   * below can be priced the way the engine prices it: Overcharge's cost is a
   * fact about the ENEMY side's statuses (state.ts resolveManaCost), which no
   * amount of the caster's own record can answer. The crest reporting 60 while
   * the engine charges 0 is exactly the drift every other cost readout in this
   * file is routed through one function to avoid.
   */
  state: CombatState;
  /**
   * The player's two active SLOTS in battlefield order (index 0 = the left
   * card, 1 = the right), nulls included — the crest mirrors the arena's
   * geometry, so it reads positions rather than a compacted alive-list. A
   * hero standing on the right of the field reports from the right of the
   * crest.
   */
  activeSlots: readonly (string | null)[];
  actingId: string | null;
  combatants: CombatState['combatants'];
  pending: Record<string, PendingAction>;
  isComplete: (p: PendingAction | undefined) => boolean;
  label: string;
  /** Overrides the console's own hue — targeting colors the label by the MOVE being aimed, not by its caster. */
  labelRgb?: string;
}) {
  function renderSlot(slot: 0 | 1) {
    const cid = activeSlots[slot] ?? null;
    const sideClass = slot === 0 ? 'left' : 'right';
    // A slot can be empty late in a locked-in fight (downed, no bench left to
    // replace it). It still holds its end of the crest, so the surviving
    // hero stays on the side of the bar it stands on.
    if (!cid || combatants[cid].fainted) return <span key={slot} className={`console-slot ${sideClass}`} />;
    const c = combatants[cid];
    const cHero = allCombatants[c.heroId];
    const committed = isComplete(pending[cid]) ? pending[cid] : undefined;
    const committedMove = committed?.kind === 'move' ? moves[committed.moveId!] : undefined;
    const acting = cid === actingId;
    /* The hero in command carries the console's own label (its name, or the
       move it is aiming). The other one reports what it is already holding,
       in that move's type color — so the bar reads "deciding X / holding Y"
       across its two ends instead of one name beside a silent portrait. */
    const slotLabel = acting
      ? label
      : committedMove
        ? committedMove.name
        : committed
          ? committed.kind === 'rest'
            ? 'Rest'
            : 'Switching out'
          : cHero.name;
    const slotRgb = acting ? labelRgb : committedMove ? getTypeColorRgb(committedMove.type) : undefined;
    return (
      <span key={slot} className={`console-slot ${sideClass}`}>
        <span
          className={`console-socket${acting ? ' acting' : ''}${committed ? ' committed' : ''}`}
          style={{ '--socket-rgb': getTypeColorRgb(effectiveTypes(cHero, c)[0]) } as CSSProperties}
          title={
            committedMove
              ? `${cHero.name} — ${committedMove.name}`
              : committed
                ? `${cHero.name} — ${committed.kind === 'rest' ? 'Rest' : 'Switching out'}`
                : cHero.name
          }
        >
          <HeroPortrait heroId={cHero.id} className="console-socket-portrait" />
          {committed && !committedMove && (
            <span className="console-socket-mark" aria-hidden="true">
              {committed.kind === 'rest' ? '\u25CC' : '\u21C4'}
            </span>
          )}
        </span>
        {/* Identity, not instruction — and set in the horizon's own register
            (9px/800/0.14em uppercase) rather than body copy, which is the
            register audit the second pass asked for. */}
        <span
          className={`console-commander${acting ? ' acting' : ''}${!acting && !committed ? ' waiting' : ''}`}
          style={slotRgb ? ({ '--console-rgb': slotRgb } as CSSProperties) : undefined}
        >
          {/* The cost rides with the MOVE NAME rather than the portrait. It
              used to be pinned to the socket's corner, which only worked on
              paper: .mana-gem's own `position: relative` is declared later in
              the sheet than that pin, so the gem never left the flow — a 16px
              gem and a 24px portrait then fought over a 30px socket, which
              knocked the sprite off-centre and pushed the gem out toward the
              label. Beside the name it is also the truer statement: the cost
              is a fact about the move being reported, not about the hero. */}
          {committedMove && <ManaCost cost={resolveManaCost(state, c.combatantId, committedMove, allCombatants)} size="sm" />}
          <span className="console-commander-text">{slotLabel}</span>
        </span>
      </span>
    );
  }

  return (
    <div className="console-crest">
      {renderSlot(0)}
      {/* Spans the gap between the two ends, so the crest still has a
          baseline to sit on now that the label no longer runs into a
          trailing rule of its own. */}
      <span className="console-rule" aria-hidden="true" />
      {renderSlot(1)}
    </div>
  );
}

interface Props {
  playerRun: RunState;
  playerSquad: Squad;
  /** This node's generated encounter (src/run/enemyGen.ts) — a fresh AI roster/squad per fight/elite/boss node, not a fixed opponent. */
  aiRun: RunState;
  aiSquad: Squad;
  /**
   * The player's owned relics (RunState.relics) — the raw id list rather
   * than precomputed grants, so this screen derives the stat/passive/status
   * broadcasts once (below) AND can hand the same ids to the hero sheets it
   * opens (HeroPreviewOverlay), which must show the same relic-inclusive
   * numbers the fight itself uses. Omitted by relic-less callers (Quick
   * Battle).
   */
  playerRelicIds?: readonly string[];
  /** This node's gold reward on a win (docs/run-loop.md), precomputed by the caller — displayed only, the caller grants it in onResolved. */
  goldReward: number;
  /** This node's Training Point reward on a win, precomputed by the caller (App.tsx handleSquadConfirmed) — displayed only, the caller grants it in onResolved. */
  trainingPointsReward: number;
  /**
   * The guaranteed common-item drop from the run's opener Goblin fight, if
   * this node is one (App.tsx handleSquadConfirmed) — rolled up front so the
   * victory screen can spotlight the exact item that's coming. Null for
   * every other node. Displayed only; the caller hands this same item off to
   * ForceEquipScreen in onResolved.
   */
  equipmentReward: EquipmentDefinition | null;
  /** Fired when the player dismisses the result overlay — the caller owns what a win/loss means for run progress (vitals sync, currency grant, advancing the map, or ending the run). */
  onResolved: (outcome: 'win' | 'loss', finalState: CombatState) => void;
  /**
   * Abandon the run from the bottom bar's Options menu and go back to the
   * title. Omit it for fights that aren't part of a run (Quick Battle, the
   * sandbox) — the menu then simply has nothing to quit and shows only
   * Resume. There is no save file, so this discards the run outright; the
   * menu arms the choice with a second tap before calling this.
   */
  onQuitToTitle?: () => void;
  /**
   * Non-destructive way out for fights that aren't part of a run (Quick
   * Battle): there is no run to abandon, so this is a plain one-tap exit
   * with no arm/confirm, and it takes the quit entry's place in the menu.
   * A caller passes one or the other, never both.
   */
  onExitToTitle?: () => void;
}

export function FightScreen({
  playerRun,
  playerSquad,
  aiRun,
  aiSquad,
  playerRelicIds = [],
  goldReward,
  trainingPointsReward,
  equipmentReward,
  onResolved,
  onQuitToTitle,
  onExitToTitle,
}: Props) {
  /** The three team-wide broadcasts every owned relic contributes (src/run/relics.ts, passives.ts, statusGrants.ts) — derived here rather than by each caller so "what a relic does" has one wiring site. */
  const teamStatModifiers = relicTeamStatModifiers(playerRelicIds, relics);
  const teamPassiveGrants = relicTeamPassiveGrants(playerRelicIds, relics);
  const teamStatusGrants = relicTeamStatusGrants(playerRelicIds, relics);

  function buildInitialState(seed: number): CombatState {
    return buildCombatState(
      seed,
      allCombatants,
      equipment,
      [
        { side: PLAYER_SIDE, squad: playerSquad, roster: playerRun.roster, teamStatModifiers, teamPassiveGrants, teamStatusGrants },
        { side: AI_SIDE, squad: aiSquad, roster: aiRun.roster },
      ],
      passives
    );
  }

  const [combat, setCombat] = useState<CombatState>(() => buildInitialState(Math.floor(Math.random() * 2 ** 31)));
  const [log, setLog] = useState<LogLine[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  /** The bottom bar's Options menu (quit run / resume). */
  const [menuOpen, setMenuOpen] = useState(false);
  /** Quitting is armed by a first tap and only fires on the second — see the menu's markup below. Reset every time the menu opens so it never comes back pre-armed. */
  const [confirmingQuit, setConfirmingQuit] = useState(false);
  /** Bench hero tapped (but not yet confirmed) in the forced-replacement panel below — a fainted active slot requires a deliberate select-then-confirm instead of a single tap, since this choice can't be undone once committed. Reset after each confirm so the panel starts fresh for the next open slot (a double KO opens two in sequence). */
  const [replacementPick, setReplacementPick] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, PendingAction>>({});
  const [selecting, setSelecting] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  /**
   * Second stage of declaring a move that sends its user out (content.ts
   * switchesUserOut — Storm's Tailwind): the ally target is already chosen and
   * held here while the player picks who comes IN. Distinct from `switchOpen`,
   * which is the plain switch ACTION — this one commits a move, not a switch,
   * and reuses SwitchInPanel only because the choice it presents is identical.
   */
  const [pivoting, setPivoting] = useState<{ combatantId: string; move: MoveDefinition; declaredTarget: string | null } | null>(null);
  const [actionStep, setActionStep] = useState(0);
  const [inspecting, setInspecting] = useState<string | null>(null);
  /** Whether the active Field Effect's full detail card (FieldEffectDetailOverlay) is open — opened via a long-press on the battlefield-divider badge. */
  const [inspectingFieldEffect, setInspectingFieldEffect] = useState(false);
  // Sequenced, tap-advanced round playback (docs/architecture.md "engine /
  // presentation separation"): `resolving` gates player input and the
  // victory overlay while a round's already-decided event stream is being
  // revealed one beat at a time; `banner` narrates the current beat;
  // `popups` are the floating numbers keyed per combatant card. The queue,
  // the in-progress display state, and the round's authoritative end state
  // live in refs rather than state — they're only ever read/written from
  // inside handleAdvance's click handler, never rendered directly.
  const [resolving, setResolving] = useState(false);
  /**
   * The beat on screen right now, whole — the sentence plus the presentational
   * split buildBeats authored for it (lead / headline / tag / meta).
   *
   * There used to be a second piece of state beside this one, a running trail
   * of every beat already revealed this round, filling the console under the
   * current beat. It's gone (2026-08-27, user direction): a round is many taps
   * and re-reading them mid-fight is a want the vast majority of players never
   * have, so the trail was spending the console's best real estate on history
   * while the beat that's actually happening sat at 14px. The full log is
   * still one tap away in the Menu, which is where a deliberate look-back
   * belongs. What the space buys instead is size — see .combat-banner-focus.
   */
  const [beat, setBeat] = useState<Beat | null>(null);
  /**
   * Monotonic counter of beats revealed this round. Only a React key: the
   * headline replays its arrival animation by remounting, and consecutive
   * beats can carry identical text (two ticks of the same DoT for the same
   * amount), so keying on the content itself would silently skip the pop.
   */
  const [beatSeq, setBeatSeq] = useState(0);
  const [popups, setPopups] = useState<Record<string, Popup>>({});
  /** The move dossier (MoveDetailOverlay), opened by holding a move row. Carries the holder as well as the move, since every number on that card — the damage band, the mana left, STAB — is relative to whichever hero is commanding. Distinct from `selecting`, which is mid-target-selection state, not an info request. */
  const [movePopup, setMovePopup] = useState<{ combatantId: string; move: MoveDefinition } | null>(null);
  const popupSeq = useRef(0);
  const beatQueue = useRef<Beat[]>([]);
  const displayState = useRef<CombatState | null>(null);
  const finalState = useRef<CombatState | null>(null);
  /** Hold-to-auto-play on the advance-overlay (below): `holdTimer` is the
   *  pending "has this press been held long enough to engage auto-play"
   *  check, `autoPlayInterval` is the running auto-advance loop once
   *  engaged, and `autoEngaged` records that engagement happened so the
   *  trailing click (pointerup always fires one) gets swallowed instead of
   *  advancing an extra beat on top of what auto-play already revealed. */
  const holdTimer = useRef<number | null>(null);
  const autoPlayInterval = useRef<number | null>(null);
  const autoEngaged = useRef(false);

  useEffect(() => {
    return () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current);
      if (autoPlayInterval.current !== null) clearInterval(autoPlayInterval.current);
    };
  }, []);

  const playerActiveAlive = aliveActiveIdsOn(combat, PLAYER_SIDE);
  const enemyActiveAlive = aliveActiveIdsOn(combat, AI_SIDE);
  const playerBench = combat.bench[PLAYER_SIDE];
  const enemyBench = combat.bench[AI_SIDE];
  const playerLockedIn = isLockedIn(combat, PLAYER_SIDE);

  const winner: Side | null = sideDefeated(combat, PLAYER_SIDE) ? AI_SIDE : sideDefeated(combat, AI_SIDE) ? PLAYER_SIDE : null;

  /**
   * The battlefield-divider Field Effect plaque opens its full detail card
   * (FieldEffectDetailOverlay) — the plaque itself only has room for the name
   * and a rounds-remaining pip track, not for what the effect actually does.
   * Bound to BOTH gestures: hold (the convention shared with status badges and
   * move buttons) *and* a plain tap. A Field Effect is standing rules that
   * change how every move in the round resolves, so "what does this do" has to
   * be one obvious tap away rather than gated behind a gesture the player has
   * to already know is available.
   */
  const inspectFieldEffect = combat.activeFieldEffect ? () => setInspectingFieldEffect(true) : undefined;
  const fieldEffectPress = useLongPress(inspectFieldEffect, inspectFieldEffect);

  // A player active slot fainted and needs a bench replacement chosen before the next round can be declared (docs/combat.md "KO handling": forced replacement is not optional, but WHICH bench hero fills it is the player's choice).
  const openReplacementSlots = ([0, 1] as const).filter((slot) => combat.active[PLAYER_SIDE][slot] === null && playerBench.length > 0);

  const canAct = !resolving && openReplacementSlots.length === 0 && playerActiveAlive.length > 0;
  const stepIndex = canAct ? Math.min(actionStep, playerActiveAlive.length - 1) : 0;
  // The player combatant whose move panel is currently on screen — glowed on the battlefield (CombatantCard's `acting` prop) instead of a "X's move" text label, so that vertical space goes back to the action panel.
  const actingId: string | null = canAct ? playerActiveAlive[stepIndex] : null;

  /** Whether the target-selection panel (below) is what's currently on screen for the acting hero — drives both that panel's render and the bottom-bar Back button's behavior (exit targeting back to the move grid, rather than stepping to the previous hero). */
  const showingTargetPanel = selecting !== null && selecting.combatantId === actingId;

  /**
   * The hue the whole lower half of the screen is lit in.
   *
   * This is the console's link to the arena. The player's two heroes take
   * turns commanding it, and while one is, the console is lit in *that hero's
   * domain color* — the same type color their platform, their card rim and
   * their move rows already carry. So the console reads as belonging to the
   * figure standing above it rather than as a control panel the fight happens
   * to be displayed on, and "whose turn is it" stops being carried solely by a
   * pulse on a 96px sprite.
   *
   * docs/visual-language.md lists "accent color at region boundaries" as a
   * non-goal — but that entry is about *separating* two regions with hue, and
   * this does the opposite. It is also the one thing on screen that changes
   * exactly as often as it should: twice a turn, at the moment command passes,
   * where the draft's rejected version would have re-tinted on every rail tap.
   *
   * Gold while a round resolves: nobody is commanding, the round is, and gold
   * is what the beat banner and every other "the game is speaking" surface
   * already uses.
   */
  const consoleRgb = (() => {
    if (resolving || actingId === null) return '224, 166, 60';
    const c = combat.combatants[actingId];
    return getTypeColorRgb(effectiveTypes(allCombatants[c.heroId], c)[0]);
  })();
  /**
   * ...and from WHERE they stand. The two player heroes occupy the left and
   * right halves of the ally row, so the console's light source slides to sit
   * under whichever one currently holds it.
   *
   * This is the cheapest honest answer to "these are two separate zones": a
   * light has a position, and putting the console's at the foot of the figure
   * that owns it makes the arena floor and the console one continuous lit
   * surface rather than a picture with a control panel under it. It is also
   * read-at-a-glance information — which side of the field you are commanding
   * from — delivered without a word of UI.
   *
   * Centre while a round resolves: the round belongs to nobody.
   */
  const consoleOrigin = (() => {
    if (resolving || actingId === null) return '50%';
    const slot = playerActiveAlive.indexOf(actingId);
    return slot <= 0 ? '27%' : '73%';
  })();
  const consoleStyle = { '--console-rgb': consoleRgb, '--console-origin': consoleOrigin } as CSSProperties;

  /**
   * Who this move may actually be aimed at, by the engine's own rules rather
   * than by a view-side copy of them (statusEngine.ts), so declaration-time
   * and resolve-time can't drift apart.
   *
   * Gate first, Stealth second, matching resolveRound's order: the status gate
   * is absolute (a Frozen-only move simply has no other legal target, and an
   * empty result is the correct answer), while Stealth is a soft hide that
   * falls back to the unfiltered list rather than presenting nothing.
   */
  function visibleTargets(move: MoveDefinition, ids: string[]): string[] {
    // `statuses` is what lets selectableTargets narrow the picker down to a
    // Provoked enemy (statusEngine.ts) — without it the player could aim at the
    // partner and watch the move silently move onto the taunt instead.
    return selectableTargets(combat, move.target, move.kind, statusGatedTargets(combat, move, ids), statuses);
  }

  /**
   * Whether a status-gated move (content.ts requiresTargetStatus) has anyone to
   * hit at all right now. Drives the dead row in the move grid, so the player
   * is refused at the button rather than dropped into an empty target panel.
   */
  function hasLegalTarget(move: MoveDefinition, casterId: string): boolean {
    if (!move.requiresTargetStatus) return true;
    const pool =
      move.target === 'singleAlly' || move.target === 'bothAllies'
        ? playerActiveAlive
        : move.target === 'self'
          ? [casterId]
          : move.target === 'allOthers'
            ? [...enemyActiveAlive, ...playerActiveAlive].filter((cid) => cid !== casterId)
            : enemyActiveAlive;
    return statusGatedTargets(combat, move, pool).length > 0;
  }

  const targetableIds: string[] = !selecting
    ? []
    : selecting.move.target === 'singleEnemy'
      ? visibleTargets(selecting.move, enemyActiveAlive)
      : selecting.move.target === 'singleAlly'
        ? visibleTargets(selecting.move, playerActiveAlive)
        : selecting.move.target === 'self'
          ? [selecting.combatantId]
          : selecting.move.target === 'bothEnemies' || selecting.move.target === 'randomEnemy'
            ? visibleTargets(selecting.move, enemyActiveAlive)
            : selecting.move.target === 'bothAllies' || selecting.move.target === 'randomAlly'
              ? visibleTargets(selecting.move, playerActiveAlive)
              : selecting.move.target === 'allOthers'
                ? visibleTargets(
                    selecting.move,
                    [...enemyActiveAlive, ...playerActiveAlive].filter((cid) => cid !== selecting.combatantId)
                  )
                : [];

  function isPendingComplete(p: PendingAction | undefined): boolean {
    if (!p) return false;
    if (p.kind === 'switch') return !!p.benchedCombatantId;
    if (p.kind === 'rest') return true;
    const move = moves[p.moveId!];
    if ((move.target === 'singleEnemy' || move.target === 'singleAlly') && !p.declaredTarget) return false;
    return true;
  }

  /**
   * Whether a switchesUserOut move has anyone to actually pivot to. Both halves
   * matter: an empty bench and a locked-in side (2+ KOs, the LOCKED rule) each
   * mean the switch would be refused at resolution. The move stays pressable
   * either way — it degrades to its buff, exactly as the engine resolves it —
   * so this only decides whether to ask the player for a second choice.
   */
  function canPivot(): boolean {
    return playerBench.length > 0 && !isLockedIn(combat, PLAYER_SIDE);
  }

  /**
   * Commits `combatantId`'s action and, Pokemon-style, advances to the next
   * player active hero once this one's choice is complete — or auto-resolves
   * the round if this was the last hero to declare. Takes the resolved
   * pending map directly (rather than reading the `pending` state) so the
   * just-committed action is visible immediately, without waiting a render
   * cycle for setState to land.
   */
  function commitAction(combatantId: string, action: PendingAction) {
    const nextPending = { ...pending, [combatantId]: action };
    setPending(nextPending);
    setSelecting(null);

    if (!isPendingComplete(action)) return;

    const idx = playerActiveAlive.indexOf(combatantId);
    if (idx !== -1 && idx < playerActiveAlive.length - 1) {
      setActionStep(idx + 1);
      return;
    }

    if (openReplacementSlots.length === 0 && playerActiveAlive.every((id) => isPendingComplete(nextPending[id]))) {
      resolveRoundWith(nextPending);
    }
  }

  /**
   * Always a two-tap commit, regardless of target shape: this tap only ever
   * loads the move into `selecting` and lights up its target(s) on the
   * battlefield (targetableIds above) — even a 'self' move highlights just
   * the caster's own card, and a singleEnemy/singleAlly move with only one
   * legal candidate still highlights that lone card rather than
   * auto-resolving. A second, deliberate tap on the highlighted card(s)
   * (handleTargetClick) is what actually commits the action. This makes
   * move selection uniformly deliberate — no move can be locked in by a
   * single accidental tap, no matter how "obvious" the target is.
   */
  function handleMoveClick(combatantId: string, move: MoveDefinition) {
    setSelecting({ combatantId, move });
  }

  function handleTargetClick(targetId: string) {
    if (!selecting) return;
    // A pivot move is a two-stage declaration: the ally is chosen, then the
    // hero who replaces the caster. Held rather than committed so the player
    // can still back out of the whole move at the switch panel.
    if (selecting.move.switchesUserOut && canPivot()) {
      setPivoting({ combatantId: selecting.combatantId, move: selecting.move, declaredTarget: targetId });
      setSelecting(null);
      return;
    }
    commitAction(selecting.combatantId, { kind: 'move', moveId: selecting.move.id, declaredTarget: targetId });
  }

  /** Fixed-group moves (bothEnemies/bothAllies/allOthers) have no target to choose — resolveTargets ignores declaredTarget for these — so the bottom targeting panel's Confirm button just commits the move as-is. */
  function handleConfirmSpread() {
    if (!selecting) return;
    if (selecting.move.switchesUserOut && canPivot()) {
      setPivoting({ combatantId: selecting.combatantId, move: selecting.move, declaredTarget: null });
      setSelecting(null);
      return;
    }
    commitAction(selecting.combatantId, { kind: 'move', moveId: selecting.move.id, declaredTarget: null });
  }

  /**
   * Modes with nothing to pick between, so the target row doubles as a confirm
   * button. The two random modes belong here for a different reason than the
   * fixed groups do: their cards show who COULD be hit rather than who will be
   * (engine/combat/targeting.ts rolls one at resolution), and offering a picker
   * for a choice the engine makes would be a lie.
   */
  function isSpreadTarget(mode: TargetMode): boolean {
    return mode === 'bothEnemies' || mode === 'bothAllies' || mode === 'allOthers' || mode === 'randomAlly' || mode === 'randomEnemy';
  }

  /** Lowercased for mid-sentence aria-label use ("Confirm — hits both enemies") — same canonical wording as TARGET_MODE_LABELS, just not title-cased. */
  function spreadTargetLabel(mode: TargetMode): string {
    return TARGET_MODE_LABELS[mode]?.toLowerCase() ?? 'target';
  }

  function handleSwitchClick(combatantId: string, benchedCombatantId: string) {
    commitAction(combatantId, { kind: 'switch', benchedCombatantId });
  }

  function handleRestClick(combatantId: string) {
    commitAction(combatantId, { kind: 'rest' });
  }

  function handleForcedReplacement(slot: 0 | 1, benchedCombatantId: string) {
    const result = applyForcedReplacement(combat, combat.round, PLAYER_SIDE, slot, benchedCombatantId, statuses);
    setCombat(result.state);
    appendLog(formatEvents(result.events, allCombatants, result.state.combatants, moves));
    setReplacementPick(null);
  }

  /**
   * formatEvents keys lines by round+index within its OWN call, which
   * collides across separate calls in the same round (e.g. two forced
   * replacements after a double KO both format a single-element array at
   * index 0). Re-key against the log's running length so every append is
   * unique regardless of how many separate calls contributed to it.
   */
  function appendLog(newLines: LogLine[]) {
    setLog((prev) => [...prev, ...newLines.map((l, i) => ({ ...l, key: `${prev.length + i}-${l.key}` }))]);
  }

  /**
   * Picks randomly among the AI's currently-affordable moves rather than
   * always its first listed move — with a wider fixture movepool per hero
   * (src/data/heroes.ts) a deterministic first-pick would never exercise the
   * variety, and a fight that always plays out the same way isn't useful for
   * testing more complex battles.
   */
  function pickAiAction(state: CombatState, combatantId: string): Action {
    const combatant = state.combatants[combatantId];
    const hero = allCombatants[combatant.heroId];
    const entry = entryFor(aiRun.roster, combatantId);
    const moveIds = entry.unlockedMoveIds.length > 0 ? entry.unlockedMoveIds : hero.moveIds;
    // `allCombatants` threaded in for the same reason the filter below takes
    // it: a Pack Leader that is currently half-price is affordable, and an AI
    // that priced it at 100 would Rest while holding a move it can cast
    // (state.ts resolveManaCost).
    if (!hasAffordableMoveInFight(state, combatantId, moveIds, moves, allCombatants)) {
      // Same fallback as the player's move grid below: nothing is affordable,
      // so Rest rather than declaring a move that would just no-op in the
      // engine (resolveRound.ts's mana guard) and silently waste the turn.
      return { kind: 'rest', combatantId };
    }
    const affordable = moveIds.filter((id) => combatant.currentMana >= resolveManaCost(state, combatantId, moves[id], allCombatants));
    // A status-gated move (content.ts requiresTargetStatus) with nothing marked
    // to aim at resolves into an ActionBlocked and silently wastes the AI's whole
    // turn — the same failure the affordability filter above exists to avoid.
    // Falls back to the unfiltered list rather than to Rest if nothing survives,
    // so the AI never stops acting over a filter.
    const gateTargets = aliveActiveIdsOn(state, PLAYER_SIDE);
    const legal = affordable.filter(
      (id) => !moves[id].requiresTargetStatus || statusGatedTargets(state, moves[id], gateTargets).length > 0
    );
    const pickable = legal.length > 0 ? legal : affordable;
    const moveId = pickable[Math.floor(Math.random() * pickable.length)];
    const move = moves[moveId];
    const declaredTarget =
      move.target === 'singleEnemy' ? (aliveActiveIdsOn(state, PLAYER_SIDE)[0] ?? null) : move.target === 'singleAlly' ? combatantId : null;
    // A switchesUserOut move with no declared replacement resolves into its
    // buff and an ActionBlocked — the same silently-wasted half the gate and
    // affordability filters above exist to avoid. First benched hero standing:
    // this AI does not evaluate matchups anywhere else either.
    const switchToCombatantId = move.switchesUserOut
      ? (state.bench[AI_SIDE].find((bid) => !state.combatants[bid]?.fainted) ?? null)
      : null;
    return { kind: 'move', combatantId, moveId, declaredTarget, switchToCombatantId };
  }

  /** Type-effectiveness multiplier of `move` against whichever hero currently occupies `defenderId` — presentation-only read of the engine's own type resolution (docs/architecture.md "Resolution and presentation are separate layers"). */
  function effectivenessAgainst(move: MoveDefinition, defenderId: string): number {
    const defender = combat.combatants[defenderId];
    const defenderHero = allCombatants[defender.heroId];
    return resolveTypeMult(typeChart, move.type, effectiveTypes(defenderHero, defender));
  }

  function formatMult(mult: number): string {
    return `${Math.round(mult * 100) / 100}×`;
  }

  /**
   * Word readout for the targeting panel (CombatantCard's `effBadge`) —
   * spells out the matchup instead of making the player do 2×/0.5× math
   * mid-tap. Neutral (1×) intentionally has no label; callers should omit
   * the badge entirely rather than render this for mult === 1.
   */
  function effLabel(mult: number): string {
    if (mult >= 4) return 'Super Bonus!';
    if (mult > 1) return 'Bonus!';
    if (mult <= TYPE_MULT_FLOOR) return 'Super Resist!';
    return 'Resist!';
  }

  /**
   * Dual-type stacking (CLAUDE.md "TypeMult stacks multiplicatively") means a
   * defender weak to a move on both its types takes 4× rather than the 2× a
   * single-type matchup caps out at, and the reverse for a double-resist —
   * floored at TYPE_MULT_FLOOR (0.25) rather than going lower still. Two extra
   * tiers on top of the plain super/resist split so those matchups read as
   * distinctly bigger deals, not just "a bit more of the same color."
   */
  function multClass(mult: number): string {
    if (mult >= 4) return 'eff-quad-super';
    if (mult > 1) return 'eff-super';
    if (mult === 1) return 'eff-neutral';
    if (mult <= TYPE_MULT_FLOOR) return 'eff-quad-resist';
    return 'eff-resist';
  }

  function resolveRoundWith(pendingMap: Record<string, PendingAction>) {
    const playerActions: Action[] = playerActiveAlive.map((id) => {
      const p = pendingMap[id];
      if (p.kind === 'switch') return { kind: 'switch', combatantId: id, benchedCombatantId: p.benchedCombatantId! };
      if (p.kind === 'rest') return { kind: 'rest', combatantId: id };
      return {
        kind: 'move',
        combatantId: id,
        moveId: p.moveId!,
        declaredTarget: p.declaredTarget,
        switchToCombatantId: p.switchToCombatantId,
      };
    });
    const aiActions: Action[] = enemyActiveAlive.map((id) => pickAiAction(combat, id));

    const result = resolveRound(combat, [...playerActions, ...aiActions], config);
    let nextState = result.state;
    const events = [...result.events];

    // The AI auto-replaces fainted active slots from its own bench right away (docs/combat.md: forced replacement "still happens" regardless of lock-in; scripts/demo-fight.ts does the same as a post-round step).
    for (const slot of [0, 1] as const) {
      if (nextState.active[AI_SIDE][slot] === null && nextState.bench[AI_SIDE].length > 0) {
        const inId = nextState.bench[AI_SIDE][0];
        const r = applyForcedReplacement(nextState, nextState.round, AI_SIDE, slot, inId, statuses);
        nextState = r.state;
        events.push(...r.events);
      }
    }

    startBeatPlayback(combat, events, nextState);
  }

  /**
   * Loads an already-resolved round's event stream, grouped into beats
   * (buildBeats.ts), and reveals the first one. The rest wait in `beatQueue`
   * for handleAdvance taps — this is the seam that turns the engine's
   * instant, synchronous result into something a player reads at their own
   * pace instead of a scripted timer (docs/architecture.md "engine /
   * presentation separation"). `finalState` is applied verbatim once the
   * queue empties, so playback can never drift from the authoritative result
   * regardless of how the beats replayed it.
   */
  function startBeatPlayback(startState: CombatState, events: CombatEvent[], nextFinalState: CombatState) {
    const beats = buildBeats(events, allCombatants, moves, startState.combatants, PLAYER_SIDE);
    displayState.current = startState;
    finalState.current = nextFinalState;
    beatQueue.current = beats;
    setResolving(true);
    handleAdvance();
  }

  /**
   * Reveals the next queued beat, or — once the queue is empty — finalizes
   * the round (snaps to the authoritative end state and hands control back
   * to the player). Bound to a tap on the banner/battlefield while
   * `resolving` is true, so the player reads each beat at their own pace
   * rather than a fixed timer. Returns whether a beat was actually shown
   * (false once it finalized), so the auto-play loop below knows when to
   * stop ticking instead of continuing to fire against an already-finished
   * round.
   */
  function handleAdvance(): boolean {
    const revealed = beatQueue.current.shift();

    if (!revealed) {
      setCombat(finalState.current!);
      setPopups({});
      setBeat(null);
      setResolving(false);
      setPending({});
      setSelecting(null);
      setMovePopup(null);
      setSwitchOpen(false);
      setActionStep(0);
      return false;
    }

    let next = displayState.current!;
    for (const event of revealed.events) next = applyEventToState(next, event);
    displayState.current = next;

    setCombat(next);
    appendLog(formatEvents(revealed.events, allCombatants, next.combatants, moves));
    // Audio subscribes to the same beat the visuals do, at the same moment —
    // one call, no timing knowledge anywhere near the engine (audio/beatSfx.ts).
    playBeatSfx(revealed);
    setBeat(revealed);
    setBeatSeq((n) => n + 1);
    setPopups(Object.fromEntries(revealed.popups.map((p) => [p.combatantId, { key: popupSeq.current++, text: p.text, className: p.className }])));
    return true;
  }

  /** Stops any pending hold-to-engage check and any running auto-play loop — bound to pointerup/pointerleave/pointercancel on the advance-overlay so releasing the press (or the pointer sliding off-screen) always halts it. */
  function stopAutoAdvance() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (autoPlayInterval.current !== null) {
      clearInterval(autoPlayInterval.current);
      autoPlayInterval.current = null;
    }
  }

  /** Fires once the press has been held past AUTO_ADVANCE_HOLD_MS: reveals the beat that was waiting under the player's thumb immediately, then keeps revealing one every AUTO_ADVANCE_STEP_MS until released or the round runs out of beats. */
  function engageAutoPlay() {
    holdTimer.current = null;
    autoEngaged.current = true;
    if (!handleAdvance()) return;
    autoPlayInterval.current = window.setInterval(() => {
      if (!handleAdvance()) stopAutoAdvance();
    }, AUTO_ADVANCE_STEP_MS);
  }

  function handleAdvancePointerDown() {
    // Reset rather than only clearing on the trailing click: a press that
    // ends via pointercancel (gesture interrupted by the OS, e.g. a
    // notification swipe) skips the click event entirely, which would
    // otherwise leave a stale `true` here and swallow the next press's tap.
    autoEngaged.current = false;
    holdTimer.current = window.setTimeout(engageAutoPlay, AUTO_ADVANCE_HOLD_MS);
  }

  /** A press that never made it to the hold threshold is a normal tap — advance one beat as before. A press that did engage auto-play already revealed its beats via the interval, so swallow the trailing click instead of double-advancing. */
  function handleAdvanceClick() {
    if (autoEngaged.current) {
      autoEngaged.current = false;
      return;
    }
    handleAdvance();
  }

  function renderActiveSlot(side: Side, slot: 0 | 1) {
    const id = combat.active[side][slot];
    if (id) {
      const hero = allCombatants[combat.combatants[id].heroId];
      return (
        <CombatantCard
          key={id}
          hero={hero}
          combatant={combat.combatants[id]}
          targetable={targetableIds.includes(id)}
          acting={id === actingId}
          onSelectTarget={() => handleTargetClick(id)}
          onInspect={() => setInspecting(id)}
          popup={popups[id]}
          activeFieldEffect={combat.activeFieldEffect}
        />
      );
    }
    const bench = combat.bench[side];
    if (side === PLAYER_SIDE && bench.length > 0 && !resolving) {
      return (
        <div className="combatant-card empty-slot" key={`empty-${side}-${slot}`}>
          <span className="fainted-tag">KO</span>
          <div className="combatant-name">Choose replacement below</div>
        </div>
      );
    }
    return (
      <div className="combatant-card empty-slot" key={`empty-${side}-${slot}`}>
        —
      </div>
    );
  }

  return (
    <>
      {/* Full-screen click-catcher while a round is playing out — lets the
          player tap anywhere to advance instead of hunting for the banner
          specifically. Sits below the battle-log overlay's z-index so an
          open log panel takes taps for itself (close it) rather than also
          advancing the beat underneath it. */}
      {resolving && (
        <div
          className="advance-overlay"
          onClick={handleAdvanceClick}
          onPointerDown={handleAdvancePointerDown}
          onPointerUp={stopAutoAdvance}
          onPointerLeave={stopAutoAdvance}
          onPointerCancel={stopAutoAdvance}
        />
      )}

      <div
        className={`battlefield${combat.activeFieldEffect ? ' field-effect-active' : ''}`}
        style={
          combat.activeFieldEffect
            ? ({ '--field-effect-rgb': getTypeColorRgb(fieldEffects[combat.activeFieldEffect.fieldEffectId]?.flavorType ?? 'Arcane') } as CSSProperties)
            : undefined
        }
      >
        <div className="team-row enemy">
          {renderActiveSlot(AI_SIDE, 0)}
          {renderActiveSlot(AI_SIDE, 1)}
        </div>

        <div className="battlefield-divider">
          <span className="battlefield-vs">VS</span>
          {combat.activeFieldEffect && (
            /* The plaque sits centred ON the horizon, and "VS" fades out
               behind it (styles.css .field-effect-active .battlefield-vs).
               "VS" is decorative and means "nothing special is happening
               here"; a Field Effect is the single most important standing
               fact about the battlefield, so it takes the centre rather than
               being pinned into a corner beside a mark it was overlapping.
               Keyed by effect id so switching effects remounts the element
               and replays the arrival animation — an override has to read as
               a *new* field, not as a name quietly swapping in place. */
            <span
              key={combat.activeFieldEffect.fieldEffectId}
              className="field-effect-badge"
              title={`${fieldEffects[combat.activeFieldEffect.fieldEffectId]?.description ?? ''} — tap for details`}
              {...fieldEffectPress}
            >
              {/* No glyph here, deliberately — it lives on
                  FieldEffectDetailOverlay instead. This plaque is the one
                  surface in the status family that already spells its subject
                  out in words, and it is also the most size-constrained thing
                  on the screen: it has to sit inside a 13px horizon band
                  without touching either team row. Measured, a 16px icon cost
                  23px of width (190px total, 51% of the screen) and dropped
                  the clearance to each row from 6.4px to 2.2px — paying half
                  the horizon for identity the adjacent word already carries. */}
              <span className="field-effect-name">
                {fieldEffects[combat.activeFieldEffect.fieldEffectId]?.name ?? combat.activeFieldEffect.fieldEffectId}
              </span>
              {/* Duration is a flat 5 rounds for every effect
                  (FIELD_EFFECT_DURATION_ROUNDS, a locked invariant), so a
                  fixed 5-pip track reads as a clock the player can learn.
                  The old "· 4" was a bare number with no unit — indistinguishable
                  from a stack count, a tier, or a power value. */}
              <span className="field-effect-pips" aria-label={`${combat.activeFieldEffect.roundsRemaining} rounds remaining`}>
                {Array.from({ length: FIELD_EFFECT_DURATION_ROUNDS }, (_, i) => (
                  <span
                    key={i}
                    className={`field-effect-pip${i < combat.activeFieldEffect!.roundsRemaining ? '' : ' spent'}`}
                  />
                ))}
              </span>
            </span>
          )}
        </div>
        {inspectingFieldEffect && combat.activeFieldEffect && (
          <FieldEffectDetailOverlay active={combat.activeFieldEffect} onClose={() => setInspectingFieldEffect(false)} />
        )}

        <div className="team-row ally">
          {renderActiveSlot(PLAYER_SIDE, 0)}
          {renderActiveSlot(PLAYER_SIDE, 1)}
        </div>
      </div>

      <div className="action-area" style={consoleStyle}>
        <div className="console-embers" aria-hidden="true">
          {CONSOLE_EMBERS.map((e, i) => (
            <span
              key={i}
              className="console-ember"
              style={{
                left: `${e.left}%`,
                width: `${e.size}px`,
                height: `${e.size}px`,
                animationDelay: `${e.delay}s`,
                animationDuration: `${e.duration}s`,
              }}
            />
          ))}
        </div>
        {/* Narrates the current beat of a playing-out round
            (docs/architecture.md "engine / presentation separation") — who
            acted, what landed, who went down. Lives here, in the space the
            move-selection panel vacates while resolving, rather than as a
            fixed-height reservation above the battlefield that would sit
            empty (and push everything else down) the rest of the time. */}
        {resolving && beat && (
          /* The beat's color lives on the OUTER element, not on the line it
             tints: the console's light pool reads off it too, so a Fire move
             floods the near ground orange and a Frost move cyan. It also has
             to sit on something that survives the beat change — the inner
             element remounts every beat (see the key below), and a background
             that remounts can't cross-fade. */
          <div
            className={`combat-banner${beat.bannerFocusKind ? ` banner-kind-${beat.bannerFocusKind}` : ''}`}
            style={beat.bannerAccent ? ({ '--banner-accent': beat.bannerAccent } as CSSProperties) : undefined}
          >
            {/* One beat, given the whole console. Keyed on beatSeq so every
                reveal remounts and replays its arrival — the pop is the beat
                landing, and it has to fire per beat, not once per round.

                buildBeats hands over an optional lead/headline/tag split
                (BeatFlavor); a beat that supplies none of it puts its plain
                sentence in the headline slot, so nothing here depends on the
                split existing. */}
            <div className="combat-banner-current" key={beatSeq}>
              {beat.bannerLead && <span className="combat-banner-lead">{beat.bannerLead}</span>}
              {/* No authored headline means this beat is a whole sentence, not
                  a subject and a payload — set it a size down, because display
                  type is for two or three words and a sentence at 26px just
                  fills the console with wrapping. */}
              <span className={`combat-banner-focus${beat.bannerFocus ? '' : ' banner-focus-sentence'}`}>{beat.bannerFocus ?? beat.banner}</span>
              {beat.bannerSub && <span className="combat-banner-sub">{beat.bannerSub}</span>}
              {beat.bannerTag && <span className="combat-banner-tag">{beat.bannerTag}</span>}
              {beat.bannerMeta && (
                <span className={`combat-banner-meta${beat.bannerMetaClass ? ` ${beat.bannerMetaClass}` : ''}`}>{beat.bannerMeta}</span>
              )}
            </div>
            <span className="combat-banner-hint">tap ▸ or hold to auto-play ⏵⏵</span>
          </div>
        )}
        {/* A player active slot fainted — voluntary switching/move selection
            is on hold (canAct is false, see openReplacementSlots above)
            until a bench replacement is chosen for it. Deliberately a
            select-then-Confirm flow rather than a single tap: this
            replacement can't be undone once committed, unlike the
            already-two-tap move-then-target flow above. A double KO opens
            this panel again for the second slot once the first is filled —
            openReplacementSlots recomputes off `combat`, which just changed. */}
        {!resolving &&
          openReplacementSlots.length > 0 &&
          (() => {
            const slot = openReplacementSlots[0];
            return (
              <div className="action-panel target-panel">
                <div className="target-panel-header">
                  <span className="target-panel-title">
                    Choose a Replacement{openReplacementSlots.length > 1 ? ' (1 of 2)' : ''}:
                  </span>
                </div>
                <div className="bench-row">
                  {playerBench.map((benchId) => {
                    const benchCombatant = combat.combatants[benchId];
                    const benchHero = allCombatants[benchCombatant.heroId];
                    return (
                      <CombatantCard
                        key={benchId}
                        hero={benchHero}
                        combatant={benchCombatant}
                        targetable
                        selected={replacementPick === benchId}
                        onSelectTarget={() => setReplacementPick(benchId)}
                        onInspect={() => setInspecting(benchId)}
                        popup={popups[benchId]}
                        activeFieldEffect={combat.activeFieldEffect}
                      />
                    );
                  })}
                </div>
                <button
                  className="resolve-button replacement-confirm-button"
                  disabled={!replacementPick}
                  onClick={() => replacementPick && handleForcedReplacement(slot, replacementPick)}
                >
                  Confirm
                </button>
              </div>
            );
          })()}
        {!resolving &&
          openReplacementSlots.length === 0 &&
          playerActiveAlive.length > 0 &&
          (() => {
            const id = actingId!;
            const entry = entryFor(playerRun.roster, id);
            const hero = allCombatants[combat.combatants[id].heroId];
            const combatant = combat.combatants[id];

            // Move chosen, target not yet declared: swap the move grid for a
            // bottom-anchored targeting panel instead of relying on the
            // battlefield cards up top — on mobile that's a long thumb
            // reach from the move buttons down here. The gold `.targetable`
            // glow on the battlefield cards (targetableIds, above) still
            // applies in parallel, so either tap path works. Fixed-group
            // moves (bothEnemies/bothAllies/allOthers) have nothing to pick
            // between, so their cards are shown for information only and a
            // single Confirm button commits; single-target moves render
            // each legal target as its own tappable card, which collapses
            // to one card — a de facto confirm button — whenever only one
            // target is legal (self-target moves, or a singleAlly/singleEnemy
            // move with only one candidate left standing).
            if (selecting && selecting.combatantId === id) {
              const { move } = selecting;
              const spread = isSpreadTarget(move.target);
              return (
                <div className="action-panel target-panel" key={`${id}-targeting`}>
                  {/* Same crest, one step later. "Select a Target:" in glowing
                      12px body copy beside a filled type chip was a second
                      header design for the same console, two taps apart — and
                      the instruction it carried is already the loudest thing on
                      screen, since every legal target has grown a pulsing gold
                      frame (docs/visual-language.md: "targetability becomes the
                      frame"). What the player cannot see from the frames is
                      WHICH move they are aiming, so that is what the crest's
                      trailing label becomes, in the move's own type color. */}
                  <ConsoleCrest
                    state={combat}
                    activeSlots={combat.active[PLAYER_SIDE]}
                    actingId={actingId}
                    combatants={combat.combatants}
                    pending={pending}
                    isComplete={isPendingComplete}
                    label={move.name}
                    labelRgb={getTypeColorRgb(move.type)}
                  />
                  {/* A spread move has nothing to pick between, so the whole
                      row of targets doubles as the confirm control — one
                      outlined group instead of a separate confirm button
                      eating its own vertical slice below the cards. A 3-target
                      spread (allOthers) additionally drops each card's name
                      text (kept: type badges, eff badge, HP/MP) since three
                      full-width cards' dual-type badges alone can outgrow the
                      panel and force horizontal scroll. */}
                  <div
                    className={`target-row${spread ? ' target-row-spread' : ''}${spread && targetableIds.length >= 3 ? ' target-row-compact' : ''}`}
                    onClick={spread ? handleConfirmSpread : undefined}
                    role={spread ? 'button' : undefined}
                    aria-label={spread ? `Confirm — hits ${spreadTargetLabel(move.target)}` : undefined}
                  >
                    {targetableIds.map((tid) => {
                      const tHero = allCombatants[combat.combatants[tid].heroId];
                      const tCombatant = combat.combatants[tid];
                      const mult = effectivenessAgainst(move, tid);
                      return (
                        <CombatantCard
                          key={tid}
                          hero={tHero}
                          combatant={tCombatant}
                          targetable={!spread}
                          onSelectTarget={spread ? undefined : () => handleTargetClick(tid)}
                          popup={popups[tid]}
                          effBadge={mult === 1 ? null : { text: effLabel(mult), className: multClass(mult) }}
                          /* `compact` (portrait + name + type only) was right
                             when this panel was 98.7px tall with 157.9px of bare
                             console under it: HP/MP/statuses are on the
                             battlefield cards above, and repeating them bloated
                             a box that had no room. The console-fill pass
                             inverted that — the cards are 248.6px now, and the
                             choice being made is *which of these two to hit*,
                             for which how much HP one has left and what it is
                             already suffering are the two facts that decide it.
                             Redundancy costs nothing against empty space. */
                        />
                      );
                    })}
                  </div>
                </div>
              );
            }

            // Softlock fallback (CLAUDE.md "Mana & tempo"): none of this
            // hero's unlocked moves are currently affordable. Rest replaces
            // the (all-disabled) move grid entirely — Switch stays available
            // below as normal whenever a bench hero exists, so a player who
            // dumped mana into a big hit can still choose to swap in someone
            // fresh instead of resting this active hero.
            const canAffordAnyMove = hasAffordableMoveInFight(combat, id, entry.unlockedMoveIds, moves, allCombatants);
            return (
              <div className="action-panel" key={id}>
                <ConsoleCrest
                  state={combat}
                  activeSlots={combat.active[PLAYER_SIDE]}
                  actingId={actingId}
                  combatants={combat.combatants}
                  pending={pending}
                  isComplete={isPendingComplete}
                  label={hero.name}
                />
                {!canAffordAnyMove && (
                  <div className="move-list" key={`${id}-moves`}>
                    <button
                      className={`move-button rest-button${pending[id]?.kind === 'rest' ? ' selected' : ''}`}
                      onClick={() => handleRestClick(id)}
                    >
                      <div className="move-row-top">
                        <span className="move-name">Rest</span>
                      </div>
                      <div className="move-row-effect">
                        <span className="move-effect-text">Out of Mana — recovers to full, but skips the turn</span>
                      </div>
                    </button>
                  </div>
                )}
                {canAffordAnyMove && (
                <div className="move-list">
                  {entry.unlockedMoveIds.map((moveId) => {
                    const move = moves[moveId];
                    const isSelected =
                      (pending[id]?.kind === 'move' && pending[id]?.moveId === moveId) ||
                      (selecting?.combatantId === id && selecting.move.id === moveId);
                    return (
                      <MoveRow
                        key={moveId}
                        move={move}
                        affordable={combatant.currentMana >= resolveManaCost(combat, id, move, allCombatants)}
                        gateUnmet={!hasLegalTarget(move, id)}
                        cost={resolveManaCost(combat, id, move, allCombatants)}
                        selected={isSelected}
                        forceBonus={resolveElementalForceBonus(combatant, move.type, statuses)}
                        banked={combatant.damageTakenSinceLastTurn}
                        bankedReductions={enemyActiveAlive.reduce(
                          (sum, eid) =>
                            sum +
                            Object.values(combat.combatants[eid].statModifiers).reduce(
                              (acc, v) => acc + (typeof v === 'number' && v < 0 ? -v : 0),
                              0
                            ),
                          0
                        )}
                        selfHpCost={
                          move.selfHpCost == null
                            ? 0
                            : move.selfHpCost.mode === 'percentMaxHp'
                              ? Math.round(getMaxHp(allCombatants[combatant.heroId], combatant) * move.selfHpCost.amount)
                              : Math.max(0, combatant.currentHp - move.selfHpCost.amount)
                        }
                        userConditionMet={
                          move.conditionalPower?.requiresPartnerType
                            ? // The fourth thing answerable without declaring
                              // a target, and the only one that is a fact
                              // about the player's own TEAM rather than about
                              // the board (content.ts requiresPartnerType).
                              (activePartnerTypes(combat, id, allCombatants) ?? []).includes(
                                move.conditionalPower.requiresPartnerType
                              )
                            : move.conditionalPower?.requiresFieldEffect
                            ? combat.activeFieldEffect?.fieldEffectId === move.conditionalPower.requiresFieldEffect
                            : move.conditionalPower?.requiresUserHpBelow != null
                              ? // The third thing the player can answer without
                                // declaring a target, and the most volatile:
                                // Spite's chip lights up the moment this hero
                                // drops under half, which is the whole read
                                // (content.ts requiresUserHpBelow).
                                combatant.currentHp <
                                getMaxHp(allCombatants[combatant.heroId], combatant) *
                                  move.conditionalPower.requiresUserHpBelow
                              : !move.conditionalPower?.requiresUserStatus ||
                                hasStatus(combatant, move.conditionalPower.requiresUserStatus)
                        }
                        packBonusActive={
                          move.conditionalStatDeltas != null &&
                          (activePartnerTypes(combat, id, allCombatants) ?? []).includes(
                            move.conditionalStatDeltas.requiresPartnerType
                          )
                        }
                        liveTargetMode={resolveTargetMode(combat, move)}
                        caster={{
                          wisdom: getEffectiveStat(allCombatants[combatant.heroId], combatant, 'wisdom', {
                            active: combat.activeFieldEffect,
                            defs: fieldEffects,
                          }),
                          types: effectiveTypes(allCombatants[combatant.heroId], combatant),
                        }}
                        matchups={
                          move.kind === 'damage'
                            ? enemyActiveAlive.map((eid) => ({
                                id: eid,
                                name: allCombatants[combat.combatants[eid].heroId].name,
                                mult: effectivenessAgainst(move, eid),
                              }))
                            : []
                        }
                        multClass={multClass}
                        formatMult={formatMult}
                        onSelect={() => handleMoveClick(id, move)}
                        onInspect={() => setMovePopup({ combatantId: id, move })}
                      />
                    );
                  })}
                </div>
                )}
              </div>
            );
          })()}
      </div>

      {/* Every secondary action lives in one fixed bottom row instead of
          reserving its own space (a top header for log/reference, an
          always-visible bench readout, a back button that shifted the move
          grid down) — that reserved space was the source of the mobile
          scroll this consolidation exists to eliminate. Buttons stay
          mounted and are disabled rather than hidden when inapplicable, so
          the row's height never changes turn to turn.

          Split into two weights (2026-08-26, user direction): Back and
          Switch are pressed *during* a decision, many times a fight, so they
          take double width and the row's full height — the previous
          24px-tall quarter-width row was genuinely hard to hit on a phone
          now that the app runs installed rather than in a browser tab. Menu is
          consulted, not played, so it stays narrow and stacks its glyph over a
          caption instead.

          Log and Reference moved OFF this row and into the Menu (2026-08-26,
          user direction). Five keys was one more than the row could give real
          width to, and the two that lost their place are the two a player
          opens least — a fight is played with Back and Switch, and reads of
          the log or the type chart are deliberate detours. Three keys means
          Menu can share the utility width the trio used to split.

          And while a target is being chosen the row collapses to a SINGLE
          full-width Back. That state has exactly one legal exit — unpick the
          move — because Switch is itself an action the hero can't take once a
          move is loaded, and the whole battlefield is live with tappable
          targets. A row of four other keys under a screen that wants one tap
          on a highlighted card was offering choices that don't exist. */}
      <div className={`bottom-bar${showingTargetPanel ? ' bottom-bar-solo' : ''}`} style={consoleStyle}>
        <button
          className="bottom-action bottom-action-primary bottom-action-back"
          disabled={!(actingId !== null && (showingTargetPanel || stepIndex > 0))}
          onClick={() => (showingTargetPanel ? setSelecting(null) : setActionStep(stepIndex - 1))}
        >
          <span className="bottom-action-glyph" aria-hidden="true">
            ←
          </span>
          Back
        </button>
        {!showingTargetPanel && (
          <>
            <button
              className="bottom-action bottom-action-primary bottom-action-switch"
              disabled={!(actingId !== null && playerBench.length > 0 && !playerLockedIn)}
              onClick={() => setSwitchOpen(true)}
            >
              {/* ⇄, not the 🔄 emoji it replaced. An emoji is a full-color
                  image the platform draws for us: it can't take the key's own
                  color, so it stayed bright blue-and-green on a key the
                  stylesheet had just turned off, and it was the one element in
                  the console that didn't belong to the console. */}
              <span className="bottom-action-glyph" aria-hidden="true">
                ⇄
              </span>
              Switch
            </button>
            <button
              className="bottom-action bottom-action-utility"
              onClick={() => {
                setConfirmingQuit(false);
                setMenuOpen(true);
              }}
            >
              <span className="bottom-action-glyph" aria-hidden="true">
                ☰
              </span>
              <span className="bottom-action-label">Menu</span>
            </button>
          </>
        )}
      </div>

      {/* Options. Deliberately the only way out of a fight that isn't
          winning or losing it: there is no save file (App.tsx holds RunState
          in component state), so abandoning is destructive and gets a
          two-tap arm/confirm rather than one button that can drop a
          45-minute run on a mis-tap. The quit entry is hidden entirely when
          the caller passes no onQuitToTitle — Quick Battle and the sandbox
          fights have no run to abandon. */}
      {menuOpen && (
        <div className="log-overlay" onClick={() => setMenuOpen(false)}>
          <div className="log-panel options-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Options</span>
              <button className="log-close-button" onClick={() => setMenuOpen(false)}>
                ✕
              </button>
            </div>
            <div className="options-list">
              {/* The two readers that used to hold their own keys in the
                  bottom row. They close the menu on the way out rather than
                  layering a second overlay on the first — both open into the
                  same .log-overlay scrim, and stacking them would leave the
                  Options panel visible behind whichever one won. */}
              <button
                className="options-item"
                onClick={() => {
                  setMenuOpen(false);
                  setLogOpen(true);
                }}
              >
                <span className="options-item-glyph" aria-hidden="true">
                  📜
                </span>
                Battle Log
              </button>
              <button
                className="options-item"
                onClick={() => {
                  setMenuOpen(false);
                  setReferenceOpen(true);
                }}
              >
                <span className="options-item-glyph" aria-hidden="true">
                  📊
                </span>
                Reference — Types &amp; Statuses
              </button>
              {/* Settings sit between the readers and the exits: they are
                  neither a place to go nor a way out, and burying them under
                  Quit would put a routine control below a destructive one. */}
              <AudioSettings />
              <button className="options-item" onClick={() => setMenuOpen(false)}>
                <span className="options-item-glyph" aria-hidden="true">
                  ▶
                </span>
                Resume Fight
              </button>
              {onExitToTitle && (
                <button className="options-item" onClick={onExitToTitle}>
                  <span className="options-item-glyph" aria-hidden="true">
                    ⏏
                  </span>
                  Back to Title Screen
                </button>
              )}
              {onQuitToTitle && (
                <button
                  className={`options-item options-item-danger${confirmingQuit ? ' armed' : ''}`}
                  onClick={() => (confirmingQuit ? onQuitToTitle() : setConfirmingQuit(true))}
                >
                  <span className="options-item-glyph" aria-hidden="true">
                    {confirmingQuit ? '⚠' : '🚪'}
                  </span>
                  {confirmingQuit ? 'Tap again to abandon' : 'Quit Run — Return to Title'}
                </button>
              )}
            </div>
            {onQuitToTitle && (
              <p className="options-note">
                {confirmingQuit
                  ? 'This run ends now. Roster, relics and map progress are lost.'
                  : 'Runs are not saved. Quitting discards this one.'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Stage two of a switchesUserOut declaration. Deliberately the same
          panel a plain switch opens — the question is identical ("who comes
          in?"), the enemy/matchup context it shows is just as relevant, and a
          second bespoke bench list would be a second thing to keep in sync.
          What differs is only what it commits: a move carrying its pivot, not
          a switch action. Dismissing it drops the whole move rather than
          committing a pivot-less one, so backing out of stage two backs out of
          stage one too. */}
      {pivoting &&
        (() => {
          const { combatantId, move, declaredTarget } = pivoting;
          const outgoing = combat.combatants[combatantId];
          return (
            <SwitchInPanel
              outgoingHero={allCombatants[outgoing.heroId]}
              outgoing={outgoing}
              typeChart={typeChart}
              moves={moves}
              enemies={enemyActiveAlive.map((eid) => {
                const c = combat.combatants[eid];
                return { hero: allCombatants[c.heroId], combatant: c };
              })}
              options={playerBench.map((benchId) => {
                const benchCombatant = combat.combatants[benchId];
                const entry = entryFor(playerRun.roster, benchId);
                return {
                  combatantId: benchId,
                  hero: allCombatants[benchCombatant.heroId],
                  combatant: benchCombatant,
                  moveIds: entry.unlockedMoveIds,
                  selected: false,
                  // Same claim rule as the switch panel: another active hero
                  // already sending this bench hero in cannot also be undercut
                  // by a pivot into the same slot.
                  claimedByOther: Object.entries(pending).some(
                    ([pid, p]) =>
                      pid !== combatantId &&
                      ((p.kind === 'switch' && p.benchedCombatantId === benchId) ||
                        (p.kind === 'move' && p.switchToCombatantId === benchId))
                  ),
                };
              })}
              onPick={(benchId) => {
                setPivoting(null);
                commitAction(combatantId, { kind: 'move', moveId: move.id, declaredTarget, switchToCombatantId: benchId });
              }}
              onInspect={(benchId) => setInspecting(benchId)}
              onClose={() => setPivoting(null)}
            />
          );
        })()}

      {switchOpen &&
        actingId &&
        (() => {
          const id = actingId;
          const outgoing = combat.combatants[id];
          return (
            <SwitchInPanel
              outgoingHero={allCombatants[outgoing.heroId]}
              outgoing={outgoing}
              typeChart={typeChart}
              moves={moves}
              enemies={enemyActiveAlive.map((eid) => {
                const c = combat.combatants[eid];
                return { hero: allCombatants[c.heroId], combatant: c };
              })}
              options={playerBench.map((benchId) => {
                const benchCombatant = combat.combatants[benchId];
                const entry = entryFor(playerRun.roster, benchId);
                return {
                  combatantId: benchId,
                  hero: allCombatants[benchCombatant.heroId],
                  combatant: benchCombatant,
                  moveIds: entry.unlockedMoveIds,
                  selected: pending[id]?.kind === 'switch' && pending[id]?.benchedCombatantId === benchId,
                  // A different already-committed active hero has already claimed this bench
                  // hero as their replacement — can't also send it in here.
                  claimedByOther: Object.entries(pending).some(
                    ([pid, p]) => pid !== id && p.kind === 'switch' && p.benchedCombatantId === benchId
                  ),
                };
              })}
              onPick={(benchId) => {
                handleSwitchClick(id, benchId);
                setSwitchOpen(false);
              }}
              onInspect={(benchId) => setInspecting(benchId)}
              onClose={() => setSwitchOpen(false)}
            />
          );
        })()}

      {/* The move dossier (MoveDetailOverlay.tsx). Handed the live fight, so
          the card can run the locked damage formula forward against whoever is
          actually standing there rather than describing the move in the
          abstract — the thing a hold on a move is genuinely worth. */}
      {movePopup && (
        <MoveDetailOverlay
          move={movePopup.move}
          context={{ combat, attackerId: movePopup.combatantId, defenderIds: enemyActiveAlive }}
          onClose={() => setMovePopup(null)}
        />
      )}

      {logOpen && (
        <div className="log-overlay" onClick={() => setLogOpen(false)}>
          <div className="log-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-panel-header">
              <span>Battle Log</span>
              <button className="log-close-button" onClick={() => setLogOpen(false)}>
                ✕
              </button>
            </div>
            <div className="event-log">
              {[...log].reverse().map((l) => (
                <div key={l.key} className={l.className}>
                  {l.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {referenceOpen && <ReferenceOverlay onClose={() => setReferenceOpen(false)} />}

      {inspecting &&
        combat.combatants[inspecting] &&
        (() => {
          const combatant = combat.combatants[inspecting];
          const hero = allCombatants[combatant.heroId];
          const roster = combatant.side === PLAYER_SIDE ? playerRun.roster : aiRun.roster;
          const rosterEntry = roster.find((r) => r.rosterId === rosterIdOf(inspecting)) ?? null;
          return (
            <HeroDetailOverlay
              hero={hero}
              combatant={combatant}
              rosterEntry={rosterEntry}
              equipmentLookup={equipment}
              activeFieldEffect={combat.activeFieldEffect}
              onClose={() => setInspecting(null)}
            />
          );
        })()}

      {winner &&
        !resolving &&
        (() => {
          const equipGrants = equipmentReward ? (Object.entries(equipmentReward.statGrants) as [StatKey, number][]) : [];

          return (
            <div className={`result-overlay ${winner === PLAYER_SIDE ? 'result-win' : 'result-loss'}`}>
              <div className="result-panel">
                <div className="result-glow" aria-hidden="true" />
                <h2>{winner === PLAYER_SIDE ? 'Victory!' : 'Defeat'}</h2>

                {winner === PLAYER_SIDE && (goldReward > 0 || trainingPointsReward > 0) && (
                  <div className="result-rewards">
                    {goldReward > 0 && (
                      <div className="result-reward-chip">
                        💰 <strong>+{goldReward}</strong>g
                      </div>
                    )}
                    {trainingPointsReward > 0 && (
                      <div className="result-reward-chip">
                        ⭐ <strong>+{trainingPointsReward}</strong> XP
                      </div>
                    )}
                  </div>
                )}

                {winner === PLAYER_SIDE && equipmentReward && (
                  <div
                    className="equip-spotlight result-equip-spotlight"
                    style={{ '--rarity-color': RARITY_COLOR_VARS[equipmentReward.rarity] } as CSSProperties}
                  >
                    <div className="equip-spotlight-header">
                      <EquipmentIcon item={equipmentReward} slot={equipmentReward.slot} className="equip-spotlight-icon" />
                      <div>
                        <div className="equip-spotlight-name">{equipmentReward.name}</div>
                        <div className="equip-spotlight-rarity">
                          {RARITY_LABELS[equipmentReward.rarity]} · {EQUIP_SLOT_LABELS[equipmentReward.slot]}
                        </div>
                      </div>
                    </div>
                    {equipGrants.length > 0 && (
                      <div className="detail-modifier-list">
                        {equipGrants
                          .filter(([, amount]) => amount)
                          .map(([stat, amount]) => (
                            <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
                              <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {fmtGrant(amount)}
                            </span>
                          ))}
                      </div>
                    )}
                    {/* What the drop actually does. The stat chips above were
                        the whole story here, so an item whose point is a
                        passive (an Elemental Force accessory, say) announced
                        itself as a name and a rarity and nothing else — the
                        player had to go equip it to find out what they had
                        won. Same spelled-out block the reward and force-equip
                        screens use. */}
                    <EquipmentEffectList item={equipmentReward} />
                  </div>
                )}

                <div className="result-buttons">
                  <button onClick={() => onResolved(winner === PLAYER_SIDE ? 'win' : 'loss', combat)}>Continue</button>
                </div>
              </div>
            </div>
          );
        })()}
    </>
  );
}
