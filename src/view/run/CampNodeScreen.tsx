import { Fragment, useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import { campBundle, type CampPiece } from '../../run/camp';
import { gemPointsForAct } from '../../run/gems';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { mendRoster } from '../../run/wounds';
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
  doorIds: readonly string[];
  /** The Mend door already taken on this screen (a reload after it): only Continue is left. */
  chosen?: number;
  /** The Mend landed: the run healed, and which door it was. */
  onMended: (door: number, next: RunState) => void;
  /** Walk through a door from its `step`-th piece (the Mend door's rider is piece 1). */
  onEnter: (door: number, step: number) => void;
}

const PIECE_ART: Record<CampPiece['kind'], string | undefined> = {
  mend: mapNodeIcon('restReward'),
  gems: mapNodeIcon('scrollReward'),
  gear: mapNodeIcon('equipmentReward'),
  blessing: mapNodeIcon('blessingReward'),
  boon: mapNodeIcon('passiveReward'),
};

function pieceWords(piece: CampPiece, actNumber: number): { name: string; sub: string } {
  switch (piece.kind) {
    case 'mend':
      return { name: 'Mend', sub: 'Everyone whole' };
    case 'gems':
      return { name: `${piece.take} Gem${piece.take === 1 ? '' : 's'}`, sub: `of ${piece.of} · +${gemPointsForAct(actNumber)}` };
    case 'gear':
      return { name: `${piece.take} Item${piece.take === 1 ? '' : 's'}`, sub: `of ${piece.of}` };
    case 'blessing':
      return { name: 'Blessing', sub: 'One KO refused' };
    case 'boon':
      return { name: 'Boon', sub: 'A passive' };
  }
}

/**
 * The Camp (docs/guild-hall-overhaul.md §3, §10): the last stop before the Guardian, the company
 * round the fire with every bar where the act left it, and three doors, each a bundle, one taken.
 * The Mend plays here, on the same figures; every other piece opens its own screen.
 */
export function CampNodeScreen({ run, doorIds, chosen, onMended, onEnter }: Props) {
  const [door, setDoor] = useState<number | null>(chosen ?? null);
  const [healed, setHealed] = useState<Record<string, number> | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const mended = chosen !== undefined || healed !== null;

  useEffect(() => {
    playSfx('shrine', { pitch: 0.7, delay: 0.12 });
  }, []);

  function commit() {
    if (door === null) return;
    const bundle = campBundle(doorIds[door]);
    if (!bundle) return;
    if (bundle.pieces[0]?.kind !== 'mend') {
      playSfx('ui.confirm');
      onEnter(door, 0);
      return;
    }
    playSfx('blessing');
    const gained: Record<string, number> = {};
    for (const entry of run.roster) {
      const { hp, maxHp } = entryHp(rosterHeroes[entry.heroId], entry, run.relics);
      gained[entry.rosterId] = maxHp - hp;
    }
    setHealed(gained);
    onMended(door, mendRoster(run));
  }

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

      <div className="camp-doors" role="radiogroup" aria-label="The Camp">
        {doorIds.map((id, i) => {
          const bundle = campBundle(id);
          if (!bundle) return null;
          const shut = mended && i !== door;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={door === i}
              className={`camp-door${door === i ? ' is-chosen' : ''}${shut ? ' is-shut' : ''}`}
              disabled={mended}
              onClick={() => {
                playSfx('ui.pick');
                setDoor(i);
              }}
            >
              {bundle.pieces.map((piece, p) => {
                const words = pieceWords(piece, run.actNumber);
                return (
                  <Fragment key={p}>
                    {p > 0 && (
                      <span className="camp-door-plus" aria-hidden="true">
                        +
                      </span>
                    )}
                    <span className={`camp-door-piece is-${piece.kind}`}>
                      <img src={PIECE_ART[piece.kind]} className="camp-door-art" alt="" draggable={false} />
                      <span className="camp-door-name">{words.name}</span>
                      <span className="camp-door-words">{words.sub}</span>
                    </span>
                  </Fragment>
                );
              })}
            </button>
          );
        })}
      </div>

      {mended && door !== null ? (
        <button className="resolve-button" onClick={() => onEnter(door, 1)}>
          Continue
        </button>
      ) : (
        <PlateButton onClick={commit} disabled={door === null}>
          {door === null ? 'Choose one' : 'Take it'}
        </PlateButton>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
