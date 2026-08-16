import { useState } from 'react';
import { heroes } from '../../data/heroes';
import type { HeroDefinition } from '../../engine/content';
import { createRosterEntry } from '../../run/state';
import { STARTER_PICK_COUNT } from '../../run/draft';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';

interface Props {
  optionIds: string[];
  onConfirm: (chosenIds: string[]) => void;
}

/**
 * Start-of-run draft: the player's opening pact with a Titan, framed with
 * flavor text, then a pick-2-of-4 hero choice (App.tsx's draft screen,
 * replacing a fixed cinderKnight+tidecaller opener — CLAUDE.md "every hero
 * must be viable", so runs shouldn't always begin identically). Candidates
 * are unrecruited (no roster entry yet), so the info-button preview
 * synthesizes a throwaway level-1 RosterEntry the same way SquadSelectScreen
 * does for real roster members.
 */
export function DraftScreen({ optionIds, onConfirm }: Props) {
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  const [inspecting, setInspecting] = useState<HeroDefinition | null>(null);

  function toggle(heroId: string) {
    setPickedIds((prev) => {
      if (prev.includes(heroId)) return prev.filter((id) => id !== heroId);
      if (prev.length >= STARTER_PICK_COUNT) return prev;
      return [...prev, heroId];
    });
  }

  return (
    <div className="squad-select draft-screen">
      <div className="screen-scroll">
        <div className="draft-flavor">
          <h2 className="squad-section-title">Forge Your Pact</h2>
          <p className="hint draft-flavor-text">
            Beneath the world, a Titan has stirred, and it offers you a pact: prove your worth
            across its trials, and a fraction of its power becomes yours. Every hero you
            command, every relic you claim, is a term of that bargain.
          </p>
          <p className="hint draft-flavor-text">Choose two allies to begin the climb.</p>
        </div>

        <div className="squad-section squad-section-player">
          <h2 className="squad-section-title">
            🤝 Choose Your Allies ({pickedIds.length}/{STARTER_PICK_COUNT})
          </h2>
          <div className="roster-grid">
            {optionIds.map((heroId) => {
              const hero = heroes[heroId];
              const picked = pickedIds.includes(heroId);
              return (
                <div
                  key={heroId}
                  className={`roster-card${picked ? ' picked' : ''}`}
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(heroId)}
                >
                  <button
                    className="info-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspecting(hero);
                    }}
                    aria-label={`View ${hero.name} details`}
                  >
                    i
                  </button>
                  <div className="roster-card-name">{hero.name}</div>
                  <div className="roster-card-types">
                    {hero.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  {picked && <span className="roster-card-badge badge-ally">CHOSEN</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <button
        className="resolve-button"
        disabled={pickedIds.length !== STARTER_PICK_COUNT}
        onClick={() => onConfirm(pickedIds)}
      >
        Begin the Pact
      </button>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting}
          entry={createRosterEntry(inspecting.id, inspecting.id, inspecting.moveIds)}
          equipmentLookup={{}}
          onClose={() => setInspecting(null)}
        />
      )}
    </div>
  );
}
