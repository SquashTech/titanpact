# ascension.md — The Ascension ladder: Permadeath, then rules

> **STATUS: A1 is BUILT and PLAYABLE** (decided 2026-09-21, per user direction): Permadeath
> (`src/run/ascension.ts`, the title's rung picker, the Fallen beat), the companion additions
> (§7a, 2026-09-26) and the woken Guardians (§2a, 2026-09-29 — A1 measured 49.6% skilled / 5.2%
> chart). **Not built:** the star colours (§8), and **A2–A5, which are PROPOSED, not decided** (§5).
> **The companion left the roster 2026-10-04** (`docs/companion-call.md`): it cannot fall, so the
> rule that a Revive never saves it is retired, A1's Fallen beat lists heroes only, the Act 1 cap
> reads the whole roster, and the `companion:<type>` star is a clear with that line. Where this doc
> says otherwise about the companion, the Call doc is the rule. Every rung above A1 escalates through a RULE,
> never a bare enemy stat multiplier (the standing constraint of 2026-09-09). Recruitment stays as
> it is at Base; the ladder is where it gets its demand. §10 lists the invariants each rung
> reverses. The measurements below predate the four-act run (2026-10-02).

---

## 0. Why this exists

**Nobody recruits past Act 2, and the game does not care.** In every playtest run the roster fills
in Act 1 — the draft, the companion after the first fight, one Guild Hall hire before the Guardian
— and never changes again.

That is not a tuning miss on the raise-vs-recruit axis (`progression.md`, "LOCKED design
intent"); the axis has lost one of its two ends. Three decisions, each right on its own, took the
reasons to churn a roster:

- **Roster-wide automatic levelling** — a hero held is at par, its schedule walked, without anyone
  spending anything. A contract hero's *finished* axes are finished on everyone.
- **Every fight fields the whole roster, cap 6** — a recruit past Act 1 is a termination first.
- **Gear absorption** — termination destroys up to three merged items, a Boon, a Class, a Ley Line.

Under those three, a recruit is a swap nobody takes. **Attrition is the only thing that makes a
mid-run recruit necessary** — Darkest Dungeon and Into the Breach both drive their rosters with
death — and attrition does not belong in the Base game, which the designer wants breezy. Ascension
is where mastery is priced, so Ascension is where the roster is allowed to break.

**The companion is the pilot.** One hero has been mortal since 2026-09-13, and that one hero
already proved the rule reads: a KO that removes a hero from the run is understood the moment it
happens, and the game still wins. A1 is that rule for everyone.

---

## 1. The rule this reduces to

**Base is the lesson; a rung is a rule.** Ascension changes *what the player has to solve*, never
only the size of the numbers they solve it with. The one place a number is the honest lever is
the economy, and it gets one rung.

Beside it, one coupling every rung has to respect: **the Revive is the price of Permadeath.**
Eighty gold, one a visit, a visit an act. Every other gold sink — the Anvil, the Enchanter, a hire,
a contract — competes with it. So a later rung that raises a Smithy price is really a rung with
fewer Revives, and the two dials are one dial: turn it on one rung, name it, and leave it alone on
the others.

---

## 2. Ascension 1 — Permadeath

**Every roster entry is `mortal`.** The companion's rule generalised to the roster: a hero knocked
out in a won fight is gone from the run when the fight resolves, its gear and pips with it. The
roster shrinks; the whole roster still fields; lock-in still derives from the side's size.

**The Revive is the one way back**, offered at the end of a WON fight for each fallen hero while the
stock lasts (§3). A lost fight is the run. The in-fight Revive keeps its job and becomes a genuine
bet: spend it mid-fight for a body at half, or hold it for the certain save at the end.

**A Revive cannot save the companion. DECIDED.** Otherwise the companion would be *easier* to keep
at A1 than at Base and its star (§7) would get cheaper as the ladder rose. On the Fallen screen its
row shows with no button.

**What stops existing at A1.** `RosterEntry.down` has no mid-act meaning, so the act-end stand-up,
the Rest seat's stand-up and the mend's downed-hero branch are never reached on A1 (Base still
reads them). Wounds are otherwise unchanged.

**A roster below two** fields what stands. The run ends at zero or at a lost fight, never at a
count. **The Act 1 enemy-count cap** reads the roster minus the companion (`isCompanion`, the
rule/identity split: `mortal` is the RULE, `companionHeroId` the IDENTITY).

## 2a. The Guardians wake — BUILT (2026-09-29, per user direction)

Sim pass 13 put A1 at 74.6% full-clear (skilled) / 16.9% (chart) against Base's 92.1 / 55.4. The
designer's yardstick (Base = Pokémon Emerald as an adult, A1 = an Emerald Nuzlocke, A5 = a
difficulty rom hack) wants A1 steeper, and **Blessings stay** — so A1 took half of what §5 had
proposed for A2, plus two pieces of its own. From A1 every Guardian fight (`guardiansWake`,
`src/run/ascension.ts`, applied in `encounters.ts`):

- **The champion leads** from round one, the escort it displaces on the bench.
- **It wears its primary type's Mark** (`wokenChampionMark`), which its seal keeps off at Base
  (`innate-passives.md` §3).
- **It grows on hero grades** (`wokenChampion`), keeping pace with the act.
- **Escorts by act** (`WOKEN_ESCORTS_BY_ACT` = 2 / 2 / 3 / 3 / 3). Three is the ceiling: a Location
  has two or three spawn lines and an escort never repeats one.

Measured (4000 runs a pilot, seed 84, all 84 heroes):

| A1 variant | skilled | chart |
|---|---|---|
| Permadeath alone | 74.8% | 17.0% |
| lead + Mark + grades | 53.9 | 7.8 |
| **+ escorts 2/2/3/3/3 (shipped)** | **49.6** | **5.2** |

Each piece bit Acts 1–2 only; escorts at 2/3/3/3/3 made Act 2 a wall (46.0 / 4.5) and were backed
off. **The late Guardians did not move with anything the champion holds** — by Act 4 six grown
heroes outclass one more body, so they need a shape change (repeated escort lines, a second phase,
an authored Ascended move). The designer chose to hold here.

---

## 3. The Fallen — the beat

**First in the post-fight chain, before the level report** (`FallenScreen`), so the report never
lists a hero already gone and a revived hero levels with everyone.

- One row per hero the fight knocked out, in roster order, the companion's last and unbuttoned.
- Each row: the hero, its level, what it wore, and **Revive** while the stock lasts, the stock
  counting down beside the rows. With nothing fallen the beat does not fire; with no stock it is a
  farewell with a Continue.
- A revived hero stands at half (`REVIVE_FRACTION`), its gear, pips, Boons and Class untouched. A
  hero let go is absorbed as a companion is.
- **It does not fire on the finale's win**: the companion star (§7) reads *alive when the Eyes
  closed*, and a post-finale Revive would buy a star.

---

## 4. The economy of a Revive under Permadeath

A1 moves none of the Revive numbers (`REVIVE_PRICE` = 80, one a visit, `REVIVE_DROP_CHANCE`). Gold
scales by act, so a Revive is most of the Act 1 purse and routine by Act 4 — the right shape. The
two readings that would move a number:

- Runs ending by *roster exhaustion* rather than a wipe — the supply is short, or the fork-only
  contract cash-in (§6) is the wall.
- `spent:revive` crowding out `spent:anvil` / `spent:enchant` — A4 has to know that before it
  raises anything. **Measured: it does** (§9b).

---

## 5. The ladder — A2–A5, PROPOSED

Each rung is a rule, carried on a lever that mostly exists. The finale (`titan-eyes.md`) built boss
verbs no Guardian uses — the ward, the phase, the drain field, Beheld — and trickling them down is
data. The designer's own list: Banners weaker, gear upgrades and enchants pricier, enemy comps
scripted rather than random, new mechanics on boss fights.

| Rung | Rule | The lever |
|---|---|---|
| **A1** | **Permadeath** + the woken Guardians (§2a). BUILT. | `src/run/ascension.ts`. |
| **A2** | **The ward.** Every Guardian is **warded while its escorts stand** — the Herald's rule, trickled down. (The Mark half of this row moved to A1; A2 needs a second piece to stand as a rung.) | `wardedWhileCompanyStands`. A warded champion leading from round one is a target you cannot hit, which may be the point. |
| **A3** | **Warbands.** The fork and the Guardian's escorts draw **authored comps** — a setter beside its reader, a Shield wall behind a DoT, a Haunt engine — in place of the typing roll, and enemies wear gear from Act 1. | The map-seeded draw in `src/run/encounters.ts`; `ENEMY_GEAR_BY_ACT` from Act 1. The one rung that is authoring work. |
| **A4** | **The Banners fray.** Each Banner at half, the Anvil and Enchanter at ×1.5. The economy rung — the one that taxes the Revive (§1). | `guardianBannerRelics`, `ANVIL_PRICE_BY_TARGET`, `ENCHANT_PRICE_BY_RARITY`. |
| **A5** | **The Titan's reach.** Withering Gaze at a tenth, every Guardian a two-phase fight, an Ascension AI tier. Candidate: no opening Blessing (`blessings-and-statuses.md` §1.7). | `WITHERING_GAZE_FRACTION` 0.05 → 0.10; the `reserves` phase. **The AI tier does not exist.** |

- **A2 and A5 cost almost nothing** — the verbs are built and measured.
- **A3 is the 2026-09-09 note's real ask** — deadlier comps — and the only rung with a content bill.
  It turns the fork's preview from a chart lookup into a tell.
- **A4 is deliberately the only number rung**, and the only one that touches the purse.
- **Nothing on any rung cuts recruitment supply.**
- **Rung order is the designer's.** What should hold is one rule a rung, the economy on one rung.

---

## 6. Recruitment under attrition — what the ladder is for

A roster below six is a state the Base game reaches only through the companion. Once it is common,
the recruitment rules read the way they were designed to: **a contract hero arrives finished, at its
node's level, armed** — what a roster with a hole in Act 4 needs; **a Guild hire arrives raw, one act
behind** — worth its 50g only early. **Nothing is terminated** to fill a hole, so the contract counter
and the shelf's blank contract mean something.

| Reading | It says | The dial |
|---|---|---|
| contracts rise, `spent:contract` stays 0 | the free contracts suffice | leave it, or delete the shelf line |
| runs end by roster exhaustion with contracts held | the fork-only cash-in is the wall | widen where a contract can be spent on A1 (§11) |
| `hire` rises late | the raw hire is a body when a body is all that is needed | nothing to move |
| neither rises | the Revive supply is covering attrition | `REVIVE_DROP_CHANCE` / the limit, before anything on A2+ |

Phase 0 read the first and third rows (§9b).

---

## 7. The companion — three additions, DECIDED

Decided 2026-09-21 for every rung including Base; **built in the shape §7a records**, which
supersedes the details here. **Since the Call (2026-10-04, `docs/companion-call.md` §5), the star
reads a clear with the companion's line — it cannot die, so "alive" is the whole run — and the
Withering Gaze exemption is moot: the companion never stands on the field.**

1. **A bestiary** for the fourteen spawn lines (now the Constellation's **Spawn** tab,
   `docs/collection.md`).
2. **A star per type for clearing with the companion alive** — `companion:<type>`. **Alive is the
   condition, not the Late body.** **Read at the Eyes' close**, not at the last Guardian's fall,
   since the finale is where it is most likely to die; §3's *no Fallen on the finale* keeps that
   honest.
3. **The companion stands under Withering Gaze un-withered.** The thing you turned against the
   Titan is the one thing it cannot wither.

## 7a. As built (2026-09-26, per user direction)

- **The bestiary reveals a line on its STAR.** A line is a silhouette with *???* until a run has
  been cleared with its companion alive, then its Late body, its three names and a lit star.
  `Profile.companionStars`, `companion:<type>` in `RunRecord.starsEarned`, counted in `totalStars`.
- **The companion AWAKENS at the finale** (per user direction): a beat between the Herald and the
  fight (`CompanionAwakensScreen`) in which Ancient takes its secondary slot (`awakenCompanion`).
  The line is recorded in `Profile.ascendedSpawnTypes`, win or lose, and **every later companion of
  that line joins already Ancient** (`joinCompanion(…, ascended)`), on every rung.
- **The Gaze exemption comes free with it**: Withering Gaze already exempts Ancient, so no
  spawn-body clause was added.

**The tension to watch in playtest:** Ancient is the chart's wall — every attacking row reads
`Ancient: 0.5`. A woken line's companion takes half damage from every typed hit **from its first
fight on every run after**. It stays mortal and arrives Early and raw. If it reads as the run's best
piece by Act 2, the lever is where the graft applies (finale only, or from the Late step), not
whether the line wakes.

---

## 8. Stars, colours, and how a rung opens

- **Built:** `Profile.ascensionCleared` (the highest rung cleared) and `RunState.ascension` (this
  run's rung, chosen at run start). Cleared at N opens N+1 (`openAscension`). A1 costs 1 star at the
  seal and pays 6 a clear (`ASCENSION_RUNGS`, `docs/collection.md`).
- **PROPOSED, not built — star colours.** `constellation.md` §6 left five colours for six states.
  Proposal: **Base white, A1 bronze, A2–A3 silver, A4 gold, A5 rainbow** — max-only, never
  regressed, cosmetic. Needs the storage change `heroId → { pathId → tier }`; the companion's star
  takes a tier the same way.

---

## 9. Order of work

| Phase | What | Status |
|---|---|---|
| 0 | Split the rule from the identity (`isCompanion`); measure A1 in the sim (`--ascension`) | **Done** 2026-09-21 (§9b) |
| 1 | A1: `RunState.ascension`, the rung picker, `FallenScreen`, `test/ascension.test.ts` | **Done** 2026-09-21 |
| 2 | The companion (§7a) | **Done** 2026-09-26 |
| 3 | Star colours (§8) | Not built |
| 4 | **A2** — the ward on every Guardian | Proposed |
| 5 | **A3** — warbands as content, enemy gear from Act 1 | Proposed |
| 6 | **A4** — the Banners at half, the Smithy ×1.5; read `spent:revive` first | Proposed |
| 7 | **A5** — the Gaze at a tenth, two-phase Guardians, the AI tier (its own document) | Proposed |

Phases 4–7 are each a rung and each a measurement; none is decided until it is built and read.

---

## 9b. Phase 0 — measured (2026-09-21)

Permadeath alone, before §2a: 3000 runs, seed 1, five acts, the pilot buying one Revive a Guild Hall
visit ahead of a hire whenever it held fewer than two.

| | Base, skilled | **A1, skilled** | Base, chart | **A1, chart** |
|---|---|---|---|---|
| full-clear | 73.7% | **31.2%** | 22.3% | **1.1%** |
| Act 1 / 2 / 3 / 4 / 5 / finale | 93 / 91 / 100 / 95 / 98 / 94 | **89 / 66 / 86 / 83 / 92 / 81** | 67 / 70 / 94 / 89 / 94 / 62 | **52 / 27 / 67 / 61 / 70 / 28** |
| the Fallen: kept / let go, a run | — | **2.66 / 2.37** | — | 0.82 / 1.34 |
| Revives found / spent, a run | 1.29 / 1.52 | 0.88 / **3.17** | 0.72 / 0.88 | 0.33 / 0.87 |
| recruits: contract / contract-replacing / hire | 1.74 / 2.27 / 1.35 | **2.57 / 0.39 / 1.43** | 1.19 / 1.10 / 1.07 | 1.11 / 0.03 / 0.56 |

- **The rule bites, and Act 2 is where** — fought with the holes Act 1's Guardian left, on an Act 1
  income a single Revive takes 60% of.
- **The Guardian is where heroes fall, and Base was hiding it**: 45% of persisting KOs fall at the
  boss, which the act's end mends for free at Base.
- **Recruitment is live**: under attrition a contract fills a hole instead of replacing a hero. **The
  shelf's blank contract still sells nothing** (≈1 gold an act at both rungs) — redundant on the
  evidence.
- **The Revive supply is the binding number**, and the Fallen beat is a real choice (about half the
  fallen walk). **The Revive crowds the Smithy out through Act 3** (Anvil 58 → 5.5 gold, Enchanter
  26 → 3.5), so A4's price rise would have no purchases left to price — the §1 coupling, measured.
- **No run ends with nobody standing**; a lost fight ends it first.

Nothing was re-tuned off this pass. Candidates for the designer: the Revive's Act 1 price against
Act 1 income; the shelf's blank contract line; the Act 2 wall as the thing to play before A2 exists.

## 10. Locked invariants this overturns

| Where | The rule | What changes, and on which rung |
|---|---|---|
| CLAUDE.md "Roster hard cap = 6" | *One exception, the companion … a knockout removes it from the run* | **A1**: every hero is that exception. The companion stays the ONE a Revive cannot reach. |
| CLAUDE.md "Wounds" | *a KO'd hero is `down` … stands up at the Rest seat, the mend, a Revive, or the act's end* | **A1**: only the Revive, at the Fallen beat. Base untouched. |
| CLAUDE.md "Consumables" — the Revive | *spent on a hero that is DOWN* | **A1**: there is no `down`; spent at the fight's end or in the fight. |
| `innate-passives.md` §3 | *no Guardian carries the Mark* | **A1** reverses it (§2a). |
| CLAUDE.md "Enemies are LEVELLED" | *a champion is FRONT-LOADED*; Base escorts by act | **A1** (§2a): hero grades, the champion leads, escorts 2/2/3/3/3. |
| CLAUDE.md "Enemies are LEVELLED" | *Enemy gear from Act 4* | **A3** (proposed): from Act 1. |
| CLAUDE.md "The Guardian's Banner" | the figures are measured parity | **A4** (proposed) keeps the parity and halves the size. |
| `titan-eyes.md` §10 | `WITHERING_GAZE_FRACTION` = 0.05 | **A5** (proposed): a tenth. |
| `profile.ts` `recordRunEnded` | stars read the roster at the last Guardian's fall | **§7**: the companion's star reads the roster at the Eyes' close. Hero stars unchanged. |
| `constellation.md` §6 | the colour mapping is unsettled | **§8** proposes Base white, A1–A5 bronze / silver / silver / gold / rainbow. |
| The Ascension memory (2026-09-09) | *a rung is never merely a stat multiplier* | **Kept.** A4 prices the player's economy, not the enemy's body. |

---

## 11. Open questions — DO NOT silently resolve

- **Where a contract can be spent on A1.** The fork is the only cash-in, once an act; a hero lost at
  the opener leaves a hole through two fights. Widen it, or is the gap the point?
- **The Revive supply on A1**, and its Act 1 price against Act 1 income (§9b). Do not move them on a
  guess.
- **A roster below two.** If 1v2 measures as a slow certain death, a forced end is the kinder rule.
- **Does A4 read as weaker or as pointless?** The alternative — Banners do not fold (one of each,
  no `+2`) — narrows the team shape instead of the number.
- **The AI tier** does not exist, and A5 leans on it. Its own document, when A4 is in.
- **The late Guardians at A1** need a shape change, not more body (§2a).
- **Rung order** past A1 (§5) is a proposal.

### Watch in playtest

- **Does the player buy a Revive first at every Guild Hall, or only after the first loss?**
- **Is the Fallen beat ever a real choice** — two Revives, three fallen — or always one-or-none? If
  it is never a choice, it is a confirm, and a confirm is not a screen.
- **Does the player recruit from the fork under A1**, and which way — contract or hire — and in
  which act? That is the whole question §0 asked.
- **The woken companion's Ancient typing** (§7a).
