import type { EnchantmentId, EquipmentDefinition } from '../../run/equipment';
import { parseEquipmentId } from '../../run/equipment';

// Pixel item art (art/equipment): one 32x32 sprite per family and per Unique, named by the id's
// base; one enchanted sprite per family and enchant (art/equipment/enchanted/<enchant>/<family>,
// PixelLab edits of the plain one); and one 24x24 gem per enchant, worn by a Unique, which has
// no enchanted sprite. Tier never changes the sprite: the box around it carries the tier.

function byName(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
  );
}

const ITEM_ART = byName(
  import.meta.glob<string>('../../../art/equipment/*.png', { eager: true, query: '?url', import: 'default' })
);
/** Keyed "<enchant>/<family>". */
const ENCHANTED_ART = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../../../art/equipment/enchanted/*/*.png', { eager: true, query: '?no-inline', import: 'default' })
  ).map(([path, url]) => [path.split('/').slice(-2).join('/').slice(0, -'.png'.length), url])
);

const ENCHANT_ART = byName(
  import.meta.glob<string>('../../../art/equipment/enchants/*.png', { eager: true, query: '?url', import: 'default' })
);

export function equipmentArt(item: EquipmentDefinition): string | undefined {
  const { base, enchantId } = parseEquipmentId(item.id);
  const family = item.familyId ?? base;
  return (enchantId ? ENCHANTED_ART[`${enchantId}/${family}`] : undefined) ?? ITEM_ART[family];
}

/** True when the item's enchant is drawn into its sprite, so no gem is needed to say it. */
export function hasEnchantedArt(item: EquipmentDefinition): boolean {
  const { base, enchantId } = parseEquipmentId(item.id);
  return !!enchantId && !!ENCHANTED_ART[`${enchantId}/${item.familyId ?? base}`];
}

export function enchantArt(enchantId: EnchantmentId): string | undefined {
  return ENCHANT_ART[enchantId];
}

/** The enchanted sprites ship as their own files (never inlined), so the preloader fetches them ahead. */
export function enchantedArtUrls(): string[] {
  return Object.values(ENCHANTED_ART);
}
