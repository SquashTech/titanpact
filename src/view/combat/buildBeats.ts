// Groups the engine's flat event stream into player-legible "beats" for
// sequenced playback. A beat is the unit FightScreen reveals per tap: e.g.
// MoveDeclared + MoveUsed + ManaChanged land together so the mana bar drains
// at the exact moment the "uses Move!" banner appears, rather than a step
// later. This is presentation-only grouping — it doesn't change what
// happened, just how many taps it takes to read it.

import type {
  BenchRegenTickedEvent,
  CombatEvent,
  HpChangedEvent,
  ManaRegenTickedEvent,
  MoveUsedEvent,
  StatChangedEvent,
  StatusAppliedEvent,
} from '../../engine/events';
import type { CombatState, Side } from '../../engine/state';
import type { HeroDefinition, MoveDefinition } from '../../engine/content';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { passiveEmoji } from '../shared/passiveIcons';
import { getTypeColor } from './typeColors';

export interface BeatPopup {
  combatantId: string;
  text: string;
  className: string;
}

/**
 * Per-status tick flavor (Burn/Bleed/Poison/Renew — the DoT/HoT statuses that
 * fire a StatusTicked kind 'damage'/'heal' every end-of-round) so each reads
 * as its own beat rather than a copy of a plain attack-damage/heal beat, the
 * same way Conduct's detonation got its own banner/popup below. Poison only
 * ever ticks once, on detonation (statusEngine.ts tickEndOfRound's timer
 * branch), but shares the same treatment since it's still a kind 'damage'
 * StatusTicked.
 */
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
 * The optional, *presentational* half of a beat — everything past the plain
 * sentence. `banner` stays the whole sentence and is what the event log reads
 * and what the console falls back to; these fields exist only so the console
 * can set the interesting words large and the bookkeeping small.
 *
 * Nothing here is required: a beat that supplies none of it still renders,
 * with `banner` itself taking the headline slot. Reach for the split only
 * when a beat genuinely has a subject and a payload — "Cinder uses" /
 * "Ember Burst", "Bramble takes" / "47 damage" — never to decorate a sentence
 * that already reads as one thought.
 */
export interface BeatFlavor {
  /** Small line above the headline: who is acting, or who is being hit. */
  bannerLead?: string;
  /** The headline itself, replacing `banner` on screen — the words worth setting large. */
  bannerFocus?: string;
  /** Small line below the headline — a move's targets, so far. */
  bannerSub?: string;
  /** Colors the headline. Maps to a .banner-focus-* class in styles.css. */
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
  /** Type color (typeColors.ts) the headline glows in, overriding the kind's own. Set on move beats, so a Fire move arrives orange and a Frost move cyan. */
  bannerAccent?: string;
  /** Stamp under the headline — "Critical hit!", "Super effective!". Rendered as a struck-in chip, not a fragment trailing an em-dash. */
  bannerTag?: string;
  /** Secondary readout — a declared move's mana cost, or the rules text of a Field Effect that just landed. */
  bannerMeta?: string;
  /** Extra class for the bannerMeta span, so a meta line that isn't a mana cost doesn't inherit .combat-banner-meta's mana blue. */
  bannerMetaClass?: string;
}

export interface Beat extends BeatFlavor {
  /** Events to apply, in order, when this beat is revealed. */
  events: CombatEvent[];
  banner: string;
  popups: BeatPopup[];
}

