import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { MoveDefinition, StatKey } from '../../engine/content';
import { statusApplicationsOf, STAT_ORDER } from '../../engine/content';
import type { CombatState } from '../../engine/state';
import { effectiveManaCost, effectiveTypes, getEffectiveStat, getMaxMana, effectiveBasePower, hasStatus, resolveManaCost, moveForHero, moveForPrimaryType } from '../../engine/state';
import { allCombatants } from '../../data/content';
import { statuses } from '../../data/statuses';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { resolveStab, resolveTypeMult, TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { fieldHealMultiplier, resolveHealFor, resolveHealForceBonus, type HealCaster } from '../../engine/heal/healPipeline';
import { resolveStatusMagnitudeFor, scaleStatusMagnitude } from '../../engine/status/statusMagnitude';
import { resolveElementalForceBonus, VARIANCE_MAX, VARIANCE_MIN } from '../../engine/damage/damagePipeline';
import { getTypeColor, getTypeColorRgb } from './typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { StatGlyph, MoveKindGlyph } from '../shared/statIcons';
import { StatusGlyph, statusColor } from '../shared/statusIcons';
import { statusAmountText, statusFactsLine } from '../shared/statusFacts';
import { fieldEffectFactsLine } from '../shared/fieldEffectFacts';
import { STAT_LABELS, hpTier } from '../shared/StatBars';
import { ManaCost } from '../shared/ManaCost';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TARGET_MODE_LABELS, restoresChargesText, grantsRatherThanInflicts, healReadout, moveKindGlyph, moveKindLabel, riderMagnitude, riderTargetLabel } from '../shared/MoveTile';
import { stageText } from '../shared/moveKind';
import { overlayHost } from '../shared/overlayHost';
import { ChargePips } from '../shared/ChargePips';
import { forecastDamage, koLabel } from './forecast';
import { ForecastBite } from './ForecastBite';
import { MoveName, MoveStrip, MoveStub, SeatArrow, TargetFigures } from '../shared/MoveStrip';
import { IconText } from '../shared/IconText';
import { typeChart } from '../../data/typechart';
import { moveKeywords, type MoveKeywordId } from '../../data/keywords';

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

/** The defenders laid into their side's two slots, so the forecast reads left and right as the arena does. */
function forecastSeats(ctx: MoveDossierContext, ids: readonly string[]): (string | null)[] {
  const side = ctx.combat.combatants[ids[0]]?.side;
  if (!side) return [...ids];
  return ctx.combat.active[side].map((id) => (id && ids.includes(id) ? id : null));
}

/** The type matchup alone, for the row's seat arrow. */
function seatMult(move: MoveDefinition, ctx: MoveDossierContext, defenderId: string): number {
  const defender = ctx.combat.combatants[defenderId];
  const hero = allCombatants[defender.heroId];
  return hero ? resolveTypeMult(typeChart, move.type, effectiveTypes(hero, defender)) : 1;
}

// One enemy's seat: the bite is drawn out of the defender's own remaining track (docs/visual-language.md fixed-denominator idiom).
function ForecastSeat({ move, ctx, defenderId }: { move: MoveDefinition; ctx: MoveDossierContext; defenderId: string }) {
  const defender = ctx.combat.combatants[defenderId];
  const hero = allCombatants[defender.heroId];
  if (!hero) return null;
  const forecast = forecastDamage(move, ctx.combat, ctx.attackerId, defenderId);
  if (!forecast) return null;

  const { min, max, maxFraction, minFraction, hpFraction, typeMult, koChance } = forecast;
  const ko = koLabel(koChance);

  return (
    <div className="move-dossier-seat">
      <div className="move-dossier-seat-who">
        <HeroPortrait heroId={defender.heroId} pathId={defender.formPathId} className="move-dossier-seat-portrait" seed={defenderId} />
        <div className="move-dossier-seat-id">
          <span className="move-forecast-name">{hero.name}</span>
          <span className="move-dossier-seat-types">
            {effectiveTypes(hero, defender).map((t) => (
              <span key={t} className="move-forecast-type" style={{ color: getTypeColor(t) }} title={t}>
                <ElementGlyph type={t} />
              </span>
            ))}
          </span>
        </div>
        <span className="move-dossier-seat-mult">
          <SeatArrow mult={typeMult} />
          <span className={`move-forecast-mult ${multClass(typeMult)}`}>{formatMult(typeMult)}</span>
        </span>
      </div>
      <div className="move-dossier-seat-damage">
        <span className="move-forecast-numbers">
          {min === max ? min : `${min}–${max}`}
          <span className="move-forecast-of"> / {defender.currentHp}</span>
        </span>
        {ko && <span className={`move-forecast-ko ${ko === 'KO' ? 'is-sure' : 'is-maybe'}`}>{ko}</span>}
      </div>
      <div className={`move-forecast-track ${hpTier(hpFraction)}`}>
        <div className="move-forecast-hp" style={{ width: `${hpFraction * 100}%` }} />
        <ForecastBite hpFraction={hpFraction} minFraction={minFraction} maxFraction={maxFraction} />
      </div>
    </div>
  );
}

