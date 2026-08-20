import cinderKnightArt from '../../../art/cinder.png';
import cragArt from '../../../art/Crag.png';
import crimsonArt from '../../../art/crimson.png';
import cubeArt from '../../../art/cube.png';
import goblinGruntArt from '../../../art/goblingrunt.png';
import goblinSkulkerArt from '../../../art/goblinskulker.png';
import ironWardenArt from '../../../art/ironwarden.png';
import luciusArt from '../../../art/lucius.png';
import mindweaverArt from '../../../art/mindweaver.png';
import mordaxArt from '../../../art/mordax.png';
import packAlphaArt from '../../../art/packalpha.png';
import revenantArt from '../../../art/revenant.png';
import rimeArt from '../../../art/rime.png';
import runescribeArt from '../../../art/runescribe.png';
import shadowMonkArt from '../../../art/shadowmonk.png';
import clockworkArt from '../../../art/clockwork.png';
import stormRangerArt from '../../../art/stormranger.png';
import sunPriestArt from '../../../art/sunpriest.png';
import theAbominableArt from '../../../art/theabominable.png';
import tidecallerArt from '../../../art/tidecaller.png';
import valorArt from '../../../art/valor.png';
import wildOracleArt from '../../../art/wildoracle.png';

/** Hero portraits (art/<file>.png), keyed by hero id. Heroes without an entry fall back to text-only rendering wherever HeroPortrait/heroArt is used. */
export const heroArt: Partial<Record<string, string>> = {
  cinderKnight: cinderKnightArt,
  crag: cragArt,
  crimson: crimsonArt,
  cube: cubeArt,
  goblinGrunt: goblinGruntArt,
  goblinSkulker: goblinSkulkerArt,
  ironWarden: ironWardenArt,
  lucius: luciusArt,
  mindweaver: mindweaverArt,
  mordax: mordaxArt,
  packAlpha: packAlphaArt,
  revenant: revenantArt,
  rime: rimeArt,
  runescribe: runescribeArt,
  shadowMonk: shadowMonkArt,
  forgewright: clockworkArt,
  stormRanger: stormRangerArt,
  dawnwarden: sunPriestArt,
  glacialWarden: theAbominableArt,
  tidecaller: tidecallerArt,
  valor: valorArt,
  wildOracle: wildOracleArt,
};
