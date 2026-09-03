import { useEffect, useRef, type CSSProperties } from 'react';
import type { EquipmentSlot } from '../../run/equipment';
import { EquipmentFormGlyph } from '../shared/equipmentIcons';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { CacheOpening, useCacheOpening } from './CacheReveal';

// The Weapon / Armor / Accessory caches: the opening beat, then a hand-off to
// the equip gate on its own. Nothing here to press.

const SLOT_TITLE: Record<EquipmentSlot, string> = {
  weapon: 'Weapon Cache',
  armor: 'Armor Cache',
  accessory: 'Accessory Cache',
};

const SLOT_CAPTION: Record<EquipmentSlot, string> = {
  weapon: 'Something in here has an edge.',
  armor: 'Something in here holds fast.',
  accessory: 'Something small, and precious.',
};

interface Props {
  slot: EquipmentSlot;
  onDone: () => void;
}

export function CacheOpenScreen({ slot, onDone }: Props) {
  const phase = useCacheOpening(true);

  // Ref: App.tsx passes `onDone` inline; depending on it would hand off more than once.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (phase === 'open') onDoneRef.current();
  }, [phase]);

  return (
    <div className="node-screen cache-open-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky motes={8} />

      {/* No RosterPeek: this screen tells, it doesn't ask. */}
      <NodeHeader floating compact eyebrow="A Cache Opens" title={SLOT_TITLE[slot]} readout="" />

      <div className="screen-scroll">
        <CacheOpening
          phase={phase}
          caption={SLOT_CAPTION[slot]}
          payload={<EquipmentFormGlyph item={null} slot={slot} className="cache-payload-glyph" />}
        />
      </div>
    </div>
  );
}
