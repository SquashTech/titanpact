import type { CSSProperties, ReactNode } from 'react';
import type { SfxId } from '../../audio/sfx';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { patrons } from '../../data/patrons';
import { PATRON_ROWS, type MapNode } from '../../run/map';
import { CAPSTONE_TRUST, fittedRarity, patronAtSeat, patronItemId, seatIndexFor, trustOf, type PatronDefinition, type PatronStep } from '../../run/patrons';
import type { RunState } from '../../run/state';
import { RARITY_LABELS } from '../shared/EquipmentBox';
import { EQUIP_FORM_PATHS } from '../shared/equipmentIcons';
import { STAT_PATHS } from '../shared/statIcons';
import type { NodeFact } from './nodeFacts';

/** The mortarboard the Academy wore (nodeIcons academyReward). */
const MORTARBOARD = (
  <>
    <path d="M12 3.2 23 8.4l-11 5.2L1 8.4Z" />
    <path d="M5.8 11.4v4.4c1.7 1.9 3.8 2.8 6.2 2.8s4.5-.9 6.2-2.8v-4.4L12 14.4Z" />
    <path d="M20.3 9.6h1.4v6.6h-1.4Z" />
    <circle cx="21" cy="17.6" r="1.5" />
  </>
);

const PATRON_PATHS: Record<string, ReactNode> = {
  swordsman: EQUIP_FORM_PATHS.sword,
  archmage: EQUIP_FORM_PATHS.staff,
  headmaster: MORTARBOARD,
  huntress: EQUIP_FORM_PATHS.bow,
  priest: STAT_PATHS.wisdom,
  hexwright: EQUIP_FORM_PATHS.sigil,
  forgemistress: EQUIP_FORM_PATHS.hammer,
};

export const PATRON_COLORS: Record<string, string> = {
  swordsman: '#c7ccd6',
  archmage: '#9a7cff',
  headmaster: '#b8c95a',
  huntress: '#7fbf6a',
  priest: '#ffe08a',
  hexwright: '#c46adf',
  forgemistress: '#ff8a2a',
};

export function patronColor(patronId: string): string {
  return PATRON_COLORS[patronId] ?? 'var(--buff)';
}

/** Each patron's figure (art/npc/patron-<id>.png), 48px. */
const PATRON_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../../art/npc/patron-*.png', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.slice(path.lastIndexOf('/patron-') + '/patron-'.length, -'.png'.length),
    url,
  ])
);

export function patronArt(patronId: string): string | undefined {
  return PATRON_ART[patronId];
}

/** The patron as drawn: its figure, or its mark until it has one. */
export function PatronFigure({ patronId, className }: { patronId: string; className?: string }) {
  const art = PATRON_ART[patronId];
  return art ? <img src={art} className={`patron-art${className ? ` ${className}` : ''}`} alt="" draggable={false} /> : <PatronGlyph patronId={patronId} className={className} />;
}

/**
 * What a patron's arrival on the map is made of (styles.css "Patron entrances"), played every time
 * its seat's row is revealed. A patron with no entry simply appears.
 */
interface PatronEntranceSpec {
  parts: readonly string[];
  /** Small pieces thrown out or drawn in (sparks, pages), fanned over `spread` degrees. */
  bits?: { kind: string; count: number; spread: number };
  sfx: SfxId;
}

const ENTRANCES: Record<string, PatronEntranceSpec> = {
  swordsman: { parts: ['slash', 'dust'], sfx: 'patron.swordsman' },
  archmage: { parts: ['circle', 'column'], sfx: 'patron.archmage' },
  huntress: { parts: ['trail', 'arrow', 'dust'], sfx: 'patron.huntress' },
  priest: { parts: ['beam', 'halo'], sfx: 'patron.priest' },
  hexwright: { parts: ['smoke-a', 'smoke-b', 'smoke-c'], sfx: 'patron.hexwright' },
  forgemistress: { parts: ['glow', 'flash'], bits: { kind: 'spark', count: 10, spread: 160 }, sfx: 'patron.forgemistress' },
  headmaster: { parts: ['dust'], bits: { kind: 'page', count: 6, spread: 360 }, sfx: 'patron.headmaster' },
};

/** The patron's own arrival sound, or none. */
/** Each patron's entrance pose (art/npc/poses/<id>.png), 48px: flown through the entrance's motion, the standing figure taking over on landing. */
const PATRON_POSES: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('../../../art/npc/poses/*.png', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.png'.length),
    url,
  ])
);

