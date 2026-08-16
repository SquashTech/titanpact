import cinderKnightArt from '../../../art/cinderknight.png';
import ironWardenArt from '../../../art/ironwarden.png';
import mindweaverArt from '../../../art/mindweaver.png';
import packAlphaArt from '../../../art/packalpha.png';
import runescribeArt from '../../../art/runescribe.png';
import shadowMonkArt from '../../../art/shadowmonk.png';
import steamColossusArt from '../../../art/steamcolossus.png';
import stormRangerArt from '../../../art/stormranger.png';
import sunPriestArt from '../../../art/sunpriest.png';
import theAbominableArt from '../../../art/theabominable.png';
import tidecallerArt from '../../../art/tidecaller.png';
import wildOracleArt from '../../../art/wildoracle.png';

/** Hero portraits (art/<file>.png), keyed by hero id. Heroes without an entry fall back to text-only rendering wherever HeroPortrait/heroArt is used. */
export const heroArt: Partial<Record<string, string>> = {
  cinderKnight: cinderKnightArt,
  ironWarden: ironWardenArt,
  mindweaver: mindweaverArt,
  packAlpha: packAlphaArt,
  runescribe: runescribeArt,
  shadowMonk: shadowMonkArt,
  forgewright: steamColossusArt,
  stormRanger: stormRangerArt,
  dawnwarden: sunPriestArt,
  glacialWarden: theAbominableArt,
  tidecaller: tidecallerArt,
  wildOracle: wildOracleArt,
};
