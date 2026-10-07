# Gems — Mastery earned as stats

**Decided 2026-10-07, per user direction. BUILT the same day.** Mastery Scrolls are replaced by
**Gems**. A Gem is **one stat grant and one Mastery pip at once**: placed on a hero, it raises that
stat for the run and lights a pip toward the Evolution (5) and the mastered innate (10). The MVP
stops paying a pip and pays **bonus XP** instead.

Code: `src/run/gems.ts`, `src/view/run/GemNodeScreen.tsx`, `src/view/shared/GemIcon.tsx`.

---

## 1. Why

Two problems, one fix.

- **A Scroll paid nothing in the moment.** It mattered only at a breakpoint. The Act 1 Scribe was
  *click two heroes, neither gets anything now*, and gold poured into Scrolls at the Guild Hall
  bought a promise rather than a thing.
- **Gems were deleted (2026-09-10) for reasons this version answers**:

| Why Gems died | Answered by |
|---|---|
| Free re-allocation made the choice admin | Placement is **permanent** |
| "+5 Attack" never became a story | Every Gem is a step toward an Evolution or a mastered innate |
| ~40 Gems against 120 of capacity; caps never bound | The 10-pip ceiling binds; a hero at 10 takes no Gem |

**The tension it buys:** *I want to evolve my Intelligence attacker, but the Gem in hand is
Attack. Do I give it the wrong stat to fast-track the Evolution?*

## 2. The Gem

| | |
|---|---|
| Stats | the seven the 550 budget covers — HP, Mana, Attack, Defense, Intelligence, Wisdom, Speed. **Never MP Regen.** |
| Size | **5 points through Act 2, 10 from Act 3** (`gemPointsForAct`). A point is +1, or **+3 HP** (the item rate). |
| Stat | uniform at random (`rollGems`) |
| Stone | HP Emerald · Mana Sapphire · Attack Ruby · Defense Diamond · Intelligence Amethyst · Wisdom Aquamarine · Speed Topaz. Each has its own cut, so a stone reads by shape before colour. |
| Stored | `RosterEntry.gems`, summed in `entryStatModifiers` beside growth (its own source, so a sheet can say where a stat came from) |

## 3. The screen

**One Gem at a time, in a fixed order: HP → Mana → Attack → Defense → Intelligence → Wisdom →
Speed** (`GEM_ORDER`, per user direction: ordering is not a decision worth a screen). The Gem in hand
is drawn large, with its grant and the queue behind it. Every hero card shows **that stat's current
value with the gain beside it** and its ten pips. A tap places it. An Evolution or a mastered innate
the pip opens is raised over the screen as before (`masteryFlow.ts`). If nobody can take a Gem, the
rest are lost and the screen says so.

## 4. Faucets

| Faucet | Pays | Was |
|---|---|---|
| **The Lapidary** (the forced row, `scribeReward`, every act 1–4) | **6 Gems** (`SCRIBE_GEMS`) | 2 heroes × 2 pips |
| **Gem Cache** (`scrollReward`, weight 20) | **4 Gems** (`GEM_CACHE_COUNT`) | 3 pips |
| **The shelf** (Guild Hall and Vigil) | **2 random Gems a pack**, 25g, 2 a visit | 2 pips |
| **MVP** | **+50% of the fight's XP** (`MVP_XP_SHARE`), on top of the roster's grant | 1 pip |

The Lapidary and the Cache grew to pay back the ~12 pips a run the MVP no longer gives. Node type ids
are unchanged (`scribeReward`, `scrollReward`); only the names are new.

## 5. Heroes that hold pips without Gems

An enemy, a contract hero, a Guild hire, the Constructed side, a save from before Gems: their pips are
**filled by fit** (`gemStatModifiers`). Pip *i* is the size of the act it would have been found in
(two an act, `2N−2`), and lands on the hero's three best-graded stats in turn. Nobody holds Mastery
without the stats that come with it, and a claimed contract is still *finished*.

## 6. The MVP's XP

The MVP takes half the fight again in XP, shown as `+N XP` on its victory row. Its bar on the victory
screen fills by the larger figure. It is the run's first per-hero XP lever (XP was fully
deterministic). Never a hero at the XP cap, and never the same hero twice running.

## 7. Invariants this reverses

| Was | Now |
|---|---|
| "A bare number never gets a screen, and a screen never buys a bare number" (`growth-overhaul.md`) | A Gem's screen buys a **pip** (a verb at 5 and 10), and the stat rides on it. The rule stands for a stat with no pip attached. |
| "There is no per-hero stat-investment currency", Mana Well and Ley Line the named exceptions, "neither extends to a third" | **Gems are the third**, allowed because each is also Mastery |
| The MVP pays a pip (`mastery.md` §3) | The MVP pays bonus XP |
| The Scribe: pick two heroes, two pips each | Six Gems, placed freely |

## 8. Measured

2026-10-07, 600 runs a side, seed 7, MVP on, against the commit before (`42c8fc5b`):

| | Skilled (greedy) | Chart |
|---|---|---|
| Full-clear | 73.0 → **81.8%** | 25.8 → **34.0%** |
| Mean roster level at the end | 22.4 → 23.7 | 17.9 → 19.5 |
| Pips per completed run | 45.3 → 43.0 | 44.5 → 42.8 |
| Every hero evolved | 67 → **45%** of runs | 42 → 32% |

**Supply held; power did not.** The pip count barely moved, so the +8 points of full-clear are the
Gems' stats plus the MVP's XP (+1.3 to +1.7 levels a roster). That is a buff on top of the Base
hardening of 2026-10-05 (`ACT_LEVEL_ADJUST` is the dial to give it back, if playtest agrees).
"Every hero evolved" fell because the Scribe used to force two pips on two heroes and the
Lapidary's six go wherever the pilot likes. Every number in §2 and §4 is a first pass.

## 9. Open — DO NOT silently resolve

- **Total stat size.** About 40 Gems a completed run is roughly 300 points, three or more levels of
  growth a hero. Watch Acts 3–4, where Gems double.
- **Should the shelf show its pack's stats before the buy?** Today it is rolled on the tap.
- ~~The Lapidary's art~~ drawn 2026-10-07 (`art/npc/lapidary.png`, `art/map-nodes/landmarks/lapidary.png`).
- **Speed Gems** cross Speed thresholds, the one place +5 can flip a turn order. Watch them.
- **The Mentor as Rare Candy** (+XP scaling by act) and **the Act 4 Tutor as a pick-any-move screen**
  were decided in the same conversation and are next, in that order.