/**
 * "TargetA" / "TargetA and TargetB" / "TargetA, TargetB and TargetC" — the
 * banner's "on {target}" clause. A move that targets only its own user (no
 * spread moves do yet, but 'self' is a defined TargetMode) omits the clause
 * entirely rather than reading "X uses Move on X".
 */
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
  // Events with no beat of their own (RoundStarted, TurnStarted, RoundEnded —
  // no state effect, and RoundStarted's log line is the only one worth
  // keeping) ride along on the next beat that has one.
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
        // The beat with the clearest subject/payload split: the actor is context
        // the player already has (they just picked it), the move NAME is the
        // thing worth reading, and it arrives lit in its own type's color.
        push(applied, `${actorName} uses ${move.name}${clause}`, [], {
          bannerLead: actorName,
          bannerFocus: move.name,
          // `clause` is " on X and Y" — slice past " on" and point at them instead.
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
        // Fainted is deliberately held back into its OWN beat below, rather
        // than bundled into this one: applying it here would clear the
        // combatant's active slot (applyEventToState) in the same tap that
        // drains the HP bar, so the card would vanish before the player ever
        // saw it hit 0. Splitting the beat gives that a tap of its own.
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const tag = e.isCrit
          ? ' — Critical hit!'
          : e.typeMult >= 2
            ? ' — Super effective!'
            : e.typeMult <= 0.5
              ? ' — Not very effective...'
              : '';
        // The same three outcomes as `tag`, split off the sentence so the console
        // can stamp them rather than trail them behind an em-dash. `tag` above
        // stays exactly as written — it is also the event-log line.
        const tagText = e.isCrit ? 'Critical hit!' : e.typeMult >= 2 ? 'Super effective!' : e.typeMult <= 0.5 ? 'Not very effective...' : undefined;
        const tagKind = e.isCrit ? 'crit' : e.typeMult >= 2 ? 'super' : e.typeMult <= 0.5 ? 'resist' : 'damage';
        const targetName = name(e.targetCombatantId);
        // Haunt (statusEngine.ts expandSpreadTargets) dragged this target into a hit
        // that was declared against its partner — call that out explicitly rather than
        // letting it read like an ordinary spread move landed on both enemies.
        const haunted = e.viaStatusId === 'Haunt';
        const banner = haunted ? `${targetName}'s Haunt drags them into the attack — takes ${e.amount} damage${tag}` : `${targetName} takes ${e.amount} damage${tag}`;
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
        // Always immediately followed by the removeStatus reason 'consumed'
        // (statusEngine.ts detonateTriggeredStatuses) and its own
        // HpChanged/Fainted pair — bundled into one beat so the zap and the
        // bar drain land on the same tap.
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

      // A held Passive reacting (passiveEngine.ts resolvePassiveReactions) —
      // e.g. Sanguine mending its owner off an enemy's Bleed tick, right after
      // that tick's own beat. Dispatches on the granting PassiveDefinition's
      // effect kind to know which trailing state-change event to fold in,
      // mirroring the dedicated Healed/StatusApplied/StatChanged beats below
      // rather than introducing a passive-specific one.
      case 'PassiveTriggered': {
        const applied: CombatEvent[] = [e];
        i++;
        const def = passives[e.passiveId];
        const ownerName = name(e.combatantId);
        const label = `${passiveEmoji[e.passiveId] ? `${passiveEmoji[e.passiveId]} ` : ''}${def?.name ?? e.passiveId}`;
        const effectKind = def?.reactive?.effect.kind;

        if (effectKind === 'heal' && events[i]?.type === 'HpChanged') {
          const hp = events[i++] as HpChangedEvent;
          applied.push(hp);
          const amount = hp.newHp - hp.previousHp;
          push(
            applied,
            `${label} heals ${ownerName} for ${amount} HP!`,
            [{ combatantId: e.combatantId, text: `${passiveEmoji[e.passiveId] ?? ''} +${amount}`, className: 'popup-passive-heal' }],
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
          const changed = events[i++] as StatChangedEvent;
          applied.push(changed);
          const sign = changed.delta > 0 ? '+' : '';
          push(
            applied,
            `${label} shifts ${name(changed.combatantId)}'s ${changed.stat} (${sign}${changed.delta})`,
            [
              {
                combatantId: changed.combatantId,
                text: `${sign}${changed.delta} ${changed.stat}`,
                className: changed.delta > 0 ? 'popup-buff' : 'popup-debuff',
              },
            ],
            {
              bannerLead: `${label} · ${name(changed.combatantId)}`,
              bannerFocus: `${changed.stat} ${sign}${changed.delta}`,
              bannerFocusKind: changed.delta > 0 ? 'buff' : 'debuff',
            }
          );
        } else {
          // No state-change event followed (e.g. resolveEffect no-op'd
          // because the target already fainted) — carry the bare trigger
          // event along rather than surfacing an empty beat.
          carry.push(...applied);
        }
        break;
      }

      case 'SwitchedIn':
        push([e], `${name(e.inCombatantId)} switches in!`, [], {
          bannerLead: 'Switching in',
          bannerFocus: name(e.inCombatantId),
          bannerFocusKind: 'buff',
        });
        i++;
        break;

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
        // A drain beat names its source. Same popup and same green number —
        // it IS a heal, and the player should read it as one — but the banner
        // says where it came from, because it arrives in the middle of an
        // attack rather than on its own turn.
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
        // Same split as DamageDealt above — Fainted gets its own beat so a
        // DoT-tick KO also shows the drained bar before the card disappears.
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
        /* The one moment the player has to understand *what* just changed.
           A Field Effect rewrites how every move in every following round
           resolves, so the banner's meta line carries the effect's actual
           rules text rather than making the player go find it — this beat is
           the only place the description is guaranteed to be read. */
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

      /* Deliberately NOT its own beat. The tick carries no new information —
         the divider plaque's pip track already shows rounds remaining, and it
         updates from this event either way — so giving it a beat charged the
         player one mandatory tap per round, every round, for five rounds, to
         be told nothing. Carried instead: the event still applies (and still
         reaches the event log via formatEvents on beat.events), it just rides
         along on the next beat that actually has something to say. */
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

  // Leftover trailing bookkeeping (e.g. a final RoundEnded) with nothing after
  // it to ride along on — fold it into the last real beat rather than drop it.
  if (carry.length > 0 && beats.length > 0) {
    beats[beats.length - 1].events.push(...carry);
  }

  return beats;
}
