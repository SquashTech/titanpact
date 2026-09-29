import cinderKnightArt from '../../../art/heroes/cinder.png';
import crimsonArt from '../../../art/heroes/starters/crimson.png';
import brimstoneArt from '../../../art/heroes/brimstone.png';
import drakeArt from '../../../art/heroes/unlocks/drake.png';
import tidecallerArt from '../../../art/heroes/starters/riptide.png';
import pincerArt from '../../../art/heroes/pincer.png';
import leviathanArt from '../../../art/heroes/leviathan.png';
import nautilusArt from '../../../art/heroes/unlocks/nautilus.png';
import flurryArt from '../../../art/heroes/flurry.png';
import rimeArt from '../../../art/heroes/starters/rime.png';
import cubeArt from '../../../art/heroes/cube.png';
import stormRangerArt from '../../../art/heroes/stormranger.png';
import skyshearArt from '../../../art/heroes/skyshear.png';
import tempestArt from '../../../art/heroes/starters/Tempest.png';
import scallywagArt from '../../../art/heroes/unlocks/scallywag.png';
import patchArt from '../../../art/heroes/unlocks/patch.png';
import vexArt from '../../../art/heroes/unlocks/vex.png';
import cragArt from '../../../art/heroes/starters/Crag.png';
import sentinelArt from '../../../art/heroes/sentinel.png';
import slateArt from '../../../art/heroes/slate.png';
import wildOracleArt from '../../../art/heroes/starters/sylva.png';
import mordaxArt from '../../../art/heroes/mordax.png';
import hollowbarkArt from '../../../art/heroes/Hollowbark.png';
import tixwickArt from '../../../art/heroes/unlocks/tixwick.png';
import sunPriestArt from '../../../art/heroes/starters/solace.png';
import aegisArt from '../../../art/heroes/aegis.png';
import empyreanArt from '../../../art/heroes/empyrean.png';
import marrowArt from '../../../art/heroes/marrow.png';
import luciusArt from '../../../art/heroes/lucius.png';
import nightshadeArt from '../../../art/heroes/starters/nightshade.png';
import runescribeArt from '../../../art/heroes/starters/glyph.png';
import zenithArt from '../../../art/heroes/zenith.png';
import pixieArt from '../../../art/heroes/pixie.png';
import mindweaverArt from '../../../art/heroes/starters/cortex.png';
import tranceArt from '../../../art/heroes/trance.png';
import revenantArt from '../../../art/heroes/starters/revenant.png';
import sorrowArt from '../../../art/heroes/sorrow.png';
import dreadArt from '../../../art/heroes/dread.png';
import ironWardenArt from '../../../art/heroes/ironwarden.png';
import valorArt from '../../../art/heroes/starters/valor.png';
import gallantArt from '../../../art/heroes/gallant.png';
import clockworkArt from '../../../art/heroes/starters/clockwork.png';
import steamColossusArt from '../../../art/heroes/steamcolossus.png';
import rexArt from '../../../art/heroes/rex.png';
import fangArt from '../../../art/heroes/starters/fang.png';
import ursaArt from '../../../art/heroes/ursa.png';
import widowArt from '../../../art/heroes/Widow.png';
import coilArt from '../../../art/heroes/coil.png';
import driftArt from '../../../art/heroes/unlocks/drift.png';
import iglooArt from '../../../art/heroes/unlocks/igloo.png';
import carillonArt from '../../../art/heroes/unlocks/carillon.png';
import hartArt from '../../../art/heroes/unlocks/hart.png';
import ashwingArt from '../../../art/heroes/unlocks/ashwing.png';
import kappaArt from '../../../art/heroes/unlocks/kappa.png';
import tuskArt from '../../../art/heroes/unlocks/tusk.png';
import motleyArt from '../../../art/heroes/unlocks/motley.png';
import folioArt from '../../../art/heroes/unlocks/folio.png';
import roninArt from '../../../art/heroes/unlocks/ronin.png';
import kongArt from '../../../art/heroes/unlocks/kong.png';
import morelArt from '../../../art/heroes/unlocks/morel.png';
import screeArt from '../../../art/heroes/unlocks/scree.png';
import aurumArt from '../../../art/heroes/unlocks/aurum.png';
import jinxArt from '../../../art/heroes/unlocks/jinx.png';
import kitsuArt from '../../../art/heroes/unlocks/kitsu.png';
import tinderArt from '../../../art/heroes/unlocks/tinder.png';
import selkieArt from '../../../art/heroes/unlocks/selkie.png';
import hushArt from '../../../art/heroes/unlocks/hush.png';
import lotusArt from '../../../art/heroes/unlocks/lotus.png';
import nimbusArt from '../../../art/heroes/unlocks/nimbus.png';
import kiteArt from '../../../art/heroes/unlocks/kite.png';
import raijuArt from '../../../art/heroes/unlocks/raiju.png';
import duneArt from '../../../art/heroes/unlocks/dune.png';
import cairnArt from '../../../art/heroes/unlocks/cairn.png';
import murkArt from '../../../art/heroes/unlocks/murk.png';
import rookArt from '../../../art/heroes/unlocks/rook.png';
import koanArt from '../../../art/heroes/unlocks/koan.png';
import thaneArt from '../../../art/heroes/unlocks/thane.png';
import troveArt from '../../../art/heroes/unlocks/trove.png';
import totemArt from '../../../art/heroes/unlocks/totem.png';
import keenArt from '../../../art/heroes/unlocks/keen.png';
import ferraArt from '../../../art/heroes/unlocks/ferra.png';
import abacusArt from '../../../art/heroes/unlocks/abacus.png';
import whirrArt from '../../../art/heroes/unlocks/whirr.png';
import mellowArt from '../../../art/heroes/unlocks/mellow.png';