/** A payload the move carries beyond its damage — one glyph, one sentence. */
/** The claim with the row's own marks in it: chevrons in their colours, and the target's figure before its name. */
function EffectClaim({ text, target }: { text: string; target?: MoveDefinition['target'] }) {
  const label = target ? TARGET_MODE_LABELS[target].toLowerCase() : '';
  const at = label ? text.toLowerCase().lastIndexOf(label) : -1;
  if (at < 0 || !target) return <IconText text={text} glyphs={false} />;
  return (
    <>
      <IconText text={text.slice(0, at)} glyphs={false} />
      <TargetFigures target={target} small />
      <span className="move-detail-effect-target">{text.slice(at)}</span>
    </>
  );
}

function EffectRow({
  glyph,
  keyword,
  head,
  text,
  note,
  color,
  target,
}: {
  glyph: ReactNode;
  keyword?: MoveKeywordId;
  /** A condition as the row's gold head, in place of a keyword ("vs Burn", "Last Charge"). */
  head?: string;
  text: string;
  note?: string;
  color?: string;
  /** Who the claim names, drawn as the row's figure before the words. */
  target?: MoveDefinition['target'];
}) {
  return (
    <div className="move-detail-effect-row" style={color ? ({ color } as CSSProperties) : undefined}>
      <span className="move-detail-effect-glyph">{glyph}</span>
      <span className="move-detail-effect-text">
        {(head ?? keyword) && <><span className="kw-badge">{head ?? moveKeywords[keyword!]}</span> </>}
        <EffectClaim text={text} target={target} />
        {note && (
          <span className="move-detail-effect-note">
            <IconText text={note} />
          </span>
        )}
      </span>
    </div>
  );
}

interface CardProps {
  move: MoveDefinition;
  context?: MoveDossierContext;
  /** Who is casting, for screens with a hero but no live fight. A `context` supersedes it. Without either, a heal falls back to its authored HealPower. */
  caster?: HealCaster;
  /** Payload rows keep their one-line claim and drop the rule sentence under it — for a screen that has to fit a decision beneath the card. */
  terse?: boolean;
  /** Cast by the companion's Call (docs/companion-call.md §3.1): it costs no mana, so no price and no mana left is shown. */
  free?: boolean;
}

