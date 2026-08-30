import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { MoveDefinition } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { effectiveManaCost, effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana, hasStatus, resolveManaCost } from '../../engine/state';
import { allCombatants } from '../../data/content';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { typeChart } from '../../data/typechart';
import { resolveStab, resolveTypeMult, TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { resolveHealFor, type HealCaster } from '../../engine/heal/healPipeline';
import {
  calcDamage,
  resolveConditionalPowerMultiplier,
  resolveElementalForceBonus,
  resolveStatRatio,
  VARIANCE_MAX,
  VARIANCE_MIN,
  type DamageModifier,
} from '../../engine/damage/damagePipeline';
import { collectPassiveDamageModifiers } from '../../engine/combat/passiveEngine';
import { getTypeColor, getTypeColorRgb } from './typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { StatGlyph, MoveKindGlyph } from '../shared/statIcons';
import { StatusGlyph, statusColor } from '../shared/statusIcons';
import { STAT_LABELS, hpTier } from '../shared/StatBars';
import { ManaCost } from '../shared/ManaCost';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TARGET_MODE_LABELS, grantsRatherThanInflicts, healReadout, moveKindGlyph, moveKindLabel, riderTargetLabel } from '../shared/MoveTile';
import { overlayHost } from '../shared/overlayHost';

/**
 * The live fight a move is being inspected *inside*. Optional everywhere the
 * card is shown, because half the places a player holds a move — the hero
 * sheet, the level-up screen's replace offer, a recruit preview — have no
 * combat to forecast against. With it, the card stops describing the move in
 * the abstract and starts answering the question the hold was asked for:
 * *what happens if I press this, right now, against those two.*
 */
export interface MoveDossierContext {
  combat: CombatState;
  /** The hero whose button was held — the attacker in every number below. */
  attackerId: string;
  /** Enemy combatants still standing, in battlefield order. */
  defenderIds: readonly string[];
}

/**
 * The one-word pipeline name for the title line — damage moves only, since
 * they are the only ones that draw from a stat pipeline at all (CLAUDE.md
 * "Two-pipeline separation"). Everything else says what it is via
 * moveKindLabel, which is also what splits Buff from Debuff. Deliberately one
 * word either way: the line also carries the type and the target, and at
 * three items it has to fit 214px of a 340px card without wrapping and
 * orphaning a separator.
 */
const PIPELINE_WORDS: Record<MoveDefinition['category'], string> = {
  physical: 'Physical',
  magical: 'Magical',
};

/** Same tiering as FightScreen's inline matchup readout, and deliberately the same class names — a 4x on the move row and a 4x in the dossier must not be two different greens. */
function multClass(mult: number): string {
  if (mult >= 4) return 'eff-quad-super';
  if (mult > 1) return 'eff-super';
  if (mult === 1) return 'eff-neutral';
  if (mult <= TYPE_MULT_FLOOR) return 'eff-quad-resist';
  return 'eff-resist';
}

function formatMult(mult: number): string {
  return `${Math.round(mult * 100) / 100}×`;
}

interface Forecast {
  min: number;
  max: number;
  /** Fractions of the defender's MAX HP the two ends of the roll take off — the "how big a bite is this" number. */
  maxFraction: number;
  minFraction: number;
  /** Fraction of max HP the defender is currently standing on, so the bite can be drawn against what's actually left. */
  hpFraction: number;
  typeMult: number;
  /** 'sure' when even the worst variance roll finishes it, 'maybe' when only the best one does. */
  ko: 'sure' | 'maybe' | null;
}

/**
 * Runs the locked damage formula (CLAUDE.md) forwards for both ends of the
 * variance roll, using the *engine's own* pipeline functions rather than a
 * view-side reimplementation — `calcDamage` takes pre-rolled variance and crit
 * precisely so it can be called without RNG, which is what makes an honest
 * forecast possible at all. Every input is read the same way resolveRound.ts
 * reads it (field-effect context into the stat ratio, passive damage modifiers,
 * Elemental Force into BasePower), so the band the player is shown is the band
 * the round will actually roll inside.
 *
 * Crit is deliberately excluded from the band. It is a 1/16 event and folding
 * it into the maximum would inflate every forecast by 50% for a case that
 * mostly doesn't happen; the card states it as a separate footnote instead.
 */
