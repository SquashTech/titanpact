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

/** The suffix each pose's file carries, appended to the idle sprite's own filename. */
const POSE_SUFFIX: Record<keyof HeroPoses, string> = { attack: 'attack', hurt: 'damaged' };

/**
 * Every sprite in the figure directories, source path → URL. Scoped to those
 * three on purpose: `art/` also holds ~2,200 icons that nothing here wants, and
 * an eager glob over all of it would bundle every one. These three hold 82 files
 * and 80 of them are imported above already, so the glob costs essentially
 * nothing on top of what the page loads anyway.
 */
const spriteFiles = import.meta.glob<string>(['../../../art/heroes/**/*.png', '../../../art/enemies/**/*.png'], {
  eager: true,
  query: '?url',
  import: 'default',
});

/**
 * ── TO GIVE A HERO ITS FRAMES ────────────────────────────────────────────
 * Drop `<name>attack.png` and `<name>damaged.png` beside the hero's idle
 * `<name>.png`. That is the whole job — no import, no table, no code at all.
 * Everything downstream (the held pose, the lean, the wound on a Burn tick, the
 * flash over each frame cut) is keyed off the hero id and has worked for the
 * whole roster since the frames existed; the only thing any hero is waiting on
 * is the art.
 *
 * The name follows the hero's own SPRITE file, not its id: the two differ across
 * most of the roster, and whoever is drawing the art is thinking of the
 * character (`fang.png` → `fangattack.png`, even though the hero id is
 * `packAlpha`). Both frames are independent and both are optional; whatever is
 * missing falls back to the idle sprite, so the roster can grow one hero, and
 * one pose, at a time.
 */
export const heroPoses: Partial<Record<string, HeroPoses>> = {};

// The glob is keyed by path and heroArt holds URLs, so the idle sprite is what
// ties a hero id to a filename — there is no second table listing them.
const pathByUrl = new Map(Object.entries(spriteFiles).map(([path, url]) => [url, path]));

for (const [heroId, idleUrl] of Object.entries(heroArt)) {
  const idlePath = idleUrl && pathByUrl.get(idleUrl);
  if (!idlePath) continue;
  const stem = idlePath.slice(0, -'.png'.length);
  const poses: HeroPoses = {};
  for (const pose of Object.keys(POSE_SUFFIX) as (keyof HeroPoses)[]) {
    const found = spriteFiles[`${stem}${POSE_SUFFIX[pose]}.png`];
    if (found) poses[pose] = found;
  }
  if (poses.attack || poses.hurt) heroPoses[heroId] = poses;
}

// Dead art, in the two shapes it comes in. This is the whole price of naming by
// convention instead of importing by hand — a misnamed frame is not a build
// error any more, so it has to be found here or it is found in a playtest weeks
// later, by noticing that a hero never once changed pose.
//
// The two shapes are graded differently on purpose. A correctly-suffixed file
// that no hero claims is unambiguously a mistake, and throws. Any OTHER sprite
// nothing draws is only *probably* one — `glyph_2.png` is a deliberate
// alternate, and work-in-progress art has to be allowed to sit in the folder —
// so that warns, and names the rename it most likely wants. That second half is
// what would have caught `fangattacking.png`.
if (import.meta.env.DEV) {
  const naming = `<idle sprite name>{${POSE_SUFFIX.attack},${POSE_SUFFIX.hurt}}.png, beside that idle sprite`;
  const drawnUrls = new Set([
    ...Object.values(heroArt),
    ...Object.values(heroPoses).flatMap((p) => [p?.attack, p?.hurt]),
  ]);
  const undrawn = Object.keys(spriteFiles).filter((path) => !drawnUrls.has(spriteFiles[path]));
  const suffixed = new RegExp(`(${Object.values(POSE_SUFFIX).join('|')})\\.png$`);

  const orphanPoses = undrawn.filter((path) => suffixed.test(path));
  if (orphanPoses.length > 0) {
    throw new Error(
      `Pose art belongs to no hero, so it can never be drawn:\n  ${orphanPoses.join('\n  ')}\n` +
        `A pose frame is named ${naming}. If the hero itself is new, it needs an entry in heroArt first.`
    );
  }

  const strays = undrawn.filter((path) => !suffixed.test(path));
  if (strays.length > 0) {
    console.warn(
      `[heroArt] Sprites nothing draws:\n  ${strays.join('\n  ')}\n` +
        `If one is meant to be a pose frame, rename it to ${naming} and it is picked up with no code change.`
    );
  }
}
