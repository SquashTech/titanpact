// Groups the engine's flat event stream into player-legible "beats" — the unit
// FightScreen reveals per tap. Presentation-only grouping.

import type {
  BenchRegenTickedEvent,
  FaintedEvent,
  CombatEvent,
  HpChangedEvent,
  ManaRegenTickedEvent,
  MoveUsedEvent,
  StatChangedEvent,
  StatusAppliedEvent,
} from '../../engine/events';
import type { CombatState, Side } from '../../engine/state';
import type { HeroDefinition, MoveDefinition, StatKey } from '../../engine/content';
import { STAT_LABELS } from '../shared/StatBars';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import { getTypeColor } from './typeColors';
import { hasDramaticEntrance } from '../shared/entrances';

export interface BeatPopup {
  combatantId: string;
  text: string;
  className: string;
}

/** Per-status flavor for DoT/HoT ticks. Poison only ticks once (on detonation) but shares the treatment. */
const STATUS_TICK_BANNER: Record<string, (targetName: string, amount: number) => string> = {
  Burn: (n, a) => `${n} is scorched by Burn for ${a} damage!`,
  Bleed: (n, a) => `${n} bleeds for ${a} damage!`,
  Poison: (n, a) => `${n}'s Poison bursts for ${a} damage!`,
  Renew: (n, a) => `${n}'s Renew mends ${a} HP!`,
};

const STATUS_TICK_EMOJI: Record<string, string> = {
  Burn: '🔥',
  Bleed: '🩸',
  Poison: '🧪',
  Renew: '💚',
};

/**
 * The optional presentational half of a beat. `banner` stays the whole
 * sentence (the log and the console fallback); these only let the console
 * set the interesting words large. Use the split only when a beat has a
 * genuine subject and payload.
 */
export interface BeatFlavor {
  /** Small line above the headline: who is acting, or who is being hit. */
  bannerLead?: string;
  /** The headline itself, replacing `banner` on screen. */
  bannerFocus?: string;
  /** Names set one per line under a VS mark, replacing the headline (openingBeats.ts). */
  bannerRoster?: readonly string[];
  /** Small line below the headline — a move's targets, so far. */
  bannerSub?: string;
  /** Colors the headline; maps to a .banner-focus-* class. */
  bannerFocusKind?:
    | 'crit'
    | 'super'
    | 'resist'
    | 'ko'
    | 'heal'
    | 'buff'
    | 'debuff'
    | 'status'
    | 'damage'
    | 'detonate'
    | 'mana'
    | 'field';
  /** Type color the headline glows in, overriding the kind's own. */
  bannerAccent?: string;
  /** Stamp under the headline — "Critical hit!", "Super effective!". */
  bannerTag?: string;
  /** Secondary readout — a mana cost, or a Field Effect's rules text. */
  bannerMeta?: string;
  /** Extra class for the bannerMeta span. */
  bannerMetaClass?: string;
  /** A dramatic entrance (entrances.ts): FightScreen veils and shakes, beatSfx plays the horn, music drops rate. One flag so a future entrance opts in by id alone. */
  dramaticEntrance?: true;
  /** The fight's opening beat (openingBeats.ts). Carries no events, so beatSfx has to be told what it is. */
  engagement?: true;
}

export interface Beat extends BeatFlavor {
  /** Events to apply, in order, when this beat is revealed. */
  events: CombatEvent[];
  banner: string;
  popups: BeatPopup[];
}

/** The card vocabulary (ATK, WIS), not the engine's field name — StatChangedEvent.stat is a bare string. */
function statLabel(stat: string): string {
  return STAT_LABELS[stat as StatKey] ?? stat;
}

/** " on A" / " on A and B" / " on A, B and C"; empty when the only target is the actor. */
function targetClause(targetIds: readonly string[], actorId: string, name: (id: string) => string): string {
  const ids = targetIds.filter((id) => id !== actorId);
  if (ids.length === 0) return '';
  const names = ids.map(name);
  const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return ` on ${joined}`;
}

