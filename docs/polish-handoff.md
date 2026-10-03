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
2. **DONE 2026-10-02 (c81ff05d):** Ghostlight is +25% Spirit damage to a Haunted foe (Ghostlight+
   +50%), no Force at all. No cap on Force (per user direction); instead every passive that banked
   Force on a repeating trigger fires at most 3 times a fight (`maxFiresPerFight`): Dawnlight,
   Silent Wings, Bedrock Hide, Rising Flame, Barrow-Call (5 → 10), Tidal Mass. Sim (4000 runs)
   unmoved, 91.3 → 91.2%: the pilot never built the stack, so play is the test. Still unbounded and
   left alone: the +25 self-Force setup moves (Static Charge, Soulfire, Hoarfrost Edge, Undercurrent,
   Stoke the Flames), Deepsurge's +25 on hit, the Titanspawn Mark. Brain Flay re-priced 70 → 90 MP (per user direction): the ×2 stays, since any lowered stat arms it for the whole fight.
3. **DONE:** a one-tap good at 25g or more arms on the first tap and buys on the second
   (`useArmedTap`, 4 s window): Scrolls, Revive, Party Heal, New Faces, and the Smithy's Strike and
   Bind. Potions stay one tap. The shelf comes back from the Scroll screen un-armed.
4. **Auto-target DONE:** a single-target move with one legal target commits on the first tap.
   Auto-declining worse offers is NOT done — "strictly worse" has no definition yet (design call).
5. **DONE:** Jackpot shows 50–150 BP on the big card and the row; the Merged screen shows the
   result; the gate label climbs clear of the seal; the combat move row prints the landed delta
   (the draft and dossier already did); the recruit Sign button sits outside the scrolling stage;
   the Crucible's class cards print Physical / Magical (Volley vs Cascade). NOT reproduced: the
   Evolution carousel dropping taps — the handlers read correctly; it needs a hands-on repro.
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
