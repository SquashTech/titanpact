# polish-handoff.md — where the polish pass stands (2026-10-02, after the full-run playtest)

> A handoff between Claude sessions, not a design module. Read it first. The full playtest write-up
> with screenshots is `art/concepts/2026-10-02-full-run/REPORT.md` — this file is the short version
> plus what to do next.

---

## 1. What happened this session

**One full Classic run, played start to finish** in the in-app browser at 375×812 (Revenant + Pincer
draft, Cogling companion; Skyshear, Coil, Ashwing recruited). Won. **58.5 min** of in-game playtime.
One run: data points, not findings.

**Fixed and committed** (`a38574dc`):
- **Level-up offers were silently lost.** `LevelUpScreen`'s effect called `flow.next()` twice on the
  same run under StrictMode; the second pass overwrote the first owed hero's offer *and* the run with
  a stale copy, so that hero's schedule entry was never paid and two offers could stack. Now guarded:
  `next` runs once per run object shown, `busy` resets the guard. Verified in-browser.
- **Jargon leaks:** Boon/passive tags "Reactive"/"Damage pipeline" → "Triggered"/"Damage bonus";
  move cards "+20 mana each use" → "Costs 20 more each use" (and "less"); Run Cleared companion card
  "INSPECT" → "Companion"; Threshold intro no longer shows an empty "Domains here"; node panels
  "the Down" → "knocked-out heroes"; battle log "STAB"/"Var" → "Same type"/"Roll", and its damage
  total now includes what a Blessing turned aside (it used to print "= 29 dmg" for a 165 hit).
  Not seen on screen (unreachable in a short test, typechecked only): the Threshold, a
  cost-growing move card, the Run Cleared label, node-panel copy.

1170 tests pass; `tsc` (engine and view) clean.

## 2. What the run showed

**Difficulty:** Act 1 lands on target (Elite and Guardian both threatened; one KO). **From Act 2 the
run collapsed** — most fights ended in 3 rounds, the Act 3 and 4 Guardians and the Herald spent most
rounds unable to act. Causes, all visible in play:
- **Mesmerize + any Intelligence drop = Daze every round.** Coil (Mesmer path) used Lull (20 MP) and
  slow bosses never acted. Daze is flinch and Speed is its only price; slow bosses can't pay it.
- **Brain Flay** (55 BP, both enemies, ×2 vs any lowered stat) is always ×2 after Coil's
  Serpent's Eye entry debuff.
- **Ghostlight+ stacks without cap** (+25 Spirit Force per Haunt): Wisp reached 155 BP for 20 MP.
- **Progression ran fast:** two Evolutions in Act 1, three heroes at Mastery 10 by Act 3; a Common
  Tome merged up to Legendary by Act 2; 177–261g unspent through Act 4; Party Heal 5–25g.

**Pacing:** map nodes are quick. Combat costs 4 taps a round, and you still tap the target when only
one enemy is left. After each Guardian: ~14 screens, including up to five back-to-back
replace-or-keep move decisions (most with one obvious answer). ~25 tips in the first 15 minutes.

**Clarity:** Ranger's Volley and Sorcerer's Cascade read identically (no physical/magical label);
lead-pick arrows ignore Ancient (green arrow, 0.5× moves); "7 moves · has room" means pool size,
not kit; the Mentor's "powerful move" was twice a sidegrade.

## 3. What to do next (ranked)

1. **Boss Daze lock** — design call for the user (CLAUDE.md: Daze is flinch; see memory
   "Daze is flinch"). Options: Daze immunity for a round after one lands, diminishing returns on
   bosses, or a price on Mesmerize. Run the sim (`--workers 2`) on Coil/Mesmer and any Mesmerize
   holder before touching numbers.
2. **Ghostlight+ cap** and a look at Brain Flay's ×2 condition — sim first, design call after.
3. **Shop: confirm before buying** above a threshold (Revive 80g, Anvil) — Scrolls, Party Heal and
   Revive buy on one tap; Contract confirms. The Scroll screen auto-returns to the shelf, so the next
   tap can buy a second pack by accident.
4. **Fewer taps/screens:** auto-target when there's one legal target; consider auto-declining (or
   batching) offers strictly worse than every held move.
5. **Smaller display bugs** (each has a screenshot in the report folder):
   - Jackpot's offer card shows no power/effect (`randomBasePower` 50–150 isn't rendered on the big
     card; the moveset row does render it).
   - "Merged" screen shows the incoming item, not the merged result.
   - "GUARDIAN" map label pierced by the gate's diamond.
   - Stat deltas differ by screen (Undertow −16 / −10 / −17 DEF; Vise −48 / −20 SPD) — one shows
     the authored base, one the landed value.
   - Evolution carousel arrows drop taps mid-slide; recruit "Sign" button moves with kit size.
6. **Art consistency:** the Endbringer and the Titan's Eyes are flat vector shapes beside pixel-art
   heroes, and Early Titanspawn sprites are tiny — reads as unfinished in the biggest fights.

Still open from before: status names in move text (*Conduct*, *Ambush 20*, *Sanctuary*) unexplained
outside their tap-sheet; PWA install prompt first on a new account; type wheel clips at 375 px;
the MVP label ("Tactician"/"Striker") unexplained; DEV stays visible on the title (deliberate).
Lore wording: "seals broken" reads as freeing the Titan; "the last two held" references seals the
player never saw.

## 4. Store readiness ($2.99 premium) — the short version

Content and core design are past the bar (combat depth, art, ~1 h runs, 84 heroes, Ascension, no
crash in a full hour). Not shippable yet because of: **no native wrapper (Capacitor), localStorage-only
saves (iOS can wipe them), no cloud save or crash reporting**; a solvable difficulty curve; the
rough edges above; no audio pass; no store assets. Suggested order: native wrapper + cloud save →
boss lock / balance → tap and screen cuts → audio + store assets.

## 5. Working notes for the next session

- Preview: `preview_start` name `titanpact-view`; `resize_window` preset `mobile`, then reload.
- The pane's storage is the user's test profile: back up `localStorage['titanpact.profile']` first
  and restore it inside a `pagehide` listener (the app writes on `pagehide`). Pre-seed `seenTipIds`
  (ids = the keys in `src/data/tips.ts` plus `lore`, `install`) to skip tips.
- Combat move rows sit at different y positions by kit size; prefer `find`/`get_page_text` + a
  fresh screenshot over fixed coordinates. Tip cards: dismiss via the `.tip-advance` element's rect.
- Node 14 is the system node; use `.node-runtime/node-v24.19.0-win-x64/node.exe` for `tsc` and tests
  (`tsc -p tsconfig.json && node dist/test/index.js`; view: `tsc -p tsconfig.view.json --noEmit`).
- Commit straight to `main`, by path. Stop the preview server before ending.