/** The move dossier: a live damage band, the priority bracket, and the mana left after casting. */
export function MoveDetailCard({ move: authored, context, caster, terse, free }: CardProps) {
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
          fieldMult: fieldHealMultiplier(statCtx),
          healPowerBonus: resolveHealForceBonus(attacker, statuses),
        }
      : caster;
  const heal = move.kind === 'heal' ? healReadout(move, healCaster) : null;
  const healTerms = healCaster && move.kind === 'heal' ? resolveHealFor(move, healCaster) : null;
  const activeFieldName = context?.combat.activeFieldEffect ? fieldEffects[context.combat.activeFieldEffect.fieldEffectId]?.name ?? '' : '';
  const stab =
    (move.kind === 'damage' || move.kind === 'heal') && healCaster ? resolveStab(move.type, healCaster.types) > 1 : false;
  const forceBonus = attacker ? resolveElementalForceBonus(attacker, move, statuses) : 0;
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
  const conditionalReduced = move.conditionalPower?.requiresTargetStatReduction === true;
  const conditionalUserHpBelow = move.conditionalPower?.requiresUserHpBelow;
  const conditionalPartnerType = move.conditionalPower?.requiresPartnerType;
  const conditionalStatusId = move.conditionalPower
    ? (move.conditionalPower.requiresTargetStatus ?? move.conditionalPower.requiresUserStatus ?? '')
    : '';
  const conditionalDef = conditionalStatusId ? statuses[conditionalStatusId] : undefined;
  const conditionalFieldDef = conditionalFieldId ? fieldEffects[conditionalFieldId] : undefined;
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
    move.mpRegenGrant != null ||
    move.clearsRaisedStages ||
      move.doublesStages ||
      move.stagesPerManaHeld ||
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
      move.chargesPerFight != null ||
      move.restoresCharges ||
      move.tags?.includes('slice') ||
      move.typeFollowsUser ||
      move.basePowerGainOnUse ||
      move.randomBasePower ||
      move.conditionalPriority ||
      move.conditionalManaCost ||
      move.conditionalStatDeltas ||
      move.switchesUserOut ||
      move.offStatOverride ||
      move.retributionPercent != null ||
      move.recoilPercent ||
      move.selfHpCost
  );

  const forecastIds = context && move.kind === 'damage' ? context.defenderIds : [];
  const stubValue =
    move.kind === 'damage'
      ? move.randomBasePower
        ? `${move.randomBasePower.min + forceBonus}–${move.randomBasePower.max + forceBonus}`
        : (liveBasePower ?? move.basePower ?? 0) + forceBonus
      : heal?.value;
  const stubTitle =
    move.kind !== 'damage'
      ? undefined
      : [move.hitCount ? `Base Power on each of ${move.hitCount} hits` : 'Base Power', forceBonus > 0 ? `+${forceBonus} from Elemental Force` : '']
          .filter(Boolean)
          .join(' · ');

  return (
    <div className={`move-detail-card${terse ? ' is-terse' : ''}`} style={{ '--move-type-rgb': getTypeColorRgb(move.type) } as CSSProperties}>

      {/* The combat row itself, drawn as a band of the card; everything under it explains it. */}
      <div className="move-button has-stub move-dossier-row">
        <div className="move-row-top">
          {!free && <ManaCost cost={liveCost} />}
          <span className="move-type-code" title={move.type}>
            <ElementGlyph type={move.type} />
          </span>
          <MoveName text={move.name} />
          <ChargePips move={move} combatant={attacker} />
          <MoveStrip
            move={move}
            amountOf={(app) => riderMagnitude(move, app, healCaster)}
            live={{
              seats: context && move.kind === 'damage' ? forecastSeats(context, context.defenderIds).map((id) => (id ? seatMult(move, context, id) : null)) : undefined,
              banked: attacker?.damageTakenSinceLastTurn,
              cost: context ? liveCost : undefined,
              power: attacker ? (liveBasePower ?? move.basePower) : undefined,
            }}
          />
        </div>
        <MoveStub move={move} value={stubValue} boosted={forceBonus > 0} title={stubTitle} />
      </div>

      <div className="move-dossier-body">
      <div className="move-dossier-meta">
        {/* Each word beside the icon the row draws for it, so the row's icons are learned here. */}
        <span className="move-dossier-term" style={{ color: typeColor }}>
          <ElementGlyph type={move.type} />
          {move.type}
        </span>
        <span className="move-detail-sep">·</span>
        <span className={`move-dossier-term move-dossier-kind is-${kindGlyph}`}>
          <MoveKindGlyph kind={kindGlyph} />
          {move.kind === 'damage' ? PIPELINE_WORDS[move.category] : moveKindLabel(move)}
        </span>
        <span className="move-dossier-target">
          <TargetFigures target={move.target} small />
          <span>{TARGET_MODE_LABELS[move.target]}</span>
        </span>
      </div>
      {hasPayload && (
        <div className="move-detail-effects">
          {move.manaGrant != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`+${move.manaGrant} MP, past the pool, to ${TARGET_MODE_LABELS[move.target].toLowerCase()}`}
              target={move.target}
            />
          )}
          {move.mpRegenGrant != null && (
            <EffectRow glyph={<StatGlyph stat="mpRegen" />} text={`+${move.mpRegenGrant} ${STAT_LABELS.mpRegen} to ${TARGET_MODE_LABELS[move.target].toLowerCase()}`} target={move.target} />
          )}
          {move.clearsRaisedStages && (
            <EffectRow glyph={<StatGlyph stat="attack" />} text={`Any raised stat on ${TARGET_MODE_LABELS[move.target].toLowerCase()} returns to normal first`} target={move.target} />
          )}
          {move.doublesStages?.map((stat) => (
            <EffectRow key={`doubles-${stat}`} glyph={<StatGlyph stat={stat} />} text={`Doubles ${STAT_LABELS[stat]} steps on ${TARGET_MODE_LABELS[move.target].toLowerCase()}`} target={move.target} />
          ))}
          {/* Read before the cost is paid, which is why it is not `manaAfter`. */}
          {move.stagesPerManaHeld?.stats.map((stat) => (
            <EffectRow
              key={`mana-steps-${stat}`}
              glyph={<StatGlyph stat={stat} />}
              text={
                attacker
                  ? Math.floor(attacker.currentMana / move.stagesPerManaHeld!.per) > 0
                    ? `${stageText(stat, Math.min(move.stagesPerManaHeld!.max, Math.floor(attacker.currentMana / move.stagesPerManaHeld!.per)))} on ${TARGET_MODE_LABELS[move.target].toLowerCase()}`
                    : `No ${STAT_LABELS[stat]} step below ${move.stagesPerManaHeld!.per} Mana`
                  : `${STAT_LABELS[stat]} ▲ per ${move.stagesPerManaHeld!.per} Mana held, up to ${'▲'.repeat(move.stagesPerManaHeld!.max)}`
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
            />
          )}
          {/* The gate reads first: it is the only effect that can make the move unpressable. */}
          {move.requiresTargetStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.requiresTargetStatus} />}
              color={statusColor(move.requiresTargetStatus)}
              text={`Only targets ${gateDef?.adjective ?? gateDef?.name ?? move.requiresTargetStatus} foes`}
            />
          )}
          {move.conditionalPower && conditionalFieldId && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalFieldDef?.flavorType ?? 'Arcane'} />}
              color={getTypeColor(conditionalFieldDef?.flavorType ?? 'Arcane')}
              head={conditionalFieldDef?.name ?? conditionalFieldId}
              text={`×${move.conditionalPower.multiplier} power`}
            />
          )}
          {move.conditionalPower && conditionalHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              head={`Target below ${Math.round(conditionalHpBelow * 100)}% HP`}
              text={`×${move.conditionalPower.multiplier} power`}
            />
          )}
          {move.conditionalPower && conditionalReduced && (
            <EffectRow
              glyph={<StatGlyph stat="intelligence" />}
              head="Debuffed target"
              text={`×${move.conditionalPower.multiplier} power`}
            />
          )}
          {move.conditionalPower && conditionalUserHpBelow != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              head={`Below ${Math.round(conditionalUserHpBelow * 100)}% HP`}
              text={`×${move.conditionalPower.multiplier} power`}
            />
          )}
          {move.conditionalPower && conditionalPartnerType != null && (
            <EffectRow
              glyph={<ElementGlyph type={conditionalPartnerType} />}
              color={getTypeColor(conditionalPartnerType)}
              head={`${conditionalPartnerType} partner`}
              text={`×${move.conditionalPower.multiplier} power`}
            />
          )}
          {move.conditionalPower?.requiresLastCharge && (
            <EffectRow
              glyph={<ChargePips move={move} combatant={attacker} />}
              head="Last Charge"
              text={`×${move.conditionalPower.multiplier} power`}
            />
          )}
          {move.conditionalPower &&
            !move.conditionalPower.requiresLastCharge &&
            !conditionalFieldId &&
            conditionalPartnerType == null &&
            conditionalHpBelow == null &&
            !conditionalReduced &&
            conditionalUserHpBelow == null && (
            <EffectRow
              glyph={<StatusGlyph statusId={conditionalStatusId} />}
              color={statusColor(conditionalStatusId)}
              head={`${move.conditionalPower.requiresUserStatus ? 'While' : 'vs'} ${conditionalDef?.adjective ?? conditionalDef?.name ?? conditionalStatusId}`}
              text={`×${move.conditionalPower.multiplier} power${move.conditionalPower.consumesStatus ? `, then removes the ${conditionalDef?.name ?? conditionalStatusId}` : ''}`}
            />
          )}
          {move.conditionalStatDeltas && (
            <EffectRow
              glyph={<ElementGlyph type={move.conditionalStatDeltas.requiresPartnerType} />}
              color={getTypeColor(move.conditionalStatDeltas.requiresPartnerType)}
              text={`×${move.conditionalStatDeltas.multiplier} stat grant while your partner is a ${move.conditionalStatDeltas.requiresPartnerType}`}
            />
          )}
          {move.detonatesStatus && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.detonatesStatus} />}
              color={statusColor(move.detonatesStatus)}
              text={`Detonates ${detonateDef?.name ?? move.detonatesStatus} on contact`}
            />
          )}
          {move.critChance != null && (
            <EffectRow
              glyph={<MoveKindGlyph kind={move.kind === 'damage' ? move.category : 'buff'} />}
              keyword="crit"
              text={`${Math.round(move.critChance * 100)}% chance, 1.5× damage`}
            />
          )}
          {move.drainPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              keyword="drain"
              text={`Heals ${Math.round(move.drainPercent * 100)}% of the damage dealt`}
            />
          )}
          {move.offStatOverride && (
            <EffectRow
              glyph={<StatGlyph stat={move.offStatOverride} />}
              text={`Uses ${STAT_LABELS[move.offStatOverride]} in place of ${STAT_LABELS[move.category === 'physical' ? 'attack' : 'intelligence']}`}
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
            />
          )}
          {move.recoilPercent != null && (
            <EffectRow
              glyph={<StatGlyph stat="hp" />}
              keyword="recoil"
              text={`Loses ${Math.round(move.recoilPercent * 100)}% of the damage dealt`}
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
            />
          )}
          {move.cleanses && (
            <EffectRow
              glyph={<MoveKindGlyph kind="buff" />}
              keyword="cleanse"
              text={
                move.cleanseCount != null
                  ? `${move.cleanseCount} negative ${move.cleanseCount === 1 ? 'status' : 'statuses'} at random`
                  : 'Every negative status'
              }
            />
          )}
          {move.randomBasePower && (
            <EffectRow
              glyph={<MoveKindGlyph kind={move.category} />}
              text={`Base Power rolls ${move.randomBasePower.min}–${move.randomBasePower.max} each round`}
            />
          )}
          {move.basePowerGainOnUse && (
            <EffectRow
              glyph={<MoveKindGlyph kind={move.category} />}
              text={`+${move.basePowerGainOnUse.amount} Base Power each use`}
            />
          )}
          {move.tags?.includes('slice') && (
            <EffectRow glyph={<MoveKindGlyph kind="physical" />} keyword="slice" text="A cutting move, of any type" />
          )}
          {move.restoresCharges && (
            <EffectRow glyph={<MoveKindGlyph kind="buff" />} text={restoresChargesText(move.restoresCharges)} />
          )}
          {move.chargesPerFight != null && (
            <EffectRow
              glyph={<ChargePips move={move} combatant={attacker} />}
              keyword="charges"
              text={`${move.chargesPerFight}`}
            />
          )}
          {/* Only while the type is unresolved: drawn at a hero's type (the Academy, the fight), the badge already says it. */}
          {move.typeFollowsUser && !attacker && !caster && (
            <EffectRow
              glyph={<ElementGlyph type={move.type} />}
              color={getTypeColor(move.type)}
              text="Wears the user's type"
            />
          )}
          {move.manaDiscountOnUse != null && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`Costs ${move.manaDiscountOnUse} less each use`}
            />
          )}
          {move.conditionalPriority && (
            <EffectRow
              glyph={<StatusGlyph statusId={move.conditionalPriority.requiresTargetStatus} />}
              color={statusColor(move.conditionalPriority.requiresTargetStatus)}
              text={`${move.conditionalPriority.bonus >= 0 ? '+' : ''}${move.conditionalPriority.bonus} priority vs ${
                priorityDef?.adjective ?? priorityDef?.name ?? move.conditionalPriority.requiresTargetStatus
              }`}
            />
          )}
          {move.conditionalManaCost && (
            <EffectRow
              glyph={<StatGlyph stat="manaPool" />}
              text={`${move.conditionalManaCost.manaCost} mana while ${
                move.conditionalManaCost.requiresAllEnemiesStatus ? 'both foes are' : 'a foe is'
              } ${freeDef?.adjective ?? freeDef?.name ?? freeGate}`}
            />
          )}
          {move.switchesUserOut && (
            <EffectRow
              glyph={<MoveKindGlyph kind="buff" />}
              keyword="pivot"
              text="Switches out after the move"
            />
          )}
          {fieldDef && (
            <EffectRow
              glyph={<ElementGlyph type={fieldDef.flavorType ?? 'Arcane'} />}
              color={getTypeColor(fieldDef.flavorType ?? 'Arcane')}
              text={`Field: ${fieldDef.name}`}
              note={fieldEffectFactsLine(fieldDef)}
            />
          )}
          {/* Riders last, as the row's strip draws them: closest to who the move reaches. */}
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
                  liveMagnitude != null ? ` ${statusAmountText(app.statusId, liveMagnitude)}` : app.duration != null ? ` ${app.duration}` : ''
                }${where ? ` — ${where}` : ''}`}
                target={app.target === 'moveTarget' ? undefined : app.target}
                note={statusFactsLine(def)}
              />
            );
          })}
          {move.statDeltas?.map(({ stat, stages }) => (
            <EffectRow
              key={stat}
              glyph={<StatGlyph stat={stat} />}
              text={`${move.statDeltaChance != null ? `${Math.round(move.statDeltaChance * 100)}% chance: ` : ''}${stageText(stat, stages)} to ${(move.statDeltaTarget === 'bothAllies'
                ? TARGET_MODE_LABELS.bothAllies
                : move.statDeltaTarget === 'self'
                  ? TARGET_MODE_LABELS.self
                  : TARGET_MODE_LABELS[move.target]
              ).toLowerCase()}`}
              target={move.statDeltaTarget === 'bothAllies' || move.statDeltaTarget === 'self' ? move.statDeltaTarget : move.target}
            />
          ))}
        </div>
      )}

      {forecastIds.length > 0 && context && (
        <div className="move-dossier-forecast">
          {/* The two enemy seats, left and right as they stand; a downed foe's seat stays empty. */}
          <div className="move-dossier-seats">
            {forecastSeats(context, forecastIds).map((id, i) =>
              id ? <ForecastSeat key={id} move={move} ctx={context} defenderId={id} /> : <div key={`empty-${i}`} className="move-dossier-seat is-empty" />
            )}
          </div>
          <div className="move-detail-footnote">
            Variance {VARIANCE_MIN}–{VARIANCE_MAX} · crit ×1.5{move.critChance != null ? ` at ${Math.round(move.critChance * 100)}%` : ''}
          </div>
        </div>
      )}

      <div className="move-detail-stats">
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
            <span className="move-detail-unit">same type</span>
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
        {!free && manaAfter !== null && manaPool !== null && (
          <span className="move-detail-stat move-detail-stat-mana">
            <StatGlyph stat="manaPool" tone="inherit" />
            <strong>{Math.max(0, manaAfter)}</strong>
            <span className="move-detail-unit">/ {manaPool} MP left</span>
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

/** What the card under it is — "Move learned", "New move" — set in the move's own type. */
export function OfferMoveTitle({ type, children }: { type: string; children: ReactNode }) {
  return (
    <h2 className="offer-move-title" style={{ '--move-type-rgb': getTypeColorRgb(type) } as CSSProperties}>
      <span className="offer-move-title-rule" aria-hidden="true" />
      <ElementGlyph type={type} className="offer-move-title-glyph" />
      <span className="offer-move-title-text">{children}</span>
      <span className="offer-move-title-rule" aria-hidden="true" />
    </h2>
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