export function buildBeats(
  events: readonly CombatEvent[],
  heroes: Record<string, HeroDefinition>,
  moves: Record<string, MoveDefinition>,
  combatants: CombatState['combatants'],
  playerSide: Side
): Beat[] {
  const name = (id: string) => heroes[combatants[id]?.heroId]?.name ?? id;
  const beats: Beat[] = [];
  // Events with no beat of their own ride along on the next beat that has one.
  let carry: CombatEvent[] = [];
  let i = 0;

  function push(applied: CombatEvent[], banner: string, popups: BeatPopup[] = [], flavor: BeatFlavor = {}) {
    beats.push({ events: [...carry, ...applied], banner, popups, ...flavor });
    carry = [];
  }

  while (i < events.length) {
    const e = events[i];

    switch (e.type) {
      case 'RoundStarted':
      case 'TurnStarted':
      case 'RoundEnded':
        carry.push(e);
        i++;
        break;

      case 'MoveDeclared': {
        const applied: CombatEvent[] = [e];
        i++;
        let manaSpent: number | undefined;
        if (events[i]?.type === 'MoveUsed') {
          manaSpent = (events[i] as MoveUsedEvent).manaSpent;
          applied.push(events[i++]);
        }
        if (events[i]?.type === 'ManaChanged') applied.push(events[i++]);

        const move = moves[e.moveId];
        const actorSide = combatants[e.combatantId]?.side;
        const actorName = `${actorSide && actorSide !== playerSide ? 'Enemy ' : ''}${name(e.combatantId)}`;
        const clause = targetClause(e.targetCombatantIds, e.combatantId, name);
        const cost = manaSpent ?? move.manaCost;
        push(applied, `${actorName} uses ${move.name}${clause}`, [], {
          bannerLead: actorName,
          bannerFocus: move.name,
          // `clause` is " on X and Y" — slice past " on".
          bannerSub: clause ? `▸${clause.slice(3)}` : undefined,
          bannerAccent: getTypeColor(move.type),
          bannerMeta: `${cost} MP`,
        });
        break;
      }

      case 'DamageDealt': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        // Fainted gets its OWN beat so the bar is seen to hit 0 before the card vanishes.
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const tag = e.isCrit
          ? ' — Critical hit!'
          : e.typeMult >= 2
            ? ' — Super effective!'
            : e.typeMult <= 0.5
              ? ' — Not very effective...'
              : '';
        const tagText = e.isCrit ? 'Critical hit!' : e.typeMult >= 2 ? 'Super effective!' : e.typeMult <= 0.5 ? 'Not very effective...' : undefined;
        const tagKind = e.isCrit ? 'crit' : e.typeMult >= 2 ? 'super' : e.typeMult <= 0.5 ? 'resist' : 'damage';
        const targetName = name(e.targetCombatantId);
        // Haunt dragged this target into a hit declared against its partner.
        const haunted = e.viaStatusId === 'Haunt';
        const banner = e.recoil
          ? `${targetName} takes ${e.amount} recoil`
          : e.retribution
            ? `${targetName} takes ${e.amount} damage — everything ${name(e.sourceCombatantId)} absorbed, returned`
            : haunted
              ? `${targetName}'s Haunt drags them into the attack — takes ${e.amount} damage${tag}`
              : `${targetName} takes ${e.amount} damage${tag}`;
        push(
          applied,
          banner,
          [
            {
              combatantId: e.targetCombatantId,
              text: `${haunted ? '👻 ' : ''}-${e.amount}`,
              className: haunted ? 'popup-haunt' : e.isCrit ? 'popup-crit' : 'popup-damage',
            },
          ],
          {
            bannerLead: haunted ? `${targetName}'s Haunt drags them in` : `${targetName} takes`,
            bannerFocus: `${e.amount} damage`,
            bannerFocusKind: tagKind,
            bannerTag: tagText,
          }
        );
        if (faintEvent) push([faintEvent], `${targetName} is knocked out!`, [], { bannerFocusKind: 'ko' });
        break;
      }

      case 'StatusDetonated': {
        // Always followed by StatusRemoved 'consumed' and its own HpChanged/Fainted pair.
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'StatusRemoved') applied.push(events[i++]);
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const targetName = name(e.combatantId);
        push(
          applied,
          `${targetName}'s ${e.statusId} detonates for ${e.amount} damage!`,
          [{ combatantId: e.combatantId, text: `⚡ -${e.amount}`, className: 'popup-conduct' }],
          {
            bannerLead: `${targetName}'s ${e.statusId} detonates`,
            bannerFocus: `${e.amount} damage`,
            bannerFocusKind: 'detonate',
          }
        );
        if (faintEvent) push([faintEvent], `${targetName} is knocked out!`, [], { bannerFocusKind: 'ko' });
        break;
      }

      // Dispatches on the passive's effect kind to know which trailing state-change event to fold in.
      case 'PassiveTriggered': {
        const applied: CombatEvent[] = [e];
        i++;
        const def = passives[e.passiveId];
        const ownerName = name(e.combatantId);
        const label = def?.name ?? e.passiveId;
        const effectKind = def?.reactive?.effect.kind;

        if (effectKind === 'heal' && events[i]?.type === 'HpChanged') {
          const hp = events[i++] as HpChangedEvent;
          applied.push(hp);
          const amount = hp.newHp - hp.previousHp;
          push(
            applied,
            `${label} heals ${ownerName} for ${amount} HP!`,
            [{ combatantId: e.combatantId, text: `+${amount}`, className: 'popup-passive-heal' }],
            { bannerLead: `${label} · ${ownerName}`, bannerFocus: `+${amount} HP`, bannerFocusKind: 'heal' }
          );
        } else if (effectKind === 'applyStatus' && events[i]?.type === 'StatusApplied') {
          const applied2 = events[i++] as StatusAppliedEvent;
          applied.push(applied2);
          push(
            applied,
            `${label} afflicts ${name(applied2.combatantId)} with ${applied2.statusId}!`,
            [{ combatantId: applied2.combatantId, text: applied2.statusId, className: 'popup-status' }],
            { bannerLead: `${label} · ${name(applied2.combatantId)}`, bannerFocus: applied2.statusId, bannerFocusKind: 'status' }
          );
        } else if (effectKind === 'statDelta' && events[i]?.type === 'StatChanged') {
          // EVERY consecutive StatChanged: a group-target effect emits one per member behind a single trigger.
          const changes: StatChangedEvent[] = [];
          while (events[i]?.type === 'StatChanged') {
            const changed = events[i++] as StatChangedEvent;
            changes.push(changed);
            applied.push(changed);
          }
          const head = changes[0];
          const sign = head.delta > 0 ? '+' : '';
          const who = changes.map((c) => name(c.combatantId)).join(' and ');
          push(
            applied,
            `${label} shifts ${who}'s ${statLabel(head.stat)} (${sign}${head.delta})`,
            changes.map((c) => ({
              combatantId: c.combatantId,
              text: `${c.delta > 0 ? '+' : ''}${c.delta} ${statLabel(c.stat)}`,
              className: c.delta > 0 ? 'popup-buff' : 'popup-debuff',
            })),
            {
              bannerLead: `${label} · ${who}`,
              bannerFocus: `${statLabel(head.stat)} ${sign}${head.delta}`,
              bannerFocusKind: head.delta > 0 ? 'buff' : 'debuff',
            }
          );
        } else {
          // No state change followed (e.g. target already fainted) — carry rather than surface an empty beat.
          carry.push(...applied);
        }
        break;
      }

      case 'SwitchedIn': {
        const inName = name(e.inCombatantId);
        if (hasDramaticEntrance(combatants[e.inCombatantId]?.heroId)) {
          push([e], `${inName} takes the field!`, [], {
            bannerLead: 'Something comes out of the treeline',
            bannerFocus: inName,
            bannerFocusKind: 'ko',
            bannerMeta: 'The ground goes quiet.',
            bannerMetaClass: 'banner-meta-rules',
            dramaticEntrance: true,
          });
          i++;
          break;
        }
        push([e], `${inName} switches in!`, [], {
          bannerLead: 'Switching in',
          bannerFocus: inName,
          bannerFocusKind: 'buff',
        });
        i++;
        break;
      }

      case 'Rested': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'ManaChanged') applied.push(events[i++]);
        const actorSide = combatants[e.combatantId]?.side;
        const actorName = `${actorSide && actorSide !== playerSide ? 'Enemy ' : ''}${name(e.combatantId)}`;
        push(
          applied,
          `${actorName} rests, restoring Mana to full`,
          [{ combatantId: e.combatantId, text: 'Full MP', className: 'popup-mana' }],
          { bannerLead: `${actorName} rests`, bannerFocus: 'Mana restored', bannerFocusKind: 'mana' }
        );
        break;
      }

      case 'Healed': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        const targetName = name(e.targetCombatantId);
        const drainedFrom = e.drain ? name(e.drain.fromCombatantId) : null;
        push(
          applied,
          drainedFrom ? `${targetName} drains ${e.amount} HP from ${drainedFrom}` : `${targetName} recovers ${e.amount} HP`,
          [{ combatantId: e.targetCombatantId, text: `+${e.amount}`, className: 'popup-heal' }],
          {
            bannerLead: drainedFrom ? `${targetName} drains ${drainedFrom}` : `${targetName} recovers`,
            bannerFocus: `+${e.amount} HP`,
            bannerFocusKind: 'heal',
          }
        );
        break;
      }

      case 'StatChanged': {
        const targetName = name(e.combatantId);
        const sign = e.delta > 0 ? '+' : '';
        push(
          [e],
          `${targetName}'s ${e.stat} ${e.delta > 0 ? 'rises' : 'falls'} (${sign}${e.delta})`,
          [{ combatantId: e.combatantId, text: `${sign}${e.delta} ${e.stat}`, className: e.delta > 0 ? 'popup-buff' : 'popup-debuff' }],
          {
            bannerLead: `${targetName}'s ${e.stat} ${e.delta > 0 ? 'rises' : 'falls'}`,
            bannerFocus: `${sign}${e.delta} ${e.stat}`,
            bannerFocusKind: e.delta > 0 ? 'buff' : 'debuff',
          }
        );
        i++;
        break;
      }

      case 'StatusApplied': {
        const targetName = name(e.combatantId);
        const detail = e.magnitude !== undefined ? ` (${e.magnitude})` : e.duration !== undefined ? ` (${e.duration})` : '';
        push(
          [e],
          `${targetName} is afflicted with ${e.statusId}${detail}`,
          [{ combatantId: e.combatantId, text: e.statusId, className: 'popup-status' }],
          { bannerLead: `${targetName} is afflicted with`, bannerFocus: `${e.statusId}${detail}`, bannerFocusKind: 'status' }
        );
        i++;
        break;
      }

      case 'StatusTicked': {
        const applied: CombatEvent[] = [e];
        i++;
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const targetName = name(e.combatantId);
        if (e.kind === 'duration') {
          push(applied, `${targetName}'s ${e.statusId} counts down (${e.newDuration} left)`);
          break;
        }
        const verb = e.kind === 'damage' ? 'takes' : 'recovers';
        const flavorBanner = STATUS_TICK_BANNER[e.statusId]?.(targetName, e.amount);
        const emoji = STATUS_TICK_EMOJI[e.statusId];
        const popupClass = flavorBanner ? `popup-${e.statusId.toLowerCase()}` : e.kind === 'damage' ? 'popup-damage' : 'popup-heal';
        push(
          applied,
          flavorBanner ?? `${targetName} ${verb} ${e.amount} from ${e.statusId}`,
          [
            {
              combatantId: e.combatantId,
              text: `${emoji ? `${emoji} ` : ''}${e.kind === 'damage' ? '-' : '+'}${e.amount}`,
              className: popupClass,
            },
          ],
          {
            bannerLead: `${emoji ? `${emoji} ` : ''}${targetName}'s ${e.statusId}`,
            bannerFocus: `${e.kind === 'damage' ? '-' : '+'}${e.amount} HP`,
            bannerFocusKind: e.kind === 'damage' ? 'damage' : 'heal',
          }
        );
        if (faintEvent) push([faintEvent], `${targetName} is knocked out!`, [], { bannerFocusKind: 'ko' });
        break;
      }

      case 'StatusRemoved': {
        // A flinch-shaped status (Daze) expiring is bookkeeping, not news — carried so the badge still clears.
        if (statuses[e.statusId]?.clearsAtEndOfRound && e.reason === 'expired') {
          carry.push(e);
          i++;
          break;
        }
        const targetName = name(e.combatantId);
        const verb =
          e.reason === 'switch' ? 'clears' : e.reason === 'cleanse' ? 'is cleansed' : e.reason === 'consumed' ? 'is consumed' : 'fades';
        push([e], `${targetName}'s ${e.statusId} ${verb}`);
        i++;
        break;
      }

      case 'ActionBlocked': {
        const targetName = name(e.combatantId);
        const text = e.reason === 'dazed' ? `${targetName} is Dazed and can't move!` : `${targetName}'s target is already down!`;
        push([e], text, [], { bannerFocusKind: 'debuff' });
        i++;
        break;
      }

      case 'FieldEffectSet': {
        const fx = fieldEffects[e.fieldEffectId];
        const label = fx?.name ?? e.fieldEffectId;
        // The meta line carries the effect's rules text: this beat is the one place it is guaranteed to be read.
        push(
          [e],
          e.previousFieldEffectId ? `${label} surges across the battlefield, overriding the old field!` : `${label} surges across the battlefield!`,
          [],
          {
            bannerLead: e.previousFieldEffectId ? 'The field is overwritten' : 'The field turns',
            bannerFocus: label,
            bannerFocusKind: 'field',
            bannerAccent: fx?.flavorType ? getTypeColor(fx.flavorType) : undefined,
            bannerMeta: fx?.description,
            bannerMetaClass: 'banner-meta-rules',
          }
        );
        i++;
        break;
      }

      // Not its own beat: the plaque's pip track already shows rounds remaining.
      case 'FieldEffectTicked':
        carry.push(e);
        i++;
        break;

      case 'FieldEffectExpired': {
        const fx = fieldEffects[e.fieldEffectId];
        push([e], `${fx?.name ?? e.fieldEffectId} fades from the battlefield.`, [], {
          bannerLead: 'The field settles',
          bannerFocus: `${fx?.name ?? e.fieldEffectId} fades`,
          bannerAccent: fx?.flavorType ? getTypeColor(fx.flavorType) : undefined,
        });
        i++;
        break;
      }

      // One beat for the whole board; KOs still split off so the bar drains before the card leaves.
      case 'PactTicked': {
        i++;
        const applied: CombatEvent[] = [e];
        const popups: BeatPopup[] = [];
        const faints: FaintedEvent[] = [];
        while (events[i]?.type === 'HpChanged' || events[i]?.type === 'Fainted') {
          const next = events[i++];
          if (next.type === 'HpChanged') {
            applied.push(next);
            const lost = next.previousHp - next.newHp;
            if (lost > 0) popups.push({ combatantId: next.combatantId, text: `-${lost}`, className: 'popup-damage' });
          } else if (next.type === 'Fainted') {
            faints.push(next);
          }
        }
        const pct = Math.round(e.fraction * 100);
        push(applied, `The pact comes due — every combatant loses ${pct}% of their health!`, popups, {
          bannerLead: e.step === 0 ? 'The pact comes due' : 'The pact tightens',
          bannerFocus: `-${pct}% HP, everyone`,
          bannerFocusKind: 'damage',
          bannerMeta: 'The Titan is done waiting. This will not stop.',
        });
        for (const faint of faints) {
          push([faint], `${name(faint.combatantId)} is knocked out!`, [], { bannerFocusKind: 'ko' });
        }
        break;
      }

      case 'BenchRegenTicked': {
        const applied: CombatEvent[] = [];
        const popups: BeatPopup[] = [];
        const names: string[] = [];
        while (events[i]?.type === 'BenchRegenTicked') {
          const be = events[i] as BenchRegenTickedEvent;
          applied.push(be);
          popups.push({ combatantId: be.combatantId, text: `+${be.hpRegen}`, className: 'popup-heal' });
          names.push(name(be.combatantId));
          i++;
        }
        push(applied, `${names.join(' and ')} recover HP on the bench`, popups, {
          bannerLead: 'On the bench',
          bannerFocus: `${names.join(' and ')} recover`,
          bannerFocusKind: 'heal',
        });
        break;
      }

      // One beat per grant, mirroring Healed. The popup names overflow since the bar's fill clamps.
      case 'ManaGranted': {
        const targetName = name(e.targetCombatantId);
        const sourceName = name(e.sourceCombatantId);
        const over = e.overflow > 0 ? ` (${e.overflow} over)` : '';
        push(
          [e],
          `${sourceName} gives ${targetName} ${e.amount} MP${over}`,
          [{ combatantId: e.targetCombatantId, text: `+${e.amount} MP`, className: 'popup-mana' }],
          {
            bannerLead: `${sourceName} charges ${targetName}`,
            bannerFocus: `+${e.amount} MP${over}`,
            bannerFocusKind: 'mana',
          }
        );
        i++;
        break;
      }

      case 'ManaRegenTicked': {
        const applied: CombatEvent[] = [];
        const popups: BeatPopup[] = [];
        while (events[i]?.type === 'ManaRegenTicked') {
          const me = events[i] as ManaRegenTickedEvent;
          applied.push(me);
          popups.push({ combatantId: me.combatantId, text: `+${me.manaRegen}`, className: 'popup-mana' });
          i++;
        }
        push(applied, 'Mana recovers', popups, { bannerFocus: 'Mana recovers', bannerFocusKind: 'mana' });
        break;
      }

      default:
        carry.push(e);
        i++;
        break;
    }
  }

  // Trailing bookkeeping (e.g. a final RoundEnded) folds into the last real beat.
  if (carry.length > 0 && beats.length > 0) {
    beats[beats.length - 1].events.push(...carry);
  }

  return beats;
}
