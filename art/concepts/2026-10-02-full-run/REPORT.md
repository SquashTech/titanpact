# Full-run playtest — 2026-10-02

One Classic run, start to finish, at 375×812 in the in-app browser, on the user's test profile
(restored afterwards). **One run: data points, not findings** — balance calls below want the sim
(`--workers 2`) or more runs.

## The run in brief

- **Draft:** Revenant (Spirit) + Pincer (Water). Companion: Cogling (Mech).
  Recruited Skyshear (Act 1 Elite), Coil + Ashwing (Act 2 Elite). Roster full from Act 2.
- **Route:** Wild's Edge → Molten Foundry → Forbidden Forest → Necropolis → Threshold. Elite every act.
- **Evolutions:** Revenant → Soulbinder and Pincer → Ironshell (both in Act 1), Skyshear → Sunward,
  Coil → Mesmer (Act 2), Ashwing → Firebird (Act 3). Revenant, Coil, Pincer **mastered by Act 3**.
- **Who carried:** Coil (Mesmer, Berserker). Its entry debuff + Brain Flay (×2 vs a debuffed foe,
  spread) one-rounded most fights from Act 2 on. Lull + Mesmerize (Int drop → Daze) stopped single
  bosses from acting at all.
- **Result:** won. One KO before the finale (Revenant, Act 1 Guardian), one in it (Pincer).
- **Length:** **58.5 min** of in-game playtime (profile counter), title to "Run Cleared", on Auto.
  Includes some time I spent reading code mid-run, so a player is probably ~50–55.

## Difficulty curve

| Fight | Rounds | Threat |
|---|---|---|
| Act 1 opener | 1 | none (enemies 64/72 HP vs our 180/230) |
| Act 1 Elite (Lv 4 vs our 5) | 3 | **real** — Skyshear nearly killed the mortal companion |
| Act 1 Guardian (Manticore) | 7 | **real** — Revenant KO'd, Blessing spent |
| Act 2 opener / Elite / Guardian | 3 / 4 / 3 | Elite cost a KO; Guardian trivial once Coil arrived |
| Act 3 opener / Elite / Guardian | 3 / 4 / 3 | Guardian never acted (Lull lock) |
| Act 4 opener / Elite / Guardian | 3 / 3 / 4 | free; Skeleton King never acted |
| Finale (Herald + Eyes) | ~12 | moderate — one KO, one MP potion; never in doubt |

Act 1 lands where the target says (Emerald-as-an-adult). **From Act 2 it collapses**, and the
cause is visible rather than statistical: a debuff-reader build (Serpent's Eye → Brain Flay ×2,
Mesmerize → Daze every round) has no answer in the enemy AI. Two Act 1 evolutions and three
masteries by Act 3 add to it. Worth a sim pass: does Coil/Mesmer (or any Mesmerize holder) spike
full-clear the way it did here?

## Pacing

- **Map nodes are fast.** One tap per node plus one screen; the cuts from the last pass show.
- **Combat costs 4 taps a round** (move, target ×2 heroes). With only one enemy left you still tap
  the single target — 2 wasted taps every late-fight round. Auto-target when there's one choice.
- **The post-Guardian chain is long**: victory → up to 5 move offers → gear → Banner (2 screens)
  → Crucible (3) → seal → seal choice → location intro → map. ~14 screens, fine once, heavy ×4.
- **Level reports at the move cap are decision walls.** After the Act 3 Guardian: 5 replace-or-keep
  decisions back to back. Most had one obvious answer (Keep). Consider auto-declining an offer
  that is strictly worse than every held move, or batching them.
- Tips: ~25 in the first 15 minutes, several in 2–3 page chains; some repeat what the scene just
  said (Blessings). Each fires once, so OK, but the opener is dense.

## Decisions

- **Real:** Elite vs Skirmish (previewed typing), evolution paths (Soulbinder vs Undying vs
  Wraithblade), recruit targets, which hero gets Scrolls, replace-at-cap offers early on.
- **One obvious answer:** Party Heal (5–25g against 100–250g purses), Mana Well/Ley Line target,
  most late "keep moveset" offers, Banner after the first.
