import type { EnchantmentId, EquipmentDefinition } from '../../run/equipment';
import { parseEquipmentId } from '../../run/equipment';

// Pixel item art (art/equipment): one 32x32 sprite per family and per Unique, named by the id's
// base, and one 24x24 gem per enchant. Tier and enchant never change the sprite; the box around
// it carries the tier and the gem carries the enchant.

function byName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
  );
}

const ITEM_ART = byName(
  import.meta.glob<string>('../../../art/equipment/*.png', { eager: true, query: '?url', import: 'default' })
);
const ENCHANT_ART = byName(
  import.meta.glob<string>('../../../art/equipment/enchants/*.png', { eager: true, query: '?url', import: 'default' })
);

export function equipmentArt(item: EquipmentDefinition): string | undefined {
  return ITEM_ART[item.familyId ?? parseEquipmentId(item.id).base];
}

export function enchantArt(enchantId: EnchantmentId): string | undefined {
  return ENCHANT_ART[enchantId];
}
