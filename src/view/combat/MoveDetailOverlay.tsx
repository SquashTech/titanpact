import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { MoveDefinition, StatKey } from '../../engine/content';
import { statusApplicationsOf, STAT_ORDER } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { activePartnerTypes, effectiveManaCost, effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana, effectiveBasePower, hasStatus, resolveCastBasePower, resolveManaCost, moveForHero, moveForPrimaryType } from '../../engine/state';
import { allCombatants } from '../../data/content';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { typeChart } from '../../data/typechart';
import { resolveStab, resolveTypeMult, TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { resolveHealFor, type HealCaster } from '../../engine/heal/healPipeline';
import { resolveStatusMagnitudeFor, scaleStatusMagnitude } from '../../engine/status/statusMagnitude';
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
import { statusFactsLine } from '../shared/statusFacts';
import { STAT_LABELS, hpTier } from '../shared/StatBars';
import { ManaCost } from '../shared/ManaCost';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TARGET_MODE_LABELS, grantsRatherThanInflicts, healReadout, moveKindGlyph, moveKindLabel, riderTargetLabel } from '../shared/MoveTile';
import { overlayHost } from '../shared/overlayHost';

/** The live fight a move is inspected inside. Optional: the hero sheet, level-up and recruit preview have no combat to forecast against. */
export interface MoveDossierContext {
  combat: CombatState;
  /** The hero whose button was held — the attacker in every number on the card. */
  attackerId: string;
  /** Enemy combatants still standing, in battlefield order. */
  defenderIds: readonly string[];
}

// One word: the title line also carries type and target and must not wrap at 214px.
const PIPELINE_WORDS: Record<MoveDefinition['category'], string> = {
  physical: 'Physical',
  magical: 'Magical',
};

/** Shared with FightScreen's move rows and SwitchInPanel — a 4x must be the same green everywhere. */
export function multClass(mult: number): string {
  if (mult >= 4) return 'eff-quad-super';
  if (mult > 1) return 'eff-super';
  if (mult === 1) return 'eff-neutral';
  if (mult <= TYPE_MULT_FLOOR) return 'eff-quad-resist';
  return 'eff-resist';
}

export function formatMult(mult: number): string {
  return `${Math.round(mult * 100) / 100}×`;
}

interface Forecast {
  min: number;
  max: number;
  /** Fractions of the defender's MAX HP the two ends of the roll take off. */
  maxFraction: number;
  minFraction: number;
  /** Fraction of max HP the defender currently stands on, so the bite is drawn against what is left. */
  hpFraction: number;
  typeMult: number;
  /** 'sure' when even the worst roll finishes it, 'maybe' when only the best one does. */
  ko: 'sure' | 'maybe' | null;
}

/**
 * Runs the locked damage formula forward for both ends of the variance roll, through the engine's
 * own pipeline functions (calcDamage takes pre-rolled variance/crit, so no RNG). Every live term is
 * threaded in exactly as resolveRound reads it — docs/authoring-moves.md §5, "pass your new term in
 * or the forecast lies". Crit is excluded from the band and stated as a footnote instead.
 */
