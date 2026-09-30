// Groups the engine's flat event stream into player-legible "beats" — the unit
// FightScreen reveals per tap. Presentation-only grouping.

import type {
  FaintedEvent,
  CombatEvent,
  HealedEvent,
  HpChangedEvent,
  ManaSurchargedEvent,
  MoveUsedEvent,
  StatChangedEvent,
  StatusAppliedEvent,
  StatusRemovedEvent,
} from '../../engine/events';
import type { CombatState, Side } from '../../engine/state';
import { moveForHero } from '../../engine/state';
import type { HeroDefinition, MoveDefinition, StatKey } from '../../engine/content';
import { STAT_LABELS } from '../shared/StatBars';
import { passives } from '../../data/passives';
import { fieldEffects } from '../../data/fieldEffects';
import { statuses } from '../../data/statuses';
import { getTypeColor } from './typeColors';
import { statusAmountText } from '../shared/statusFacts';
import { cinematicEntranceFor, dramaticEntranceFor, type CinematicEntrance } from '../shared/entrances';
import { moveKindGlyph } from '../shared/MoveTile';
import type { MoveKindGlyphKind } from '../shared/statIcons';

export interface BeatPopup {
  combatantId: string;
  text: string;
  className: string;
  /**
   * A status id, drawn as its own StatusGlyph ahead of the number. The status IS the reason the
   * number is happening — a Burn tick and an ordinary hit are both "-14" otherwise — and the
   * glyph is the same mark the shoulder cluster on the figure is already wearing, so the popup
   * points back at the badge that caused it.
   */
  glyph?: string;
}

/** Per-status flavor for DoT/HoT ticks. Poison only ticks once (on detonation) but shares the treatment. */
const STATUS_TICK_BANNER: Record<string, (targetName: string, amount: number) => string> = {
  Burn: (n, a) => `${n} is scorched by Burn for ${a} damage!`,
  Bleed: (n, a) => `${n} bleeds for ${a} damage!`,
  Poison: (n, a) => `${n}'s Poison bursts for ${a} damage!`,
  Renew: (n, a) => `${n}'s Renew mends ${a} HP!`,
};

/**
 * The optional presentational half of a beat. `banner` stays the whole
 * sentence (the log and the console fallback); these only let the console
 * set the interesting words large. Use the split only when a beat has a
 * genuine subject and payload.
 */
/** One lead in the opening beat's roster. */
export interface BeatRosterEntry {
  name: string;
  /** The type colors the name is set in — one, or two for a dual type, which the view gradients across. */
  colors: readonly string[];
}

export interface BeatFlavor {
  /** Small line above the headline: who is acting, or who is being hit. */
  bannerLead?: string;
  /** The headline itself, replacing `banner` on screen. */
  bannerFocus?: string;
  /** Names set one per line under a VS mark, replacing the headline (openingBeats.ts). */
  bannerRoster?: readonly BeatRosterEntry[];
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
    | 'field'
    | 'shield'
    | 'blessing';
  /** Type color the headline glows in, overriding the kind's own. */
  bannerAccent?: string;
  /** Stamp under the headline — "Critical hit!", "Super effective!". */
  bannerTag?: string;
  /**
   * The declaration beat's readout (2026-09-11, per user direction): what kind of move this is
   * and what it cost, as the same objects the move tile wears — the kind glyph and the mana gem —
   * rather than "20 MP" in small type. FightScreen draws it; buildBeats only says what it is.
   */
  bannerCast?: { kind: MoveKindGlyphKind; label: string; cost: number };
  /** Secondary readout — a Field Effect's rules text. */
  bannerMeta?: string;
  /** Extra class for the bannerMeta span. */
  bannerMetaClass?: string;
  /** A dramatic entrance (entrances.ts): FightScreen veils and shakes, beatSfx plays the horn, music drops rate. One flag so a future entrance opts in by id alone. */
  dramaticEntrance?: true;
  /** A scene played over the field before the arrival it announces (entrances.ts cinematicEntranceFor): FightScreen holds playback until it is done. Carries no events. */
  cinematic?: CinematicEntrance;
  /** The fight's opening beat (openingBeats.ts). Carries no events, so beatSfx has to be told what it is. */
  engagement?: true;
  /**
   * Whoever is mid-action on this beat — the figure holds its action frame
   * (styles.css `.striking`). Stamped from the declaration through every beat
   * the action goes on to produce: the damage, what it afflicted, the KO. So
   * the pose is up for exactly as long as the console is still talking about
   * that move, and drops on the first beat that isn't about it.
   */
  strikeCombatantId?: string;
  /**
   * A switch (2026-09-25, per user direction — Pokémon's recall and send-out, without the ball;
   * one beat since 2026-09-30): `recallCombatantId` is the hero leaving, drawn back into its
   * platform while FightScreen holds the swap back; `summonCombatantId` is the one arriving, rising
   * out of the same ground once the swap lands (styles.css .recalling / .summoning).
   */
  recallCombatantId?: string;
  summonCombatantId?: string;
  /**
   * A move's payload LANDING on a figure this beat (TypeFx.tsx), and the cast
   * sound beatSfx layers under it. Stamped on the beat where the target takes it
   * — the damage, the heal, the stat change — never on the declaration, so the
   * element arrives with its consequence. An `element` is the move's type
   * manifesting on a foe; a `buff` is the one universal grant animation, tinted
   * by the type and wearing its glyph, for a target on the caster's own side.
   */
  fx?: readonly BeatFx[];
}

/** What the cast strip calls the move's kind: the damage pipeline it swings on, or what a non-damage move does. */
function castLabel(move: MoveDefinition): string {
  if (move.kind === 'damage') return move.category === 'physical' ? 'Physical' : 'Magical';
  if (move.kind === 'heal') return 'Heal';
  return moveKindGlyph(move) === 'debuff' ? 'Debuff' : 'Buff';
}