function forecastAgainst(move: MoveDefinition, ctx: MoveDossierContext, defenderId: string): Forecast | null {
  if (move.kind !== 'damage' || move.basePower == null) return null;
  const attacker = ctx.combat.combatants[ctx.attackerId];
  const defender = ctx.combat.combatants[defenderId];
  if (!attacker || !defender) return null;
  const attackerHero = allCombatants[attacker.heroId];
  const defenderHero = allCombatants[defender.heroId];
  if (!attackerHero || !defenderHero) return null;

  const fieldEffectCtx = { active: ctx.combat.activeFieldEffect, defs: fieldEffects };
  // offStatOverride threaded in, or Body Blow forecasts off a Sentinel's
  // Attack 45 while the round resolves it off Defense 100 — the exact failure
  // docs/authoring-moves.md §5 warns about ("pass your new term in or the
  // forecast lies").
  const ratio = resolveStatRatio(move.category, attackerHero, attacker, defenderHero, defender, fieldEffectCtx, move.offStatOverride);
  const modifiers: DamageModifier[] = collectPassiveDamageModifiers(attacker, move, passives);
  const forceBonus = resolveElementalForceBonus(attacker, move.type, statuses);
  // Read against THIS defender, so a conditional move forecasts x3 on the
  // Burned foe and x1 on the clean one — the whole point of showing a
  // per-defender band rather than one number.
  // fieldEffectCtx threaded in for the same reason offStatOverride is: a Smite
  // forecast that ignored the Sanctuary already on the board would print half
  // the number the round is about to deal (docs/authoring-moves.md §5, "pass
  // your new term in or the forecast lies").
  // getMaxHp threaded in for the same reason: an execute (content.ts
  // conditionalPower.requiresTargetHpBelow) forecast without it would print
  // half the number the round is about to deal against a wounded foe.
  const conditionalMult = resolveConditionalPowerMultiplier(move, defender, attacker, fieldEffectCtx, getMaxHp(defenderHero, defender));
  const attackerTypes = effectiveTypes(attackerHero, attacker);
  const defenderTypes = effectiveTypes(defenderHero, defender);

  const roll = (variance: number) =>
    Math.round(
      calcDamage(
        move,
        ratio,
        attackerTypes,
        defenderTypes,
        typeChart,
        variance,
        false,
        modifiers,
        undefined,
        undefined,
        forceBonus,
        conditionalMult
      )
        .damage
    );

  const min = roll(VARIANCE_MIN);
  const max = roll(VARIANCE_MAX);
  const maxHp = getMaxHp(defenderHero, defender);
  return {
    min,
    max,
    maxFraction: Math.min(1, max / maxHp),
    minFraction: Math.min(1, min / maxHp),
    hpFraction: Math.min(1, defender.currentHp / maxHp),
    typeMult: resolveTypeMult(typeChart, move.type, defenderTypes),
    ko: min >= defender.currentHp ? 'sure' : max >= defender.currentHp ? 'maybe' : null,
  };
}

/**
 * One enemy's line in the forecast: who they are, how the type chart treats
 * this move against them, and how much of what they have left it takes.
 *
 * The bar is the point. A range of numerals ("38-45") is precise and says
 * nothing about whether that matters against a hero standing on 52 HP, and the
 * player is reading it under a turn clock. Drawing the bite *out of the
 * defender's own remaining track* is the same fixed-denominator idiom as the
 * Field Effect plaque's 5-pip clock and the level-up screen's rank track
 * (docs/visual-language.md) — a shape learned once and then read at a glance.
 */
function ForecastRow({ move, ctx, defenderId }: { move: MoveDefinition; ctx: MoveDossierContext; defenderId: string }) {
  const defender = ctx.combat.combatants[defenderId];
  const hero = allCombatants[defender.heroId];
  if (!hero) return null;
  const forecast = forecastAgainst(move, ctx, defenderId);
  if (!forecast) return null;

  const { min, max, maxFraction, minFraction, hpFraction, typeMult, ko } = forecast;
  // The bite is drawn from the right-hand end of what the defender is standing
  // on, eating leftwards — so a lethal hit visibly reaches the track's origin
  // instead of overflowing past it.
  const biteWidth = Math.min(maxFraction, hpFraction);
  const biteLeft = Math.max(0, hpFraction - maxFraction);
  // Where the *worst* roll would leave them. Sits inside the bite as a notch,
  // which is what turns a solid block into a range without drawing a second bar.
  const floorMark = Math.max(0, hpFraction - Math.min(minFraction, hpFraction));

  return (
    <div className="move-forecast-row">
      {/* 48px — the source's native size. The 24px this used to draw at is the
          other legal scale (docs/visual-language.md defect 1) and it made the
          enemy a footnote in a readout that is entirely about that enemy; at
          native size the row is worth the space it takes, and the name/matchup
          line and the meter stack beside it rather than under it. */}
      <HeroPortrait heroId={defender.heroId} className="move-forecast-portrait" seed={defenderId} />
      <div className="move-forecast-body">
      <div className="move-forecast-who">
        <span className="move-forecast-name">{hero.name}</span>
        {/* Chromeless, not TypeBadge: a filled chip here would put back exactly
            the sub-box the console's move rows had removed, twice per row, and
            it out-shouted the defender's own name. The glyph in the type's
            colour separates fifteen types on its own — the same argument
            .move-type-code makes on the button. */}
        {effectiveTypes(hero, defender).map((t) => (
          <span key={t} className="move-forecast-type" style={{ color: getTypeColor(t) }} title={t}>
            <ElementGlyph type={t} />
          </span>
        ))}
        <span className={`move-forecast-mult ${multClass(typeMult)}`}>{formatMult(typeMult)}</span>
      </div>
      <div className="move-forecast-meter">
        <div className={`move-forecast-track ${hpTier(hpFraction)}`}>
          <div className="move-forecast-hp" style={{ width: `${hpFraction * 100}%` }} />
          <div className="move-forecast-bite" style={{ left: `${biteLeft * 100}%`, width: `${biteWidth * 100}%` }} />
          {biteWidth > 0 && <div className="move-forecast-floor" style={{ left: `${floorMark * 100}%` }} />}
        </div>
        <span className="move-forecast-numbers">
          {min === max ? min : `${min}–${max}`}
          <span className="move-forecast-of"> / {defender.currentHp}</span>
        </span>
        {ko && <span className={`move-forecast-ko ${ko === 'sure' ? 'is-sure' : 'is-maybe'}`}>{ko === 'sure' ? 'KO' : 'KO?'}</span>}
      </div>
      </div>
    </div>
  );
}