function forecastAgainst(move: MoveDefinition, ctx: MoveDossierContext, defenderId: string): Forecast | null {
  // A randomBasePower move authors no basePower, and a ramping one has outgrown its authored
  // figure; both forecast off the number the button is showing (state.ts resolveCastBasePower).
  const rolledBasePower = resolveCastBasePower(ctx.combat, ctx.attackerId, move, ctx.combat.combatants[ctx.attackerId]?.moveBasePowerBonuses);
  if (move.kind !== 'damage' || (move.basePower == null && rolledBasePower == null)) return null;
  const attacker = ctx.combat.combatants[ctx.attackerId];
  const defender = ctx.combat.combatants[defenderId];
  if (!attacker || !defender) return null;
  const attackerHero = allCombatants[attacker.heroId];
  const defenderHero = allCombatants[defender.heroId];
  if (!attackerHero || !defenderHero) return null;

  const fieldEffectCtx = { active: ctx.combat.activeFieldEffect, defs: fieldEffects, board: { state: ctx.combat, passives } };
  const ratio = resolveStatRatio(move.category, attackerHero, attacker, defenderHero, defender, fieldEffectCtx, move.offStatOverride);
  const modifiers: DamageModifier[] = collectPassiveDamageModifiers(attacker, move, passives);
  const forceBonus = resolveElementalForceBonus(attacker, move.type, statuses);
  const maxHp = getMaxHp(defenderHero, defender);
  // Read against THIS defender, so a conditional move forecasts per enemy.
  const conditionalMult = resolveConditionalPowerMultiplier(
    move,
    defender,
    attacker,
    fieldEffectCtx,
    maxHp,
    { currentHp: attacker.currentHp, maxHp: getMaxHp(attackerHero, attacker) },
    activePartnerTypes(ctx.combat, ctx.attackerId, allCombatants)
  );
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
        conditionalMult,
        rolledBasePower
      )
        .damage
    );

  const min = roll(VARIANCE_MIN);
  const max = roll(VARIANCE_MAX);
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

