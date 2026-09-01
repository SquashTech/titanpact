import { useEffect, useRef, type CSSProperties } from 'react';
import type { EquipmentSlot } from '../../run/equipment';
import { EquipmentFormGlyph } from '../shared/equipmentIcons';
import { NodeHeader, NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { CacheOpening, useCacheOpening } from './CacheReveal';

/**
 * The Weapon / Armor / Accessory caches, opened.
 *
 * These three nodes had no screen at all: App.tsx rolled the item and dropped
 * the player straight into ForceEquipScreen, so a cache on the map became a
 * hero grid with an item name over it and the node itself was never seen. The
 * Equipment Cache — the one that offers a *choice* — got a whole opening beat;
 * the three that hand over a guaranteed item got nothing, which is backwards
 * if anything, since a guaranteed item is precisely the case where the reveal
 * is the only moment the node has.
 *
 * So this is the same beat (CacheReveal.tsx), in front of the same equip gate,
 * with the node finally saying which cache it was. It is on screen for about
 * 1.3 seconds and then hands off on its own — there is nothing here to press,
 * and a Continue button in front of an animation is a button that means "stop
 * showing me this".
 */

const SLOT_TITLE: Record<EquipmentSlot, string> = {
  weapon: 'Weapon Cache',
  armor: 'Armor Cache',
  accessory: 'Accessory Cache',
};

/** What is rattling around inside. Said before it is known which item it is, so it names the kind and nothing more. */
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

  /* Same ref indirection LevelUpScreen's auto-continue uses: App.tsx passes
     `onDone` as an inline arrow, so depending on it directly would re-run this
     effect on every parent render and hand off more than once. */
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (phase === 'open') onDoneRef.current();
  }, [phase]);

  return (
    <div className="node-screen cache-open-screen" style={{ '--node-rgb': NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky motes={8} />

      {/* No RosterPeek. Every other node screen carries it because it is asking
          the player something; this one is telling them something, and for one
          second. The gate on the far side of it has the roster glyph. */}
      <NodeHeader compact eyebrow="A Cache Opens" title={SLOT_TITLE[slot]} readout="" />

      <div className="screen-scroll">
        <CacheOpening
          phase={phase}
          caption={SLOT_CAPTION[slot]}
          /* The slot's generic silhouette, rising out of the lid — this cache
             is guaranteed to be a weapon, so promising a sword is honest here
             in a way it would not be at the Equipment Cache. */
          payload={<EquipmentFormGlyph item={null} slot={slot} className="cache-payload-glyph" />}
        />
      </div>
    </div>
  );
}