export interface BeatFx {
  combatantId: string;
  type: string;
  /** How many of the effect to draw — a broadside draws the balls it actually fired. Absent = the shape's own default. */
  count?: number;
  /**
   * 'element' is the move's type manifesting on a foe and 'buff' the universal grant; 'cannonball'
   * is Broadside's volley (PASSIVE_FX), a passive whose payload is a picture of its own rather
   * than of its type.
   */
  kind: 'element' | 'buff' | 'cannonball';
}

/**
 * A passive whose payload wants its own animation rather than its owner's element. Keyed by
 * passive id, the same way classIcons.tsx keys a Class's glyph — presentation, authored per card.
 */
const PASSIVE_FX: Record<string, BeatFx['kind']> = {
  broadsideFire: 'cannonball',
};

export interface Beat extends BeatFlavor {
  /** Events to apply, in order, when this beat is revealed. */
  events: CombatEvent[];
  banner: string;
  popups: BeatPopup[];
}

/**
 * Everything a declared move can go on to emit. While the stream stays inside
 * this set the actor is still mid-move, so its figure keeps its action frame;
 * the first event outside it (a round boundary, a DoT tick, a switch, the Pact)
 * ends the action and puts the figure back at rest.
 */
const ACTION_EVENTS: ReadonlySet<CombatEvent['type']> = new Set([
  'MoveDeclared',
  'MoveUsed',
  'ManaChanged',
  'ManaGranted',
  'DamageDealt',
  'HpChanged',
  'Healed',
  'Fainted',
  'Endured',
  'BlessingSpent',
  'StatChanged',
  'StatusApplied',
  'StatusRemoved',
  'StatusDetonated',
  'PassiveTriggered',
  'ActionBlocked',
  'MoveGuarded',
]);

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

/** "A", "A and B", "A, B and C". */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** A passive's name without its parenthetical — "Mark of the Titan (Fire)" and "(Water)" are one family. */
function passiveFamily(label: string): string {
  return label.replace(/\s*\([^)]*\)$/, '');
}

/** What rides along inside the round's end beat without a figure of its own. */
const ROUND_END_BOOKKEEPING: ReadonlySet<CombatEvent['type']> = new Set([
  'StatusRemoved',
  'Healed',
  'ManaChanged',
  'ManaSurcharged',
  'Endured',
  'BlessingSpent',
  'FieldEffectTicked',
  'RoundEnded',
]);

/** Consecutive StatChanged events, folded per target, first-seen order kept. */
function groupByCombatant(changes: readonly StatChangedEvent[]): { combatantId: string; changes: StatChangedEvent[] }[] {
  const groups: { combatantId: string; changes: StatChangedEvent[] }[] = [];
  for (const change of changes) {
    const group = groups.find((g) => g.combatantId === change.combatantId);
    if (group) group.changes.push(change);
    else groups.push({ combatantId: change.combatantId, changes: [change] });
  }
  return groups;
}

/** "falls" for one stat on one hero, "fall" once the subject is plural; "can't go any lower / higher" when the band took the whole change. */
function statVerb(changes: readonly StatChangedEvent[], plural: boolean): string {
  const rising = changes.every((c) => c.delta > 0);
  // A drop the floor took whole is still a fall in kind, so "-24 DEF (no lower), WIS can't go lower" reads as one.
  const heldWhole = changes.every((c) => c.capped && c.delta === 0);
  // A change the band took whole is still a rise or a fall in kind; which end is read off the sign of the authored base.
  const heldUp = heldWhole && changes.every((c) => (c.authored ?? 0) > 0);
  const falling = changes.every((c) => c.delta < 0 || (c.capped && c.delta === 0 && !heldUp));
  const verb = heldWhole ? (heldUp ? "can't go any higher" : "can't go any lower") : rising ? 'rise' : falling ? 'fall' : 'shift';
  if (plural || changes.length > 1) return verb;
  return heldWhole ? verb : `${verb}s`;
}

/** What two targets have to match on for the beat to read as one sentence about both. */
function signatureOf(changes: readonly StatChangedEvent[]): string {
  return changes.map((c) => `${c.stat}:${c.delta}${c.capped ? (c.delta > 0 || (c.delta === 0 && (c.authored ?? 0) > 0) ? 'c' : 'f') : ''}`).join(',');
}

/**
 * The console's big line: "-10 DEF/WIS" when one number covers them all, else "+10 ATK -5 DEF".
 * A change the band held reads "DEF can't go lower" / "ATK can't go higher" when nothing landed and "-12 DEF (no lower)" / "+12 ATK (no higher)" when some did.
 */
function deltaSummary(changes: readonly StatChangedEvent[]): string {
  const sign = (d: number) => (d > 0 ? '+' : '');
  const up = (c: StatChangedEvent) => (c.delta !== 0 ? c.delta > 0 : (c.authored ?? 0) > 0);
  const edge = (c: StatChangedEvent) => (up(c) ? 'higher' : 'lower');
  const one = (c: StatChangedEvent) =>
    c.capped && c.delta === 0 ? `${statLabel(c.stat)} can't go ${edge(c)}` : `${sign(c.delta)}${c.delta} ${statLabel(c.stat)}${c.capped ? ` (no ${edge(c)})` : ''}`;
  const first = changes[0];
  if (changes.every((c) => c.delta === first.delta && !!c.capped === !!first.capped && up(c) === up(first))) {
    if (first.capped && first.delta === 0) return `${changes.map((c) => statLabel(c.stat)).join('/')} can't go ${edge(first)}`;
    return `${sign(first.delta)}${first.delta} ${changes.map((c) => statLabel(c.stat)).join('/')}${first.capped ? ` (no ${edge(first)})` : ''}`;
  }
  return changes.map(one).join(' ');
}

