import type { CSSProperties } from 'react';
import type { MapNodeType } from '../../run/map';
import { allCombatants } from '../../data/content';
import { getTypeColor } from '../combat/typeColors';
import { SceneLights, type SceneLight } from '../shared/SceneLights';
import mentorArt from '../../../art/map-nodes/landmarks/mentor.png';
import tutorArt from '../../../art/map-nodes/landmarks/tutor.png';
import lapidaryArt from '../../../art/map-nodes/landmarks/lapidary.png';
import academyArt from '../../../art/map-nodes/landmarks/academy.png';
import campArt from '../../../art/map-nodes/landmarks/camp.png';
import towerArt from '../../../art/map-nodes/landmarks/guardianTower.png';
import titanStoneArt from '../../../art/map-nodes/landmarks/titanStone.png';
import titanGateArt from '../../../art/map-nodes/landmarks/titanGate.png';
import titanGateFrameArt from '../../../art/map-nodes/landmarks/titanGateFrame.png';
import titanGateLeafLeftArt from '../../../art/map-nodes/landmarks/titanGateLeafL.png';
import titanGateLeafRightArt from '../../../art/map-nodes/landmarks/titanGateLeafR.png';

// The act's beats, drawn as themselves rather than as a stone medallion: the opening fight is a
// standing stone the Titan's eye has cracked open on the road, the Mentor, the Tutor and the Scribe are met at the
// roadside (a fire, a practice post, a writing desk), the Camp is pitched by the road, the Academy a building you walk into,
// the act's Guardian keeps a tower at the top of the road, and the finale is a
// greater gate sealed with the Titan's own eye.

/** The Titan's own red: the light behind the finale gate's doors and in the opening stone's eye. */
export const TITAN_LIGHT = '#f247dc';

export type LandmarkKind = 'stone' | 'npc' | 'building' | 'tower' | 'titanGate';

const KIND: Partial<Record<MapNodeType, LandmarkKind>> = {
  fight: 'stone',
  mentorReward: 'npc',
  tutorReward: 'npc',
  scribeReward: 'npc',
  academyReward: 'building',
  camp: 'building',
  boss: 'tower',
  finale: 'titanGate',
};

const NPC_ART: Partial<Record<MapNodeType, string>> = {
  mentorReward: mentorArt,
  tutorReward: tutorArt,
  scribeReward: lapidaryArt,
};

/** A building's own sprite; the Camp's when a type has none. */
const BUILDING_ART: Partial<Record<MapNodeType, string>> = {
  academyReward: academyArt,
};

// The stone's eye (rows 12-26 of 64) burning, and embers lifting off the cracks at its foot.
const STONE_LIGHTS: readonly SceneLight[] = [
  { kind: 'glow', x: 53, y: 30, size: 34, rgb: '255, 90, 50' },
  { kind: 'ember', x: 36, y: 74 },
  { kind: 'ember', x: 58, y: 70 },
  { kind: 'ember', x: 70, y: 78 },
];

/**
 * A gate's art in three layers that stack back to its single sprite: the arch round a dark doorway,
 * and the two leaves, which swing inward when the gate is opened (MapRoute OPENING). The doorway's
 * box and the hinges are the sprite's own columns and rows, as a fraction of its side.
 */
interface GateDoor {
  frame: string;
  left: string;
  right: string;
  l: number;
  r: number;
  t: number;
  b: number;
}

const TITAN_DOOR: GateDoor = { frame: titanGateFrameArt, left: titanGateLeafLeftArt, right: titanGateLeafRightArt, l: 38 / 128, r: 83 / 128, t: 25 / 128, b: 107 / 128 };

function GateArt({ door, light }: { door: GateDoor; light: string }) {
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  const style = { '--door-l': pct(door.l), '--door-r': pct(door.r), '--door-t': pct(door.t), '--door-b': pct(door.b), '--door-light': light } as CSSProperties;
  return (
    <span className="map-landmark-art map-gate-art" style={style}>
      <img src={door.frame} alt="" draggable={false} />
      <span className="map-gate-inner" />
      <img src={door.left} className="map-gate-leaf is-left" alt="" draggable={false} />
      <img src={door.right} className="map-gate-leaf is-right" alt="" draggable={false} />
    </span>
  );
}

export function landmarkKind(type: MapNodeType): LandmarkKind | undefined {
  return KIND[type];
}

const LANDMARK_STILL: Partial<Record<LandmarkKind, string>> = {
  stone: titanStoneArt,
  building: campArt,
  tower: towerArt,
  titanGate: titanGateArt,
};

/** A landmark as one still sprite — the gate shut, no lights — for where it is drawn small, off the map. */
export function landmarkStillArt(type: MapNodeType): string | undefined {
  const kind = KIND[type];
  if (!kind) return undefined;
  if (kind === 'npc') return NPC_ART[type];
  if (kind === 'building') return BUILDING_ART[type] ?? campArt;
  return LANDMARK_STILL[kind];
}

export function MapLandmarkFace({
  kind,
  type,
  guardianId,
  quiet = false,
}: {
  kind: LandmarkKind;
  type: MapNodeType;
  guardianId: string | null;
  /** Behind the player (the route's origin): no invitation to tap. */
  quiet?: boolean;
}) {
  switch (kind) {
    case 'stone':
      if (quiet) return <img src={titanStoneArt} className="map-landmark-art" alt="" draggable={false} />;
      // The ripple waits a few seconds and then keeps asking: it is only ever seen by a player
      // who has not tapped yet.
      return (
        <>
          <span className="map-stone-ripple" aria-hidden="true" />
          <span className="map-stone-ripple is-second" aria-hidden="true" />
          <img src={titanStoneArt} className="map-landmark-art" alt="" draggable={false} />
          <SceneLights lights={STONE_LIGHTS} className="map-stone-lights" />
        </>
      );
    case 'npc':
      return <img src={NPC_ART[type]} className="map-landmark-art" alt="" draggable={false} />;
    case 'building':
      return <img src={BUILDING_ART[type] ?? campArt} className="map-landmark-art" alt="" draggable={false} />;
    case 'tower': {
      // The Guardian's keep, its door lit in the Guardian's element.
      const type = guardianId ? allCombatants[guardianId]?.types[0] : undefined;
      const style = { '--warden-color': type ? getTypeColor(type) : '#e0a63c' } as CSSProperties;
      return (
        <>
          <img src={towerArt} className="map-landmark-art" alt="" draggable={false} />
          {!quiet && <span className="map-tower-door" style={style} aria-hidden="true" />}
        </>
      );
    }
    case 'titanGate':
      // The Titan's red pressing through the seam of the greater door, and nothing set on its face.
      if (quiet) return <img src={titanGateArt} className="map-landmark-art" alt="" draggable={false} />;
      return (
        <>
          <GateArt door={TITAN_DOOR} light={TITAN_LIGHT} />
          <span className="map-gate-seam is-titan" style={{ '--warden-color': TITAN_LIGHT } as CSSProperties} aria-hidden="true" />
        </>
      );
  }
}