/** Portraits keyed by hero id (heroes.ts order). A missing entry renders text-only; a Titanspawn or Guardian id never reaches this — HeroPortrait draws it. */
export const heroArt: Partial<Record<string, string>> = {
  // --- Fire ---
  cinderKnight: cinderKnightArt,
  crimson: crimsonArt,
  brimstone: brimstoneArt,
  drake: drakeArt,
  ashwing: ashwingArt,
  tinder: tinderArt,
  // --- Water ---
  tidecaller: tidecallerArt,
  pincer: pincerArt,
  leviathan: leviathanArt,
  nautilus: nautilusArt,
  kappa: kappaArt,
  selkie: selkieArt,
  // --- Frost ---
  glacialWarden: flurryArt,
  rime: rimeArt,
  cube: cubeArt,
  rimehold: iglooArt,
  tusk: tuskArt,
  hush: hushArt,
  // --- Storm ---
  stormRanger: stormRangerArt,
  skyshear: skyshearArt,
  tempest: tempestArt,
  scallywag: scallywagArt,
  nimbus: nimbusArt,
  kite: kiteArt,
  raiju: raijuArt,
  // --- Stone ---
  crag: cragArt,
  sentinel: sentinelArt,
  slate: slateArt,
  scree: screeArt,
  dune: duneArt,
  cairn: cairnArt,
  // --- Nature ---
  wildOracle: wildOracleArt,
  mordax: mordaxArt,
  hollowbark: hollowbarkArt,
  tixwick: tixwickArt,
  morel: morelArt,
  lotus: lotusArt,
  // --- Light ---
  dawnwarden: sunPriestArt,
  aegis: aegisArt,
  empyrean: empyreanArt,
  carillon: carillonArt,
  hart: hartArt,
  aurum: aurumArt,
  // --- Shadow ---
  marrow: marrowArt,
  lucius: luciusArt,
  nightshade: nightshadeArt,
  jinx: jinxArt,
  murk: murkArt,
  rook: rookArt,
  // --- Arcane ---
  runescribe: runescribeArt,
  zenith: zenithArt,
  pixie: pixieArt,
  folio: folioArt,
  thane: thaneArt,
  trove: troveArt,
  // --- Mind ---
  mindweaver: mindweaverArt,
  trance: tranceArt,
  drift: driftArt,
  motley: motleyArt,
  koan: koanArt,
  // --- Spirit ---
  revenant: revenantArt,
  sorrow: sorrowArt,
  dread: dreadArt,
  kitsu: kitsuArt,
  totem: totemArt,
  keen: keenArt,
  // --- Iron ---
  ironWarden: ironWardenArt,
  valor: valorArt,
  gallant: gallantArt,
  ronin: roninArt,
  ferra: ferraArt,
  // --- Mech ---
  forgewright: clockworkArt,
  steamColossus: steamColossusArt,
  rex: rexArt,
  patch: patchArt,
  abacus: abacusArt,
  whirr: whirrArt,
  // --- Beast ---
  packAlpha: fangArt,
  ursa: ursaArt,
  widow: widowArt,
  coil: coilArt,
  vex: vexArt,
  kong: kongArt,
  mellow: mellowArt,
};

// The Guardians and the Endbringer are not here either: guardianFigures.ts draws them, sealed and
// unsealed, from one figure each. Their retired sprites are under art/archive/guardians/.

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
 * Every sprite in the hero directory, source path → URL. Scoped to it on
 * purpose: `art/` also holds ~2,200 icons that nothing here wants, and an eager
 * glob over all of it would bundle every one — and `art/archive/` holds the
 * retired faction and Guardian sprites, which must stay out of it or the orphan
 * check below throws on their pose frames. Nearly every file the glob finds is
 * imported above already, so it costs essentially nothing on top of what the
 * page loads anyway.
 */
const spriteFiles = import.meta.glob<string>('../../../art/heroes/**/*.png', {
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
