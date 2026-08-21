import cinderKnightArt from '../../../art/heroes/cinder.png';
import cragArt from '../../../art/heroes/starters/Crag.png';
import crimsonArt from '../../../art/heroes/starters/crimson.png';
import cubeArt from '../../../art/heroes/cube.png';
import fangArt from '../../../art/heroes/starters/fang.png';
import goblinGruntArt from '../../../art/enemies/goblingrunt.png';
import goblinSkulkerArt from '../../../art/enemies/goblinskulker.png';
import ironWardenArt from '../../../art/heroes/ironwarden.png';
import luciusArt from '../../../art/heroes/lucius.png';
import mindweaverArt from '../../../art/heroes/starters/cortex.png';
import mordaxArt from '../../../art/heroes/mordax.png';
import revenantArt from '../../../art/heroes/starters/revenant.png';
import rimeArt from '../../../art/heroes/starters/rime.png';
import runescribeArt from '../../../art/heroes/starters/glyph.png';
import shadowMonkArt from '../../../art/heroes/starters/vesper.png';
import clockworkArt from '../../../art/heroes/starters/clockwork.png';
import stormRangerArt from '../../../art/heroes/stormranger.png';
import tempestArt from '../../../art/heroes/starters/Tempest.png';
import sunPriestArt from '../../../art/heroes/starters/solace.png';
import theAbominableArt from '../../../art/heroes/theabominable.png';
import tidecallerArt from '../../../art/heroes/starters/riptide.png';
import valorArt from '../../../art/heroes/starters/valor.png';
import wildOracleArt from '../../../art/heroes/starters/sylva.png';

/** Hero portraits (art/heroes/[starters/]<file>.png), keyed by hero id. Heroes without an entry fall back to text-only rendering wherever HeroPortrait/heroArt is used. */
export const heroArt: Partial<Record<string, string>> = {
  cinderKnight: cinderKnightArt,
  crag: cragArt,
  crimson: crimsonArt,
  cube: cubeArt,
  packAlpha: fangArt,
  goblinGrunt: goblinGruntArt,
  goblinSkulker: goblinSkulkerArt,
  ironWarden: ironWardenArt,
  lucius: luciusArt,
  mindweaver: mindweaverArt,
  mordax: mordaxArt,
  revenant: revenantArt,
  rime: rimeArt,
  runescribe: runescribeArt,
  shadowMonk: shadowMonkArt,
  forgewright: clockworkArt,
  stormRanger: stormRangerArt,
  tempest: tempestArt,
  dawnwarden: sunPriestArt,
  glacialWarden: theAbominableArt,
  tidecaller: tidecallerArt,
  valor: valorArt,
  wildOracle: wildOracleArt,
};
