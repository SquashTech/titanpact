import { useState, type CSSProperties } from 'react';
import { equipment } from '../../data/equipment';
import { rollCampGear } from '../../run/camp';
import type { RunState } from '../../run/state';
import { NodeMotes } from '../shared/NodeStage';
import { PlateButton } from '../shared/PlateButton';
import { seededRandom } from '../shared/seededRandom';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { mapNodeIcon } from './mapNodeArt';
import './campNode.css';

interface Props {
  run: RunState;
  /** Fixes the three pieces, so a reload lays out the same ones. */
  seed: number;
  /** The piece taken: the caller asks who carries it. */
  onTake: (itemId: string) => void;
}

/** The Camp's Gear door (docs/guild-hall-overhaul.md §3): three pieces on the act's curve, one taken, then its who-screen. */
export function CampGearScreen({ run, seed, onTake }: Props) {
  const [itemIds] = useState(() => rollCampGear(run.actNumber, seededRandom(seed, 'campGear')));
  const [picked, setPicked] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);

  return (
    <div className="node-screen rite-screen is-camp camp-node-screen camp-gear-screen" style={{ '--rite-color': '#ec9640' } as CSSProperties}>
      <span className="node-sky camp-ground" aria-hidden="true" />
      <NodeMotes count={10} />

      <header className="rite-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={mapNodeIcon('equipmentReward')} className="rite-place-art is-icon" alt="" draggable={false} />
        </span>
        <span className="rite-eyebrow">The Camp</span>
        <h2 className="rite-name">Gear</h2>
      </header>

      <div className="screen-scroll">
        <div className="equip-cache-list camp-gear-list">
          {itemIds.map((id, i) =>
            equipment[id] ? (
              <EquipChoiceCard
                key={`${id}:${i}`}
                item={equipment[id]}
                picked={picked === id}
                onPick={() => setPicked(id)}
                onInspect={() => setInspecting(id)}
                revealDelayMs={120 + i * 90}
              />
            ) : null
          )}
        </div>
      </div>

      <PlateButton onClick={() => picked && onTake(picked)} disabled={!picked}>
        {picked ? `Take ${equipment[picked]?.name ?? ''}` : 'Take'}
      </PlateButton>

      {inspecting && equipment[inspecting] && <EquipInspectOverlay item={equipment[inspecting]} onClose={() => setInspecting(null)} />}
    </div>
  );
}
