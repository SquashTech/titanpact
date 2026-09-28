# Implementing the future heroes

Handoff for the chat that turns `art/future-heroes/` into playable heroes. The art is done
(idle, `attack`, `damaged` for all twelve; see `README.md` for concepts, types and facing).
What is left is authoring each hero as data. Drift, Rimehold, Carillon and Hart (commit
`085cd3e`) are the worked example: copy their shape.

## Decisions to make with the user first

- **How they are unlocked.** Drift/Rimehold/Carillon/Hart are `unlock: 'starfall'`. The
  alternative is one or more bundles (`unlock: 'bundle.<id>'`, see From the Tall Grass in
  `docs/constellation.md`). Kappa, Kitsu, Ronin and Motley could make a folklore bundle.
- **Names.** Working names are the file names (Ashwing, Aurum, Kappa, Kitsu, Kong, Morel,
  Motley, Omen, Ronin, Scree, Tome, Tusk). Check none clashes with a move, passive or Location.
- **The role pitches in README.md are first passes, not decisions.**
- Ashwing's pitch reuses the endure verb (Lingering, `enduresOnce`), which is off the roster
  today; bringing it back is a design call.

## Per hero, what to author

1. `src/data/heroes.ts`: the definition. Seven stats sum to exactly **550** (MP Regen a flat
   10 outside it); growth grades sum to **28** (S6 A5 B4 C3 D2 E1 F0); a dump stat stays E/F;
   a stat it swings or defends with never below C.
2. `schedule`: 4 to 7 sorted `offerLevels`, an offer from every band (Early below
   `midLevel`, Mid to `lateLevel`, Late after), `signatureLevel` in 14-16 / 18-20 / 22-24 by how
   hard the signature hits and never on an offer level. Offers are staggered across the
   roster; if `moveTiers` "staggered" fails, nudge levels.
3. `src/data/signatures.ts`: a unique signature at the hero's primary type, no `tier`, in no
   pool, kit or Evolution list.
4. `src/data/passives.ts`: an innate in `innatePassives` (a verb, not a bare stat grant) and
   its mastered upgrade in `masteredInnatePassives` (same hook, every figure at least doubled,
   a different name).
5. `src/data/progression.ts`: a move pool (`moveTiers`) with enough Early/Mid/Late moves to
   survive the offers, and an Evolution node of **three paths with three different lead
   types**: one mono path plus grafts (`typeGraft`) whose `learnableMoveIds` are that type's
   moves. No path hands over a move already in the pool, kit or signature; no path is bare
   stats.
6. Art: move the three PNGs into `art/heroes/unlocks/` (or `art/heroes/`) and add the idle to
   `src/view/shared/heroArt.ts` (import plus entry); pose frames are picked up by filename.

## Rules the tests caught last time

- Granting **Wisdom** from a non-Mind move is pinned off (`test/ironMoves.test.ts`); use a
  heal, Renew or another stat instead.
- A hero that can be offered **Smite or Sunlance** needs a way to set Sanctuary (Hallow,
  Consecrate) in reach (`test/lightMoves.test.ts`). Other field readers have the same rule.
- Run `npm test` with the pinned Node: `export PATH="$PWD/.node-runtime/node-v24.19.0-win-x64:$PATH"`.
  Also `npm run typecheck:view`. 1109 tests passed at `976a3eb`.

## Art notes

- Art edits use the PixelLab recipe in memory: `create_image_pro_flash` / `edit_image_pro_flash` at
  48×48, frames edited from the idle's `source_image_id`; check each frame faces the same way as its idle.
- New heroes have had no sim pass; say so when they ship.