/** A payload the move carries beyond its damage — one glyph, one sentence. */
function EffectRow({ glyph, text, note, color }: { glyph: ReactNode; text: string; note?: string; color?: string }) {
  return (
    <div className="move-detail-effect-row" style={color ? ({ color } as CSSProperties) : undefined}>
      <span className="move-detail-effect-glyph">{glyph}</span>
      <span className="move-detail-effect-text">
        {text}
        {note && <span className="move-detail-effect-note">{note}</span>}
      </span>
    </div>
  );
}

interface CardProps {
  move: MoveDefinition;
  /** Optional eyebrow above the name — LevelUpScreen's replace offer uses it to say which slot is being inspected. */
  label?: string;
  context?: MoveDossierContext;
  /** Who is casting, for screens that have a hero but no live fight (level-up, hero sheet, draft). A `context` supersedes it — that carries a real Combatant, so the field effect and any mid-fight Wisdom buff are already in the number. Without either, a heal falls back to its authored HealPower (healReadout). */
  caster?: HealCaster;
}

/**
 * The move dossier: everything a hold on a move is worth, in the vector
 * vocabulary the rest of the game now speaks.
 *
 * It replaces a card that was five text chips in a row (a filled TypeBadge, a
 * bordered PHY/MAG badge, two uppercase word-spans and a bare "STAB" tag)
 * above a flavor line and a name/multiplier list — which is the *exact*
 * "competing rectangles" defect docs/visual-language.md's second pass removed
 * from the button this popup opens from, left standing in the popup itself.
 * Every one of those facts is now a glyph from an authored family: the type
 * from `elementIcons`, the pipeline from `statIcons` (the move-kind glyph is
 * literally the stat the damage formula reads), the payload from
 * `statusIcons`, the cost from the mana gem the button already wears.
 *
 * And it answers three questions the old card never asked, which is the second
 * half of the procedure that doc keeps arriving at — the rule governs whether a
 * thing is boxed, not whether the box holds the decision:
 *
 * - **How hard does this actually hit?** A real damage band, run through the
 *   engine's own pipeline (see `forecastAgainst`), drawn against the target's
 *   remaining HP. The move row already shows the type multiplier; a multiplier
 *   is not a number of hit points.
 * - **Does it move first?** `priority` is a locked mechanic (CLAUDE.md
 *   "Priority uses integer brackets") that ten authored moves carry and that
 *   the UI has never displayed anywhere, at all.
 * - **What is left in the tank?** The cost gem says what it costs; with a live
 *   fight it now also says what the hero is standing on afterwards.
 */
