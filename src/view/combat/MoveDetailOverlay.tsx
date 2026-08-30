import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { MoveDefinition } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { effectiveManaCost, effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana } from '../../engine/state';
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
import { TARGET_MODE_LABELS, grantsRatherThanInflicts, healReadout, moveKindGlyph, moveKindLabel } from '../shared/MoveTile';
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
  const ratio = resolveStatRatio(move.category, attackerHero, attacker, defenderHero, defender, fieldEffectCtx);
  const modifiers: DamageModifier[] = collectPassiveDamageModifiers(attacker, move, passives);
  const forceBonus = resolveElementalForceBonus(attacker, move.type, statuses);
  // Read against THIS defender, so a conditional move forecasts x3 on the
  // Burned foe and x1 on the clean one — the whole point of showing a
  // per-defender band rather than one number.
  const conditionalMult = resolveConditionalPowerMultiplier(move, defender);
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
  // The live price, not the authored one — Wave Shred is 80 on the first cast
  // and less on every one after it (state.ts effectiveManaCost). Out of combat
  // there is no attacker and no ramp, so this is simply move.manaCost.
  const liveCost = effectiveManaCost(move, attacker?.moveManaDiscounts);
  const manaAfter = attacker ? attacker.currentMana - liveCost : null;
  const manaPool = attacker && attackerHero ? getMaxMana(attackerHero, attacker) : null;

  const kindGlyph = moveKindGlyph(move);
  const statusDef = move.statusApplication ? statuses[move.statusApplication.statusId] : undefined;
  const fieldDef = move.fieldEffectApplication ? fieldEffects[move.fieldEffectApplication] : undefined;
  const conditionalDef = move.conditionalPower ? statuses[move.conditionalPower.requiresTargetStatus] : undefined;
  const gateDef = move.requiresTargetStatus ? statuses[move.requiresTargetStatus] : undefined;
  const hasPayload = Boolean(
    move.statDeltas?.length ||
      move.statusApplication ||
      move.cleanses ||
      move.fieldEffectApplication ||
      move.conditionalPower ||
      move.requiresTargetStatus ||
      move.critChance != null ||
      move.drainPercent ||
      move.manaDiscountOnUse
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
        {move.priority !== 0 && (
          <span className={`move-detail-stat move-detail-stat-priority${move.priority > 0 ? ' is-fast' : ' is-slow'}`}>
            <StatGlyph stat="speed" tone="inherit" />
            <strong>
              {move.priority > 0 ? '+' : ''}
              {move.priority}
            </strong>
            <span className="move-detail-unit">{move.priority > 0 ? 'Strikes first' : 'Strikes last'}</span>
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
          {move.statDeltas?.map(({ stat, amount }) => (
            <EffectRow
              key={stat}
              glyph={<StatGlyph stat={stat} />}
              text={`${amount >= 0 ? '+' : ''}${amount} ${STAT_LABELS[stat]}`}
              note={`on ${TARGET_MODE_LABELS[move.target].toLowerCase()}`}
            />
          ))}
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
          {move.conditionalPower && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.conditionalPower.requiresTargetStatus} />}
              color={statusColor(move.conditionalPower.requiresTargetStatus)}
              text={`×${move.conditionalPower.multiplier} power vs ${conditionalDef?.name ?? move.conditionalPower.requiresTargetStatus}`}
              note={
                move.conditionalPower.consumesStatus
                  ? `scales base power, not the finished hit — and spends the ${conditionalDef?.name ?? move.conditionalPower.requiresTargetStatus} it cashed in`
                  : 'scales base power, not the finished hit'
              }
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
