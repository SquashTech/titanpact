import cinderKnightArt from '../../../art/heroes/cinder.png';
import crimsonArt from '../../../art/heroes/starters/crimson.png';
import brimstoneArt from '../../../art/heroes/brimstone.png';
import tidecallerArt from '../../../art/heroes/starters/riptide.png';
import pincerArt from '../../../art/heroes/pincer.png';
import flurryArt from '../../../art/heroes/flurry.png';
import rimeArt from '../../../art/heroes/starters/rime.png';
import cubeArt from '../../../art/heroes/cube.png';
import stormRangerArt from '../../../art/heroes/stormranger.png';
import tempestArt from '../../../art/heroes/starters/Tempest.png';
import scallywagArt from '../../../art/heroes/scallywag.png';
import cragArt from '../../../art/heroes/starters/Crag.png';
import sentinelArt from '../../../art/heroes/sentinel.png';
import wildOracleArt from '../../../art/heroes/starters/sylva.png';
import mordaxArt from '../../../art/heroes/mordax.png';
import hollowbarkArt from '../../../art/heroes/Hollowbark.png';
import sunPriestArt from '../../../art/heroes/starters/solace.png';
import aegisArt from '../../../art/heroes/aegis.png';
import shadowMonkArt from '../../../art/heroes/vesper.png';
import marrowArt from '../../../art/heroes/marrow.png';
import luciusArt from '../../../art/heroes/lucius.png';
import nightshadeArt from '../../../art/heroes/starters/nightshade.png';
import runescribeArt from '../../../art/heroes/starters/glyph.png';
import zenithArt from '../../../art/heroes/zenith.png';
import mindweaverArt from '../../../art/heroes/starters/cortex.png';
import tranceArt from '../../../art/heroes/trance.png';
import revenantArt from '../../../art/heroes/starters/revenant.png';
import sorrowArt from '../../../art/heroes/sorrow.png';
import ironWardenArt from '../../../art/heroes/ironwarden.png';
import valorArt from '../../../art/heroes/starters/valor.png';
import gallantArt from '../../../art/heroes/gallant.png';
import clockworkArt from '../../../art/heroes/starters/clockwork.png';
import steamColossusArt from '../../../art/heroes/steamcolossus.png';
import fangArt from '../../../art/heroes/starters/fang.png';
import widowArt from '../../../art/heroes/Widow.png';
import coilArt from '../../../art/heroes/coil.png';
import goblinGruntArt from '../../../art/enemies/goblingrunt.png';
import goblinSkulkerArt from '../../../art/enemies/goblinskulker.png';
import spookyGoblinArt from '../../../art/enemies/spookygoblin.png';
import goblinWarriorArt from '../../../art/enemies/goblinwarrior.png';
import torchGoblinArt from '../../../art/enemies/torchgoblin.png';
import goblinChiefArt from '../../../art/enemies/goblinchief.png';
import goblinLordArt from '../../../art/enemies/goblinlord.png';

/** Portraits keyed by hero id (heroes.ts order, then enemies.ts order). A missing entry renders text-only. */
export const heroArt: Partial<Record<string, string>> = {
  // --- Fire ---
  cinderKnight: cinderKnightArt,
  crimson: crimsonArt,
  brimstone: brimstoneArt,
  // --- Water ---
  tidecaller: tidecallerArt,
  pincer: pincerArt,
  // --- Frost ---
  glacialWarden: flurryArt,
  rime: rimeArt,
  cube: cubeArt,
  // --- Storm ---
  stormRanger: stormRangerArt,
  tempest: tempestArt,
  scallywag: scallywagArt,
  // --- Stone ---
  crag: cragArt,
  sentinel: sentinelArt,
  // --- Nature ---
  wildOracle: wildOracleArt,
  mordax: mordaxArt,
  hollowbark: hollowbarkArt,
  // --- Light ---
  dawnwarden: sunPriestArt,
  aegis: aegisArt,
  // --- Shadow ---
  shadowMonk: shadowMonkArt,
  marrow: marrowArt,
  lucius: luciusArt,
  nightshade: nightshadeArt,
  // --- Arcane ---
  runescribe: runescribeArt,
  zenith: zenithArt,
  // --- Mind ---
  mindweaver: mindweaverArt,
  trance: tranceArt,
  // --- Spirit ---
  revenant: revenantArt,
  sorrow: sorrowArt,
  // --- Iron ---
  ironWarden: ironWardenArt,
  valor: valorArt,
  gallant: gallantArt,
  // --- Mech ---
  forgewright: clockworkArt,
  steamColossus: steamColossusArt,
  // --- Beast ---
  packAlpha: fangArt,
  widow: widowArt,
  coil: coilArt,
  // --- Enemies ---
  goblinGrunt: goblinGruntArt,
  goblinSkulker: goblinSkulkerArt,
  spookyGoblin: spookyGoblinArt,
  goblinWarrior: goblinWarriorArt,
  torchGoblin: torchGoblinArt,
  goblinChief: goblinChiefArt,
  goblinLord: goblinLordArt,
};