export function MoveDetailCard({ move, label, context, caster }: CardProps) {
  const typeColor = getTypeColor(move.type);
  const attacker = context ? context.combat.combatants[context.attackerId] : undefined;
  const attackerHero = attacker ? allCombatants[attacker.heroId] : undefined;

  // Heals take STAB too (docs/combat.md "The healing formula"), so this is no
  // longer damage-only — a Light healer's Light heal is 1.25x for exactly the
  // same reason a Light nuke is.
  const healCaster: HealCaster | undefined =
    attacker && attackerHero
      ? {
          wisdom: getEffectiveStat(attackerHero, attacker, 'wisdom', { active: context?.combat.activeFieldEffect ?? null, defs: fieldEffects }),
          types: effectiveTypes(attackerHero, attacker),
        }
      : caster;
  const heal = move.kind === 'heal' ? healReadout(move, healCaster) : null;
  const healTerms = healCaster && move.kind === 'heal' ? resolveHealFor(move, healCaster) : null;
  const stab =
    (move.kind === 'damage' || move.kind === 'heal') && healCaster ? resolveStab(move.type, healCaster.types) > 1 : false;
  const forceBonus = attacker ? resolveElementalForceBonus(attacker, move.type, statuses) : 0;
  // The live price, not the authored one, and live in both senses: Wave Shred
  // is 80 on the first cast and less on every one after it (manaDiscountOnUse),
  // and Overcharge is 0 while both enemies carry Conduct (conditionalManaCost).
  // The second needs the BOARD, so it is only answerable with a fight in scope —
  // out of combat this falls back to the ramp-only price, which is
  // move.manaCost with no attacker and no ramp (state.ts).
  const liveCost = context
    ? resolveManaCost(context.combat, context.attackerId, move)
    : effectiveManaCost(move, attacker?.moveManaDiscounts);
  const manaAfter = attacker ? attacker.currentMana - liveCost : null;
  const manaPool = attacker && attackerHero ? getMaxMana(attackerHero, attacker) : null;

  const kindGlyph = moveKindGlyph(move);
  const statusDef = move.statusApplication ? statuses[move.statusApplication.statusId] : undefined;
  const fieldDef = move.fieldEffectApplication ? fieldEffects[move.fieldEffectApplication] : undefined;
  // Whichever side of the board this move's conditional actually asks about
  // (content.ts conditionalPower.requiresUserStatus). Empty on the field form,
  // which asks about no combatant at all and wears the field effect's own
  // glyph instead (requiresFieldEffect).
  const conditionalFieldId = move.conditionalPower?.requiresFieldEffect ?? '';
  // The HP form asks about neither a status nor the field, so it takes
  // neither of their rows (content.ts conditionalPower.requiresTargetHpBelow).
  const conditionalHpBelow = move.conditionalPower?.requiresTargetHpBelow;
  const conditionalStatusId = move.conditionalPower
    ? (move.conditionalPower.requiresTargetStatus ?? move.conditionalPower.requiresUserStatus ?? '')
    : '';
  const conditionalDef = conditionalStatusId ? statuses[conditionalStatusId] : undefined;
  /** Whether any prospective defender is ALREADY under an execute's line — answerable without declaring a target, same as conditionalFieldLive below. */
  const conditionalHpLive = Boolean(
    conditionalHpBelow != null &&
      context?.defenderIds.some((id) => {
        const defender = context.combat.combatants[id];
        const hero = defender && allCombatants[defender.heroId];
        return defender && !defender.fainted && hero && defender.currentHp < getMaxHp(hero, defender) * conditionalHpBelow;
      })
  );
  const conditionalFieldDef = conditionalFieldId ? fieldEffects[conditionalFieldId] : undefined;
  /** Whether the field this move's conditional wants is the one actually up right now — answerable without a target, unlike the target-side form. */
  const conditionalFieldLive = Boolean(conditionalFieldId && context?.combat.activeFieldEffect?.fieldEffectId === conditionalFieldId);
  const detonateDef = move.detonatesStatus ? statuses[move.detonatesStatus] : undefined;
  const gateDef = move.requiresTargetStatus ? statuses[move.requiresTargetStatus] : undefined;
  const priorityDef = move.conditionalPriority ? statuses[move.conditionalPriority.requiresTargetStatus] : undefined;
  /**
   * The bracket this move would actually resolve in. The dossier is opened
   * BEFORE a target is declared, so there is no one target to read the
   * condition off — this answers "can this strike first right now" by checking
   * whether ANY prospective defender is carrying the mark, and leaves the exact
   * rule (it is the declared target's mark, read when the round is ordered) to
   * the effect row below, which states it in full.
   */
  const livePriority =
    move.conditionalPriority &&
    context?.defenderIds.some((id) => {
      const defender = context.combat.combatants[id];
      return defender && !defender.fainted && hasStatus(defender, move.conditionalPriority!.requiresTargetStatus);
    })
      ? move.priority + move.conditionalPriority.bonus
      : move.priority;
  const freeDef = move.conditionalManaCost ? statuses[move.conditionalManaCost.requiresAllEnemiesStatus] : undefined;
  const hasPayload = Boolean(
    move.statDeltas?.length ||
      move.derivedStatDeltas ||
      move.manaGrant ||
      move.conditionalTarget ||
      move.statusApplication ||
      move.cleanses ||
      move.fieldEffectApplication ||
      move.conditionalPower ||
      move.detonatesStatus ||
      move.requiresTargetStatus ||
      move.critChance != null ||
      move.drainPercent ||
      move.manaDiscountOnUse ||
      move.conditionalPriority ||
      move.conditionalManaCost ||
      move.switchesUserOut ||
      move.offStatOverride ||
      move.retributionPercent != null ||
      move.recoilPercent ||
      move.doublesStatReductions
  );

  const forecastIds = context && move.kind === 'damage' ? context.defenderIds : [];

  return (
    <div className="move-detail-card" style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}>
      {label && <div className="move-detail-label">{label}</div>}

      <div className="move-detail-head">
        {/* The same 44px tinted disc StatusDetailOverlay gives a status, for
            the same reason: it is the one slot in the app big enough to show
            an authored glyph at full size, so this is where a player actually
            learns what the Storm mark or the Iron anvil looks like. */}
        <span className="move-detail-disc" style={{ color: typeColor }}>
          <ElementGlyph type={move.type} />
        </span>
        <div className="move-detail-titles">
          <div className="move-detail-name">{move.name}</div>
          <div className="move-detail-line">
            <span style={{ color: typeColor }}>{move.type}</span>
            <span className="move-detail-sep">·</span>
            <span>{move.kind === 'damage' ? PIPELINE_WORDS[move.category] : moveKindLabel(move)}</span>
            <span className="move-detail-sep">·</span>
            <span>{TARGET_MODE_LABELS[move.target]}</span>
          </div>
        </div>
        {/* Cost leads the move button and so it leads the card too — mana is
            the primary balance lever (CLAUDE.md), and the gem is the picture
            the player already reads it as. */}
        <ManaCost cost={liveCost} />
      </div>

      <div className="move-detail-stats">
        {move.kind === 'damage' && move.basePower != null && (
          <span className="move-detail-stat">
            <MoveKindGlyph kind={kindGlyph} />
            <strong>{move.basePower + forceBonus}</strong>
            <span className="move-detail-unit">BP</span>
            {forceBonus > 0 && <span className="move-detail-boost">▲{forceBonus}</span>}
          </span>
        )}
        {heal && (
          <span
            className="move-detail-stat move-detail-stat-heal"
            title={
              healTerms
                ? `${healTerms.healPower} HealPower × ${healTerms.wisdomMult.toFixed(2)} Wisdom${healTerms.stab > 1 ? ' × 1.25 STAB' : ''}`
                : undefined
            }
          >
            <StatGlyph stat="hp" tone="inherit" />
            <strong>{heal.value}</strong>
            <span className="move-detail-unit">{heal.resolved ? 'HP' : 'HEAL'}</span>
          </span>
        )}
        {/* The Wisdom term, stated the way STAB below is: a heal that reads 60
            on one hero and 36 on another has to say WHY on the card, or the
            formula just looks like the numbers are unstable. Hidden at
            exactly 1.00 — a caster sitting on the reference Wisdom has no
            story to tell. */}
        {healTerms && healTerms.wisdomMult !== 1 && (
          <span className="move-detail-stat move-detail-stat-wis" title="Wisdom scales healing: ±1% per point off 50">
            <StatGlyph stat="wisdom" tone="inherit" />
            <strong>×{healTerms.wisdomMult.toFixed(2)}</strong>
            <span className="move-detail-unit">WIS</span>
          </span>
        )}
        {/* STAB wears the attacker's own type glyph rather than the word
            alone: the bonus exists because those two types match, and showing
            the matching element is the shortest way to say so. */}
        {stab && (
          <span className="move-detail-stat move-detail-stat-stab" title="Same-Type Attack Bonus">
            <ElementGlyph type={move.type} />
            <strong>×1.25</strong>
            <span className="move-detail-unit">STAB</span>
          </span>
        )}
        {/* Never shown anywhere in the game before this card, on ten authored
            moves. The Speed glyph is the honest one to borrow — priority is
            resolved before Speed and tie-broken by it (CLAUDE.md). */}
        {/* Folds in conditionalPriority, so a marked board makes Electric
            Burst read "+1 · Strikes first" rather than printing its authored 0
            and being contradicted by its own effect row below. Shown whenever
            the LIVE bracket is nonzero, which is why a base-0 move can appear
            here at all. */}
        {livePriority !== 0 && (
          <span className={`move-detail-stat move-detail-stat-priority${livePriority > 0 ? ' is-fast' : ' is-slow'}`}>
            <StatGlyph stat="speed" tone="inherit" />
            <strong>
              {livePriority > 0 ? '+' : ''}
              {livePriority}
            </strong>
            <span className="move-detail-unit">{livePriority > 0 ? 'Strikes first' : 'Strikes last'}</span>
          </span>
        )}
        {manaAfter !== null && manaPool !== null && (
          <span className="move-detail-stat move-detail-stat-mana">
            <StatGlyph stat="manaPool" tone="inherit" />
            <strong>{Math.max(0, manaAfter)}</strong>
            <span className="move-detail-unit">/ {manaPool} MP left</span>
          </span>
        )}
      </div>

      {hasPayload && (
        <div className="move-detail-effects">
          {/* First, because on the four battery moves it is the entire payload
              (content.ts manaGrant). The note carries the half the number
              cannot: that a full-pool ally keeps the surplus instead of
              wasting it, which is the only reason handing 150 to a 90 pool is
              a play at all (docs/mana.md "Overflow"). */}
          {move.manaGrant != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`Gives ${move.manaGrant} MP to ${TARGET_MODE_LABELS[move.target].toLowerCase()}`}
              note="overflows past the pool and stays there — nothing takes it back but spending it"
            />
          )}
          {move.statDeltas?.map(({ stat, amount }) => (
            <EffectRow
              key={stat}
              glyph={<StatGlyph stat={stat} />}
              text={`${amount >= 0 ? '+' : ''}${amount} ${STAT_LABELS[stat]}`}
              /* Landslide buffs the caster's side while hitting the enemy's,
                 so the move's own target is the wrong answer here
                 (content.ts statDeltaTarget). A chanced delta also has to say
                 what the odds are and that the move's own body lands anyway —
                 the rider is gated, never the hit (content.ts
                 statDeltaChance). */
              note={`on ${(move.statDeltaTarget === 'bothAllies'
                ? TARGET_MODE_LABELS.bothAllies
                : move.statDeltaTarget === 'self'
                  ? TARGET_MODE_LABELS.self
                  : TARGET_MODE_LABELS[move.target]
              ).toLowerCase()}${
                move.statDeltaChance != null
                  ? ` — ${Math.round(move.statDeltaChance * 100)}% chance, rolled per target; the hit itself always lands`
                  : ''
              }`}
            />
          ))}
          {/* The capstone with no number at all: what it is worth is entirely
              what the enemy's stat line already says (content.ts
              doublesStatReductions). So the row states the rule and the note
              carries the live total off the actual defenders, the same split
              the derived-grant row below uses — and the same reason, that a
              player deciding whether to spend 80 mana needs the figure, not
              the mechanic. */}
          {move.doublesStatReductions && (
            <EffectRow
              glyph={<StatGlyph stat="intelligence" />}
              text="Doubles every stat reduction already on the target"
              note={(() => {
                const ids = context?.defenderIds ?? [];
                const banked = ids.reduce((sum, id) => {
                  const d = context?.combat.combatants[id];
                  if (!d || d.fainted) return sum;
                  return sum + Object.values(d.statModifiers).reduce((a, v) => a + (typeof v === 'number' && v < 0 ? -v : 0), 0);
                }, 0);
                if (!ids.length) return 'worth nothing against a clean stat line, and it compounds on a second cast';
                return banked > 0
                  ? `${banked} of reductions standing right now — this would add ${banked} more`
                  : 'nothing is debuffed right now, so this would do nothing at all';
              })()}
            />
          )}
          {/* The one stat grant in the game with no authored number — so the
              row prints the LIVE figure when there is a caster to read it off,
              and the rule when there is not (content.ts derivedStatDeltas).
              Read before the cost is paid, which is why it is not
              `manaAfter`. */}
          {move.derivedStatDeltas?.stats.map((stat) => (
            <EffectRow
              key={`derived-${stat}`}
              glyph={<StatGlyph stat={stat} />}
              text={
                attacker
                  ? `+${attacker.currentMana} ${STAT_LABELS[stat]} on ${TARGET_MODE_LABELS[move.target].toLowerCase()}`
                  : `+${STAT_LABELS[stat]} equal to your current Mana`
              }
              note={
                attacker
                  ? 'your Mana as it stands BEFORE this move is paid for — overflow included'
                  : 'no fixed amount: it is whatever the caster is holding when they press it'
              }
            />
          ))}
          {/* Targeting, as an effect row, because on Overload it is the whole
              difference between the move and its neighbours (content.ts
              conditionalTarget). The note answers it live when there is a
              board to answer it against. */}
          {move.conditionalTarget && (
            <EffectRow
              glyph={<ElementGlyph type={fieldEffects[move.conditionalTarget.requiresFieldEffect]?.flavorType ?? 'Arcane'} />}
              color={getTypeColor(fieldEffects[move.conditionalTarget.requiresFieldEffect]?.flavorType ?? 'Arcane')}
              text={`Hits ${TARGET_MODE_LABELS[move.conditionalTarget.target].toLowerCase()} while ${
                fieldEffects[move.conditionalTarget.requiresFieldEffect]?.name ?? move.conditionalTarget.requiresFieldEffect
              } is up`}
              note={
                context?.combat.activeFieldEffect?.fieldEffectId === move.conditionalTarget.requiresFieldEffect
                  ? 'the field is up right now — this cast spreads'
                  : 'read when the move lands, so a partner setting the field earlier this round already counts'
              }
            />
          )}
          {move.statusApplication && statusDef && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.statusApplication.statusId} />}
              color={statusColor(move.statusApplication.statusId)}
              /* Granted vs inflicted: same field, opposite reading, and the
                 verb is what separates them — see moveEffectSummary. */
              /* A chanced rider leads with its odds; an unchanced one says
                 nothing, so every move authored before the field reads exactly
                 as it did. */
              text={`${move.statusApplication.chance != null ? `${Math.round(move.statusApplication.chance * 100)}% ` : ''}${
                /* Granted vs inflicted keys off the status's own sign, not off who it lands on — see grantsRatherThanInflicts. */
                grantsRatherThanInflicts(move.statusApplication) ? 'Grants' : 'Applies'
              } ${statusDef.name}${
                move.statusApplication.magnitude != null
                  ? ` ${move.statusApplication.magnitude}`
                  : move.statusApplication.duration != null
                    ? ` ${move.statusApplication.duration}`
                    : ''
              }${
                /* Where it lands, when that is not the move's own target — on
                   Rising Static the +20 Speed and the Conduct go to opposite
                   sides of the field, and only this clause says so. */
                riderTargetLabel(move.statusApplication) ? ` — ${riderTargetLabel(move.statusApplication)}` : ''
              }`}
              note={statusDef.description}
            />
          )}
          {/* The gate reads first, above the conditional row and above crit:
              it is the only effect in this list that can make the move
              unpressable rather than merely different. */}
          {move.requiresTargetStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.requiresTargetStatus} />}
              color={statusColor(move.requiresTargetStatus)}
              text={`Only targets ${gateDef?.name ?? move.requiresTargetStatus}`}
              note="no legal target, and no way to declare it, unless the status is already out there"
            />
          )}
          {/* The field form wears the FIELD's glyph and colour, not a status's:
              what it is asking about is the ground, and a Sanctuary-gated Smite
              carrying a blank status glyph would be pointing at nothing
              (content.ts conditionalPower.requiresFieldEffect). */}
          {move.conditionalPower && conditionalFieldId && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalFieldDef?.flavorType ?? 'Arcane'} />}
              color={getTypeColor(conditionalFieldDef?.flavorType ?? 'Arcane')}
              text={`×${move.conditionalPower.multiplier} power while ${conditionalFieldDef?.name ?? conditionalFieldId} is up`}
              note={
                conditionalFieldLive
                  ? `scales base power, not the finished hit — and ${conditionalFieldDef?.name ?? conditionalFieldId} is up right now`
                  : 'scales base power, not the finished hit — the field is global, so either side setting it arms this move'
              }
            />
          )}
          {/* The execute wears the HP heart rather than a status glyph: what
              it asks about is a NUMBER on the target, and every other row
              here points at something the player can see on a card's status
              strip (content.ts conditionalPower.requiresTargetHpBelow). */}
          {move.conditionalPower && conditionalHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`×${move.conditionalPower.multiplier} power vs a target below ${Math.round(conditionalHpBelow * 100)}% HP`}
              note={
                conditionalHpLive
                  ? 'scales base power, not the finished hit — and someone out there is already under the line'
                  : 'scales base power, not the finished hit — read BEFORE this hit lands, so it never doubles off HP it is about to take'
              }
            />
          )}
          {move.conditionalPower && !conditionalFieldId && conditionalHpBelow == null && (
            <EffectRow
              glyph={<StatusGlyph statusId={conditionalStatusId} />}
              color={statusColor(conditionalStatusId)}
              text={
                move.conditionalPower.requiresUserStatus
                  ? `×${move.conditionalPower.multiplier} power while you have ${conditionalDef?.name ?? conditionalStatusId}`
                  : `×${move.conditionalPower.multiplier} power vs ${conditionalDef?.name ?? conditionalStatusId}`
              }
              note={
                move.conditionalPower.consumesStatus
                  ? `scales base power, not the finished hit — and spends the ${conditionalDef?.name ?? conditionalStatusId} it cashed in`
                  : move.conditionalPower.requiresUserStatus
                    ? 'scales base power, not the finished hit — read off THIS hero, so a partner granting it earlier in the round already counts'
                    : 'scales base power, not the finished hit'
              }
            />
          )}
          {/* The detonation wears the detonated status's own glyph, not the
              move's: what the row is really reporting is how big the player's
              Poison stack has grown, and the move is only the trigger
              (content.ts detonatesStatus). */}
          {move.detonatesStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.detonatesStatus} />}
              color={statusColor(move.detonatesStatus)}
              text={`Detonates ${detonateDef?.name ?? move.detonatesStatus} on contact`}
              note="pays the timer out now, at whatever magnitude it has reached — and this move's own application counts toward it"
            />
          )}
          {move.critChance != null && (
            <EffectRow
              glyph={<MoveKindGlyph kind={move.kind === 'damage' ? move.category : 'buff'} />}
              text={`${Math.round(move.critChance * 100)}% crit chance`}
              note="1.5× damage when it lands"
            />
          )}
          {/* The drain row wears the HP heart, not the move's own pipeline
              glyph: what it returns is hit points, and the number it scales is
              the finished hit rather than anything the healing formula would
              recognise (content.ts drainPercent). */}
          {move.drainPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`Heals ${Math.round(move.drainPercent * 100)}% of damage dealt`}
              note="a share of the hit itself — Wisdom and STAB do not scale it"
            />
          )}
          {/* Pipeline 1, and the row says so: this does not scale the hit, it
              changes which of the caster's stats the ratio reads
              (content.ts offStatOverride). */}
          {move.offStatOverride && (
            <EffectRow
              glyph={<StatGlyph stat={move.offStatOverride} />}
              text={`Uses ${STAT_LABELS[move.offStatOverride]} in place of ${STAT_LABELS[move.category === 'physical' ? 'attack' : 'intelligence']}`}
              note={
                attacker && attackerHero
                  ? `${getEffectiveStat(attackerHero, attacker, move.offStatOverride, {
                      active: context?.combat.activeFieldEffect ?? null,
                      defs: fieldEffects,
                    })} right now — the target still defends with its own ${STAT_LABELS[move.category === 'physical' ? 'defense' : 'wisdom']}`
                  : 'the defending stat is unchanged — only the attacking one moves'
              }
            />
          )}
          {/* This move has no Base Power, so this row IS the damage. The live
              banked figure, because a percentage of an unknown number is not a
              decision (content.ts retributionPercent). */}
          {move.retributionPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={
                attacker
                  ? `Deals ${Math.round(attacker.damageTakenSinceLastTurn * move.retributionPercent)} damage right now`
                  : `Deals ${Math.round(move.retributionPercent * 100)}% of damage taken since your last turn`
              }
              note={
                attacker
                  ? `${Math.round(move.retributionPercent * 100)}% of the ${attacker.damageTakenSinceLastTurn} taken since this hero last acted — fixed damage, no type chart, no variance, no crit`
                  : 'fixed damage — the type chart, variance and crit do not apply'
              }
            />
          )}
          {/* The recoil row wears the HP heart for the same reason the drain
              row does: what it costs is hit points, billed off the finished
              hit (content.ts recoilPercent). */}
          {move.recoilPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`Costs ${Math.round(move.recoilPercent * 100)}% of damage dealt as recoil`}
              note="a share of the hit itself — and there is no floor, so it can knock the caster out"
            />
          )}
          {move.cleanses && (
            <EffectRow
              glyph={<MoveKindGlyph kind="buff" />}
              text={move.cleanseCount != null ? `Cleanses ${move.cleanseCount} at random` : 'Cleanses'}
              note={
                move.cleanseCount != null
                  ? 'one negative status, chosen at random — never a positive one'
                  : 'strips every negative status from the target'
              }
            />
          )}
          {move.manaDiscountOnUse != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`−${move.manaDiscountOnUse} mana each use`}
              note={
                attacker
                  ? `costs ${liveCost} now, ${Math.max(0, liveCost - move.manaDiscountOnUse)} after this cast — for the rest of the fight`
                  : 'stacks for the rest of the fight, on this hero only'
              }
            />
          )}
          {move.conditionalPriority && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.conditionalPriority.requiresTargetStatus} />}
              color={statusColor(move.conditionalPriority.requiresTargetStatus)}
              text={`${move.conditionalPriority.bonus >= 0 ? '+' : ''}${move.conditionalPriority.bonus} priority vs ${
                priorityDef?.name ?? move.conditionalPriority.requiresTargetStatus
              }`}
              note="read when the round is ordered, so the mark has to already be out there — a partner applying it this round is too late"
            />
          )}
          {move.conditionalManaCost && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`${move.conditionalManaCost.manaCost} mana while both enemies carry ${
                freeDef?.name ?? move.conditionalManaCost.requiresAllEnemiesStatus
              }`}
              note={
                attacker
                  ? `costs ${liveCost} right now`
                  : `${move.manaCost} otherwise — the condition reads the live board`
              }
            />
          )}
          {move.switchesUserOut && (
            <EffectRow
              glyph={<MoveKindGlyph kind="buff" />}
              text="Then switch out"
              note="the payload lands first, then the caster goes to the bench — refused, buff and all costs kept, once the side is locked in at 2 KOs"
            />
          )}
          {fieldDef && (
            <EffectRow
              glyph={<ElementGlyph type={fieldDef.flavorType ?? 'Arcane'} />}
              color={getTypeColor(fieldDef.flavorType ?? 'Arcane')}
              text={`Field: ${fieldDef.name}`}
              note={fieldDef.description}
            />
          )}
        </div>
      )}

      {move.description && <div className="move-detail-desc">{move.description}</div>}

      {forecastIds.length > 0 && context && (
        <div className="move-detail-forecast">
          <div className="move-detail-eyebrow">Forecast</div>
          {forecastIds.map((id) => (
            <ForecastRow key={id} move={move} ctx={context} defenderId={id} />
          ))}
          {/* Stated, not hidden: the band is the variance roll only, and a
              player who sees 41 land after being shown "38-45" should know
              exactly which term the game rolled. */}
          <div className="move-detail-footnote">
            Range is the 0.85–1.0 variance roll. A crit multiplies it by 1.5
            {move.critChance != null ? ` (${Math.round(move.critChance * 100)}% on this move)` : ''}.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The dossier as a modal, for the fight screen's move rows.
 *
 * Moved off `.log-overlay`/`.log-panel` — the *Battle Log's* chassis, which it
 * had been borrowing — and onto `.detail-overlay`/`.detail-panel`, the shell
 * every other hold-to-inspect card in combat already uses (StatusDetailOverlay,
 * FieldEffectDetailOverlay, HeroDetailOverlay). Same identity stripe across the
 * top in the subject's own color, same "tap anywhere to close". The one
 * long-press a player performs most often was the only one that opened
 * something shaped differently from all the others.
 *
 * Portalled for the reason StatusDetailOverlay documents — the console and its
 * rows carry transforms and filters, either of which would make a
 * `position: fixed` descendant resolve against the row — but into
 * `.app-shell`, not `document.body`. See overlayHost.ts: body is outside the
 * transform-scaled design canvas, which on a zoomed browser rendered this card
 * at half the size of everything around it.
 */
export function MoveDetailOverlay({ move, context, onClose }: { move: MoveDefinition; context?: MoveDossierContext; onClose: () => void }) {
  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div
        className="detail-panel move-detail-panel"
        /* The type var is set here as well as on the card inside: the panel's
           own domain wash has to bleed to the modal's edges, and a custom
           property only travels down. The card re-declares it so it still
           works standalone, inside the shared popup wrapper the hero sheet and
           the level-up offer open it in. */
        style={{ borderTopColor: getTypeColor(move.type), '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
        onClick={closeAndStop}
      >
        <MoveDetailCard move={move} context={context} />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