// One enemy's line: the bite is drawn out of the defender's own remaining track (docs/visual-language.md fixed-denominator idiom).
function ForecastRow({ move, ctx, defenderId }: { move: MoveDefinition; ctx: MoveDossierContext; defenderId: string }) {
  const defender = ctx.combat.combatants[defenderId];
  const hero = allCombatants[defender.heroId];
  if (!hero) return null;
  const forecast = forecastAgainst(move, ctx, defenderId);
  if (!forecast) return null;

  const { min, max, maxFraction, minFraction, hpFraction, typeMult, ko } = forecast;
  // The bite eats leftwards from the right-hand end of what is left, so a lethal hit reaches the origin instead of overflowing.
  const biteWidth = Math.min(maxFraction, hpFraction);
  const biteLeft = Math.max(0, hpFraction - maxFraction);
  // Where the worst roll would leave them — a notch inside the bite that turns a block into a range.
  const floorMark = Math.max(0, hpFraction - Math.min(minFraction, hpFraction));

  return (
    <div className="move-forecast-row">
      <HeroPortrait heroId={defender.heroId} className="move-forecast-portrait" seed={defenderId} />
      <div className="move-forecast-body">
      <div className="move-forecast-who">
        <span className="move-forecast-name">{hero.name}</span>
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
  /** Optional eyebrow above the name — LevelUpScreen's replace offer says which slot is being inspected. */
  label?: string;
  context?: MoveDossierContext;
  /** Who is casting, for screens with a hero but no live fight. A `context` supersedes it. Without either, a heal falls back to its authored HealPower. */
  caster?: HealCaster;
  /** Payload rows keep their one-line claim and drop the rule sentence under it — for a screen that has to fit a decision beneath the card. */
  terse?: boolean;
}

/** The move dossier: a live damage band, the priority bracket, and the mana left after casting. */
export function MoveDetailCard({ move: authored, label, context, caster, terse }: CardProps) {
  const attacker = context ? context.combat.combatants[context.attackerId] : undefined;
  const attackerHero = attacker ? allCombatants[attacker.heroId] : undefined;
  // A Class move wears its holder's type (state.ts): the live attacker's, else the caster's.
  const move = attackerHero ? moveForHero(authored, attackerHero) : caster ? moveForPrimaryType(authored, caster.types[0]) : authored;
  const typeColor = getTypeColor(move.type);
  const statCtx = { active: context?.combat.activeFieldEffect ?? null, defs: fieldEffects, board: context ? { state: context.combat, passives } : undefined };

  // Heals take STAB too (docs/combat.md "The healing formula").
  const healCaster: HealCaster | undefined =
    attacker && attackerHero
      ? {
          wisdom: getEffectiveStat(attackerHero, attacker, 'wisdom', statCtx),
          types: effectiveTypes(attackerHero, attacker),
          stats: Object.fromEntries(
            STAT_ORDER.map((stat) => [stat, getEffectiveStat(attackerHero, attacker, stat, statCtx)])
          ) as Record<StatKey, number>,
        }
      : caster;
  const heal = move.kind === 'heal' ? healReadout(move, healCaster) : null;
  const healTerms = healCaster && move.kind === 'heal' ? resolveHealFor(move, healCaster) : null;
  const stab =
    (move.kind === 'damage' || move.kind === 'heal') && healCaster ? resolveStab(move.type, healCaster.types) > 1 : false;
  const forceBonus = attacker ? resolveElementalForceBonus(attacker, move.type, statuses) : 0;
  // conditionalManaCost needs the board, so only a fight in scope prices it; otherwise the ramp-only price.
  const liveCost = context
    ? resolveManaCost(context.combat, context.attackerId, move, allCombatants)
    : effectiveManaCost(move, attacker?.moveManaDiscounts);
  // The ramp needs no board — only this hero's own accrual — so it reads off the attacker either way.
  const liveBasePower = move.basePowerGainOnUse ? effectiveBasePower(move, attacker?.moveBasePowerBonuses) : undefined;
  const manaAfter = attacker ? attacker.currentMana - liveCost : null;
  const manaPool = attacker && attackerHero ? getMaxMana(attackerHero, attacker) : null;

  const kindGlyph = moveKindGlyph(move);
  const statusApps = statusApplicationsOf(move);
  // Unknown ids are dropped rather than rendered as a blank row.
  const statusRiders = statusApps
    .map((app) => ({ app, def: statuses[app.statusId] }))
    .filter((r): r is { app: (typeof r)['app']; def: NonNullable<(typeof r)['def']> } => r.def != null);
  const fieldDef = move.fieldEffectApplication ? fieldEffects[move.fieldEffectApplication] : undefined;
  // Each conditionalPower form takes its own row; the status form is the fallthrough.
  const conditionalFieldId = move.conditionalPower?.requiresFieldEffect ?? '';
  const conditionalHpBelow = move.conditionalPower?.requiresTargetHpBelow;
  const conditionalUserHpBelow = move.conditionalPower?.requiresUserHpBelow;
  const conditionalPartnerType = move.conditionalPower?.requiresPartnerType;
  const livePartnerTypes = context ? activePartnerTypes(context.combat, context.attackerId, allCombatants) : null;
  const conditionalPartnerLive =
    conditionalPartnerType != null && (livePartnerTypes ?? []).includes(conditionalPartnerType);
  const conditionalStatusId = move.conditionalPower
    ? (move.conditionalPower.requiresTargetStatus ?? move.conditionalPower.requiresUserStatus ?? '')
    : '';
  const conditionalDef = conditionalStatusId ? statuses[conditionalStatusId] : undefined;
  // The dossier opens before a target is declared, so target-side conditions check ANY prospective defender.
  const conditionalHpLive = Boolean(
    conditionalHpBelow != null &&
      context?.defenderIds.some((id) => {
        const defender = context.combat.combatants[id];
        const hero = defender && allCombatants[defender.heroId];
        return defender && !defender.fainted && hero && defender.currentHp < getMaxHp(hero, defender) * conditionalHpBelow;
      })
  );
  const conditionalUserHpLive = Boolean(
    conditionalUserHpBelow != null &&
      attacker &&
      attackerHero &&
      attacker.currentHp < getMaxHp(attackerHero, attacker) * conditionalUserHpBelow
  );
  const conditionalFieldDef = conditionalFieldId ? fieldEffects[conditionalFieldId] : undefined;
  const conditionalFieldLive = Boolean(conditionalFieldId && context?.combat.activeFieldEffect?.fieldEffectId === conditionalFieldId);
  const detonateDef = move.detonatesStatus ? statuses[move.detonatesStatus] : undefined;
  const gateDef = move.requiresTargetStatus ? statuses[move.requiresTargetStatus] : undefined;
  const priorityDef = move.conditionalPriority ? statuses[move.conditionalPriority.requiresTargetStatus] : undefined;
  const livePriority =
    move.conditionalPriority &&
    context?.defenderIds.some((id) => {
      const defender = context.combat.combatants[id];
      return defender && !defender.fainted && hasStatus(defender, move.conditionalPriority!.requiresTargetStatus);
    })
      ? move.priority + move.conditionalPriority.bonus
      : move.priority;
  // Exactly one side of conditionalManaCost is ever set.
  const freeGate = move.conditionalManaCost
    ? move.conditionalManaCost.requiresAllEnemiesStatus ?? move.conditionalManaCost.requiresAnyEnemyStatus
    : undefined;
  const freeDef = freeGate ? statuses[freeGate] : undefined;
  const conditionalTargetField = move.conditionalTarget ? fieldEffects[move.conditionalTarget.requiresFieldEffect] : undefined;
  const hasPayload = Boolean(
    move.statDeltas?.length ||
      move.derivedStatDeltas ||
      move.manaGrant ||
      move.conditionalTarget ||
      statusApps.length ||
      move.cleanses ||
      move.fieldEffectApplication ||
      move.conditionalPower ||
      move.detonatesStatus ||
      move.requiresTargetStatus ||
      move.critChance != null ||
      move.drainPercent ||
      move.manaDiscountOnUse ||
      move.manaCostGainOnUse ||
      move.typeFollowsUser ||
      move.basePowerGainOnUse ||
      move.conditionalPriority ||
      move.conditionalManaCost ||
      move.conditionalStatDeltas ||
      move.switchesUserOut ||
      move.offStatOverride ||
      move.retributionPercent != null ||
      move.recoilPercent ||
      move.selfHpCost ||
      move.doublesStatReductions
  );

  const forecastIds = context && move.kind === 'damage' ? context.defenderIds : [];

  return (
    <div className={`move-detail-card${terse ? ' is-terse' : ''}`} style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}>
      {label && <div className="move-detail-label">{label}</div>}

      <div className="move-detail-head">
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
        <ManaCost cost={liveCost} />
      </div>

      <div className="move-detail-stats">
        {move.kind === 'damage' && move.basePower != null && (
          <span
            className="move-detail-stat"
            // The Base Power shown is PER HIT, so a multi-hit move has to say so here — the
            // number alone reads as the whole swing and would understate it threefold.
            title={move.hitCount ? `${move.basePower + forceBonus} Base Power on each of ${move.hitCount} hits` : undefined}
          >
            <MoveKindGlyph kind={kindGlyph} />
            <strong>{move.basePower + forceBonus}</strong>
            <span className="move-detail-unit">BP</span>
            {move.hitCount ? <span className="move-detail-unit">×{move.hitCount}</span> : null}
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
        {/* Hidden at exactly 1.00 — a caster on the reference Wisdom has no story to tell. */}
        {healTerms && healTerms.wisdomMult !== 1 && (
          <span className="move-detail-stat move-detail-stat-wis" title="Wisdom scales healing: ±1% per point off 50">
            <StatGlyph stat="wisdom" tone="inherit" />
            <strong>×{healTerms.wisdomMult.toFixed(2)}</strong>
            <span className="move-detail-unit">WIS</span>
          </span>
        )}
        {stab && (
          <span className="move-detail-stat move-detail-stat-stab" title="Same-Type Attack Bonus">
            <ElementGlyph type={move.type} />
            <strong>×1.25</strong>
            <span className="move-detail-unit">STAB</span>
          </span>
        )}
        {/* The LIVE bracket (conditionalPriority folded in), so a base-0 move can appear here. */}
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
          {move.manaGrant != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`+${move.manaGrant} MP to ${TARGET_MODE_LABELS[move.target].toLowerCase()}, past the pool`}
            />
          )}
          {move.statDeltas?.map(({ stat, amount }) => (
            <EffectRow
              key={stat}
              glyph={<StatGlyph stat={stat} />}
              text={`${amount >= 0 ? '+' : ''}${amount} ${STAT_LABELS[stat]} to ${(move.statDeltaTarget === 'bothAllies'
                ? TARGET_MODE_LABELS.bothAllies
                : move.statDeltaTarget === 'self'
                  ? TARGET_MODE_LABELS.self
                  : TARGET_MODE_LABELS[move.target]
              ).toLowerCase()}`}
              note={move.statDeltaChance != null ? `${Math.round(move.statDeltaChance * 100)}% chance, rolled per target` : undefined}
            />
          ))}
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
                if (!ids.length) return undefined;
                return banked > 0 ? `${banked} standing right now — this adds ${banked} more` : 'nothing is debuffed right now';
              })()}
            />
          )}
          {/* Read before the cost is paid, which is why it is not `manaAfter`. */}
          {move.derivedStatDeltas?.stats.map((stat) => (
            <EffectRow
              key={`derived-${stat}`}
              glyph={<StatGlyph stat={stat} />}
              text={
                attacker
                  ? `+${attacker.currentMana} ${STAT_LABELS[stat]} on ${TARGET_MODE_LABELS[move.target].toLowerCase()}`
                  : `+${STAT_LABELS[stat]} equal to your current Mana`
              }
              note="read before the cost is paid — overflow included"
            />
          ))}
          {move.conditionalTarget && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalTargetField?.flavorType ?? 'Arcane'} />}
              color={getTypeColor(conditionalTargetField?.flavorType ?? 'Arcane')}
              text={`Hits ${TARGET_MODE_LABELS[move.conditionalTarget.target].toLowerCase()} while ${
                conditionalTargetField?.name ?? move.conditionalTarget.requiresFieldEffect
              } is up`}
              note={
                context?.combat.activeFieldEffect?.fieldEffectId === move.conditionalTarget.requiresFieldEffect
                  ? 'up right now — this cast spreads'
                  : undefined
              }
            />
          )}
          {statusRiders.map(({ app, def }) => {
            const where = riderTargetLabel(app);
            // The number the caster would actually land, the way liveBasePower and liveCost read.
            // A hero sheet has no Combatant but does have the same two inputs the formula wants.
            const liveMagnitude =
              attacker && attackerHero
                ? scaleStatusMagnitude(app.magnitude, def, app, move, attackerHero, attacker, statCtx)
                : healCaster
                  ? resolveStatusMagnitudeFor(app.magnitude, def, app, move, { stats: healCaster.stats ?? {}, types: healCaster.types })
                  : app.magnitude;
            return (
              <EffectRow
                key={app.statusId}
                glyph={<StatusGlyph statusId={app.statusId} />}
                color={statusColor(app.statusId)}
                text={`${app.chance != null ? `${Math.round(app.chance * 100)}% ` : ''}${
                  grantsRatherThanInflicts(app) ? 'Grants' : 'Applies'
                } ${def.name}${
                  liveMagnitude != null ? ` ${liveMagnitude}` : app.duration != null ? ` ${app.duration}` : ''
                }${where ? ` — ${where}` : ''}`}
                note={statusFactsLine(def)}
              />
            );
          })}
          {/* The gate reads first: it is the only effect that can make the move unpressable. */}
          {move.requiresTargetStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.requiresTargetStatus} />}
              color={statusColor(move.requiresTargetStatus)}
              text={`Only targets ${gateDef?.name ?? move.requiresTargetStatus}`}
            />
          )}
          {move.conditionalPower && conditionalFieldId && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalFieldDef?.flavorType ?? 'Arcane'} />}
              color={getTypeColor(conditionalFieldDef?.flavorType ?? 'Arcane')}
              text={`×${move.conditionalPower.multiplier} power while ${conditionalFieldDef?.name ?? conditionalFieldId} is up`}
              note={conditionalFieldLive ? 'up right now' : undefined}
            />
          )}
          {move.conditionalPower && conditionalHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`×${move.conditionalPower.multiplier} power vs a target below ${Math.round(conditionalHpBelow * 100)}% HP`}
              note={conditionalHpLive ? 'a target is under the line right now' : 'read before the hit lands'}
            />
          )}
          {move.conditionalPower && conditionalUserHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`×${move.conditionalPower.multiplier} power while you are below ${Math.round(conditionalUserHpBelow * 100)}% HP`}
              note={conditionalUserHpLive ? 'under the line right now' : undefined}
            />
          )}
          {move.conditionalPower && conditionalPartnerType != null && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalPartnerType} />}
              color={getTypeColor(conditionalPartnerType)}
              text={`×${move.conditionalPower.multiplier} power while your partner is a ${conditionalPartnerType}`}
              note={conditionalPartnerLive ? 'your partner qualifies right now' : 'read off the active partner'}
            />
          )}
          {move.conditionalPower &&
            !conditionalFieldId &&
            conditionalPartnerType == null &&
            conditionalHpBelow == null &&
            conditionalUserHpBelow == null && (
            <EffectRow
              glyph={<StatusGlyph statusId={conditionalStatusId} />}
              color={statusColor(conditionalStatusId)}
              text={
                move.conditionalPower.requiresUserStatus
                  ? `×${move.conditionalPower.multiplier} power while you have ${conditionalDef?.name ?? conditionalStatusId}`
                  : `×${move.conditionalPower.multiplier} power vs ${conditionalDef?.name ?? conditionalStatusId}`
              }
              note={move.conditionalPower.consumesStatus ? `spends the ${conditionalDef?.name ?? conditionalStatusId}` : undefined}
            />
          )}
          {move.conditionalStatDeltas && (
            <EffectRow
              glyph={<ElementGlyph type={move.conditionalStatDeltas.requiresPartnerType} />}
              color={getTypeColor(move.conditionalStatDeltas.requiresPartnerType)}
              text={`×${move.conditionalStatDeltas.multiplier} stat grant while your partner is a ${move.conditionalStatDeltas.requiresPartnerType}`}
              note={
                (livePartnerTypes ?? []).includes(move.conditionalStatDeltas.requiresPartnerType)
                  ? 'your partner qualifies right now'
                  : 'read off the active partner'
              }
            />
          )}
          {move.detonatesStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.detonatesStatus} />}
              color={statusColor(move.detonatesStatus)}
              text={`Detonates ${detonateDef?.name ?? move.detonatesStatus} on contact`}
              note="pays out now, at its current magnitude — this move's own rider counts"
            />
          )}
          {move.critChance != null && (
            <EffectRow
              glyph={<MoveKindGlyph kind={move.kind === 'damage' ? move.category : 'buff'} />}
              text={`${Math.round(move.critChance * 100)}% crit chance · 1.5×`}
            />
          )}
          {move.drainPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`Heals ${Math.round(move.drainPercent * 100)}% of damage dealt`}
              note="unscaled by Wisdom or STAB"
            />
          )}
          {move.offStatOverride && (
            <EffectRow
              glyph={<StatGlyph stat={move.offStatOverride} />}
              text={`Uses ${STAT_LABELS[move.offStatOverride]} in place of ${STAT_LABELS[move.category === 'physical' ? 'attack' : 'intelligence']}`}
              note={
                attacker && attackerHero
                  ? `${getEffectiveStat(attackerHero, attacker, move.offStatOverride, statCtx)} right now — defended by ${STAT_LABELS[move.category === 'physical' ? 'defense' : 'wisdom']} as usual`
                  : `defended by ${STAT_LABELS[move.category === 'physical' ? 'defense' : 'wisdom']} as usual`
              }
            />
          )}
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
                  ? `${Math.round(move.retributionPercent * 100)}% of the ${attacker.damageTakenSinceLastTurn} taken since this hero last acted · fixed: no chart, variance or crit`
                  : 'fixed damage: no chart, variance or crit'
              }
            />
          )}
          {move.recoilPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`Costs ${Math.round(move.recoilPercent * 100)}% of damage dealt as recoil`}
              note="no floor — can KO the caster"
            />
          )}
          {move.selfHpCost != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={
                move.selfHpCost.mode === 'percentMaxHp'
                  ? `Costs the user ${Math.round(move.selfHpCost.amount * 100)}% of max HP`
                  : `Drops the user to ${move.selfHpCost.amount} HP`
              }
              note={
                move.selfHpCost.mode === 'percentMaxHp'
                  ? 'paid after the hit · no floor — can KO the caster'
                  : 'paid after the hit · never heals'
              }
            />
          )}
          {move.cleanses && (
            <EffectRow
              glyph={<MoveKindGlyph kind="buff" />}
              text={
                move.cleanseCount != null
                  ? `Cleanses ${move.cleanseCount} negative ${move.cleanseCount === 1 ? 'status' : 'statuses'} at random`
                  : 'Cleanses every negative status'
              }
            />
          )}
          {move.basePowerGainOnUse && (
            <EffectRow
              glyph={<MoveKindGlyph kind={move.category} />}
              text={`+${move.basePowerGainOnUse.amount} Base Power each use`}
              note={
                attacker
                  ? `${liveBasePower} now, ${Math.min(
                      move.basePowerGainOnUse.max,
                      (liveBasePower ?? 0) + move.basePowerGainOnUse.amount
                    )} after this cast · up to ${move.basePowerGainOnUse.max}, this fight`
                  : `up to ${move.basePowerGainOnUse.max}, this hero, this fight`
              }
            />
          )}
          {move.manaCostGainOnUse != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`+${move.manaCostGainOnUse} mana each use`}
              note={
                attacker
                  ? `costs ${liveCost} now, ${liveCost + move.manaCostGainOnUse} after this cast · this fight`
                  : 'this hero, this fight'
              }
            />
          )}
          {move.typeFollowsUser && (
            <EffectRow
              glyph={<ElementGlyph type={move.type} />}
              color={getTypeColor(move.type)}
              text="Wears the user's type"
              note="Class move · always STAB"
            />
          )}
          {move.manaDiscountOnUse != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`−${move.manaDiscountOnUse} mana each use`}
              note={
                attacker
                  ? `costs ${liveCost} now, ${Math.max(0, liveCost - move.manaDiscountOnUse)} after this cast · this fight`
                  : 'this hero, this fight'
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
              note="read when the round is ordered"
            />
          )}
          {move.conditionalManaCost && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`${move.conditionalManaCost.manaCost} mana while ${
                move.conditionalManaCost.requiresAllEnemiesStatus ? 'both enemies carry' : 'an enemy carries'
              } ${freeDef?.name ?? freeGate}`}
              note={attacker ? `costs ${liveCost} right now` : `${move.manaCost} otherwise`}
            />
          )}
          {move.switchesUserOut && (
            <EffectRow
              glyph={<MoveKindGlyph kind="buff" />}
              text="Then switch out"
              note="payload first, then the bench · refused once locked in at 2 KOs"
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

      {forecastIds.length > 0 && context && (
        <div className="move-detail-forecast">
          <div className="move-detail-eyebrow">Forecast</div>
          {forecastIds.map((id) => (
            <ForecastRow key={id} move={move} ctx={context} defenderId={id} />
          ))}
          <div className="move-detail-footnote">
            Variance {VARIANCE_MIN}–{VARIANCE_MAX} · crit ×1.5{move.critChance != null ? ` at ${Math.round(move.critChance * 100)}%` : ''}
          </div>
        </div>
      )}
    </div>
  );
}

// Portalled into overlayHost(), never document.body — see overlayHost.ts.
export function MoveDetailOverlay({
  move,
  context,
  caster,
  onClose,
}: {
  move: MoveDefinition;
  context?: MoveDossierContext;
  /** Who is casting, for screens that hold a hero but no live fight. Superseded by `context`. */
  caster?: HealCaster;
  onClose: () => void;
}) {
  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div
        className="detail-panel move-detail-panel"
        /* Set here as well as on the card: the panel's wash must reach the modal's edges, and a custom property only travels down. */
        style={{ borderTopColor: getTypeColor(move.type), '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}
        onClick={closeAndStop}
      >
        <MoveDetailCard move={move} context={context} caster={caster} />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
