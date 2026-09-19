import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { locationDomains, locations, type LocationDefinition } from '../../data/locations';
import type { RunState } from '../../run/state';
import { SEAL_ACTS } from '../../run/state';
import { LocationMotes } from '../shared/LocationSky';
import { LocationHorizon } from '../shared/locationArt';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { ElementGlyph } from '../shared/elementIcons';
import { getTypeColor } from '../combat/typeColors';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  /** Drawn once by App.tsx when the seal is behind the player; never fewer than two here. */
  candidateIds: readonly string[];
  onChoose: (locationId: string) => void;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** How much of a place's weather one card carries. */
const CARD_MOTE_DENSITY = 0.55;

/**
 * The 1-of-2 that opens every seal act after the first (docs/locations.md §1): two places, each
 * a scene of its own — its horizon, its weather, its warden standing on the skyline — and the
 * player picks which seal to break next. Placeless itself, like the Pact Seal before it: the sky
 * belongs to neither place until one is picked, and then it takes that place's colour.
 */
export function LocationChoiceScreen({ run, candidateIds, onChoose }: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const picked = pickedId ? locations[pickedId] : null;

  function handlePick(locationId: string) {
    playSfx('ui.pick');
    setPickedId(pickedId === locationId ? null : locationId);
  }

  function handleSetOut() {
    if (!pickedId) return;
    playSfx('map.path');
    onChoose(pickedId);
  }

  return (
    <div
      className={`node-screen location-choice-screen${picked ? ' has-pick' : ''}`}
      style={{ '--node-rgb': picked?.tintRgb ?? NODE_TINT_GOLD } as CSSProperties}
    >
      <NodeSky />
      <RosterPeek run={run} />

      <NodeHeader
        compact
        eyebrow={`Act ${ROMAN[run.actNumber - 1] ?? run.actNumber} of ${ROMAN[SEAL_ACTS - 1]}`}
        title="Choose a seal"
        readoutKey={picked?.id ?? 'offer'}
        readoutLive={!!picked}
        readout={picked ? picked.omen : `${candidateIds.length === 2 ? 'Two' : candidateIds.length} wardens are within reach. The road runs to one.`}
      />

      <div className="location-choice-options">
        {candidateIds.map((id, i) => (
          <LocationChoiceCard
            key={id}
            location={locations[id]}
            picked={pickedId === id}
            dimmed={pickedId !== null && pickedId !== id}
            revealDelayMs={120 + i * 140}
            onPick={() => handlePick(id)}
          />
        ))}
      </div>

      <button className="resolve-button" disabled={!picked} onClick={handleSetOut}>
        {/* Lower-cased article so a name that carries one does not read "Set out for The Threshold". */}
        {picked ? `Set out for ${picked.name.replace(/^The /, 'the ')}` : 'Choose a seal'}
      </button>
    </div>
  );
}

interface CardProps {
  location: LocationDefinition;
  picked: boolean;
  dimmed: boolean;
  revealDelayMs: number;
  onPick: () => void;
}

/**
 * One place as a scene: the horizon band low, the warden standing behind it in the haze, the
 * weather over both. Sets its own `--node-rgb`, so the wash, the motes, the rim light and the
 * pick glow all take the place's colour from the one property the location system keys off.
 */
function LocationChoiceCard({ location, picked, dimmed, revealDelayMs, onPick }: CardProps) {
  const domains = locationDomains(location);

  return (
    <button
      type="button"
      className={`location-choice-card${picked ? ' is-picked' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={{ '--node-rgb': location.tintRgb, '--reveal-delay': `${revealDelayMs}ms` } as CSSProperties}
      onClick={onPick}
      aria-pressed={picked}
    >
      <span className="location-choice-scene" aria-hidden="true">
        <span className="location-choice-wash" />
        <LocationMotes kind={location.ambience} density={CARD_MOTE_DENSITY} />
        {location.guardianFinalEnemyId && (
          <span className="location-choice-warden">
            <HeroPortrait heroId={location.guardianFinalEnemyId} className="location-choice-warden-figure" />
          </span>
        )}
        <LocationHorizon locationId={location.id} />
      </span>

      <span className="location-choice-body">
        <span className="location-choice-name">{location.name}</span>
        <span className="location-choice-flavor">{location.flavor}</span>
      </span>

      <span className="location-choice-domains">
        {domains ? (
          domains.map((type) => (
            <span key={type} className="location-choice-domain" style={{ color: getTypeColor(type) }} title={type}>
              <ElementGlyph type={type} />
            </span>
          ))
        ) : (
          /* Wild's Edge only (docs/locations.md §1). */
          <span className="location-choice-domains-all">Every domain</span>
        )}
      </span>
    </button>
  );
}
