// ⚠️ TEST FIXTURE CONTENT — a level-up move pool and Evolution paths for the
// fixture roster's starter heroes, enough to exercise both consequences of
// leveling end to end (docs/leveling-and-ranks.md: a level-up either "offers
// a random move" or, at EVOLUTION_LEVEL, surfaces the Evolution choice
// instead). Every hero's starting kit (src/data/heroes.ts) is exactly three
// moves — a low-power main-type move plus two supports — so the moveTiers
// pool below is where the rest of a hero's thematic movepool lives, offered
// randomly (not in authored order) as the hero levels up toward the 4-move
// cap (src/run/progression.ts MOVE_CAP). Not the authored 53-hero
// progression content.
//
// A pool entry that's also in the hero's starting kit is dead weight —
// levelUpMovePool filters out anything already unlocked, so it can never be
// offered — which is why runescribe's pool carries Mana Font rather than the
// Magic Bolt it now starts with.
//
// SCOPE NOTE: paths are stat-only (statGrants + description, no
// unlocksMoveIds) — kept deliberately separate from the level-up move pool
// so the two growth axes don't gate the same content twice. Every fixture
// hero's evolution node sits at EVOLUTION_LEVEL and offers exactly three
// paths differing in kind (CLAUDE.md "the player is presented with a choice
// of three options"): one offensive, one defensive, one utility — not every
// path grafts a type ("mono remains a legitimate terminal state",
// docs/progression.md); each hero keeps exactly one mono path as a valid
// terminal identity. `description` is the one-line flavor/mechanical pitch
// shown on the Evolution choice screen (src/view/run/LevelUpScreen.tsx) —
// this is the 2026-08-16 designer draft verbatim, not final balance copy.
//
// ironWarden and wildOracle were promoted from dual- to mono-typed in
// src/data/heroes.ts to fit this framework's mono-base-plus-graft shape
// (matching the "50/50 heroes" pattern in CLAUDE.md, even though neither is
// on that specific list) — Iron/Stone and Nature/Spirit are now reachable
// only via their defensive Evolution paths (Bulwark/Heartwood keep them
// mono; the type comes from a sibling path instead, same as any other
// hero here). Type-chart tuning is unaffected: the chart is keyed per
// single type, not per pair.
//
// cinderKnight and tidecaller's paths were renamed/retyped from an earlier
// placeholder pass (Blazing Vanguard/Ember Bulwark/Kindled Spirit, Deluge
// Adept/Glacial Bastion/Mana Current) to match the same designer draft —
// stat grants are unchanged, only names and typeGraft targets moved to line
// up with the other 10 heroes' authored framework.
//
// Lucius (dual Shadow/Mind — no typeGraft path, per the mono-only rule
// chooseEvolutionPath enforces) is the one exception to the stat-only scope
// note above: his defensive path also grants a Passive (grantsPassiveIds,
// src/run/progression.ts EvolutionPath, engine/content.ts PassiveDefinition)
// — Sanguine (src/data/passives.ts), the first Evolution-granted Passive now
// that the contract exists (engine/combat/passiveEngine.ts).

import type { ProgressionTable } from '../run/progression';
import { EVOLUTION_LEVEL } from '../run/progression';