- **Confusing:** Ranger's Volley vs Sorcerer's Cascade read identically (no physical/magical
  label); the lead-pick arrows ignore Ancient (green arrow, 0.5× moves); "7 moves · has room"
  (pool size vs held kit); Mentor's "powerful move" was a 50 BP Haunt clone of two held moves,
  and later a self-heal.

## Bugs (each with a screenshot here)

1. **First owed move offer is silently lost** (`12-offer-flow.jpg`, `13-stacked-offers.jpg`).
   Revenant carried a "NEW MOVE!" tag for ~6 fights; its offer never appeared. Cause:
   `LevelUpScreen`'s effect calls `flow.next()`, which is not idempotent — under StrictMode's
   double-invoked effects the second pass overwrites the first hero's `offer` *and* the run with a
   stale copy (`levelUpFlow.ts` `rollOffer` closes over `run`). Repro: any level-up where the first
   owed hero in roster order is at `MOVE_CAP` and a later hero is also owed. Likely dev-only, but the
   same shape bit `NodeRewardScreen` before (its ref guard). Also produced two offer overlays at once.
2. **"+20 mana each use"** on the move detail/learned card (`09-…`), `MoveDetailOverlay.tsx:728`
   (and `:748` "−N mana each use"). The tile says "costs 20 more each use".
3. **"DAMAGE PIPELINE" tag on Boons** (`05-…`), `passiveIcons.tsx:147`. Also "REACTIVE".
4. **Jackpot's offer card is blank** — no BP, no effect (`15-…`). It's `randomBasePower` 50–150; the
   moveset row renders it, the big card doesn't.
5. **Merge screen shows the incoming item, not the result** (`10-…`): "Merged · Tome COMMON +15/+15"
   after it became Epic.
6. **Guardian map label pierced** by the gate's diamond: "GUA◆IAN" (`06-…`).
7. **Threshold intro: "DOMAINS HERE" with nothing under it** (`17-…`).
8. **Run Cleared: companion labelled "INSPECT"** (`20-…`), `RunSummaryScreen.tsx:114` fallback.
9. **Battle log prints the Shield's share as the formula total** (`07-…`): "= 29 dmg" for a 165 hit
   whose remainder the Blessing turned aside. Made a correct Blessing look broken.
10. **Stat deltas disagree by screen**: Undertow −16 DEF (draft) / −10 (combat tile) / −17 (dossier);
    Vise −48 / −20. One shows base, one landed.
11. **Shop buys on a single tap** (Scrolls 25g, Revive 80g, Party Heal); Contract asks to confirm.
    The Scroll screen auto-returns to the shelf, so my next tap bought a second pack by accident.
12. Pincer learned **Claw** at the first level-up with no visible moment (receipt not shown, or lost
    to bug 1).
13. Evolution carousel arrows drop taps during the slide; Sign button jumps with kit size
    (mis-tapped twice on the recruit screen).

## Balance flags (one run — verify in the sim)

- **Mesmerize + any Int drop = a boss that never acts.** Act 3/4 Guardians and the Herald spent
  most rounds Dazed. Daze is flinch and Speed is its only price; slow bosses can't pay it.
- **Ghostlight+ stacks unbounded**: +25 Spirit Force per Haunt; Wisp reached 155 BP for 20 MP.
- **Brain Flay** (55 BP spread ×2 vs any lowered stat) with Serpent's Eye+ entry debuff is ×2 always.
- **Scrolls are plentiful**: 3 mastered heroes by Act 3; Revenant evolved before Act 1's 2nd fight.
- **Gold is plentiful late**: 177–261g unspent at Acts 4–5; Party Heal 5–25g.
- Late merges: a Common Tome merged Rare → Epic → Legendary on one hero by Act 2.

## Fix next (ranked)

1. Make the level-flow effect idempotent (bug 1) — it eats content and stacks overlays.
2. Mesmerize/Daze lock on bosses: diminishing Daze, boss Daze immunity after one, or price it.
3. Jargon leaks: "DAMAGE PIPELINE", "+20 mana each use", "INSPECT", empty "DOMAINS HERE".
4. Confirm-on-buy above a threshold (or for Revive/Anvil), and stop the shelf tap-through.
5. Auto-target when there is one legal target; consider auto-keep for dominated offers.
6. Jackpot card, merge result card, Guardian label, battle-log shield line, delta consistency.
7. Sim pass on the Coil/Mesmer line and Ghostlight+ stacking before touching numbers.
