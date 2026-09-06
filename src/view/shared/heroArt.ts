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
import valorAttackArt from '../../../art/heroes/starters/valorattack.png';
import valorHurtArt from '../../../art/heroes/starters/valordamaged.png';
import gallantArt from '../../../art/heroes/gallant.png';
import clockworkArt from '../../../art/heroes/starters/clockwork.png';
import steamColossusArt from '../../../art/heroes/steamcolossus.png';
import fangArt from '../../../art/heroes/starters/fang.png';
import fangAttackArt from '../../../art/heroes/starters/fangattacking.png';
import fangHurtArt from '../../../art/heroes/starters/fangdamaged.png';
import widowArt from '../../../art/heroes/Widow.png';
import coilArt from '../../../art/heroes/coil.png';
import goblinGruntArt from '../../../art/enemies/goblingrunt.png';
import goblinSkulkerArt from '../../../art/enemies/goblinskulker.png';
import spookyGoblinArt from '../../../art/enemies/spookygoblin.png';
import goblinWarriorArt from '../../../art/enemies/goblinwarrior.png';
import torchGoblinArt from '../../../art/enemies/torchgoblin.png';
import goblinChiefArt from '../../../art/enemies/goblinchief.png';
import goblinLordArt from '../../../art/enemies/goblinlord.png';

import cultBladeArt from '../../../art/enemies/cultists/cultblade.png';
import dreadCultistArt from '../../../art/enemies/cultists/dreadcultist.png';
import blightedCultistArt from '../../../art/enemies/cultists/blightedcultist.png';
import frozenCultistArt from '../../../art/enemies/cultists/frozencultist.png';
import cultMysticArt from '../../../art/enemies/cultists/cultmystic.png';
import yugzulachArt from '../../../art/enemies/cultists/yugzulach.png';

import pixieArt from '../../../art/enemies/fae/pixie.png';
import faeWarriorArt from '../../../art/enemies/fae/faewarrior.png';
import lightFairyArt from '../../../art/enemies/fae/lightfairy.png';
import mechaFairyArt from '../../../art/enemies/fae/mechafairy.png';
import pixieQueenArt from '../../../art/enemies/fae/pixiequeen.png';
import elderBoughArt from '../../../art/enemies/fae/elderbough.png';

import flameSpriteArt from '../../../art/enemies/vulcans/flamesprite.png';
import steamSpiritArt from '../../../art/enemies/vulcans/steamspirit.png';
import emberLizardArt from '../../../art/enemies/vulcans/emberlizard.png';
import automatonArt from '../../../art/enemies/vulcans/automaton.png';
import vulcadozerArt from '../../../art/enemies/vulcans/vulcadozer.png';
import lavaBeastArt from '../../../art/enemies/vulcans/lavabeast.png';

import skullShamblerArt from '../../../art/enemies/necropolis/skullshambler.png';
import skeletonKnightArt from '../../../art/enemies/necropolis/skeletonknight.png';
import shamblingHuskArt from '../../../art/enemies/necropolis/shamblinghusk.png';
import boneConjurerArt from '../../../art/enemies/necropolis/boneconjurer.png';
import dreadRavenArt from '../../../art/enemies/necropolis/dreadraven.png';
import skeletonKingArt from '../../../art/enemies/necropolis/skeletonking.png';

import raiderArt from '../../../art/enemies/raiders/raider.png';
import stormRaiderArt from '../../../art/enemies/raiders/stormraider.png';
import surfRaiderArt from '../../../art/enemies/raiders/surfraider.png';
import mysticRaiderArt from '../../../art/enemies/raiders/mysticraider.png';
import championRaiderArt from '../../../art/enemies/raiders/championraider.png';
import leviathanArt from '../../../art/enemies/raiders/leviathan.png';
import endbringerArt from '../../../art/enemies/final boss/endbringer.png';
import { CHAMPION_IDS, unsealedIdFor } from '../../data/enemies';

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
  // --- Enemies: Goblins ---
  goblinGrunt: goblinGruntArt,
  goblinSkulker: goblinSkulkerArt,
  spookyGoblin: spookyGoblinArt,
  goblinWarrior: goblinWarriorArt,
  torchGoblin: torchGoblinArt,
  goblinChief: goblinChiefArt,
  goblinLord: goblinLordArt,
  // --- Enemies: Cultists ---
  cultBlade: cultBladeArt,
  dreadCultist: dreadCultistArt,
  blightedCultist: blightedCultistArt,
  frozenCultist: frozenCultistArt,
  cultMystic: cultMysticArt,
  yugzulach: yugzulachArt,
  // --- Enemies: Fae ---
  pixie: pixieArt,
  faeWarrior: faeWarriorArt,
  lightFairy: lightFairyArt,
  mechaFairy: mechaFairyArt,
  pixieQueen: pixieQueenArt,
  elderBough: elderBoughArt,
  // --- Enemies: Vulcans ---
  flameSprite: flameSpriteArt,
  steamSpirit: steamSpiritArt,
  emberLizard: emberLizardArt,
  automaton: automatonArt,
  vulcadozer: vulcadozerArt,
  lavaBeast: lavaBeastArt,
  // --- Enemies: Undead ---
  skullShambler: skullShamblerArt,
  skeletonKnight: skeletonKnightArt,
  shamblingHusk: shamblingHuskArt,
  boneConjurer: boneConjurerArt,
  dreadRaven: dreadRavenArt,
  skeletonKing: skeletonKingArt,
  // --- Enemies: Raiders ---
  raider: raiderArt,
  stormRaider: stormRaiderArt,
  surfRaider: surfRaiderArt,
  mysticRaider: mysticRaiderArt,
  championRaider: championRaiderArt,
  leviathan: leviathanArt,
  // --- The Threshold ---
  endbringer: endbringerArt,
};

// An unsealed champion is the same creature with the seal taken off it (docs/lore.md §6),
// so it wears the same art. Appended rather than listed so a new champion cannot arrive at
// the finale unpainted.
for (const championId of CHAMPION_IDS) {
  heroArt[unsealedIdFor(championId)] = heroArt[championId];
}

/** The frames a hero has beyond its idle one. Both optional and independent. */
export interface HeroPoses {
  /** Held for as long as the console is narrating this hero's move (styles.css `.striking`). */
  attack?: string;
  /** Held for as long as the console is narrating a hit landing on it (`.hit-struck` / `.hit-crit` / `.hit-wince`). */
  hurt?: string;
}

/**
 * ── TO GIVE A HERO ITS FRAMES ────────────────────────────────────────────
 * Drop the art beside the hero's idle sprite, import it above next to that
 * hero's idle import, and add ONE line to the table below. That is the whole
 * job: everything downstream — the poses, the lean, the wound on a Burn tick,
 * the flash over each frame cut — is keyed off the hero id and already works
 * for every hero in the game the moment its art lands here.
 *
 * Filenames are not a convention and are not scanned for; they are imported by
 * hand, so a hero's frames can be called whatever the artist called them
 * (`valorattack.png` and `fangattacking.png` are both fine) and a typo is a
 * build error rather than a frame that silently never shows up.
 *
 * Either frame may be omitted. A hero with no entry at all, or with only one of
 * the two, simply keeps its idle sprite for whatever is missing and loses
 * nothing else — so the roster can grow frames one hero, and one pose, at a
 * time.
 */
export const heroPoses: Partial<Record<string, HeroPoses>> = {
  valor: { attack: valorAttackArt, hurt: valorHurtArt },
  packAlpha: { attack: fangAttackArt, hurt: fangHurtArt },
};
