# constructed.md — Constructed: build six, fight the fourteen

> **STATUS: PROPOSED 2026-10-04; §11 steps 1–6 BUILT (fourteen Trials, the sim, the pilot as the Trials' AI, a dev screen)
> — no player-facing UI yet.** A second mode beside Classic. A player who has
> won a run builds a team of six from the heroes they have won with — each at level 30, Mastery
> 10, in a chosen Evolution, with a chosen kit, three Mythic items and a Class — and takes it
> against **fourteen authored teams, one a type, each the six heroes of its type**, in any order.
> **Decided per user direction:** the mode is locked until a Classic win; a Trial pays stars on its
> **first clear only, and a real chunk**; the teambuilder's density is the hard problem and is
> treated as one. Everything else here is a recommendation, and §12 lists what is open.
> Working names: the mode is **Constructed**, its fights **the Trials**.

---

## 0. Why this exists

- **A win has nowhere to go.** After a Classic clear the next thing is another run or Ascension.
  Neither spends what the player now knows about the roster.
- **The roguelite hides its own depth.** Most players never see a hero's whole pool, a Mythic of
  every family, or a Class on the hero it was made for. Building is where people fall for a
  system — Pokémon Showdown is the reference.
- **The north star gets a test it cannot dodge.** *No hero is a trap pick* is checked in Classic
  through scarcity and luck. In Constructed, with everything chosen, a hero that is viable under
  no combination shows up at once. That is useful pressure, and it will be uncomfortable.

---

## 1. The rule this reduces to

**Classic earns heroes; Constructed perfects them.** Nothing crosses back: no stat, item or move
built here enters a run. The two modes share content, the engine and the star balance — nothing
else.

---

## 2. The gate

**The mode opens on the first Classic win** (decided). Which heroes it then lets the player build
is the open question. Two candidates; the record behind both already exists —
`Profile.evolutionStars`, heroId → the Evolution path ids that hero has cleared a run in.

| | **Path gate** | **Hero gate** |
|---|---|---|
| Rule | A hero is buildable in each form it has won in | A hero with any starred path is buildable in all three |
| Unlocks to collect | 252 (84 × 3) | 84 |
| Clears to finish, floor | 42 (six stars a clear, never wasted) | 14 |
| Clears to finish, real | well past 60 — repeats, draft luck, heroes that end unevolved | ~25–30 |
| Path stars mean | the Constructed unlock itself | a badge in the builder |

**Recommendation: the hero gate.** The path gate makes the mode a grind against draft luck: a
player who wants Cinder's third path needs Cinder drafted, kept, and evolved down that path in a
winning run. The hero gate still asks for a win with every hero, which is a long collection. Path
stars keep meaning something under it: the builder marks the paths a player has won in, gilt, and
the Constellation's Stars tab is unchanged.

Second-order questions this raises:

- **The first win unlocks about six heroes — one team, no choices.** That can be the onboarding
  (*"your winning team, perfected"*), as long as the first Trial screen says plainly how the pool
  grows. An alternative is to also open the 14 heroes the player led into the winning run's draft,
  but that waters the gate down. Recommend: six, plus the line.
- **The deck becomes the farming tool.** A hero gets starred only if it can show up in a run, and
  it can only show up if it is decked. Swapping a hero into the deck to get it into Constructed is
  a real loop between the modes — good, and worth a tip.
- **Owning is not unlocking.** A Starfall hero must be owned (to be drafted), then won with.
  §7 makes that a loop rather than a wall.
- **An unevolved finish earns nothing today.** Under the hero gate this could relax to *on the
  roster at the clear*. Recommend: keep it as is — one rule, already recorded.

---

## 3. A constructed hero

One `TeamSlot`, projected to a `RosterEntry` at fight build so the engine never knows which mode
it is in:

| Axis | Value | Notes |
|---|---|---|
| Level | 30 (`MAX_LEVEL`) | stats are the **expected** line, §4 |
| Mastery | 10 | the mastered innate (`masteredPassiveIds`) |
| Evolution | any of three paths (§2) | graft, move and passive as in Classic; the rewire where pinned |
| Moves | four (`MOVE_CAP`) from the hero's whole pool — every band, plus the signature and the path's move | no schedule, no roll |
| Items | three, Mythic, an enchant each | one per family still holds (no merge here, so it is a legality rule) |
| Class | any of the fourteen, or none | the class move wears the hero's type as in Classic |

**Off for both sides:** Banners, Wounds, Mana Well / Ley Line grants, gold, the Pact purse. The
Pact Clock, lock-in (3 of 6), Field Effects and the whole roster fielding with leads picked in
the fight all stand.

**Consumables, first pass: none, both sides.** A potion is a decision about scarcity; here it
would be a fixed opening. Open (§12).

---

## 4. Stats: the expected line, and why Classic keeps its rolls

Growth rolls are random (`GRADE_ROLL`), which a built team cannot be. **Do not undo the roll in
Classic.** The fix is one function:

- **Every grade has an exact mean** (`gradeExpectedPoints`, `0.1 + 0.3 × GRADE_COST`). A
  constructed hero's stat is `base + 29 × expected points × unit` (levels 1 → 30, HP ×3), rounded
  once. Deterministic, legible, and the same 9.1 points a level every hero gets.
- **The roll is doing work in Classic.** The level report shows the misses so the hits read as a
  roll against a grade; a late bloomer is a story the expected line cannot tell; and the run's
  difficulty curve was fitted against it. Undoing it buys Constructed nothing the mean does not.
- **What it costs:** a lucky Classic Cinder may out-stat the constructed one. That is fine, and
  the builder should say *expected at level 30*, never imply this is the hero's ceiling.

---

## 5. Team slots

**Six saved teams, first pass.** They fit one screen with no scroll and cost nothing to raise.
A team is six `TeamSlot`s and a name. **A team that stops being legal is never deleted** — a
hero leaving the catalog or a move leaving its pool leaves a marked hole the player fixes, the
deck's `profileDeck` rule.

**Team codes:** a team exports to one short string and imports from one. Cheap, and it is how
builds travel.

---

## 6. The Trials

Fourteen teams, one a draftable type, **each the six heroes of that type**. Any order. A team is
data in the same `TeamSlot` shape the player builds with, so it is legal by construction and
`test/` pins it.

**Authoring rules for a Trial team:**

1. **One gameplan, in one sentence**, and every slot serves it (e.g. *Water sets rain and pivots
   on Shield*; *Iron walls, then wins the Pact Clock*).
2. **It answers its own chart weakness on purpose.** A mono-type team is a chart lookup unless it
   covers its hole. The tools are its grafts and its off-type moves; the cover is part of the
   design, named in the team's line. Without this the mode is *bring Water to Fire* fourteen
   times.
3. **Its leads are authored.** The AI picks the opening two from the table.
4. **Same rules as the player** — level 30 expected, Mythic, no Banners. The difficulty lives in
   the build and the AI, never in a stat bonus (the Ascension principle: a rule, never a bare
   multiplier).
5. **A name and one line of voice** for flavour. Not a story mode: no staging and no script.

**The fifteenth fight** opens when all fourteen are beaten. Candidates:

- **The Herald and the Eyes, re-fitted to constructed power.** Built, lore-correct, enemy-only
  Ancient. Cheapest.
- **Six Ancients.** The Ancient slate exists; the bodies do not — six new enemy definitions and
  their art.
- **A gauntlet of the fourteen leads** back to back, no recovery between.

Recommend the first, with the second as later content. Its reward is open: a title or cosmetic
is safe; **an Ancient hero is not** — it would make Ancient a fifteenth deck row and enter
Classic, so it is a separate decision.

---

## 7. Rewards

**First clear only, decided; a real chunk, decided.** Each Trial pays once. Replays pay nothing.

**First-pass numbers:** **5 stars a Trial, 15 for the fifteenth — 85 in all.** For scale: a
Classic clear pays 1 plus its new path stars, an A1 clear 6, a Starfall costs 2. So a Trial is
worth about an A1 clear, and the whole set buys about 40 Starfalls — close to every hero outside
the base 42.

That is large on purpose, and it closes a loop rather than leaking one: Trial stars buy Starfall
heroes, a Starfall hero is buildable only after a Classic win with it, and that win needs the
hero decked. So the stars send the player back into Classic. Watch whether 85 is too much while
a player's Constructed pool is still small; the number is the designer's to move.

---

## 8. The AI — the cost that decides the mode

**The enemy AI never switches** — only the player's side ever builds a switch action
(`src/engine/combat/actions.ts`). In Classic that is survivable. In Constructed it is the mode:
the Trials' gameplans (pivots, Shields sent to the bench, field setters returning to re-set) need
an opponent that switches. A Showdown-like mode against an AI that stays in and picks greedily
gets solved in an evening.

What the Trials need, in order:

1. **Switch out of a lost matchup** (incoming type multiplier, low HP against a faster threat).
2. **Cycle mana** — send an empty hero to the bench to regen rather than Rest.
3. **A gameplan hint per team**: which statuses and fields it sets up first, who it protects —
   authored on the Trial, read by the AI.
4. **Target focus** — the two picks agree on a target when one is close to a KO.

**Resolved 2026-10-04 (§11 step 5): not switching — move choice.** The Trials fly their enemy
with `src/run/pilot.ts`, the sim's skilled pilot, and it wins half the Trials against a skilled
player where `run/ai.ts` wins a fifth. The list below was the hypothesis; the measurement is in §11.
This is the same work as the AI tier `ascension.md` proposes for A5. **Build it once, for both.**
Until it lands, Trial teams must be designed around a no-switch AI — playable, but the gameplans
in §6 are halved.

---

## 9. The teambuilder

This is the screen most likely to fail, on a portrait phone. Six heroes × (path + four moves +
three items with enchants + Class) is about fifty decisions. Principles:

- **One hero a screen.** The team is a row of six portraits; tapping one opens that hero's
  page. Never a grid of everything.
- **A suggested build per hero, one tap.** The Trial teams already author a build for all 84
  heroes; **those are the suggestions**. The authoring is shared work, and a player can field a
  team in thirty seconds and tinker later.
- **Progressive disclosure:** path first (it changes the pool), then moves, then items, then
  Class. Each section shows its current pick folded; one is open at a time.
- **Never illegal.** The builder only offers legal picks — no error states. A pick that would
  break a later one (a path that drops a held move) says so as it is made.
- **The move list is filtered by default** (the hero's types, then everything) and every card is
  read whole, as in Classic.
- **Items: family, then enchant.** Two short lists, not one long one.
- **A beaten Trial's team can be copied** into a slot — the fastest teacher there is.

---

## 10. Presentation

**Its own title tile, hidden until the first Classic win**, revealed with a first-time tip,
rather than a toggle on Play. A toggle splits the most-used button and teaches nothing; a tile
appearing is itself the reward moment. Inside: the fourteen Trials as a wheel or grid by type,
each starred when beaten, the fifteenth locked in the centre; Teams beside them.

---

## 11. Implementation

Build steps 1–4 with no player-facing UI, and play the Trials from a dev screen first. That
answers *is this fun against this AI* before paying for the teambuilder.

1. **Model — IN (2026-10-04)** (`src/run/constructed.ts`, `test/constructed.test.ts`):
   `TeamSlot`, `Team`, legality (`slotProblems` / `teamProblems` — the hero gate, the pool, the
   cap, Mythic only, one a family, six distinct heroes), the expected line (`expectedGrowthGrants`),
   and `constructedEntry`, which takes the path through the run's own `chooseEvolutionPath` so a
   graft, a rewire and a path passive land exactly as in Classic. The pool is the kit, the hero's
   table pool, the path's moves and line, the signature, and the chosen Class's move.
2. **A fight without a RunState — IN (same day).** Nothing to audit away: `buildCombatState`
   already takes plain rosters and squads, and Quick Battle already hands `FightScreen` a
   throwaway run. `constructedSide` is that throwaway — no gold, relics, Banners or potions,
   nobody wounded or down — with authored leads for the AI and none for the player, who picks
   them in the fight.
3. **The fourteen teams as data** (`src/data/trials.ts`), pinned legal by test. **Pilot IN
   (2026-10-04): Fire, Water, Iron** — *The Kindling* (Burn both foes, cash it in), *The Long
   Tide* (Selkie's Renew ticks feed Kappa's Attack; Shields; Water Force), *The Charged Line*
   (Ferra plants Conduct, the line's Metallic Blade and Overcharge go free). `test/constructed`
   pins rules 1–4 of §6 as code: each Trial is ready with no gate, fields exactly its type's six,
   its leads build a side, no Unique twice, and **it holds a damaging move super-effective into
   every type that hits it super-effectively** — read off the chart, class moves excluded.
   **First read, 3 × 3 round-robin, 100 fights a cell (scratch script on `simulateFight`):**
   with the same AI on both sides Iron is the strongest (66 / 89 / 56% as the player into Fire /
   Water / Iron) and Water the weakest (60 / 32 / 19%). **The skilled pilot wins 64–100%
   against the AI and 92–99% of mirrors** — §8's cost, measured: the team matters less than
   who flies it.
   **All fourteen DRAFTED (same day)**, the other eleven by the same rules and pinned by the same
   tests: Frost *The White Hold* (every Defense raise sets off Speed drain and Freeze), Storm
   *The Front* (move first: Tailwind, Storm Surge, priority), Stone *The Return* (Provoke the
   hits onto hardening walls, send them back), Nature *The Undergrowth* (Poison from every angle,
   Guillotine under half), Light *The Sounding Bell* (Sanctuary all fight, Smite and Sunlance
   doubled on it), Shadow *The Ill Omen* (hex both foes down, then cut), Arcane *The Wellspring
   Court* (pour mana into Zenith, whose every point is Intelligence), Mind *The Unravelling*
   (strip every stat, Brain Flay at double), Spirit *The Bound Choir* (Haunt both on entry,
   Nightmare and Séance), Mech *The Wound Spring* (every machine winds up as the fight runs),
   Beast *The Blood Trail* (open a Bleed, feed on it).
   **One roster gap, declared: Stone cannot answer Iron.** No Stone hero, on any of its eighteen
   path builds, can learn a damaging Storm or Mech move, so `TrialDefinition.uncovered` names it
   and the test holds both ends — an undeclared gap fails, and so does a declared one the team
   in fact answers. Stoneheart and Retribution return damage with the chart off, which is the
   Trial's stated answer; the real fix is content (a Storm or Mech line move on one Stone hero).
   **Closed the same day, per user direction: Dune's pool takes Thunderclap** (Storm physical,
   Early, 45), the Stone Trial holds it in place of Fault Line, and nothing is declared
   uncovered — the mechanism stays as the guard for the next gap. The rule is met; the
   matchup is not moved by it (Stone into Iron 0%, Iron into Stone 100%, AI on both sides).
   **The 14 × 14 round-robin, 20 fights a cell** (scratch `rr2.js`, 24 seconds): with the AI on
   both sides the player-seat averages run 32% (Light) to 67% (Beast) — except **Spirit, 83% as
   the player and 90% as the AI**, beaten only by Mind and its mirror. The cause is hero data,
   not the Trial: Dread's mastered innate Nightmare+ takes 20% of max HP a round from every
   Haunted foe, and its Omen path Haunts both foes on entry — a five-round clock that needs no
   turn spent. Live in Classic too, where Mastery 10 is rarely reached. **With the skilled pilot
   the AI wins 7–37% of every Trial but Spirit (65%)**; Mind beats Spirit 100%, Storm 95%.
4. **Sim: a 14 × 14 round-robin — IN (2026-10-04)**: `node dist/scripts/sim/trials.js` (`--fights`,
   `--pilot chart|greedy`, `--only <trial>` for one row plus its record on the AI side). The matrix
   is the balance read by type that Classic cannot give.
5. **The Trials' AI — IN (2026-10-04), and not the switching the plan named.** Measured against
   the skilled pilot, 14 × 14, 20 fights a cell (AI win%, mean of the fourteen columns):
   `run/ai.ts` as shipped **22%**; with a switching layer (cycle out for mana, step out of a
   super-effective matchup 60% of the time — 5.5% of AI turns switched) **23%**; with focus fire
   too (finish a foe at ≤35% HP, ties to the wounded) **25%**; **flown by the skilled pilot,
   50%**. Switching was never the missing piece — a switch spends the turn a Rest does, and the
   incoming hero still eats the round. Move choice was. So **the pilot moved into the game**:
   `scripts/sim/pilot.ts` → `src/run/pilot.ts` (history kept), side-agnostic as written, and
   **Trials fights fly the enemy with it** (`FightScreen` `aiPilot`; the sim's `aiPilot:
   'greedy'`, `trials.js --ai-pilot greedy`). Classic's enemy is untouched. The switching and
   focus layers were taken back out. A fix rode along: a sim context resolved kits from ONE
   roster, so a pilot reading the other side saw its starting two moves; it now reads each
   side's own (Classic skilled full-clear 91.3% on 400 runs, against the 90% on record).
   **The Trials under the pilot, skilled player vs pilot AI:** the AI wins 24% (Frost) to 73%
   (Beast); Spirit 67% is no longer the outlier, and Stone, whose Provoke-and-return plan wants
   a careful hand, jumps to 66%. Frost and Light are the weak pair now (21% / 31% as the player).
6. **Dev screen — IN (2026-10-04)**: the title's Dev menu → **Trials**
   (`TrialsDevScreen`): pick a Trial team to fly, pick a Trial to face, fight. The player's leads
   are picked in the fight; leaving returns to the screen.
7. **Teambuilder**, slots, team codes.
8. **Profile** (`constructedTeams`, `trialsCleared`), the tile, rewards, the fifteenth fight.

---

## 12. Open questions

- **The gate** (§2): hero gate (recommended) or path gate.
- **The first-win pool**: about six heroes, or also the run's draft.
- **Star numbers** (§7): 5 a Trial, 15 for the fifteenth — first pass.
- **The fifteenth fight and its reward** (§6); an Ancient hero is a separate decision.
- **Consumables in a Trial**: none (first pass), or a fixed kit for both sides.
- **Slot count**: six, first pass.
- **Name**: Constructed / the Trials are working names (others: Pact Trials, the Conclaves,
  the Fourteen).
- **Ship before the AI switches?** A Trial set designed around a static AI, or wait for §8.
- **A beaten Trial's team as a preset** before the player has unlocked its heroes: viewable,
  not buildable — confirm.
- **A Unique on every hero?** The six Guardian Uniques are Mythic, so the model allows them —
  and the same one on more than one hero. One a team would match the name; not yet a rule.
- **Spirit is still the strongest Trial after the Nightmare+ nerf** (2026-10-04, per user
  direction: Nightmare+ keeps Nightmare's 10% and reaches the bench — `nightTerrorBench`,
  `whileBenched` — in place of 20% from the field; a reach widened, as the mastered rule
  allows). Spirit 87 → 82% as the player, 90 → 86% as the AI, 65 → 54% against the skilled
  pilot. **Attribution, toggled one at a time (AI-side win% into the other thirteen):** the
  Haunt echo −14, Omen's entry Haunt −10, Séance's ×2 −4, Nightmare+ −6, every Spirit innate
  unmastered −4. Dropping one hero: **Dread −16 (Nevermore's Provoke and Shield 60 on a
  230 HP, S-Defense wall), Sorrow −15 (Shriek: 30% Daze on every landed hit, echoed through
  Haunt)**, Kitsu −10, Keen −8, Revenant and Totem −3. Under an AI that never switches a
  Haunt never clears (`clearsOnSwitch` is its only exit), which is part of every number
  here. The next lever is Dread's or Sorrow's, and the designer's.
- **Stone into Iron** still loses every fight after Thunderclap; whether one Early hit is
  answer enough, or the matchup wants more, is a playtest call.
- **Gold-reading innates are dead in Constructed** (Aurum's Gilded Mane: the side holds no
  gold). Give Constructed a fixed purse, or let Aurum be a Sunlance hitter here.
- **Loose fits the drafts flagged**, to look at in play: Whirr (Mech), Coil (Beast), Lotus
  (Nature), Folio and Thane (Arcane), Koan (Mind), Widow (Shadow); Raiju's on-switch innate is
  dead under the AI; Hush takes its Shadow path only to answer Light. Thin covers: Shadow's
  Spirit answer and Spirit's Arcane answer each rest on one hero.
- **Unevolved is legal** in the model (`pathId: null`). A Mastery-10 hero is always evolved in
  Classic; allowing it costs nothing, but say so if it should be refused.

---

## 13. What this reverses

**Nothing in Classic.** Constructed is a separate mode with its own state; every invariant in
`CLAUDE.md` holds for a run. Inside Constructed, by design, these do not apply: automatic levelling
and the roll (the expected line instead), the schedule and its offers, absorbed gear and the
who-screen, Mastery supply, Banners, Wounds and the purse. The Constellation's *content, never
configuration* holds: nothing built here carries into a run.
