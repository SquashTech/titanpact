import type { CSSProperties } from 'react';
import type { MapNodeType } from '../../run/map';
import { allCombatants } from '../../data/content';
import { getTypeColor } from '../combat/typeColors';
import { ElementGlyph } from '../shared/elementIcons';
import { HeroPortrait } from '../shared/HeroPortrait';
import mentorArt from '../../../art/map-nodes/landmarks/mentor.png';
import tutorArt from '../../../art/map-nodes/landmarks/tutor.png';
import scribeArt from '../../../art/map-nodes/landmarks/scribe.png';
import guildHallArt from '../../../art/map-nodes/landmarks/guildHall.png';
import gateArt from '../../../art/map-nodes/landmarks/guardianGate.png';

// The act's beats, drawn as themselves rather than as a stone medallion: the opening fight is the
// Titan's eye opening on the road, the Mentor, the Tutor and the Scribe are met at the
// roadside (a fire, a practice post, a writing desk), the Guild Hall is a building you walk into,
// the act's Guardian waits behind a sealed gate carrying its element's sigil, and the finale's
// Herald is itself.

export type LandmarkKind = 'eye' | 'npc' | 'building' | 'gate' | 'guardian';

const KIND: Partial<Record<MapNodeType, LandmarkKind>> = {
  fight: 'eye',
  mentorReward: 'npc',
  tutorReward: 'npc',
  scribeReward: 'npc',
  shop: 'building',
  muster: 'building',
  boss: 'gate',
  finale: 'guardian',
};

const NPC_ART: Partial<Record<MapNodeType, string>> = {
  mentorReward: mentorArt,
  tutorReward: tutorArt,
  scribeReward: scribeArt,
};

export function landmarkKind(type: MapNodeType): LandmarkKind | undefined {
  return KIND[type];
}

/** A single Titan eye in the title screen's idiom (titanArt.tsx): lens, lit iris, slit, halo. */
function MapTitanEye() {
  // Rounder than the title's (half-height 48 against its 32): this one is a button, and it is
  // held open rather than narrowed and flared.
  const lens = 'M-82 0 Q0 -48 82 0 Q0 48 -82 0 Z';
  return (
    <svg className="map-landmark-eye" viewBox="-130 -52 260 104" aria-hidden="true">
      <defs>
        <radialGradient id="map-eye-iris" cx="50%" cy="50%" r="52%">
          <stop offset="0%" stopColor="#f6c070" />
          <stop offset="22%" stopColor="#e8604a" />
          <stop offset="50%" stopColor="#c8303a" />
          <stop offset="78%" stopColor="#601018" />
          <stop offset="100%" stopColor="#1e060a" />
        </radialGradient>
        <radialGradient id="map-eye-hotspot" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff3d2" stopOpacity="1" />
          <stop offset="38%" stopColor="#f0b060" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#e0393f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="map-eye-glare" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0393f" stopOpacity="0.5" />
          <stop offset="42%" stopColor="#e0393f" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#e0393f" stopOpacity="0" />
        </radialGradient>
        <clipPath id="map-eye-lid">
          <path d={lens} />
        </clipPath>
      </defs>
      <circle className="map-eye-halo" r="128" />
      <g className="titan-eye-open" clipPath="url(#map-eye-lid)">
        <path className="map-eye-lens" d={lens} />
        <g className="titan-eye-gaze">
          <ellipse className="map-eye-hotspot" rx="52" ry="40" />
          {/* A slit that tapers inside the lids wherever the gaze takes it, never cut square by them. */}
          <ellipse className="map-eye-pupil" rx="6" ry="30" />
        </g>
      </g>
    </svg>
  );
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
    case 'eye':
      if (quiet) return <MapTitanEye />;
      // The ripple waits a few seconds and then keeps asking: it is only ever seen by a player
      // who has not tapped yet.
      return (
        <>
          <span className="map-eye-ripple" aria-hidden="true" />
          <span className="map-eye-ripple is-second" aria-hidden="true" />
          <MapTitanEye />
        </>
      );
    case 'npc':
      return <img src={NPC_ART[type]} className="map-landmark-art" alt="" draggable={false} />;
    case 'building':
      return <img src={guildHallArt} className="map-landmark-art" alt="" draggable={false} />;
    case 'gate': {
      // The seal is the Guardian's own element: what is behind the door is named, never shown.
      const type = guardianId ? allCombatants[guardianId]?.types[0] : undefined;
      return (
        <>
          <img src={gateArt} className="map-landmark-art" alt="" draggable={false} />
          {type && (
            <span className={`map-gate-seal${quiet ? ' is-quiet' : ''}`} style={{ '--seal-color': getTypeColor(type) } as CSSProperties} aria-hidden="true">
              <ElementGlyph type={type} className="map-gate-sigil" />
            </span>
          )}
        </>
      );
    }
    case 'guardian':
      return guardianId ? <HeroPortrait heroId={guardianId} className="map-landmark-figure" /> : null;
  }
}