export function patronPose(patronId: string): string | undefined {
  return PATRON_POSES[patronId];
}

export function patronEntranceSfx(patronId: string): SfxId | undefined {
  return ENTRANCES[patronId]?.sfx;
}

function bitAngle(i: number, count: number, spread: number): number {
  return spread >= 360 ? (360 * i) / count : -spread / 2 + (spread * i) / Math.max(1, count - 1);
}

export function PatronEntrance({ patronId }: { patronId: string }) {
  const spec = ENTRANCES[patronId];
  if (!spec) return null;
  const bits = spec.bits;
  const pose = PATRON_POSES[patronId];
  return (
    <span className={`patron-entrance is-${patronId}`} aria-hidden="true">
      {pose && <img src={pose} className="patron-entrance-pose patron-art" alt="" draggable={false} />}
      {spec.parts.map((part) => (
        <span key={part} className={`patron-entrance-${part}`} />
      ))}
      {bits &&
        Array.from({ length: bits.count }, (_, i) => (
          <span
            key={`bit-${i}`}
            className={`patron-entrance-bit is-${bits.kind}`}
            style={{ '--bit-angle': `${bitAngle(i, bits.count, bits.spread)}deg`, '--bit-reach': `${34 + ((i * 17) % 22)}px` } as CSSProperties}
          />
        ))}
    </span>
  );
}

export function PatronGlyph({ patronId, className }: { patronId: string; className?: string }) {
  return (
    <svg className={`node-glyph${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {PATRON_PATHS[patronId] ?? MORTARBOARD}
    </svg>
  );
}

/** The patron a seat tile holds, or null for any other node. */
export function patronOfNode(run: RunState, node: MapNode): PatronDefinition | null {
  if (node.type !== 'patronSeat') return null;
  const seat = seatIndexFor(run.actNumber, node.row, PATRON_ROWS);
  const id = seat === null ? null : patronAtSeat(run, seat, node.col);
  return id ? (patrons[id] ?? null) : null;
}

/** Trust as pips: filled up to the patron's Trust, out of five. */
export function TrustPips({ trust, className }: { trust: number; className?: string }) {
  return (
    <span className={`patron-trust${className ? ` ${className}` : ''}`} aria-label={`Trust ${trust} of ${CAPSTONE_TRUST}`}>
      {Array.from({ length: CAPSTONE_TRUST }, (_, i) => (
        <span key={i} className={`patron-trust-pip${i < trust ? ' is-filled' : ''}`} />
      ))}
    </span>
  );
}

/** One step of a rung as a ledger row. */
export function stepFact(step: PatronStep, actNumber: number): NodeFact {
  switch (step.kind) {
    case 'item': {
      const item = equipment[patronItemId(step.familyId, actNumber)];
      return { glyph: 'item', label: item.name, value: RARITY_LABELS[item.rarity], who: 'one' };
    }
    case 'liftItem':
      return { glyph: 'anvil', label: equipment[patronItemId(step.familyId, actNumber)].name, value: 'A tier up', who: 'one' };
    case 'unique':
      return { glyph: 'item', label: equipment[step.uniqueId].name, value: 'Unique', who: 'one' };
    case 'move':
      return { glyph: 'move', label: 'Move', value: moves[step.moveId].name, who: 'one' };
    case 'passive':
      return { glyph: 'passive', label: 'Passive', value: passives[step.passiveId].name, who: 'one' };
    case 'class':
      return { glyph: 'class', label: 'Class', value: step.pick ? `Pick of ${step.count}` : `1 of ${step.count}`, who: 'one' };
    case 'masterClass':
      return { glyph: 'class', label: 'Master Class', value: `1 of ${step.classIds.length}`, who: 'one' };
    case 'forge':
      return { glyph: 'anvil', label: 'Forge', value: 'Lift + bind', who: 'one' };
    case 'fittedItem':
      return { glyph: 'item', label: 'Fitted piece', value: RARITY_LABELS[fittedRarity(actNumber, step.tiersAhead)], who: 'one' };
    case 'uniqueChoice':
      return { glyph: 'item', label: 'Unique', value: `1 of ${step.uniqueIds.length}`, who: 'one' };
  }
}

/** The steps the next meeting with `patron` pays. */
export function nextRungSteps(run: RunState, patron: PatronDefinition): readonly PatronStep[] {
  const rung = Math.min(trustOf(run, patron.id) + 1, CAPSTONE_TRUST);
  return patron.rungs[rung - 1];
}
