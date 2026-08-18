import ironBladeArt from '../../../art/icons/equipment/iron-blade.png';
import daggerArt from '../../../art/icons/equipment/dagger.png';
import arcaneFocusArt from '../../../art/icons/equipment/arcane-focus.png';
import oakenArmorArt from '../../../art/icons/equipment/oaken-armor.png';
import guardianPlateArt from '../../../art/icons/equipment/guardian-plate.png';
import swiftBootsArt from '../../../art/icons/equipment/swift-boots.png';
import vitalCharmArt from '../../../art/icons/equipment/vital-charm.png';
import ironStandardArt from '../../../art/icons/relics/iron-standard.png';
import warHornArt from '../../../art/icons/relics/war-horn.png';
import sagesLanternArt from '../../../art/icons/relics/sages-lantern.png';
import windcallersBannerArt from '../../../art/icons/relics/windcallers-banner.png';
import deepWellstoneArt from '../../../art/icons/relics/deep-wellstone.png';
import bulwarkCoreArt from '../../../art/icons/relics/bulwark-core.png';

/** Per-item equipment icons (art/icons/equipment/<file>.png), keyed by equipment id. Items without an entry fall back to the generic slot icon (EQUIP_SLOT_ICONS) wherever EquipmentIcon is used. */
export const equipmentArt: Partial<Record<string, string>> = {
  ironBlade: ironBladeArt,
  dagger: daggerArt,
  arcaneFocus: arcaneFocusArt,
  oakenArmor: oakenArmorArt,
  guardianPlate: guardianPlateArt,
  swiftBoots: swiftBootsArt,
  vitalCharm: vitalCharmArt,
};

/** Per-relic icons (art/icons/relics/<file>.png), keyed by relic id. Relics without an entry fall back to the generic relic glyph (💠) wherever RelicIcon is used. */
export const relicArt: Partial<Record<string, string>> = {
  ironStandard: ironStandardArt,
  warHorn: warHornArt,
  sagesLantern: sagesLanternArt,
  windcallersBanner: windcallersBannerArt,
  deepWellstone: deepWellstoneArt,
  bulwarkCore: bulwarkCoreArt,
};
