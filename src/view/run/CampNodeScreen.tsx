import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { CAMP_DOORS, CAMP_GEAR_COUNT, CAMP_GEMS, type CampDoor } from '../../run/camp';
import { gemPointsForAct } from '../../run/gems';
import { anyMasteryEligible } from '../../run/mastery';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { anyWounded, mendRoster } from '../../run/wounds';
import { NodeMotes } from '../shared/NodeStage';
import { PlateButton } from '../shared/PlateButton';
import { entryHp } from '../shared/WoundBar';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { mapNodeIcon } from './mapNodeArt';
import { CampFigure } from './RestNodeScreen';
import campArt from '../../../art/map-nodes/landmarks/camp.png';
import './campNode.css';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** The Gems or Gear door taken: the caller opens it. */
  onOpen: (door: Exclude<CampDoor, 'mend'>) => void;
  onContinue: () => void;
  /** The Mend already taken (a reload after it): only Continue is left. */
  settled?: boolean;
}

const DOOR_ART: Record<CampDoor, string | undefined> = {
  mend: mapNodeIcon('restReward'),
  gems: mapNodeIcon('scrollReward'),
  gear: mapNodeIcon('equipmentReward'),
};

const DOOR_NAME: Record<CampDoor, string> = { mend: 'Mend', gems: 'Gems', gear: 'Gear' };


const COMMIT: Record<CampDoor, string> = { mend: 'Mend', gems: 'Take the Gems', gear: 'See the Gear' };

/**
 * The Camp (docs/guild-hall-overhaul.md §3): the last stop before the Guardian, the company round
 * the fire with every bar where the act left it, and three doors of which one is taken. The Mend
 * plays here, on the same figures; the Gems and the Gear open their own screens.
 */
export function CampNodeScreen({ run, onRunChange, onOpen, onContinue, settled = false }: Props) {
  const [door, setDoor] = useState<CampDoor | null>(null);
  const [healed, setHealed] = useState<Record<string, number> | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const done = settled || healed !== null;

  useEffect(() => {
    playSfx('shrine', { pitch: 0.7, delay: 0.12 });
  }, []);

  const open: Record<CampDoor, boolean> = {
    mend: anyWounded(run),
    gems: anyMasteryEligible(run.roster),
    gear: true,
  };

  function commit() {
    if (!door || !open[door]) return;
    if (door !== 'mend') {
      playSfx('ui.confirm');
      onOpen(door);
      return;
    }
    playSfx('blessing');
    const gained: Record<string, number> = {};
    for (const entry of run.roster) {
      const { hp, maxHp } = entryHp(rosterHeroes[entry.heroId], entry, run.relics);
      gained[entry.rosterId] = maxHp - hp;
    }
    setHealed(gained);
    onRunChange(mendRoster(run));
  }

  const doorWords: Record<CampDoor, string> = {
    mend: 'Everyone whole',
    gems: `${CAMP_GEMS} × +${gemPointsForAct(run.actNumber)}`,
    gear: `1 of ${CAMP_GEAR_COUNT}`,
  };

  const frontCount = Math.min(3, run.roster.length);
  const back = run.roster.slice(0, run.roster.length - frontCount);
  const front = run.roster.slice(run.roster.length - frontCount);

  return (
    <div className={`node-screen rite-screen is-camp camp-node-screen${healed ? ' is-rested' : ''}`} style={{ '--rite-color': '#ec9640' } as CSSProperties}>
      <span className="node-sky camp-ground" aria-hidden="true" />
      <NodeMotes count={16} />

      <header className="rite-head">
        <span className="rite-place camp-fire">
          <span className="rite-pool" aria-hidden="true" />
          <img src={campArt} className="rite-place-art camp-node-art" alt="" draggable={false} />
          <span className="camp-flare" aria-hidden="true" />
        </span>
        <span className="rite-eyebrow">Before the Guardian</span>
        <h2 className="rite-name">The Camp</h2>
      </header>

      <div className="camp-ranks">
        {[back, front].map((rank, r) => (
          <div key={r} className={`camp-rank${r === 0 ? ' is-back' : ''}`}>
            {rank.map((entry) => {
              const hero = rosterHeroes[entry.heroId];
              const { hp, maxHp } = entryHp(hero, entry, run.relics);
              return (
                <CampFigure
                  key={entry.rosterId}
                  hero={hero}
                  entry={entry}
                  hp={hp}
                  maxHp={maxHp}
                  healed={healed?.[entry.rosterId] || null}
                  onPreview={() => setPreviewEntry({ hero, entry })}
                />
              );
            })}
          </div>
        ))}
      </div>

      {!done && (
        <div className="camp-doors" role="radiogroup" aria-label="The Camp">
          {CAMP_DOORS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={door === d}
              className={`camp-door is-${d}${door === d ? ' is-chosen' : ''}`}
              disabled={!open[d]}
              onClick={() => {
                playSfx('ui.pick');
                setDoor(d);
              }}
            >
              <img src={DOOR_ART[d]} className="camp-door-art" alt="" draggable={false} />
              <span className="camp-door-name">{DOOR_NAME[d]}</span>
              <span className="camp-door-words">{open[d] ? doorWords[d] : d === 'mend' ? 'Nobody hurt' : 'All mastered'}</span>
            </button>
          ))}
        </div>
      )}

      {done ? (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      ) : (
        <PlateButton onClick={commit} disabled={!door}>
          {door ? COMMIT[door] : 'Choose one'}
        </PlateButton>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