export const progressionTable: ProgressionTable = {
  moveTiers: {
    // The three Fire heroes draw from the authored Fire pool (src/data/moves.ts),
    // split by the stat each one actually attacks with rather than by tier:
    // Cinder (Atk 70 / Int 30) takes the physical line, Crimson (Int 80) the
    // magical burst line, Brimstone (Int 60, Fire/Shadow) the spread-and-
    // attrition line. Each hero's own starting move is deliberately absent —
    // levelUpMovePool filters unlocked moves out, so listing it is dead weight.
    // kindle left this pool for Cinder's starting kit (heroes.ts) when the
    // Spirit slate deleted Mend Wounds — a starting move in its own pool is
    // dead weight levelUpMovePool can never offer.
    // quickJab died with the Iron slate (moves.ts, 2026-08-30). Cinder is the
    // only Fire hero for which Iron is an INNATE second type, and at Atk 70 it
    // is the one that can actually swing it, so the slot became a real Iron
    // line rather than one more off-type poke.
    // fangRush dropped with the Beast slate (moves.ts, 2026-08-30) rather
    // than being repointed: Cinder is Fire/Iron and already draws a full line
    // from both, so the off-type Beast slot was filler the moment the type
    // had content of its own.
    cinderKnight: ['moltenLash', 'firebrand', 'volcanicSurge', 'heavyBlow', 'momentumSwing'],
    // stokeTheFlames sits here rather than on the other two deliberately:
    // it buffs the whole active side, and Crimson is the only Fire STARTER
    // (heroes.ts), so it is the one that can be drafted alongside a second
    // Fire hero for the ramp to pay off twice.
    // stokeTheFlames likewise moved up into Crimson's starting kit
    // (heroes.ts) when Mend Wounds died. The note above still holds — it is on
    // the Fire STARTER because a side-wide ramp wants a second Fire hero
    // beside it — it now just starts unlocked rather than being drawn for.
    crimson: ['setAlight', 'scorch', 'immolate', 'firestorm', 'inferno', 'purify'],
    // The two Water heroes draw from the authored Water pool (src/data/moves.ts,
    // 2026-08-30), split the same way the Fire three are — by the stat each
    // actually attacks with. Riptide (Int 59) takes the magical line and, being
    // the only Water STARTER, also carries High Tide for the reason Crimson
    // carries Stoke the Flames: it buffs the whole active side, so it wants to
    // be on the hero that can be drafted alongside a second Water hero.
    tidecaller: ['siphon', 'torrent', 'engulf', 'deluge', 'oasis', 'maelstrom', 'tsunami', 'highTide'],
    // fortify dropped 2026-08-30: it is in Warden's own STARTING kit
    // (heroes.ts), so levelUpMovePool filtered it out and it could never be
    // offered — dead weight that made the pool read as 5 picks when it was 4.
    // Predates the Spirit slate; found by widening §9's "no starter in its own
    // pool" assertion past the type being authored (test/spiritMoves.test.ts).
    // Iron authored (moves.ts, 2026-08-30). Warden takes the DEBUFF line its
    // Atk 55 / Def 90 frame can actually play — Rend Armor is the escalation
    // of the Opening Strike it starts with, and Juggernaut is the one row in
    // the game that answers Speed 30. The two Stone entries stay: Body Blow
    // swings DEFENSE (offStatOverride), which is the single best move in the
    // game for a Defense-90 hero and the reason it was put here.
    // pinDown moved down here from Warden's kit when Fortify was re-authored
    // (heroes.ts, 2026-08-30) — still the debuff line, one pick later.
    ironWarden: ['ironFist', 'pinDown', 'rendArmor', 'juggernaut', 'rockToss', 'bodyBlow'],
    // The three Nature heroes draw from the authored Nature pool
    // (src/data/moves.ts, 2026-08-30), split by the stat each actually attacks
    // with, same as Fire/Water/Frost/Storm/Stone. Sylva (Int 60, Wis 60) takes
    // the magical line and with it BOTH halves of the type's engine — the
    // Poison stack (Blight, Corrode) and the move that detonates it (Miasma) —
    // because it is the only Nature hero that can hold all three at once.
    //
    // Magic Growth sits here for the reason Crimson carries Stoke the Flames
    // and Riptide carries High Tide: it is the side-wide/field move, and Sylva
    // is the only Nature STARTER (heroes.ts), so it is the one that can be
    // drafted alongside a second Nature hero for Verdant Earth to pay off twice.
    // mendWounds survived the Nature rewrite as Sylva's only heal-KIND move
    // and did not survive the Spirit one (moves.ts, 2026-08-30) — so Sylva now
    // has no direct heal either, and every point of Nature healing in its pool
    // is Renew. The consequence Nature's own hand-off predicted, arriving one
    // slate later than expected.
    // animalSpirit is the Beast slate's one magical row, authored as
    // "coverage for certain casters" rather than for its own type (moves.ts,
    // 2026-08-30), and this is the least arguable home in the roster: Sylva
    // is Intelligence 60 on an 80 pool against the move's 50, its OFFENSIVE
    // Evolution grafts Beast (so the move gains STAB on the exact build that
    // wants it), and Nature's own slate has no spread damage move at all —
    // the gap that type's hand-off reported and nothing has filled since.
    // The other candidates are deliberately left unplaced; see
    // docs/authoring-moves.md §10.
    wildOracle: ['blight', 'corrode', 'magicGrowth', 'miasma', 'forceOfNature', 'wildBloom', 'animalSpirit'],
    // The three Storm heroes draw from the authored Storm pool (src/data/moves.ts,
    // 2026-08-30), split by the stat each actually attacks with, same as Fire,
    // Water and Frost. Squall (Atk 65 vs Int 35) and Scallywag (Atk 75 vs Int
    // 30) share the physical line and are separated by what each is FOR: Squall
    // is the Speed-90 pivot, so it gets Tailwind; Scallywag is the Attack-75
    // bruiser, so it gets a second mark planter to feed its own Overcharge.
    //
    // Overcharge sits in both 50-mana pools despite costing 60. That is the
    // move: it is free while both enemies carry Conduct, so on these two heroes
    // it is only ever castable off a fully-marked board — see docs/combat.md
    // for the hand-off on whether that reads as a payoff or as a dead row.
    // fangRush dropped with the Beast slate (moves.ts, 2026-08-30) — same
    // reason as Cinder above: off-type filler, and Tempest has a Storm line.
    stormRanger: ['stormLash', 'shockSlice', 'tailwind', 'overcharge', 'heavyBlow'],
    // Tempest had NO pool at all before the Storm slate — a starter that could
    // never learn a move (levelUpMovePool returns an empty list for a hero with
    // no moveTiers entry). It takes the magical line, and with it Storm Surge,
    // for the reason Crimson carries Stoke the Flames and Riptide carries High
    // Tide: it buffs the whole active side, and Tempest is the only Storm
    // STARTER, so it is the one that can be drafted alongside a second Storm
    // hero. That the +50 Attack lands better on that partner than on Tempest
    // itself is the point, not an accident.
    tempest: ['ionize', 'chainLightning', 'electricBurst', 'thunderbolt', 'stormSurge', 'ionicZap'],
    // Shadow's authored pool (src/data/moves.ts, 2026-08-30). Vesper is the
    // physical Stealth line — Ambush and Shadow Form are the payoffs its own
    // Vanish arms. Marrow is the MAGICAL line (heroes.ts: Attack and
    // Intelligence swapped, 2026-08-30), so it takes the Poison escalation and
    // the magical execute and none of the physical moves it can no longer
    // swing.
    shadowMonk: ['ambush', 'shadowSlice', 'rend', 'duskBlade', 'shadowForm'],
    marrow: ['umbralBeam', 'umbralWave', 'eclipse', 'enfeeble'],
    // The three Frost heroes draw from the authored Frost pool (src/data/moves.ts,
    // 2026-08-30), split by the stat each actually attacks with, same as Fire
    // and Water. Flurry (Int 70) takes the magical line and with it BOTH of the
    // `requiresTargetStatus` moves — it is also the hero carrying Deep Chill in
    // its starting kit, so the key and the lock grow on the same hero rather
    // than depending on a second Frost draft.
    glacialWarden: ['snowBlast', 'glaciate', 'permafrost', 'quickFreeze', 'frigidAir', 'absoluteZero', 'avalanche', 'purify'],
    // Light authored (2026-08-30): Solace is Int 60 / Wis 70, so it takes the
    // MAGICAL half of the slate plus the whole support line — the two spread
    // moves, both big heals, every Intelligence buff, and Consecrate + Smite,
    // which are the only pair in the game where one move is the other's damage
    // condition (moves.ts conditionalPower.requiresFieldEffect). Its three
    // starters (Glimmer, Mend, Purify) are deliberately absent: levelUpMovePool
    // filters unlocked moves out, so listing them here would be dead weight.
    // The off-type filler (fortify) is gone now that the type has its own.
    dawnwarden: [
      'radiantBeam',
      'blind',
      'bless',
      'consecrate',
      'smite',
      'radiance',
      'blindingFlash',
      'solarFlare',
      'divineGrace',
      'judgment',
      'exalt',
    ],
    // The two Arcane heroes draw from the authored Arcane pool
    // (src/data/moves.ts, 2026-08-30). Both are magical, so unlike every slate
    // before this one the split is not physical-vs-magical — it is
    // artillery-vs-battery (see heroes.ts). Glyph takes the damage line and
    // both halves of the type's own engine: Mana Font, which sets Magical
    // Surge, and Overload, which reads it back as a spread. Putting the field
    // and the move that keys off it in ONE pool is deliberate, the same call
    // Light's Consecrate/Smite pairing made — the combo grows on one hero
    // rather than depending on a second Arcane draft.
    //
    // Mana Font also sits here for the reason Crimson carries Stoke the Flames
    // and Riptide carries High Tide: it is the side-wide/field move, and Glyph
    // is the only Arcane STARTER (heroes.ts), so it is the one that can be
    // drafted alongside a second Arcane hero for the field to pay off twice.
    // The off-type filler (mindSpike, psychicLance, weaken) is gone now that
    // the type has its own line.
    // Conjured Sword (Iron, moves.ts 2026-08-30) is the one row of that slate
    // authored for heroes who do NOT have the type — "a lategame learnable for
    // certain spellcasters", per the designer. Glyph is the game's highest
    // Intelligence (90) on the game's second-biggest pool (85, against the
    // move's 80), and this is already the artillery line, so it is the least
    // arguable home for it. WHICH other casters should learn it is a roster
    // decision, not a movepool one — see docs/authoring-moves.md §10 (Iron)
    // for the candidate list, left unplaced rather than stuffed in.
    runescribe: ['manaFont', 'study', 'arcaneBlast', 'overload', 'magicCloak', 'arcPulse', 'singularity', 'cataclysm', 'conjuredSword'],
    // Cortex takes the WISDOM/control line — the half of the slate its 55/55
    // Int/Wis frame can actually play. Mind Shatter is the anchor (it swings
    // Wisdom, so Mental Fortress is its ramp), and Break Will -> Brain Flay is
    // the stat-reduction engine, which wants the bulkier hero because it costs
    // whole turns before it pays. Stasis sits here for the same reason Crimson
    // carries Stoke the Flames and Glyph carries Mana Font: it is the
    // field-effect setter and Cortex is the type's only STARTER (heroes.ts),
    // so it is the one that can be drafted alongside a second Mind hero.
    // The off-type filler (spectralBind, quickJab, vanish, stunningBlow) is
    // gone now that the type has its own line.
    mindweaver: ['enervate', 'psychicBlow', 'stasis', 'mentalFortress', 'disorient', 'mindShatter', 'breakWill', 'brainFlay'],
    // Three of Clockwork's four pool entries were Iron fixture moves and all
    // three died (moves.ts, 2026-08-30). Mech has no authored slate yet, so
    // the line stays off-type Iron — it is just a line now instead of filler.
    // Clockwork takes the MAGICAL half of the slate, and it takes it by
    // default rather than by fit: Intelligence 45 is the highest any Mech hero
    // has, and the four magical rows (Backfire, Overheat, Malfunction,
    // Meltdown) are otherwise in nobody's pool at all — Bellows is
    // Intelligence 15. Reported in docs/authoring-moves.md §10; Stone's
    // finding, with a fourth row on it.
    //
    // The line those four make is coherent even so: Mech's magic is heat it
    // cannot contain, so every one of them burns the caster or gambles on
    // what it does. Salvage is the answer to that — the only self-target heal
    // in the game, and the reason this hero can keep pressing Overheat. Jury-
    // Rig extends the reel it already opened with Overclock.
    //
    // Deliberately no physical rows: Bellows has those, and a pool shared
    // between two heroes is the byte-identical-kits problem five slates have
    // now reported (docs/authoring-moves.md §10).
    forgewright: ['backfire', 'overheat', 'malfunction', 'meltdown', 'salvage', 'juryRig'],
    // Beast authored (src/data/moves.ts, 2026-08-30). Fang is the type's
    // only hero, so like Spirit's Revenant it draws the WHOLE physical half
    // rather than a line split against a sibling — eleven entries, and the
    // off-type filler (rendingClaw, ironFist, heavyBlow, weaken) is gone now
    // that the type has rows of its own.
    //
    // Two of these are pack rows Fang cannot satisfy on its own (Pack Hunt,
    // Pack Leader), and they are here rather than orphaned because the
    // condition IS reachable — Sylva, Rime and Mordrax each have a
    // Beast type-graft Evolution below, so a Fang drafted beside one of them
    // turns both rows on mid-run. Named in docs/authoring-moves.md §10 rather
    // than quietly tuned, because until that Evolution is taken Pack Hunt is
    // strictly worse than Lacerate.
    //
    // animalSpirit is NOT here: it is the slate's one magical row and Fang is
    // Intelligence 20 (see wildOracle below).
    packAlpha: [
      'prowl',
      'pounce',
      'lacerate',
      'maul',
      'toxicFangs',
      'thrash',
      'packHunt',
      'rampage',
      'eviscerate',
      'apexPredator',
      'packLeader',
    ],
    // Widow and Coil (heroes.ts, 2026-08-30) split the Beast pool the way
    // Fire's three heroes split theirs — by the stat each one actually
    // attacks with — except that here the split is also the type's
    // physical/magical seam, and Beast has only one row on the far side of
    // it.
    //
    // Widow (Beast/Shadow, Atk 85 / Spd 90) takes the Bleed line through
    // BOTH types: Beast plants it (Claw, Lacerate, Toxic Fangs) and cashes
    // it (Maul, Eviscerate), Shadow plants it three more times (Backstab,
    // Shadow Slice, Dusk Blade), and every one of those carries STAB on this
    // hero. Stealth is the second thread — Ambush doubles off the Vanish in
    // its starting kit, and Shadow Form is the capstone that grants both.
    //
    // Deliberately absent, each for a stated reason: Rampage (25% recoil is
    // a bad trade on 75 HP, and this is the one hero in the game the recoil
    // could routinely kill), Pounce (a +1 bracket row on the hero that is
    // already tied for fastest is the definition of a dead pick), Thrash and
    // Pack Leader (Fang's side-wide rows — Widow is the one who cashes the
    // pack bonus, not the one who hands it out). Pack Hunt IS here: doubled
    // beside Fang it is the best rate in the slate, and Widow is now one of
    // exactly two heroes that can be the Beast on the other side of it.
    widow: [
      'claw',
      'backstab',
      'lacerate',
      'ambush',
      'fadeStrike',
      'maul',
      'packHunt',
      'toxicFangs',
      'shadowSlice',
      'duskBlade',
      'eviscerate',
      'shadowForm',
      'apexPredator',
    ],
    // Coil (Beast/Mind, Int 75 / Atk 30) is the inverse: an ENTIRELY magical
    // pool on a Beast hero. Not a stylistic choice — every Beast row but one
    // is physical, and offering any of them to Attack 30 would be the trap
    // pick the north star forbids (Pack Hunt doubled off Atk 30 is still
    // worse than Psychock). So Beast contributes exactly two: animalSpirit,
    // which is the reason this hero exists, and packLeader, whose +50 Speed
    // half is live on Coil while its +50 Attack half is the partner's, and
    // whose 100 -> 50 discount is exactly the condition Coil is here to
    // satisfy.
    //
    // The Mind half is split against Cortex rather than duplicated wholesale.
    // Cortex keeps the WISDOM line it was authored around (Mind Shatter
    // swings Wisdom, Brain Ward and Mental Fortress ramp it, Stasis and
    // Psychic Blow are its tempo); Coil takes the straight INTELLIGENCE line
    // — the damage rows plus the debuffs that widen them. Enervate, Disorient
    // and Break Will sit in both pools on purpose, the way Vesper's and
    // Nightshade's Shadow pools already overlap on five rows.
    //
    // Dopamine is the one entry here that is about the DUAL rather than about
    // Mind: the Beast slate authored no heal at all, on purpose, and Coil is
    // the only Beast hero that can have one without the type getting it.
    // Wisdom 60 also heals for more than Cortex's 55, so it is not a borrowed
    // row — it is the better home for it.
    //
    // Cerebral Shock is deliberately NOT here even though it is Mind, Int-
    // swinging, and currently unreachable. It applies Conduct, whose
    // triggerTypes are ['Storm', 'Iron'] (statuses.ts), and Coil is Beast/
    // Mind — so it would be the same dead button on a third hero rather than
    // a rescue. Its orphan status is a designer call (test/stoneMoves.test.ts
    // pins the list and states the reason), and a new Mind hero is not a
    // reason to overturn it.
    coil: [
      'animalSpirit',
      'psychock',
      'wickedFear',
      'dopamine',
      'enervate',
      'disorient',
      'psionicWave',
      'breakWill',
      'packLeader',
    ],
    // --- Stone/Spirit starters + the new Iron starter (2026-08-17) ---
    // rally moved up into Valor's starting kit (heroes.ts) when Mend Wounds died.
    //
    // Iron authored (moves.ts, 2026-08-30). Valor is Iron's ONLY starter, so
    // Reinforce sits here for the reason Crimson carries Stoke the Flames and
    // Riptide carries High Tide: it is the side-wide row, and this is the one
    // Iron hero that can be drafted alongside a second one for it to pay off
    // twice. The rest is the type's middle — the Bleed carrier, the spread,
    // and the two mid attacks its Atk 60 can afford before the capstones.
    valor: ['openingStrike', 'heavyBlow', 'momentumSwing', 'serratedSlice', 'reinforce', 'swingingChain'],
    // Revenant draws the ENTIRE magical half of the authored Spirit pool
    // (src/data/moves.ts, 2026-08-30), which is a deliberate departure from
    // the "keep the pool a line, not a sample" rule every other type here
    // follows — and it is a fact about the roster, not about the slate.
    // Spirit has exactly one hero, so there is no second line to split into,
    // and anything left out is a move no pool in the game points at.
    //
    // What IS left out is the physical half — Phantom Strike, Spooky Slice and
    // Wailing Flight. Revenant is Int 77 against Atk 56, so Wailing Flight's
    // 85 base power lands for less than Banish's 100 does, and putting it here
    // would be the trap pick the north star forbids. They are reported as
    // orphans (test/spiritMoves.test.ts pins the list) rather than stuffed in,
    // per the rule Stone's slate set: the deliverable is the list, not a fix.
    revenant: [
      'torment',
      'drain',
      'spite',
      'soulRend',
      'poltergeist',
      'soulOffering',
      'vengeance',
      'flicker',
      'banish',
      'lastRites',
      'ascendant',
    ],
    crag: ['faultLine', 'rubbleRush', 'retribution', 'boulderSlam', 'provoke', 'weaken', 'rally'],

    // --- Rime, Cube, Mordrax (2026-08-17) ---
    // Rime takes the physical line — and Frost Wall, for the reason Crimson
    // carries Stoke the Flames and Riptide carries High Tide: it buffs the whole
    // active side, and Rime is the only Frost STARTER (heroes.ts), so it is the
    // one that can be drafted alongside a second Frost hero. Ice Shatter sits
    // here at 70 despite Rime's 60 pool; see docs/combat.md for that hand-off.
    // stunningBlow dropped 2026-08-30 with the Iron slate. Not backfilled:
    // Rime's own Frost line is already eight deep and Iron has nothing at the
    // 20-mana price point that row occupied.
    // rendingClaw and fangRush both died with the Beast slate (moves.ts,
    // 2026-08-30) and ONE Beast row replaces the two: Claw keeps the off-type
    // Bleed slot at the slate's price. Rime is one of the three heroes with a
    // Beast type-graft Evolution (Direwing, below), so a Beast move here is
    // the type it may actually become rather than filler.
    rime: ['icicleThrust', 'coldSnap', 'iceShatter', 'frostWall', 'permafrost', 'claw'],
    // Cube's 45 pool is the tightest in the game, so its line is the cheap half
    // of the physical one plus its own Freeze setup — Deep Chill (25) and
    // Permafrost (45, exactly affordable) feeding Cold Snap (35).
    cube: ['icicleThrust', 'coldSnap', 'deepChill', 'permafrost', 'rockToss', 'openingStrike', 'ironFist'],
    // Mordrax takes the physical line and, with Overgrowth, the Renew that
    // doubles Branch Slam — the two are one pick, and putting them in the same
    // pool is what makes that legible rather than accidental.
    mordax: ['ivySpike', 'thornWhip', 'leafSlice', 'branchSlam', 'overgrowth', 'toxicSpores', 'weaken'],

    // Lucius: only his Evolutions are deferred (src/data/heroes.ts) — he
    // still grows a movepool like any other hero below EVOLUTION_LEVEL.
    // Int 75 / Atk 35, so the MAGICAL Shadow line — and the only hero holding
    // Eclipse, the slate's 80-mana execute.
    // Lucius keeps the magical SHADOW line and takes the raw magical half of
    // the Mind slate alongside it (§7: a dual-typed hero keeps both). Int 75
    // is the type's real caster stat, so the straight-damage rows land here
    // and the Wisdom-scaling ones go to Cortex. Wicked Fear was the deliberate
    // upgrade path from the spectralBind in its kit; the Spirit slate deleted
    // spectralBind (moves.ts, 2026-08-30), so Wicked Fear moved up into the
    // kit itself and out of this pool.
    lucius: ['umbralBeam', 'eclipse', 'umbralWave', 'enfeeble', 'psychock', 'psionicWave', 'lull'],

    // --- Hollowbark, Aegis, Brimstone, Gallant, Nightshade, Pincer,
    // Scallywag, Sentinel, Bellows, Zenith (2026-08-22) ---
    // Hollowbark shares the physical line but is the 40-mana wall, so its
    // half of it is the cheap end (Vine Lash 20, Blight 30) plus the two big
    // swings a run's mana growth eventually reaches (docs/mana.md).
    // rendingClaw dropped: Leaf Slice is the slate's own Bleed carrier.
    hollowbark: ['vineLash', 'blight', 'leafSlice', 'thornWhip', 'branchSlam', 'regrowth', 'weaken'],
    // Aegis is Atk 45 / Int 40 / Wis 75 / Def 80 — the slate's PHYSICAL half
    // (Holy Slice, Deity Blade, on top of the Holy Strike it opens with) plus
    // the support line its Wisdom actually pays for. Bless and Exalt are here
    // despite granting a stat Aegis barely uses: both are singleAlly, so this
    // is the hero that spends a turn making a MAGICAL partner enormous.
    // stunningBlow died with the Iron slate and Mend moved up into Aegis's own
    // starting kit (both 2026-08-30), so two entries left this pool. Reinforce
    // replaces them: Iron's +20 Attack / +20 Defense to BOTH allies is the
    // closest thing left in the game to the Fortify that Aegis lost, it is
    // singleAlly-adjacent in exactly the way Bless and Exalt are, and Aegis's
    // 70 pool is the only one of the nine ex-Fortify heroes that can pay 50
    // for it.
    aegis: ['holySlice', 'deityBlade', 'purify', 'bless', 'exalt', 'consecrate', 'divineGrace', 'reinforce'],
    // The spread-and-attrition line reads the same on both halves now: Fire's
    // Burn spreads, Shadow's Poison spreads.
    brimstone: ['sparkFlash', 'spreadingBlaze', 'backdraft', 'sparkBurst', 'umbralBeam', 'umbralWave'],
    // galeShot dropped with the Storm rewrite — it was Storm filler on a
    // mono-IRON hero, and Iron's own five moves are already split across
    // Gallant's kit and the four below, so there is no same-type replacement to
    // put in the slot. Left short rather than backfilled with more off-type
    // filler; the real fix is Iron's own authored slate.
    //
    // Which landed 2026-08-30, so savageMaul goes too and the pool is now
    // wholly Iron. Gallant is the AGGRO line: Atk 80 behind Def 55, so it takes
    // the Attack ramp (Iron Fist, Momentum Swing) into Onslaught, the type's
    // 100-power capstone, plus the Bleed carrier. Metallic Blade is here
    // rather than on Warden or Valor because a free 50-power swing is worth
    // most to the hero that wants to press an attack every single round — and
    // because Gallant's 45 pool is the one that most needs the rows it cannot
    // otherwise afford.
    gallant: ['swiftBlow', 'ironFist', 'momentumSwing', 'serratedSlice', 'metallicBlade', 'onslaught'],
    // Speed 85, the fastest Shadow hero, so Shadowstrike's +1 bracket is worth
    // most here. Off-type filler (curseMind, rendingClaw, stunningBlow) drops
    // for the type's own line — docs/authoring-moves.md §7, "a line, not a sample".
    nightshade: ['shadowstrike', 'ambush', 'shadowSlice', 'rend', 'duskBlade', 'shadowForm'],
    // Pincer takes the physical line — and Wash Away, which scales off Wisdom
    // (45) rather than off the category, so the 20-Intelligence wall is a
    // perfectly good carrier for it. Wave Shred sits here because Pincer is the
    // only physical Water hero in the roster; see docs/combat.md for the open
    // question about its first cast being unaffordable on a 55 pool.
    pincer: ['aquaSlice', 'waveShred', 'washAway', 'rendArmor', 'refresh'],
    // ironFist moved up into Scallywag's starting kit and stunningBlow died,
    // both with the Iron slate (2026-08-30); Heavy Blow is the one row left.
    // fangRush dropped with the Beast slate (moves.ts, 2026-08-30).
    scallywag: ['stormLash', 'shockSlice', 'overcharge', 'risingStatic', 'heavyBlow'],
    sentinel: ['bodyBlow', 'bastion', 'retribution', 'bodyCrush', 'stoneheart', 'toughenUp', 'rally'],
    // Bellows is Mech/IRON at Atk 90 and Speed 15 — the heaviest body in the
    // roster — so its half of the slate is the big swings, with STAB, and none
    // of the cheap ramp (Iron Fist and Sharpen are in its starting kit now).
    // Onslaught's 80 sits above its 40 starting pool on purpose; a run's mana
    // growth is what opens it (docs/mana.md).
    // Bellows takes the PHYSICAL half plus the two rows that scale off
    // nothing. Atk 90 behind Speed 15 is the heaviest, slowest body in the
    // roster, so it gets the big swings: Cog Slam (the 65 BP coin flip),
    // Whirling Blades (the spread), and Jackpot, which wants exactly this
    // hero — a 150 roll through an Attack of 90 is the largest single hit the
    // type can produce, and the reel being visible means a slow hero can wait
    // a round for it without wasting the turn.
    //
    // Overdrive and Perfect Creation are here rather than on Clockwork for
    // the same reason as each other: neither reads a stat. Overdrive's +20 to
    // all five is worth most on the body with the worst Speed, and Perfect
    // Creation is six flat statuses, so Intelligence 15 costs it nothing.
    // Onslaught keeps the Iron half of the ramp alive.
    steamColossus: ['cogSlam', 'whirlingBlades', 'jackpot', 'overdrive', 'perfectCreation', 'onslaught'],
    // Zenith takes the battery line — every mana grant the slate authors, plus
    // Arcane Overflow, which is the only move that reads the pool back out. The
    // three are one plan: bank with Font of Power, cash it as a three-figure
    // Attack/Intelligence buff on both allies, and still have the mana to spend
    // on Singularity afterward (moves.ts derivedStatDeltas reads the pool BEFORE
    // the 80 is paid, and spends none of it). Magic Bolt and Cataclysm are the
    // damage it can actually afford between grants; the rest of the artillery
    // line stays on Glyph.
    zenith: ['conduit', 'fontOfPower', 'arcaneOverflow', 'magicBolt', 'cataclysm', 'focus'],
  },
  evolutions: {
    // cinderKnight is now baseline Fire/Iron (src/data/heroes.ts, 2026-08-17)
    // rather than mono Fire grafting Iron via Evolution — none of its three
    // paths may carry a typeGraft any more (chooseEvolutionPath rejects a
    // type-graft path on an already-dual-typed hero, src/run/progression.ts),
    // so Ironclad and Thunderblaze were re-themed to amplify the existing
    // Fire/Iron kit instead of reaching for a third type.
    cinderKnight: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'cinderKnight-offensive',
            heroId: 'cinderKnight',
            kind: 'offensive',
            name: 'Explosive',
            description: 'Burn-stacking burst; leans into Consume-Burn detonations.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cinderKnight-defensive',
            heroId: 'cinderKnight',
            kind: 'defensive',
            name: 'Ironclad',
            description: 'Armored frontliner; protect self/partner, high bulk.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cinderKnight-utility',
            heroId: 'cinderKnight',
            kind: 'utility',
            name: 'Thunderblaze',
            description: 'Molten-forged speed; sheds bulk for tempo and priority pressure.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    tidecaller: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'tidecaller-offensive',
            heroId: 'tidecaller',
            kind: 'offensive',
            name: 'Maelstrom',
            description: 'Escalating wave pressure / multi-hit.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'tidecaller-defensive',
            heroId: 'tidecaller',
            kind: 'defensive',
            name: 'Tidewarden',
            description: 'Sustain tank; Renew + protect.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'tidecaller-utility',
            heroId: 'tidecaller',
            kind: 'utility',
            name: 'Frostbound',
            description: 'Freeze control; locks tempo, feeds Freeze→Consume lines.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
          },
        ],
      },
    ],
    ironWarden: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'ironWarden-offensive',
            heroId: 'ironWarden',
            kind: 'offensive',
            name: 'Sunderer',
            description: 'Armor-piercing heavy hits; cuts enemy Def.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Mech',
          },
          {
            id: 'ironWarden-defensive',
            heroId: 'ironWarden',
            kind: 'defensive',
            name: 'Bulwark',
            description: 'Redirect/protect partner — the doubles anchor.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'ironWarden-utility',
            heroId: 'ironWarden',
            kind: 'utility',
            name: 'Lodestar',
            description: 'Cleanse + ally support; the paladin path.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
        ],
      },
    ],
    wildOracle: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'wildOracle-offensive',
            heroId: 'wildOracle',
            kind: 'offensive',
            name: 'Thornwrath',
            description: 'Feral on-hit aggression; Bleed/Poison pressure.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Beast',
          },
          {
            id: 'wildOracle-defensive',
            heroId: 'wildOracle',
            kind: 'defensive',
            name: 'Heartwood',
            description: 'Renew bulwark; sustains the pair.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'wildOracle-utility',
            heroId: 'wildOracle',
            kind: 'utility',
            name: 'Augur',
            description: 'Foresight/control; status manipulation and priority steering.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    stormRanger: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'stormRanger-offensive',
            heroId: 'stormRanger',
            kind: 'offensive',
            name: 'Tempest',
            description: 'High-crit, high-priority skirmisher.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'stormRanger-defensive',
            heroId: 'stormRanger',
            kind: 'defensive',
            name: 'Bedrock',
            description: 'Grounded tank; hazard/redirect.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'stormRanger-utility',
            heroId: 'stormRanger',
            kind: 'utility',
            name: 'Whiteout',
            description: 'Spread slow/Freeze; tempo denial across both targets.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
          },
        ],
      },
    ],
    shadowMonk: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'shadowMonk-offensive',
            heroId: 'shadowMonk',
            kind: 'offensive',
            name: 'Nightreaver',
            description: 'High-burst assassin strikes, safest under Stealth.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'shadowMonk-defensive',
            heroId: 'shadowMonk',
            kind: 'defensive',
            name: 'Stillmind',
            description: 'Evasive sustain; self-cleanse.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'shadowMonk-utility',
            heroId: 'shadowMonk',
            kind: 'utility',
            name: 'Nightveil',
            description: 'Daze control + debuffs; shuts a threat off.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    marrow: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          // Rewritten 2026-08-30 alongside the Attack/Intelligence swap. These
          // three were byte-identical to Vesper's — same names, same
          // descriptions, same grants — which is what made the two heroes the
          // same hero at every level, not just at level 1. The offensive grant
          // now follows the stat Marrow actually attacks with, and neither
          // graft duplicates Vesper's (Spirit / Mind).
          {
            id: 'marrow-offensive',
            heroId: 'marrow',
            kind: 'offensive',
            name: 'Carrion',
            description: 'Leans all the way into the rot; raw Intelligence behind Poison and Eclipse.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'marrow-defensive',
            heroId: 'marrow',
            kind: 'defensive',
            name: 'Ossuary',
            description: 'Bone-deep endurance; outlasts whatever it poisoned.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Nature',
          },
          {
            id: 'marrow-utility',
            heroId: 'marrow',
            kind: 'utility',
            name: 'Ashenwell',
            description: 'Casts deeper and more often; the attrition never stops.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
          },
        ],
      },
    ],
    glacialWarden: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'glacialWarden-offensive',
            heroId: 'glacialWarden',
            kind: 'offensive',
            name: 'Avalanche',
            description: 'Freeze-then-shatter burst (Consume-Freeze).',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'glacialWarden-defensive',
            heroId: 'glacialWarden',
            kind: 'defensive',
            name: 'Glacier',
            description: 'Immovable tank; max Def, endure.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'glacialWarden-utility',
            heroId: 'glacialWarden',
            kind: 'utility',
            name: 'Permafrost',
            description: 'Spread Freeze/slow; area control.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Water',
          },
        ],
      },
    ],
    dawnwarden: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'dawnwarden-offensive',
            heroId: 'dawnwarden',
            kind: 'offensive',
            name: 'Sunflare',
            description: 'Radiant burst; Burn pressure.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Fire',
          },
          {
            id: 'dawnwarden-defensive',
            heroId: 'dawnwarden',
            kind: 'defensive',
            name: 'Sanctuary',
            description: 'Healer-tank; Renew + protect.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'dawnwarden-utility',
            heroId: 'dawnwarden',
            kind: 'utility',
            name: 'Dawnherald',
            description: 'Cleanse/buff support; the classic support priest.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    runescribe: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'runescribe-offensive',
            heroId: 'runescribe',
            kind: 'offensive',
            name: 'Spellstorm',
            description: 'Raw Int nuke; scaling burst.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'runescribe-defensive',
            heroId: 'runescribe',
            kind: 'defensive',
            name: 'Sigilward',
            description: 'Barrier/ward tank.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'runescribe-utility',
            heroId: 'runescribe',
            kind: 'utility',
            name: 'Loreweaver',
            description: 'Setup/control; status steering.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    mindweaver: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'mindweaver-offensive',
            heroId: 'mindweaver',
            kind: 'offensive',
            name: 'Mindrend',
            description: 'Daze-punishing burst.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'mindweaver-defensive',
            heroId: 'mindweaver',
            kind: 'defensive',
            name: 'Adamant',
            description: 'Mental + physical bulk; status resistance.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'mindweaver-utility',
            heroId: 'mindweaver',
            kind: 'utility',
            name: 'Dominion',
            description: 'Control lock — Daze, Haunt, domination debuffs.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
          },
        ],
      },
    ],
    forgewright: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'forgewright-offensive',
            heroId: 'forgewright',
            kind: 'offensive',
            name: 'Overdrive',
            description: 'Ramping heavy hitter; Atk builds over turns.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'forgewright-defensive',
            heroId: 'forgewright',
            kind: 'defensive',
            name: 'Juggernaut',
            description: 'Armored machine; max bulk, endure.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'forgewright-utility',
            heroId: 'forgewright',
            kind: 'utility',
            name: 'Boilover',
            description: 'Steam control — Burn spread + hazard/tempo.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Water',
          },
        ],
      },
    ],
    packAlpha: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'packAlpha-offensive',
            heroId: 'packAlpha',
            kind: 'offensive',
            name: 'Bloodhunt',
            description: 'Bleed-momentum aggressor.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'packAlpha-defensive',
            heroId: 'packAlpha',
            kind: 'defensive',
            name: 'Stonehide',
            description: 'Thick-hide bruiser; endure.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'packAlpha-utility',
            heroId: 'packAlpha',
            kind: 'utility',
            name: 'Warhowl',
            description: 'Pack-support — partner buffs, the doubles-facing path.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    // Widow and Coil are DUAL-typed by design, so neither gets a typeGraft
    // path — chooseEvolutionPath throws on a graft offered to a dual hero,
    // and Lucius (Shadow/Mind) is the standing precedent for what a
    // dual-typed hero's three paths look like instead: same offensive /
    // defensive / utility split, stat grants only, no second type to give.
    widow: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'widow-offensive',
            heroId: 'widow',
            kind: 'offensive',
            name: 'Venomfang',
            description: 'Leans all the way into the kill — Bleed, Poison, and nothing held back.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'widow-defensive',
            heroId: 'widow',
            kind: 'defensive',
            name: 'Carapace',
            description: 'Hardens the shell so the wounds it opens outlast it.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'widow-utility',
            heroId: 'widow',
            kind: 'utility',
            name: 'Silkbinder',
            description: 'Sets the trap before the fight — faster, and cheaper to keep hidden.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    coil: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'coil-offensive',
            heroId: 'coil',
            kind: 'offensive',
            name: 'Basilisk',
            description: 'The gaze stops being a suggestion.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'coil-defensive',
            heroId: 'coil',
            kind: 'defensive',
            name: 'Hooded',
            description: 'Spreads the hood — harder to reach, harder to unsettle.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'coil-utility',
            heroId: 'coil',
            kind: 'utility',
            name: 'Mesmer',
            description: 'Holds the whole field in the coil — deeper reserves, the pack-support path.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],

    // --- Stone/Spirit starters + the new Iron starter (2026-08-17) ---
    valor: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'valor-offensive',
            heroId: 'valor',
            kind: 'offensive',
            name: 'Crusader',
            description: 'All-out armored assault; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'valor-defensive',
            heroId: 'valor',
            kind: 'defensive',
            name: 'Bastion',
            description: 'Shield-wall anchor; protect partner, max Defense.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'valor-utility',
            heroId: 'valor',
            kind: 'utility',
            name: 'Dawnblade',
            description: 'Righteous support; cleanse and speed control.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
        ],
      },
    ],
    revenant: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'revenant-offensive',
            heroId: 'revenant',
            kind: 'offensive',
            name: 'Wraithblade',
            description: 'Draining spectral assault; raw Intelligence.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'revenant-defensive',
            heroId: 'revenant',
            kind: 'defensive',
            name: 'Hollow Warden',
            description: 'Undying bulwark; bleeds momentum from the living.',
            statGrants: { defense: 10, wisdom: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Shadow',
          },
          {
            id: 'revenant-utility',
            heroId: 'revenant',
            kind: 'utility',
            name: 'Soulbinder',
            description: 'Control and setup; status steering from beyond.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    crag: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'crag-offensive',
            heroId: 'crag',
            kind: 'offensive',
            name: 'Stonebreaker',
            description: 'Rock-fisted heavy hitter; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'crag-defensive',
            heroId: 'crag',
            kind: 'defensive',
            name: 'Mountainheart',
            description: 'Immovable armored mass; max bulk.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'crag-utility',
            heroId: 'crag',
            kind: 'utility',
            name: 'Warden of Roots',
            description: 'Overgrown guardian; sustain and support.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Nature',
          },
        ],
      },
    ],

    // --- Crimson, Rime, Cube, Mordrax (2026-08-17) ---
    crimson: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'crimson-offensive',
            heroId: 'crimson',
            kind: 'offensive',
            name: 'Pyroclasm',
            description: 'Unrestrained magical firepower; raw Int nuke.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'crimson-defensive',
            heroId: 'crimson',
            kind: 'defensive',
            name: 'Cinderveil',
            description: 'Wreathes itself in protective embers; a bulkier caster.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'crimson-utility',
            heroId: 'crimson',
            kind: 'utility',
            name: 'Emberweave',
            description: 'Fuses flame with raw arcane current; efficient, sustained casting.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Arcane',
          },
        ],
      },
    ],
    rime: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'rime-offensive',
            heroId: 'rime',
            kind: 'offensive',
            name: 'Iceclaw',
            description: 'Raw talon aggression; hits like a diving strike.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'rime-defensive',
            heroId: 'rime',
            kind: 'defensive',
            name: 'Direwing',
            description: 'Apex-predator instincts harden it into a Frost/Beast bulwark.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Beast',
          },
          {
            id: 'rime-utility',
            heroId: 'rime',
            kind: 'utility',
            name: 'Farsight',
            description: 'Preternatural foresight; reads the whole field before it moves.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    cube: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'cube-offensive',
            heroId: 'cube',
            kind: 'offensive',
            name: 'Shatterframe',
            description: 'Sharpens its frozen edges into a genuine offensive threat.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'cube-defensive',
            heroId: 'cube',
            kind: 'defensive',
            name: 'Permafrost Core',
            description: 'Its frozen shell hardens into an armored, near-immovable block.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'cube-utility',
            heroId: 'cube',
            kind: 'utility',
            name: 'Cryolattice',
            description: 'Crystalline lattice growth; a slow, grinding area-control build.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
        ],
      },
    ],
    mordax: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'mordax-offensive',
            heroId: 'mordax',
            kind: 'offensive',
            name: 'Bloomfang',
            description: 'Thorn and claw working together; raw aggression.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'mordax-defensive',
            heroId: 'mordax',
            kind: 'defensive',
            name: 'Ironbark',
            description: 'Bark hardens to something closer to stone than wood.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'mordax-utility',
            heroId: 'mordax',
            kind: 'utility',
            name: 'Wildheart',
            description: 'Leans fully into its feral side; faster, hungrier.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Beast',
          },
        ],
      },
    ],

    lucius: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'lucius-offensive',
            heroId: 'lucius',
            kind: 'offensive',
            name: 'Voidcaller',
            description: 'Leans fully into raw spellpower, restraint be damned.',
            statGrants: { intelligence: 10, speed: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'lucius-defensive',
            heroId: 'lucius',
            kind: 'defensive',
            name: 'Sanguine',
            description: "Feeds on the enemy's open wounds — heals for every point of Bleed damage they take, from any source.",
            statGrants: { hp: 10, wisdom: 10 },
            unlocksMoveIds: [],
            grantsPassiveIds: ['sanguine'],
          },
          {
            id: 'lucius-utility',
            heroId: 'lucius',
            kind: 'utility',
            name: 'Cipher',
            description: 'Trades offense for a deep, self-sustaining mana reserve.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],

    // --- Hollowbark, Aegis, Brimstone, Gallant, Nightshade, Pincer,
    // Scallywag, Sentinel, Bellows, Zenith (2026-08-22) — Brimstone
    // and Bellows are already dual-typed, so per the mono-only graft
    // rule none of their paths carry a typeGraft (same treatment as
    // cinderKnight/lucius above).
    hollowbark: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'hollowbark-offensive',
            heroId: 'hollowbark',
            kind: 'offensive',
            name: 'Thornheart',
            description: 'Thorn and root turned weapon; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'hollowbark-defensive',
            heroId: 'hollowbark',
            kind: 'defensive',
            name: 'Rootstone',
            description: 'Bark petrifies into bark-over-stone armor.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'hollowbark-utility',
            heroId: 'hollowbark',
            kind: 'utility',
            name: 'Wraithwood',
            description: 'The hollow trunk lets something else move in.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    aegis: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'aegis-offensive',
            heroId: 'aegis',
            kind: 'offensive',
            name: 'Vanguard',
            description: 'Shield becomes spear; leads the charge instead of holding the line.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'aegis-defensive',
            heroId: 'aegis',
            kind: 'defensive',
            name: 'Warforged',
            description: 'The shield-arm becomes literal, unbreakable iron.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'aegis-utility',
            heroId: 'aegis',
            kind: 'utility',
            name: 'Sanctified',
            description: 'A guardian blessing extended to the whole team.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    brimstone: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'brimstone-offensive',
            heroId: 'brimstone',
            kind: 'offensive',
            name: 'Cauldronborn',
            description: 'The pot boils over; raw Intelligence.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'brimstone-defensive',
            heroId: 'brimstone',
            kind: 'defensive',
            name: 'Ashguard',
            description: 'Caked-on ash and cinder harden into a crude shell.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'brimstone-utility',
            heroId: 'brimstone',
            kind: 'utility',
            name: 'Hexfume',
            description: 'A choking, cursed smoke that lingers over the field.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    gallant: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'gallant-offensive',
            heroId: 'gallant',
            kind: 'offensive',
            name: 'Charger',
            description: 'All-out lance rush; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'gallant-defensive',
            heroId: 'gallant',
            kind: 'defensive',
            name: 'Rampart',
            description: 'Barded and braced; an immovable cavalry wall.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Stone',
          },
          {
            id: 'gallant-utility',
            heroId: 'gallant',
            kind: 'utility',
            name: 'Oathbound',
            description: 'The knightly oath made literal; a radiant, faster escort.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
        ],
      },
    ],
    nightshade: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'nightshade-offensive',
            heroId: 'nightshade',
            kind: 'offensive',
            name: 'Umbral',
            description: 'Pure killing focus; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'nightshade-defensive',
            heroId: 'nightshade',
            kind: 'defensive',
            name: 'Wraithstep',
            description: 'Half a step out of the material world at all times.',
            statGrants: { wisdom: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
          {
            id: 'nightshade-utility',
            heroId: 'nightshade',
            kind: 'utility',
            name: 'Duskweaver',
            description: 'Reads intent before the strike lands; control over kill.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
    pincer: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'pincer-offensive',
            heroId: 'pincer',
            kind: 'offensive',
            name: 'Tideclaw',
            description: 'Bigger claws, harder strikes; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'pincer-defensive',
            heroId: 'pincer',
            kind: 'defensive',
            name: 'Ironshell',
            description: 'The carapace hardens past shell into plate.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'pincer-utility',
            heroId: 'pincer',
            kind: 'utility',
            name: 'Brinefrost',
            description: 'Retreats to colder water; slows everything around it.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Frost',
          },
        ],
      },
    ],
    scallywag: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'scallywag-offensive',
            heroId: 'scallywag',
            kind: 'offensive',
            name: 'Corsair',
            description: 'No quarter given; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'scallywag-defensive',
            heroId: 'scallywag',
            kind: 'defensive',
            name: 'Ironhull',
            description: 'Scavenged plate lashed over the coat; built to take a boarding fight.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'scallywag-utility',
            heroId: 'scallywag',
            kind: 'utility',
            name: 'Seawise',
            description: 'Reads the water and the wind; always a step ahead.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Water',
          },
        ],
      },
    ],
    sentinel: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'sentinel-offensive',
            heroId: 'sentinel',
            kind: 'offensive',
            name: 'Talonguard',
            description: 'Drops from its perch; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'sentinel-defensive',
            heroId: 'sentinel',
            kind: 'defensive',
            name: 'Cathedral',
            description: 'Iron reinforcement worked into the stone; a load-bearing wall of a hero.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Iron',
          },
          {
            id: 'sentinel-utility',
            heroId: 'sentinel',
            kind: 'utility',
            name: 'Gloomwatch',
            description: 'Keeps its vigil after dark; wards and unsettles in equal measure.',
            statGrants: { wisdom: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Spirit',
          },
        ],
      },
    ],
    steamColossus: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'steamColossus-offensive',
            heroId: 'steamColossus',
            kind: 'offensive',
            name: 'Redline',
            description: 'Every safety valve welded shut; raw Attack.',
            statGrants: { attack: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'steamColossus-defensive',
            heroId: 'steamColossus',
            kind: 'defensive',
            name: 'Bulkhead',
            description: 'Plated past the point of reason; max bulk.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'steamColossus-utility',
            heroId: 'steamColossus',
            kind: 'utility',
            name: 'Overpressure',
            description: 'Vents building steam into a longer, more efficient burn.',
            statGrants: { manaPool: 10, mpRegen: 5 },
            unlocksMoveIds: [],
          },
        ],
      },
    ],
    zenith: [
      {
        level: EVOLUTION_LEVEL,
        paths: [
          {
            id: 'zenith-offensive',
            heroId: 'zenith',
            kind: 'offensive',
            name: 'Apex',
            description: 'Unrestrained arcane output; raw Intelligence.',
            statGrants: { intelligence: 10 },
            unlocksMoveIds: [],
          },
          {
            id: 'zenith-defensive',
            heroId: 'zenith',
            kind: 'defensive',
            name: 'Halo',
            description: 'The orb blooms into a standing radiant shield.',
            statGrants: { defense: 10, hp: 10 },
            unlocksMoveIds: [],
            typeGraft: 'Light',
          },
          {
            id: 'zenith-utility',
            heroId: 'zenith',
            kind: 'utility',
            name: 'Oracle',
            description: 'Reads the whole field at once; setup and control.',
            statGrants: { speed: 10, mpRegen: 5 },
            unlocksMoveIds: [],
            typeGraft: 'Mind',
          },
        ],
      },
    ],
  },
};
