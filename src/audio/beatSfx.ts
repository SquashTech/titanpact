/**
 * Combat audio: turns the engine's event stream into sound.
 *
 * This is the audio half of the same subscription the visuals already use.
 * The engine emits an ordered stream, buildBeats.ts groups it into the units
 * the player reveals one tap at a time, and this file says what each of
 * those units sounds like. Nothing here reaches back into the engine, and
 * the engine has no idea it exists (CLAUDE.md: "Never bake timing, animation,
 * or sound into the engine").
 *
 * One sound per beat, not one per event. A beat is one thing the player is
 * being told; a DamageDealt bundled with its HpChanged is still one hit, and
 * playing both would just smear the transient.
 */

import type { Beat } from '../view/combat/buildBeats';
import type { CombatEvent, DamageDealtEvent, StatChangedEvent, StatusTickedEvent } from '../engine/events';
import { playSfx } from './sfx';
import type { SfxId } from './sounds';

/**
 * Which event in a beat gets to speak, most salient first. A beat that
 * bundles a detonation with its HP change is a detonation; a beat that
 * bundles a hit with its HP change is a hit.
 */
const PRIORITY: readonly CombatEvent['type'][] = [
  'Fainted',
  'StatusDetonated',
  'DamageDealt',
  'Healed',
  'FieldEffectSet',
  'SwitchedIn',
  'StatusApplied',
  'StatusTicked',
  'StatChanged',
  'Rested',
  'ManaRegenTicked',
  'MoveUsed',
  'ActionBlocked',
];

function leadEvent(beat: Beat): CombatEvent | null {
  for (const type of PRIORITY) {
    const found = beat.events.find((e) => e.type === type);
    if (found) return found;
  }
  return null;
}

/**
 * Damage → how the impact is voiced. The base sound stays the same; the
 * hit's own numbers bend it, which is what lets one sound cover a 4-damage
 * chip and a 120-damage crit without either sounding wrong.
 *
 *  - Bigger hits play LOWER and louder. Pitch-down is the single most
 *    reliable "this was heavy" cue, and it costs nothing.
 *  - Type effectiveness moves brightness, not volume alone: a resisted hit
 *    is dull and small, a super-effective one sharp and forward. The player
 *    hears the matchup before they read the banner.
 */
function damageVoicing(e: DamageDealtEvent): { id: SfxId; pitch: number; gain: number } {
  const id: SfxId = e.category === 'physical' ? 'hit.physical' : 'hit.magical';

  // Saturating curve: heavy hits keep getting a little lower without ever
  // sliding into inaudible sub-bass on an outlier roll.
  const weight = e.amount / (e.amount + 55);
  let pitch = 1.22 - weight * 0.52;
  let gain = 0.7 + weight * 0.55;

  if (e.typeMult >= 2) {
    pitch *= 1.1;
    gain *= 1.2;
  } else if (e.typeMult <= 0.5) {
    pitch *= 0.9;
    gain *= 0.6;
  }

  return { id, pitch, gain };
}

function statusTickVoicing(e: StatusTickedEvent): { id: SfxId; pitch: number; gain: number } | null {
  // A plain countdown tick is bookkeeping — it doesn't even get its own beat
  // most of the time, and it certainly shouldn't get its own sound.
  if (e.kind === 'duration') return null;
  if (e.kind === 'heal') return { id: 'heal', pitch: 1.08, gain: 0.6 };
  // DoT ticks reuse the status sizzle pitched up, so they read as the
  // condition working rather than as a fresh attack landing.
  return { id: 'status', pitch: 1.25, gain: 0.7 };
}

function statVoicing(e: StatChangedEvent): { id: SfxId; pitch: number; gain: number } {
  return { id: e.delta > 0 ? 'buff' : 'debuff', pitch: 1, gain: 1 };
}

/**
 * Plays the sound for one revealed beat. Call it from wherever the beat is
 * revealed — it is a fire-and-forget side effect and never throws.
 */
export function playBeatSfx(beat: Beat): void {
  // Checked ahead of the PRIORITY table rather than added to it: a dramatic
  // entrance IS a SwitchedIn, so priority alone could never separate the two,
  // and the whole point is that this one does not sound like a switch
  // (view/combat/entrances.ts, sounds.ts 'entrance.dread').
  if (beat.dramaticEntrance) {
    playSfx('entrance.dread');
    return;
  }

  const lead = leadEvent(beat);
  if (!lead) return;

  switch (lead.type) {
    case 'DamageDealt': {
      const { id, pitch, gain } = damageVoicing(lead);
      playSfx(id, { pitch, gain });
      // Layered rather than substituted: a crit is the same attack landing
      // harder, and the crit layer's own delayed crack supplies the
      // separation that makes it register as an event.
      if (lead.isCrit) playSfx('hit.crit', { gain: 1 });
      break;
    }
    case 'Fainted':
      playSfx('faint');
      break;
    case 'StatusDetonated':
      playSfx('detonate');
      break;
    case 'Healed':
      playSfx('heal');
      break;
    case 'FieldEffectSet':
      playSfx('field');
      break;
    case 'SwitchedIn':
      playSfx('switchIn');
      break;
    case 'StatusApplied':
      playSfx('status');
      break;
    case 'StatusTicked': {
      const voicing = statusTickVoicing(lead);
      if (voicing) playSfx(voicing.id, { pitch: voicing.pitch, gain: voicing.gain });
      break;
    }
    case 'StatChanged': {
      const { id, pitch, gain } = statVoicing(lead);
      playSfx(id, { pitch, gain });
      break;
    }
    case 'Rested':
      playSfx('mana', { pitch: 0.92 });
      break;
    case 'ManaRegenTicked':
      playSfx('mana', { gain: 0.7 });
      break;
    case 'MoveUsed':
      playSfx('cast');
      break;
    case 'ActionBlocked':
      playSfx('ui.denied', { gain: 0.8 });
      break;
    default:
      break;
  }
}