/** One target's clause, for the case where the targets took different payloads. */
function statClause(targetName: string, changes: readonly StatChangedEvent[]): string {
  return `${targetName}'s ${joinNames(changes.map((c) => c.stat))} ${statVerb(changes, false)} (${deltaSummary(changes)})`;
}

export function buildBeats(
  events: readonly CombatEvent[],
  heroes: Record<string, HeroDefinition>,
  moves: Record<string, MoveDefinition>,
  combatants: CombatState['combatants'],
  playerSide: Side
): Beat[] {
  const name = (id: string) => heroes[combatants[id]?.heroId]?.name ?? id;
  /** A combatant's primary type — what a passive's own effect is tinted in, having no move to read. */
  const ownerType = (id: string) => heroes[combatants[id]?.heroId]?.types[0] ?? 'Iron';
  const beats: Beat[] = [];
  // Events with no beat of their own ride along on the next beat that has one.
  let carry: CombatEvent[] = [];
  let i = 0;
  // Who declared the move currently being narrated, held until an event that
  // can't belong to it comes through (ACTION_EVENTS below).
  let striker: string | undefined;
  // The move being narrated, and who has already had its landing animated. A
  // move animates ONCE per target — on its first payload beat against them, so a
  // rider status behind a hit doesn't light the figure twice — except that every
  // hit of a multi-hit move lands (DamageDealt bypasses the set).
  let strikerMove: MoveDefinition | undefined;
  let landed = new Set<string>();
  // The round's end beat (regen and ticks), so a field lapsing right behind it can ride on it.
  let roundEndBeat = null as Beat | null;

  function push(applied: CombatEvent[], banner: string, popups: BeatPopup[] = [], flavor: BeatFlavor = {}) {
    beats.push({ events: [...carry, ...applied], banner, popups, strikeCombatantId: striker, ...flavor });
    carry = [];
  }

  /** The landing on `targetId` of the move being narrated, or nothing if there is no move or it already landed there. */
  function landing(targetId: string, force = false): BeatFx[] | undefined {
    if (!striker || !strikerMove) return undefined;
    if (!force && landed.has(targetId)) return undefined;
    landed.add(targetId);
    const kind = combatants[targetId]?.side === combatants[striker]?.side ? 'buff' : 'element';
    return [{ combatantId: targetId, type: strikerMove.type, kind }];
  }

  /** One landing per target group, for a beat that folds several targets. */
  function landings(targetIds: readonly string[]): BeatFx[] | undefined {
    const all = targetIds.flatMap((id) => landing(id) ?? []);
    return all.length > 0 ? all : undefined;
  }

  /**
   * The round's end as ONE beat (2026-09-30, per user direction, widened from the regen-and-tick
   * block it was): bench and mana regen, every status tick and expiry, every passive that fires on
   * them or on the round's end (the Marks, Halo, Rivet, Sporefall…) with its payload, and a field
   * lapsing — none of it a decision, and 1.8 taps a round before. Each figure gets one popup: its
   * net HP (glyph of the biggest tick), else its stat shift, else what it gained, else its mana; the
   * detail stays in the Battle Log. A KO still splits off, one beat for all of them, so the bar
   * drains before the card leaves; the Clock, a draining field and a field set carry rules text and
   * keep beats of their own.
   */
  function roundEnd() {
    const applied: CombatEvent[] = [];
    const faints: FaintedEvent[] = [];
    const hp = new Map<string, { delta: number; glyph: string; glyphAmount: number; named: boolean }>();
    const mana = new Map<string, number>();
    const shifts = new Map<string, StatChangedEvent[]>();
    const gained = new Map<string, string[]>();
    const clauses: string[] = [];
    const sources: string[] = [];
    let faded: string | null = null;
    // Renew heals as it lands, so a tick can come mid-round: only regen or the round's end itself
    // earns the beat its "round ends" title.
    let closing = false;
    const hpOf = (id: string) => hp.get(id) ?? { delta: 0, glyph: '', glyphAmount: -1, named: false };
    const source = (label: string) => {
      if (!sources.includes(label)) sources.push(label);
    };
    for (;;) {
      const next = events[i];
      if (!next) break;
      if (next.type === 'BenchRegenTicked' || next.type === 'ManaRegenTicked' || next.type === 'RoundEnded') closing = true;
      if (next.type === 'BenchRegenTicked') {
        const cur = hpOf(next.combatantId);
        cur.delta += next.hpRegen;
        hp.set(next.combatantId, cur);
      } else if (next.type === 'ManaRegenTicked') {
        mana.set(next.combatantId, (mana.get(next.combatantId) ?? 0) + next.manaRegen);
      } else if (next.type === 'StatusTicked') {
        applied.push(next);
        i++;
        if (next.kind !== 'duration') {
          const cur = hpOf(next.combatantId);
          cur.delta += next.kind === 'damage' ? -next.amount : next.amount;
          cur.named = true;
          if (next.amount > cur.glyphAmount) {
            cur.glyph = next.statusId;
            cur.glyphAmount = next.amount;
          }
          hp.set(next.combatantId, cur);
          source(next.statusId);
          clauses.push(
            STATUS_TICK_BANNER[next.statusId]?.(name(next.combatantId), next.amount) ??
              `${name(next.combatantId)} ${next.kind === 'damage' ? 'takes' : 'recovers'} ${next.amount} from ${next.statusId}`
          );
          // The tick's own HP change is counted by its amount above, not again below.
          if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        }
        continue;
      } else if (next.type === 'HpChanged') {
        const cur = hpOf(next.combatantId);
        cur.delta += next.newHp - next.previousHp;
        cur.named = true;
        hp.set(next.combatantId, cur);
      } else if (next.type === 'PassiveTriggered') {
        const label = passiveFamily(passives[next.passiveId]?.name ?? next.passiveId);
        source(label);
        clauses.push(`${name(next.combatantId)}'s ${label}`);
      } else if (next.type === 'StatusApplied') {
        const shield = statuses[next.statusId]?.pipeline === 'shield';
        gained.set(next.combatantId, [...(gained.get(next.combatantId) ?? []), shield && next.magnitude !== undefined ? `Shield ${next.magnitude}` : next.statusId]);
      } else if (next.type === 'StatChanged') {
        shifts.set(next.combatantId, [...(shifts.get(next.combatantId) ?? []), next]);
      } else if (next.type === 'ManaGranted') {
        mana.set(next.targetCombatantId, (mana.get(next.targetCombatantId) ?? 0) + next.amount);
      } else if (next.type === 'FieldEffectExpired') {
        faded = fieldEffects[next.fieldEffectId]?.name ?? next.fieldEffectId;
      } else if (next.type === 'Fainted') {
        // A KO ends the beat; every KO standing in a row behind it shares one beat of its own.
        while (events[i]?.type === 'Fainted') faints.push(events[i++] as FaintedEvent);
        break;
      } else if (!ROUND_END_BOOKKEEPING.has(next.type)) {
        break;
      }
      applied.push(next);
      i++;
    }

    const popups: BeatPopup[] = [];
    for (const combatantId of new Set([...hp.keys(), ...shifts.keys(), ...gained.keys(), ...mana.keys()])) {
      const tick = hp.get(combatantId);
      const shift = shifts.get(combatantId);
      const marks = gained.get(combatantId);
      const regen = mana.get(combatantId) ?? 0;
      if (tick && tick.delta !== 0) {
        const flavored = tick.glyph !== '' && STATUS_TICK_BANNER[tick.glyph] !== undefined;
        popups.push({
          combatantId,
          text: `${tick.delta > 0 ? '+' : ''}${tick.delta}`,
          className: flavored ? `popup-${tick.glyph.toLowerCase()}` : tick.delta > 0 ? 'popup-heal' : 'popup-damage',
          glyph: tick.glyph || undefined,
        });
      } else if (shift) {
        popups.push({ combatantId, text: deltaSummary(shift), className: shift.every((c) => c.delta > 0) ? 'popup-buff' : 'popup-debuff' });
      } else if (marks) {
        const shield = marks.some((m) => m.startsWith('Shield'));
        popups.push({ combatantId, text: [...new Set(marks)].join(' · '), className: shield ? 'popup-shield-gain' : 'popup-status', glyph: shield ? 'Shield' : undefined });
      } else if (regen > 0) {
        popups.push({ combatantId, text: `+${regen}`, className: 'popup-mana' });
      }
    }

    // The big line names what hurt or healed someone for a reason — a tick or a passive — and
    // leaves the bench's quiet regen to its popup.
    let net = 0;
    const focus: string[] = [];
    for (const [combatantId, tick] of hp) {
      if (!tick.named || tick.delta === 0) continue;
      net += tick.delta;
      focus.push(`${name(combatantId)} ${tick.delta > 0 ? '+' : '−'}${Math.abs(tick.delta)}`);
    }
    const eventful = clauses.length > 0;
    const sentence = eventful ? clauses.join('; ') : 'Mana recovers';
    push(applied, faded ? `${sentence}; ${faded} fades from the battlefield.` : sentence, popups, {
      bannerLead: eventful && closing ? 'The round ends' : undefined,
      bannerFocus: !eventful ? 'Mana recovers' : focus.length > 0 ? focus.join(' · ') : sources.join(' · '),
      bannerSub: eventful && focus.length > 0 ? `▸${sources.join(' · ')}` : undefined,
      bannerFocusKind: !eventful ? 'mana' : net < 0 ? 'damage' : net > 0 ? 'heal' : 'status',
      bannerMeta: faded ? `${faded} fades` : undefined,
    });
    roundEndBeat = beats[beats.length - 1];
    if (faints.length > 0) {
      const who = joinNames(faints.map((f) => name(f.combatantId)));
      push(faints, `${who} ${faints.length > 1 ? 'are' : 'is'} knocked out!`, [], { bannerFocusKind: 'ko' });
    }
  }

  while (i < events.length) {
    const e = events[i];
    if (!ACTION_EVENTS.has(e.type)) striker = undefined;

    switch (e.type) {
      case 'RoundEnded':
        if (events[i + 1]?.type === 'PassiveTriggered') {
          roundEnd();
          break;
        }
        carry.push(e);
        i++;
        break;

      case 'RoundStarted':
      case 'RoundOrdered':
      case 'TurnStarted':
        carry.push(e);
        i++;
        break;

      case 'MoveDeclared': {
        striker = e.combatantId;
        landed = new Set();
        const applied: CombatEvent[] = [e];
        i++;
        let manaSpent: number | undefined;
        if (events[i]?.type === 'MoveUsed') {
          manaSpent = (events[i] as MoveUsedEvent).manaSpent;
          applied.push(events[i++]);
        }
        if (events[i]?.type === 'ManaChanged') applied.push(events[i++]);

        const actorHero = heroes[combatants[e.combatantId]?.heroId];
        const move = actorHero ? moveForHero(moves[e.moveId], actorHero) : moves[e.moveId];
        strikerMove = move;
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
          bannerCast: { kind: moveKindGlyph(move), label: castLabel(move), cost },
        });
        break;
      }

      case 'DamageDealt': {
        const applied: CombatEvent[] = [e];
        i++;
        // A hit that empties a Shield removes it BEFORE the HP change lands (docs/shield.md §4).
        let shieldBroken = false;
        if (events[i]?.type === 'StatusRemoved' && (events[i] as { reason?: string }).reason === 'broken') {
          applied.push(events[i++]);
          shieldBroken = true;
        }
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        if (events[i]?.type === 'BlessingSpent') applied.push(events[i++]);
        // Fainted gets its OWN beat so the bar is seen to hit 0 before the card vanishes.
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const tagText = e.isCrit ? 'Critical hit!' : e.typeMult >= 2 ? 'Super effective!' : e.typeMult <= 0.5 ? 'Not very effective...' : undefined;
        // A Blessing turned the killing blow aside (docs/blessings-and-statuses.md §1.6): the number
        // that would have landed is shown struck through, in the Blessing's own tone.
        if (e.prevented) {
          const blessedName = name(e.targetCombatantId);
          push(
            applied,
            `${blessedName}'s Blessing turns aside ${e.prevented} damage!`,
            [{ combatantId: e.targetCombatantId, text: `${e.prevented}`, className: 'popup-blessed' }],
            {
              bannerLead: `${blessedName}'s Blessing turns aside`,
              bannerFocus: `${e.prevented} damage`,
              bannerFocusKind: 'blessing',
              bannerTag: tagText,
              fx: landing(e.targetCombatantId, true),
            }
          );
          break;
        }
        const tag = e.isCrit
          ? ' — Critical hit!'
          : e.typeMult >= 2
            ? ' — Super effective!'
            : e.typeMult <= 0.5
              ? ' — Not very effective...'
              : '';
        const tagKind = e.isCrit ? 'crit' : e.typeMult >= 2 ? 'super' : e.typeMult <= 0.5 ? 'resist' : 'damage';
        const targetName = name(e.targetCombatantId);
        // Haunt dragged this target into a hit declared against its Haunted partner.
        const haunted = e.viaStatusId === 'Haunt';
        const absorbed = e.absorbed ?? 0;
        // The Shield's share is the figure the player sees, never a silent nothing (docs/shield.md §3.3):
        // a hit it takes whole rises in the Shield's tone; one that gets through shows both numbers.
        const shieldPopup: BeatPopup | null =
          absorbed > 0
            ? {
                combatantId: e.targetCombatantId,
                text: e.amount > 0 ? `-${absorbed} · -${e.amount}` : `-${absorbed}`,
                className: shieldBroken ? 'popup-shield-broken' : 'popup-shield',
                glyph: 'Shield',
              }
            : null;
        const banner = e.recoil
          ? `${targetName} takes ${e.amount} recoil`
          : e.retribution
            ? `${targetName} takes ${e.amount} damage — everything ${name(e.sourceCombatantId)} absorbed, returned`
            : shieldBroken
              ? `${targetName}'s Shield breaks — takes ${e.amount} damage${tag}`
              : absorbed > 0
                ? `${targetName}'s Shield absorbs ${absorbed}${tag}`
                : haunted
                  ? `${targetName} is caught in the Haunt — takes ${e.amount} damage${tag}`
                  : `${targetName} takes ${e.amount} damage${tag}`;
        push(
          applied,
          banner,
          [
            shieldPopup ?? {
              combatantId: e.targetCombatantId,
              text: `-${e.amount}`,
              className: haunted ? 'popup-haunt' : e.isCrit ? 'popup-crit' : 'popup-damage',
              glyph: haunted ? 'Haunt' : undefined,
            },
          ],
          {
            bannerLead: shieldBroken
              ? `${targetName}'s Shield breaks — takes`
              : absorbed > 0
                ? `${targetName}'s Shield absorbs`
                : haunted
                  ? `${targetName} is caught in the Haunt`
                  : `${targetName} takes`,
            bannerFocus: absorbed > 0 && !shieldBroken ? `${absorbed}` : `${e.amount} damage`,
            bannerFocusKind: absorbed > 0 && !shieldBroken ? 'shield' : tagKind,
            bannerTag: tagText,
            // The caster paying its own price is not the element arriving anywhere.
            fx: e.recoil || e.retribution || e.selfCost ? undefined : landing(e.targetCombatantId, true),
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
        if (events[i]?.type === 'StatusRemoved' && (events[i] as { reason?: string }).reason === 'broken') applied.push(events[i++]);
        if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        let faintEvent: CombatEvent | null = null;
        if (events[i]?.type === 'Fainted') faintEvent = events[i++];
        const targetName = name(e.combatantId);
        const absorbed = e.absorbed ?? 0;
        const through = e.amount - absorbed;
        push(
          applied,
          absorbed > 0
            ? `${targetName}'s ${e.statusId} detonates for ${e.amount} — the Shield takes ${absorbed}!`
            : `${targetName}'s ${e.statusId} detonates for ${e.amount} damage!`,
          [{ combatantId: e.combatantId, text: absorbed > 0 && through > 0 ? `-${absorbed} · -${through}` : `-${e.amount}`, className: 'popup-conduct', glyph: 'Conduct' }],
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
          // EVERY consecutive trigger of the same passive, as one beat: three spawn's Marks at a
          // round's end are one thing happening, not three taps. "Same" reads the name without its
          // parenthetical, so each type's Mark of the Titan folds with the others.
          const landed: StatusAppliedEvent[] = [events[i++] as StatusAppliedEvent];
          applied.push(landed[0]);
          while (
            events[i]?.type === 'PassiveTriggered' &&
            events[i + 1]?.type === 'StatusApplied' &&
            passives[(events[i] as typeof e).passiveId]?.reactive?.effect.kind === 'applyStatus' &&
            passiveFamily(passives[(events[i] as typeof e).passiveId]?.name ?? '') === passiveFamily(label)
          ) {
            applied.push(events[i++]);
            const more = events[i++] as StatusAppliedEvent;
            applied.push(more);
            landed.push(more);
          }
          const statusIds = [...new Set(landed.map((l) => l.statusId))];
          const who = joinNames([...new Set(landed.map((l) => name(l.combatantId)))]);
          const shownLabel = landed.length > 1 ? passiveFamily(label) : label;
          push(
            applied,
            landed.length > 1 ? `${shownLabel} marks ${who}!` : `${label} afflicts ${who} with ${statusIds[0]}!`,
            landed.map((l) => ({ combatantId: l.combatantId, text: l.statusId, className: 'popup-status' })),
            { bannerLead: `${shownLabel} · ${who}`, bannerFocus: statusIds.join(' · '), bannerFocusKind: 'status' }
          );
        } else if (effectKind === 'statDelta' && events[i]?.type === 'StatChanged') {
          // EVERY consecutive StatChanged: a group-target effect emits one per member behind a single trigger.
          const changes: StatChangedEvent[] = [];
          while (events[i]?.type === 'StatChanged') {
            const changed = events[i++] as StatChangedEvent;
            changes.push(changed);
            applied.push(changed);
          }
          const groups = groupByCombatant(changes);
          const who = joinNames(groups.map((g) => name(g.combatantId)));
          push(
            applied,
            `${label} shifts ${who}'s ${joinNames(groups[0].changes.map((c) => c.stat))} (${deltaSummary(groups[0].changes)})`,
            groups.map((g) => ({
              combatantId: g.combatantId,
              text: deltaSummary(g.changes),
              className: g.changes.every((c) => c.capped && c.delta === 0)
              ? g.changes.every((c) => (c.authored ?? 0) > 0)
                ? 'popup-ceiling'
                : 'popup-floor'
              : g.changes.every((c) => c.delta > 0)
                ? 'popup-buff'
                : 'popup-debuff',
            })),
            {
              bannerLead: `${label} · ${who}`,
              bannerFocus: deltaSummary(groups[0].changes),
              bannerFocusKind: changes.every((c) => c.delta < 0) ? 'debuff' : 'buff',
            }
          );
        } else if (effectKind === 'manaSurcharge' && events[i]?.type === 'ManaSurcharged') {
          const taxed = events[i++] as ManaSurchargedEvent;
          applied.push(taxed);
          push(
            applied,
            `${label} grips ${name(taxed.combatantId)}: every move costs ${taxed.total} more Mana!`,
            [{ combatantId: taxed.combatantId, text: `+${taxed.delta} MP`, className: 'popup-debuff' }],
            { bannerLead: `${label} · ${name(taxed.combatantId)}`, bannerFocus: `+${taxed.total} MP a move`, bannerFocusKind: 'debuff' }
          );
        } else if (effectKind === 'damage' && events[i]?.type === 'HpChanged') {
          // EVERY consecutive HpChanged, each with the Fainted that may trail it: a group-target
          // effect (Broadside's volley, Dread's Nightmare) is one blow with several landings.
          const hits: HpChangedEvent[] = [];
          while (events[i]?.type === 'HpChanged') {
            const hp = events[i++] as HpChangedEvent;
            hits.push(hp);
            applied.push(hp);
            if (events[i]?.type === 'Fainted') applied.push(events[i++]);
          }
          // The status the payload spent (Broadside's magazine), so the chip clears on the same
          // beat — and what it held, which is how many balls the volley draws.
          let spent: number | undefined;
          while (events[i]?.type === 'StatusRemoved' && (events[i] as StatusRemovedEvent).combatantId === e.combatantId) {
            const removed = events[i++] as StatusRemovedEvent;
            applied.push(removed);
            spent = removed.magnitude ?? spent;
          }
          const struck = hits.map((hp) => ({ hp, amount: hp.previousHp - hp.newHp })).filter((h) => h.amount > 0);
          const who = joinNames(struck.map((h) => name(h.hp.combatantId)));
          const total = struck.reduce((sum, h) => sum + h.amount, 0);
          const fxKind = PASSIVE_FX[e.passiveId];
          push(
            applied,
            `${label} tears into ${who} for ${total} damage!`,
            struck.map((h) => ({ combatantId: h.hp.combatantId, text: `-${h.amount}`, className: 'popup-damage' })),
            {
              bannerLead: `${label} · ${ownerName}`,
              bannerFocus: `-${total}`,
              bannerFocusKind: 'damage',
              ...(fxKind
                ? {
                    fx: struck.map((h) => ({
                      combatantId: h.hp.combatantId,
                      type: ownerType(e.combatantId),
                      kind: fxKind,
                      ...(spent === undefined ? {} : { count: spent }),
                    })),
                  }
                : {}),
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
        const arriving = combatants[e.inCombatantId]?.heroId;
        // The scene first, on its own beat with nothing applied, so the field is still the Herald's
        // fall when the Titan rises over it; the Eye's reveal beat is the one that puts it on the board.
        const cinematic = cinematicEntranceFor(arriving);
        if (cinematic) push([], 'The Titan rises', [], { cinematic, bannerFocusKind: 'ko' });
        const entrance = dramaticEntranceFor(arriving);
        if (entrance) {
          push([e], `${inName} takes the field!`, [], {
            bannerLead: entrance.lead,
            bannerFocus: inName,
            bannerFocusKind: 'ko',
            bannerMeta: entrance.meta,
            bannerMetaClass: 'banner-meta-rules',
            dramaticEntrance: true,
          });
          i++;
          break;
        }
        // One beat for the whole switch (2026-09-30, per user direction — it was two): FightScreen
        // holds the swap back while the leaving hero recalls, then lands it and the arrival is sent
        // out. A replacement for a fallen hero has nobody to recall.
        if (e.outCombatantId) {
          const outName = name(e.outCombatantId);
          push([e], `${outName} falls back — ${inName} switches in!`, [], {
            bannerLead: `${outName} falls back`,
            bannerFocus: inName,
            bannerSub: 'switches in',
            bannerFocusKind: 'buff',
            recallCombatantId: e.outCombatantId,
            summonCombatantId: e.inCombatantId,
          });
          i++;
          break;
        }
        push([e], `${inName} switches in!`, [], {
          bannerLead: 'Switching in',
          bannerFocus: inName,
          bannerFocusKind: 'buff',
          summonCombatantId: e.inCombatantId,
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
        // A heal on both allies is one payload: every consecutive plain heal folds into this beat.
        const heals: HealedEvent[] = [e];
        while (!e.drain && events[i]?.type === 'Healed' && !(events[i] as HealedEvent).drain) {
          const more = events[i++] as HealedEvent;
          heals.push(more);
          applied.push(more);
          if (events[i]?.type === 'HpChanged') applied.push(events[i++]);
        }
        if (heals.length > 1) {
          const who = joinNames(heals.map((h) => name(h.targetCombatantId)));
          const uniform = heals.every((h) => h.amount === e.amount);
          push(
            applied,
            uniform ? `${who} recover ${e.amount} HP each` : heals.map((h) => `${name(h.targetCombatantId)} recovers ${h.amount} HP`).join('; '),
            heals.map((h) => ({ combatantId: h.targetCombatantId, text: `+${h.amount}`, className: 'popup-heal' })),
            {
              bannerLead: `${who} recover`,
              bannerFocus: uniform ? `+${e.amount} HP each` : heals.map((h) => `+${h.amount}`).join(' · '),
              bannerFocusKind: 'heal',
              fx: landings(heals.map((h) => h.targetCombatantId)),
            }
          );
          break;
        }
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
            fx: landing(e.targetCombatantId),
          }
        );
        break;
      }

      // EVERY consecutive StatChanged, as one beat: a move that swings two stats (Weaken's DEF
      // and WIS) or hits both foes is one payload, so it costs one tap rather than four.
      case 'StatChanged': {
        const changes: StatChangedEvent[] = [];
        while (events[i]?.type === 'StatChanged') changes.push(events[i++] as StatChangedEvent);
        const groups = groupByCombatant(changes);
        const falling = changes.every((c) => c.delta < 0 || (c.capped && c.delta === 0 && (c.authored ?? 0) <= 0));
        // Identical payloads across targets read as one sentence about both, not as a list.
        const uniform = groups.every((g) => signatureOf(g.changes) === signatureOf(groups[0].changes));
        const lead = uniform
          ? `${joinNames(groups.map((g) => name(g.combatantId)))}'s ${joinNames(groups[0].changes.map((c) => c.stat))} ${statVerb(
              groups[0].changes,
              groups.length > 1
            )}`
          : groups.map((g) => statClause(name(g.combatantId), g.changes)).join('; ');
        push(
          changes,
          uniform ? `${lead} (${deltaSummary(groups[0].changes)})` : lead,
          groups.map((g) => ({
            combatantId: g.combatantId,
            text: deltaSummary(g.changes),
            className: g.changes.every((c) => c.delta > 0) ? 'popup-buff' : 'popup-debuff',
          })),
          {
            bannerLead: lead,
            bannerFocus: deltaSummary(groups[0].changes),
            bannerFocusKind: falling ? 'debuff' : 'buff',
            fx: landings(groups.map((g) => g.combatantId)),
          }
        );
        break;
      }

      case 'StatusApplied': {
        const targetName = name(e.combatantId);
        const detail = e.magnitude !== undefined ? ` (${statusAmountText(e.statusId, e.magnitude)})` : e.duration !== undefined ? ` (${e.duration})` : '';
        // Renew and Ambush are things a hero GAINS; only the rest are afflictions.
        const verb = statuses[e.statusId]?.positive ? 'gains' : 'is afflicted with';
        if (statuses[e.statusId]?.pipeline === 'shield') {
          // A pool, not a mark: the figure is the beat, and at the cap the beat says why (docs/shield.md §5).
          // Laid on several allies at once (Tide Guard, Bastion), it is one beat with a figure each.
          const pools: StatusAppliedEvent[] = [e];
          while (events[i + pools.length]?.type === 'StatusApplied' && (events[i + pools.length] as StatusAppliedEvent).statusId === e.statusId) {
            pools.push(events[i + pools.length] as StatusAppliedEvent);
          }
          if (pools.length > 1) {
            const who = joinNames(pools.map((p) => name(p.combatantId)));
            const same = pools.every((p) => p.magnitude === e.magnitude && !p.capped);
            push(
              pools,
              same ? `${who} gain Shield ${e.magnitude}` : pools.map((p) => (p.capped ? `${name(p.combatantId)}'s Shield can't go any higher` : `${name(p.combatantId)} gains Shield ${p.magnitude}`)).join('; '),
              pools.map((p) => ({
                combatantId: p.combatantId,
                text: p.capped ? "Can't go any higher" : `Shield ${p.magnitude}`,
                className: p.capped ? 'popup-ceiling' : 'popup-shield-gain',
                glyph: 'Shield',
              })),
              {
                bannerLead: `${who} gain`,
                bannerFocus: same ? `Shield ${e.magnitude}` : 'Shield',
                bannerFocusKind: 'shield',
                fx: landings(pools.map((p) => p.combatantId)),
              }
            );
            i += pools.length;
            break;
          }
          const capped = e.capped === true;
          push(
            [e],
            capped ? `${targetName}'s Shield can't go any higher (${e.magnitude})` : `${targetName} gains Shield ${e.magnitude}`,
            [{ combatantId: e.combatantId, text: capped ? "Can't go any higher" : `Shield ${e.magnitude}`, className: capped ? 'popup-ceiling' : 'popup-shield-gain', glyph: 'Shield' }],
            {
              bannerLead: capped ? `${targetName}'s Shield` : `${targetName} gains`,
              bannerFocus: capped ? "can't go any higher" : `Shield ${e.magnitude}`,
              bannerFocusKind: 'shield',
              fx: landing(e.combatantId),
            }
          );
          i++;
          break;
        }
        // The same status landing on several targets back to back (a spread rider, a team grant) is
        // one payload, so one beat — the detail kept only when every target took the same figure.
        const group: StatusAppliedEvent[] = [e];
        let j = i + 1;
        while (events[j]?.type === 'StatusApplied' && (events[j] as StatusAppliedEvent).statusId === e.statusId && (events[j] as StatusAppliedEvent).combatantId !== e.combatantId) {
          group.push(events[j++] as StatusAppliedEvent);
        }
        if (group.length > 1) {
          const who = joinNames(group.map((g) => name(g.combatantId)));
          const same = group.every((g) => g.magnitude === e.magnitude && g.duration === e.duration);
          const pluralVerb = statuses[e.statusId]?.positive ? 'gain' : 'are afflicted with';
          push(
            group,
            `${who} ${pluralVerb} ${e.statusId}${same ? detail : ''}`,
            group.map((g) => ({ combatantId: g.combatantId, text: e.statusId, className: 'popup-status' })),
            { bannerLead: `${who} ${pluralVerb}`, bannerFocus: `${e.statusId}${same ? detail : ''}`, bannerFocusKind: 'status', fx: landings(group.map((g) => g.combatantId)) }
          );
          i = j;
          break;
        }
        push(
          [e],
          `${targetName} ${verb} ${e.statusId}${detail}`,
          [{ combatantId: e.combatantId, text: e.statusId, className: 'popup-status' }],
          { bannerLead: `${targetName} ${verb}`, bannerFocus: `${e.statusId}${detail}`, bannerFocusKind: 'status', fx: landing(e.combatantId) }
        );
        i++;
        break;
      }

      // The round's end: one beat for all of its upkeep (roundEnd, above).
      case 'BenchRegenTicked':
      case 'ManaRegenTicked':
      case 'StatusTicked':
        roundEnd();
        break;

      // A status leaving on its own — expiry, decay, a switch — is bookkeeping, carried so the
      // badge still clears. Only a cleanse is somebody's payload.
      case 'StatusRemoved': {
        // A Haunt passing off the fallen (passesOnFaint): one beat with its new host when it has one.
        const next = events[i + 1];
        if (e.reason === 'passed' && next?.type === 'StatusApplied' && next.statusId === e.statusId) {
          const hostName = name(next.combatantId);
          push([e, next], `The ${e.statusId} on ${name(e.combatantId)} passes to ${hostName}`, [{ combatantId: next.combatantId, text: e.statusId, className: 'popup-status', glyph: e.statusId }], {
            bannerLead: `The ${e.statusId} passes to`,
            bannerFocus: hostName,
            bannerFocusKind: 'status',
            fx: landing(next.combatantId),
          });
          i += 2;
          break;
        }
        if (e.reason !== 'cleanse') {
          carry.push(e);
          i++;
          break;
        }
        push([e], `${name(e.combatantId)}'s ${e.statusId} is cleansed`);
        i++;
        break;
      }

      case 'ActionBlocked': {
        const targetName = name(e.combatantId);
        const text =
          e.reason === 'dazed'
            ? `${targetName} is Dazed and can't move!`
            : e.reason === 'targetStatusMissing'
              ? `${targetName} has nothing to aim at!`
              : e.reason === 'moveUnavailable'
                ? `${targetName} can't use that move now!`
                : `${targetName}'s target is already down!`;
        push([e], text, [], { bannerFocusKind: 'debuff' });
        i++;
        break;
      }

      // The turn-away reads on the DEFENDER, so it is a buff beat on them rather than a
      // failure beat on the caster — the guard is the thing that happened.
      case 'MoveGuarded': {
        push([e], `${name(e.combatantId)} turns it away!`, [], { bannerFocusKind: 'buff' });
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
        // Right behind the round's end beat, the lapse rides on it as a line rather than a tap of its
        // own (2026-09-30, per user direction). Anything shown in between keeps it separate, so the
        // plaque never clears ahead of a beat that still reads the field.
        const last = beats[beats.length - 1];
        if (last && last === roundEndBeat) {
          last.events.push(...carry, e);
          carry = [];
          last.banner = `${last.banner}; ${fx?.name ?? e.fieldEffectId} fades from the battlefield.`;
          last.bannerMeta = `${fx?.name ?? e.fieldEffectId} fades`;
          i++;
          break;
        }
        push([e], `${fx?.name ?? e.fieldEffectId} fades from the battlefield.`, [], {
          bannerLead: 'The field settles',
          bannerFocus: `${fx?.name ?? e.fieldEffectId} fades`,
          bannerAccent: fx?.flavorType ? getTypeColor(fx.flavorType) : undefined,
        });
        i++;
        break;
      }

      // The field's drain (Withering Gaze): the Clock's shape, one beat for the board, KOs split off.
      case 'FieldEffectDrained': {
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
        const fx = fieldEffects[e.fieldEffectId];
        const label = fx?.name ?? e.fieldEffectId;
        const pct = Math.round(e.fraction * 100);
        push(applied, `${label} presses — everyone under it loses ${pct}% of their health!`, popups, {
          bannerLead: `${label} presses`,
          bannerFocus: `-${pct}% HP`,
          bannerFocusKind: 'damage',
          bannerAccent: fx?.flavorType ? getTypeColor(fx.flavorType) : undefined,
          bannerMeta: 'A field of your own would turn it aside.',
        });
        for (const faint of faints) {
          push([faint], `${name(faint.combatantId)} is knocked out!`, [], { bannerFocusKind: 'ko' });
        }
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

      // A Blessing spent on anything but a move's hit (a DoT tick, a passive, the Gaze) — the hit's
      // own case folds it into the strike instead.
      case 'BlessingSpent': {
        const blessedName = name(e.combatantId);
        push([e], `${blessedName}'s Blessing turns aside ${e.prevented} damage!`, [{ combatantId: e.combatantId, text: `${e.prevented}`, className: 'popup-blessed' }], {
          bannerLead: `${blessedName}'s Blessing turns aside`,
          bannerFocus: `${e.prevented} damage`,
          bannerFocusKind: 'blessing',
        });
        i++;
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
