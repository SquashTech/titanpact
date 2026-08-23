import aegisArt from '../../../art/heroes/aegis.png';
import brimstoneArt from '../../../art/heroes/brimstone.png';
import cinderKnightArt from '../../../art/heroes/cinder.png';
import cragArt from '../../../art/heroes/starters/Crag.png';
import crimsonArt from '../../../art/heroes/starters/crimson.png';
import cubeArt from '../../../art/heroes/cube.png';
import fangArt from '../../../art/heroes/starters/fang.png';
import flurryArt from '../../../art/heroes/flurry.png';
import gallantArt from '../../../art/heroes/gallant.png';
import goblinChiefArt from '../../../art/enemies/goblinchief.png';
import goblinGruntArt from '../../../art/enemies/goblingrunt.png';
import goblinSkulkerArt from '../../../art/enemies/goblinskulker.png';
import goblinWarriorArt from '../../../art/enemies/goblinwarrior.png';
import hollowbarkArt from '../../../art/heroes/Hollowbark.png';
import ironWardenArt from '../../../art/heroes/ironwarden.png';
import luciusArt from '../../../art/heroes/lucius.png';
import marrowArt from '../../../art/heroes/marrow.png';
import mindweaverArt from '../../../art/heroes/starters/cortex.png';
import mordaxArt from '../../../art/heroes/mordax.png';
import nightshadeArt from '../../../art/heroes/starters/nightshade.png';
import pincerArt from '../../../art/heroes/pincer.png';
import revenantArt from '../../../art/heroes/starters/revenant.png';
import rimeArt from '../../../art/heroes/starters/rime.png';
import runescribeArt from '../../../art/heroes/starters/glyph.png';
import scallywagArt from '../../../art/heroes/scallywag.png';
import sentinelArt from '../../../art/heroes/sentinel.png';
import shadowMonkArt from '../../../art/heroes/vesper.png';
import clockworkArt from '../../../art/heroes/starters/clockwork.png';
import spookyGoblinArt from '../../../art/enemies/spookygoblin.png';
import steamColossusArt from '../../../art/heroes/steamcolossus.png';
import stormRangerArt from '../../../art/heroes/stormranger.png';
import tempestArt from '../../../art/heroes/starters/Tempest.png';
import sunPriestArt from '../../../art/heroes/starters/solace.png';
import tidecallerArt from '../../../art/heroes/starters/riptide.png';
import torchGoblinArt from '../../../art/enemies/torchgoblin.png';
import valorArt from '../../../art/heroes/starters/valor.png';
import wildOracleArt from '../../../art/heroes/starters/sylva.png';
import zenithArt from '../../../art/heroes/zenith.png';

/** Hero portraits (art/heroes/[starters/]<file>.png), keyed by hero id. Heroes without an entry fall back to text-only rendering wherever HeroPortrait/heroArt is used. */
export const heroArt: Partial<Record<string, string>> = {
  aegis: aegisArt,
  brimstone: brimstoneArt,
  cinderKnight: cinderKnightArt,
  crag: cragArt,
  crimson: crimsonArt,
  cube: cubeArt,
  packAlpha: fangArt,
  gallant: gallantArt,
  goblinChief: goblinChiefArt,
  goblinGrunt: goblinGruntArt,
  goblinSkulker: goblinSkulkerArt,
  goblinWarrior: goblinWarriorArt,
  hollowbark: hollowbarkArt,
  ironWarden: ironWardenArt,
  lucius: luciusArt,
  marrow: marrowArt,
  mindweaver: mindweaverArt,
  mordax: mordaxArt,
  nightshade: nightshadeArt,
  pincer: pincerArt,
  revenant: revenantArt,
  rime: rimeArt,
  runescribe: runescribeArt,
  scallywag: scallywagArt,
  sentinel: sentinelArt,
  shadowMonk: shadowMonkArt,
  forgewright: clockworkArt,
  spookyGoblin: spookyGoblinArt,
  steamColossus: steamColossusArt,
  stormRanger: stormRangerArt,
  tempest: tempestArt,
  dawnwarden: sunPriestArt,
  glacialWarden: flurryArt,
  tidecaller: tidecallerArt,
  torchGoblin: torchGoblinArt,
  valor: valorArt,
  wildOracle: wildOracleArt,
  zenith: zenithArt,
};
