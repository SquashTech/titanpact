// Combat audio: one sound per revealed beat (buildBeats.ts), chosen from the beat's most
// salient event. View-layer subscriber — nothing here reaches back into the engine.

import type { Beat } from '../view/combat/buildBeats';
import type { CombatEvent, StatChangedEvent, StatusTickedEvent } from '../engine/events';
import { playSfx } from './sfx';
import type { SfxId } from './sounds';

/** Which event in a beat gets to speak, most salient first. */
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

const RANK = new Map<CombatEvent['type'], number>(PRIORITY.map((type, i) => [type, i]));

function leadEvent(beat: Beat): CombatEvent | null {
  let lead: CombatEvent | null = null;
  let best = Infinity;
  for (const e of beat.events) {
    const rank = RANK.get(e.type);
    if (rank !== undefined && rank < best) {
      best = rank;
      lead = e;
    }
  }
  return lead;
}

/**
 * How a hit's numbers bend the base impact: bigger hits play lower and louder (saturating,
 * so an outlier never drops into sub-bass); effectiveness moves brightness as well as level.
 */
export function damageVoicing(amount: number, typeMult: number): { pitch: number; gain: number } {
  const weight = amount / (amount + 55);
  let pitch = 1.22 - weight * 0.52;
  let gain = 0.7 + weight * 0.55;

  if (typeMult >= 2) {
    pitch *= 1.1;
    gain *= 1.2;
  } else if (typeMult <= 0.5) {
    pitch *= 0.9;
    gain *= 0.6;
  }

  return { pitch, gain };
}

function statusTickVoicing(e: StatusTickedEvent): { id: SfxId; pitch: number; gain: number } | null {
  if (e.kind === 'duration') return null;
  if (e.kind === 'heal') return { id: 'heal', pitch: 1.08, gain: 0.6 };
  // DoT ticks: the status sizzle pitched up, so it reads as the condition working, not a new hit.
  return { id: 'status', pitch: 1.25, gain: 0.7 };
}

function statVoicing(e: StatChangedEvent): { id: SfxId; pitch: number; gain: number } {
  return { id: e.delta > 0 ? 'buff' : 'debuff', pitch: 1, gain: 1 };
}

/** Plays the sound for one revealed beat. Fire-and-forget; never throws. */
export function playBeatSfx(beat: Beat): void {
  // Checked before PRIORITY: a dramatic entrance IS a SwitchedIn, and must not sound like one.
  if (beat.dramaticEntrance) {
    playSfx('entrance.dread');
    return;
  }
  // The opening beat carries no events at all, so PRIORITY has nothing to read off it.
  if (beat.engagement) {
    playSfx('battle.join');
    return;
  }

  const lead = leadEvent(beat);
  if (!lead) return;

  switch (lead.type) {
    case 'DamageDealt': {
      const id: SfxId = lead.category === 'physical' ? 'hit.physical' : 'hit.magical';
      playSfx(id, damageVoicing(lead.amount, lead.typeMult));
      // Layered, not substituted: a crit is the same attack landing harder.
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
