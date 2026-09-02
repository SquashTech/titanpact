import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { MoveDefinition } from '../../engine/content';
import { statusApplicationsOf } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { activePartnerTypes, effectiveManaCost, effectiveTypes, getEffectiveStat, getMaxHp, getMaxMana, hasStatus, resolveManaCost, resolveRandomBasePower } from '../../engine/state';
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
  // A randomBasePower move authors no basePower; it forecasts off this round's rolled figure.
  const rolledBasePower = resolveRandomBasePower(ctx.combat, ctx.attackerId, move);
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
}

const SCALES_BASE_POWER = 'scales base power, not the finished hit';

/** The move dossier: a live damage band, the priority bracket, and the mana left after casting. */
export function MoveDetailCard({ move, label, context, caster }: CardProps) {
  const typeColor = getTypeColor(move.type);
  const attacker = context ? context.combat.combatants[context.attackerId] : undefined;
  const attackerHero = attacker ? allCombatants[attacker.heroId] : undefined;
  const statCtx = { active: context?.combat.activeFieldEffect ?? null, defs: fieldEffects, board: context ? { state: context.combat, passives } : undefined };

  // Heals take STAB too (docs/combat.md "The healing formula").
  const healCaster: HealCaster | undefined =
    attacker && attackerHero
      ? {
          wisdom: getEffectiveStat(attackerHero, attacker, 'wisdom', statCtx),
          types: effectiveTypes(attackerHero, attacker),
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
    <div className="move-detail-card" style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}>
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
              text={`Gives ${move.manaGrant} MP to ${TARGET_MODE_LABELS[move.target].toLowerCase()}`}
              note="overflows past the pool and stays there — nothing takes it back but spending it"
            />
          )}
          {move.statDeltas?.map(({ stat, amount }) => (
            <EffectRow
              key={stat}
              glyph={<StatGlyph stat={stat} />}
              text={`${amount >= 0 ? '+' : ''}${amount} ${STAT_LABELS[stat]}`}
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
              note={
                attacker
                  ? 'your Mana as it stands BEFORE this move is paid for — overflow included'
                  : 'no fixed amount: it is whatever the caster is holding when they press it'
              }
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
                  ? 'the field is up right now — this cast spreads'
                  : 'read when the move lands, so a partner setting the field earlier this round already counts'
              }
            />
          )}
          {statusRiders.map(({ app, def }) => {
            const where = riderTargetLabel(app);
            return (
              <EffectRow
                key={app.statusId}
                glyph={<StatusGlyph statusId={app.statusId} />}
                color={statusColor(app.statusId)}
                text={`${app.chance != null ? `${Math.round(app.chance * 100)}% ` : ''}${
                  grantsRatherThanInflicts(app) ? 'Grants' : 'Applies'
                } ${def.name}${
                  app.magnitude != null ? ` ${app.magnitude}` : app.duration != null ? ` ${app.duration}` : ''
                }${where ? ` — ${where}` : ''}`}
                note={def.description}
              />
            );
          })}
          {/* The gate reads first: it is the only effect that can make the move unpressable. */}
          {move.requiresTargetStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.requiresTargetStatus} />}
              color={statusColor(move.requiresTargetStatus)}
              text={`Only targets ${gateDef?.name ?? move.requiresTargetStatus}`}
              note="no legal target, and no way to declare it, unless the status is already out there"
            />
          )}
          {move.conditionalPower && conditionalFieldId && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalFieldDef?.flavorType ?? 'Arcane'} />}
              color={getTypeColor(conditionalFieldDef?.flavorType ?? 'Arcane')}
              text={`×${move.conditionalPower.multiplier} power while ${conditionalFieldDef?.name ?? conditionalFieldId} is up`}
              note={
                conditionalFieldLive
                  ? `${SCALES_BASE_POWER} — and ${conditionalFieldDef?.name ?? conditionalFieldId} is up right now`
                  : `${SCALES_BASE_POWER} — the field is global, so either side setting it arms this move`
              }
            />
          )}
          {move.conditionalPower && conditionalHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`×${move.conditionalPower.multiplier} power vs a target below ${Math.round(conditionalHpBelow * 100)}% HP`}
              note={
                conditionalHpLive
                  ? `${SCALES_BASE_POWER} — and someone out there is already under the line`
                  : `${SCALES_BASE_POWER} — read BEFORE this hit lands, so it never doubles off HP it is about to take`
              }
            />
          )}
          {move.conditionalPower && conditionalUserHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`×${move.conditionalPower.multiplier} power while you are below ${Math.round(conditionalUserHpBelow * 100)}% HP`}
              note={
                conditionalUserHpLive
                  ? `${SCALES_BASE_POWER} — and this hero is already under the line`
                  : `${SCALES_BASE_POWER} — asked once per cast, so every hit gets it or none does`
              }
            />
          )}
          {move.conditionalPower && conditionalPartnerType != null && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalPartnerType} />}
              color={getTypeColor(conditionalPartnerType)}
              text={`×${move.conditionalPower.multiplier} power while your partner is a ${conditionalPartnerType}`}
              note={
                conditionalPartnerLive
                  ? `${SCALES_BASE_POWER} — and the hero beside you qualifies right now`
                  : `${SCALES_BASE_POWER} — read off the ACTIVE partner, so switching one in turns it on`
              }
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
              note={
                move.conditionalPower.consumesStatus
                  ? `${SCALES_BASE_POWER} — and spends the ${conditionalDef?.name ?? conditionalStatusId} it cashed in`
                  : move.conditionalPower.requiresUserStatus
                    ? `${SCALES_BASE_POWER} — read off THIS hero, so a partner granting it earlier in the round already counts`
                    : SCALES_BASE_POWER
              }
            />
          )}
          {move.conditionalStatDeltas && (
            <EffectRow
              glyph={<ElementGlyph type={move.conditionalStatDeltas.requiresPartnerType} />}
              color={getTypeColor(move.conditionalStatDeltas.requiresPartnerType)}
              text={`×${move.conditionalStatDeltas.multiplier} stat grant while your partner is a ${move.conditionalStatDeltas.requiresPartnerType}`}
              note={
                (livePartnerTypes ?? []).includes(move.conditionalStatDeltas.requiresPartnerType)
                  ? 'the hero beside you qualifies right now, so this lands at the doubled figure'
                  : 'read off the ACTIVE partner when the buff lands — the bench does not count'
              }
            />
          )}
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
          {move.drainPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`Heals ${Math.round(move.drainPercent * 100)}% of damage dealt`}
              note="a share of the hit itself — Wisdom and STAB do not scale it"
            />
          )}
          {move.offStatOverride && (
            <EffectRow
              glyph={<StatGlyph stat={move.offStatOverride} />}
              text={`Uses ${STAT_LABELS[move.offStatOverride]} in place of ${STAT_LABELS[move.category === 'physical' ? 'attack' : 'intelligence']}`}
              note={
                attacker && attackerHero
                  ? `${getEffectiveStat(attackerHero, attacker, move.offStatOverride, statCtx)} right now — the target still defends with its own ${STAT_LABELS[move.category === 'physical' ? 'defense' : 'wisdom']}`
                  : 'the defending stat is unchanged — only the attacking one moves'
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
                  ? `${Math.round(move.retributionPercent * 100)}% of the ${attacker.damageTakenSinceLastTurn} taken since this hero last acted — fixed damage, no type chart, no variance, no crit`
                  : 'fixed damage — the type chart, variance and crit do not apply'
              }
            />
          )}
          {move.recoilPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              text={`Costs ${Math.round(move.recoilPercent * 100)}% of damage dealt as recoil`}
              note="a share of the hit itself — and there is no floor, so it can knock the caster out"
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
                  ? 'paid after the effect lands — and there is no floor, so it can knock the caster out'
                  : 'paid after the damage lands, and never heals — a caster already lower stays there'
              }
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
              text={`${move.conditionalManaCost.manaCost} mana while ${
                move.conditionalManaCost.requiresAllEnemiesStatus ? 'both enemies carry' : 'an enemy carries'
              } ${freeDef?.name ?? freeGate}`}
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

      {forecastIds.length > 0 && context && (
        <div className="move-detail-forecast">
          <div className="move-detail-eyebrow">Forecast</div>
          {forecastIds.map((id) => (
            <ForecastRow key={id} move={move} ctx={context} defenderId={id} />
          ))}
          <div className="move-detail-footnote">
            Range is the 0.85–1.0 variance roll. A crit multiplies it by 1.5
            {move.critChance != null ? ` (${Math.round(move.critChance * 100)}% on this move)` : ''}.
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
