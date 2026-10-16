# move-audit.md

**The move and movepool audit, first pass (2026-10-15).** The follow-up to `docs/hero-audit.md`: it
covers every slate move and every hero's pool. §1–§6 are findings and proposals. §7 records what
the designer ruled. The source table is `docs/balance/moves.md` (regenerated
the same day by `scripts/exportBalance.ts`), and the pool counts come from `progressionTable.moveTiers`.

## 0. The yardstick

There is no HP scale (`damagePipeline.ts`). At even off/def a STAB hit deals about
`BP × 1.25 × 0.925 ≈ 1.16 × BP`, and a base hero has about 215 HP. So **1% of max HP ≈ 2 BP**,
and the ratio holds at level 30 as long as both sides grow at the same rate. Under that yardstick:

| Rider | What it does | Worth (BP) | Note |
|---|---|---|---|
| Burn | 15 + 8 + 4% | **~50** | ~90 under Scorched Land (15 + 15 + 15) |
| Bleed | 6% every round, never clears | **~12 a round, so 60+** | The strongest DoT. It survives a switch, and the AI never switches anyway |
| Poison X | X% once, three active rounds later | ~2X, late | Poison 5 ≈ 10 BP; **at 30% it's ≈ 3 BP** |
| Conduct | +15% on the next Storm/Iron/Mech hit | ~28 | Only pays if a trigger type follows |
| Renew | 10% × 3 | ~55 of healing | |
| Daze | a flinch if you move first | 0 to a whole turn | At 10–30% it's noise (the designer dislikes Daze-chance procs) |
| Freeze | halves Speed until a switch | situational | Its real job is the key for Glaciate / Absolute Zero / Cold Snap |

**What sits under the whole table:** the Classic AI never switches voluntarily (`src/run/ai.ts`
only switches through a switch-out move). So the Burn, Freeze and Haunt the player applies run their
full course, while the player can clear the same statuses off its own side. The player's statuses
are worth more than the enemy's. That's fine, but it's why Burn and Bleed riders read as so strong in play.

Efficiency baselines: an Early hit is 40 BP for 20 mana (2.0 a mana), a Mid single 60–65 for 40
(1.6), a Late single 90–100 for 65 (1.5), an Early spread 30–35 ×2 for 25.

## 1. Cross-cutting findings: one fix covers a whole family

**1a. Poison chance riders are invisible.** This matches the designer's Umbra Bolt read.
- Umbra Bolt and Vine Lash (Early, 30%: Poison 5) ≈ 3 BP of expected value.
- Umbral Wave (Late spread, 20%: Poison 20) ≈ 4% a target, expected.
- Umbral Beam (Mid, 50%: Poison 10) ≈ 5% expected.
- Miasma (Late, Poison 5 + detonate) and Grim Harvest (Late, detonate) are the payoffs for a stack that
  these riders never build.

*Proposal:* make **Poison a certain rider** and leave the chance riders to Bleed, Freeze and Burn.
Poison is already delayed and lumpy, and adding a coin flip on top of that makes it nothing. Umbra
Bolt / Vine Lash become **Poison 10, certain**. Umbral Beam becomes **Poison 15, certain**. Umbral Wave
becomes **Poison 15, certain, on both targets**. Miasma becomes Poison 10 + detonate. At 10 a cast the
riders stack (additive), so three Umbra Bolts set up a 30% lump for a Grim Harvest, and that's the
engine those payoffs were written for. If the designer wants to keep a chance, the floor is the one
they named: Poison 10 minimum at 30%.

**1b. Chance-Daze riders** (the designer dislikes them): Glimmer 10%, Radiant Blow 20%, Ki Strike 20%,
Radiant Beam 20%, Stunning Bolt 30%, Blinding Flash 30%, Deity Blade 30%, Salvo 30%, Blinding Snow 40%,
Solar Pounce / Sandman 50%. *Precedent:* Shield Bash's Daze was made **certain with 2 Charges**
(the Stone pass). *Proposal:* the same treatment for the ones where Daze is the point (Radiant Blow,
Blinding Flash, Deity Blade, Sandman, Solar Pounce). On the plain hits, swap the Daze out for the
type's own verb (Glimmer, Radiant Beam, Ki Strike), because a 10% Daze on Light's Early bolt
reads as no rider at all.

**1c. Early spreads at 35 mana are traps.** Rime Wind (25 ×2, 35 mana), Arc Flash (30, 35), Psi
Pulse (30, 35), Knife Fan (25, 35) and Shrapnel (30, 35) sit beside Tremor (35, **25**), Gravel Spray
(30, 25, plus 30% Def ▼), Steam Vent (40, 25) and Snow Blast (50 all-others, 25).
*Proposal:* an **Early spread costs 25 at 30–35 BP**, and its rider is what tells one apart from another.

**1d. +1-priority pokes are scattered.** The healthy ones are Zap (30 for 15), Mana Tap (20 for 0),
Psychic Blow and Quick Freeze (40 for 30), and Flicker (50 for 35). The outliers:
**Swift Blow 15 BP** (in 11 pools; worth nothing once Opening Strike exists), **Pounce 30 for 35**
(Zap's damage at more than twice the price), and **Shadowstrike 40 for 45 at Mid** (Psychic Blow's
damage for +15 mana, *and* an Evolution grant on three paths). *Proposal:* a priority poke is
30 / 15 at Early and 40–50 / 30–35 at Mid. Cut Swift Blow outright, since Opening Strike already
fills Iron's +1 seat.

## 2. Dead twins: a move another move strictly beats

| Move | Beaten by | Proposal |
|---|---|---|
| **Spark Burst** (Fire Late, 65: Burn both) | Spark Flash (Early, 30: the *same* effect), Spreading Blaze (Mid, 30, plus a field), Heat Haze (Mid, 35, plus Int ▼) | Cut it. Fire has four Burn-both buffs, and three is already plenty |
| **Pack Leader** (Beast Late, 100 / 50: both Atk ▲ Spd ▲) | Howl (Early, 30: *the same stages*) | Make it the Late version: ▲▲ / ▲▲, or both allies plus Ambush. Kong / Silverback grants it |
| **Drain** (Spirit Early, 55 drain, 40 mana) | is Soul Rend (Mid): an identical row | Cut one. An Early at 40 mana is off the price convention anyway |
| **Rally** (Beast Early, 25: both Atk ▲) | Howl (30: both Atk ▲ Spd ▲) | Cut it, or make it a ▲▲ self |
| **Overgrowth** (Nature Late, 65: Heal 70 + Renew) | Full Bloom (Mid, **25**: Heal 55 + Renew, 2 Charges) | Overgrowth to both allies, or Full Bloom to 35 |
| **Momentum Swing** (Iron Mid, 50 + Atk ▲ for 35) | Iron Fist (Early, 40 + Atk ▲ for 20, in 14 pools) | Give Momentum Swing ▲▲, or let it scale the way Snowball does |
| **Rampage** (Beast Mid, 70 recoil for 50) | Gore (Mid, 65 recoil for 30) | Cut it, or give it Bleed |
| **Salvo** (Mech Late, 65 spread, 30% Daze, 90 mana) | Rocket Pod (Mid, 55 spread for 25, 3 Charges) | Rework it. At 90 mana it's the worst spread in the game |
| **Exalt** (Light Late, 55: one ally Int ▲▲▲) | Radiance (Mid, 50: both Int ▲▲) | Exalt on both allies, or add a rider |
| Break Will (Mind Late, 65) | Ink Cloud (Early, 25), which has the same stages | *Not* a twin: it also **wipes raised stages**, a rider the export doesn't print. Lead with the wipe in the copy |

## 3. Too strong: suspects for play, not verdicts

- **Spreading Blaze** (Mid, 30 mana): Burn on both targets *and* Scorched Land, which holds each Burn at
  15% → **45% of max HP a target over three rounds, ≈ 170 BP-equivalent for 30 mana.** That's the best
  rate in the catalog by a distance. It's an Evolution-pool entry on 13 paths, too.
- **Rubble Rush** (Stone Mid, 75 BP for **25**, recoil 25%): 3 BP a mana at Mid, in 7 pools and 2
  grants. Gore (65 for 30) is the recoil precedent. *Proposal:* 75 for 35.
- **Rocket Pod** (Mech Mid, 55 spread for 25, 3 Charges): 4.4 BP a mana. The Charges are what bound
  it, so it may be fine. It's also the reason Salvo is dead.
- **Repair Kit** (Mech Early, 15 mana: Heal 60, 3 Charges) against Mend (25: Heal 45). Bounded by Charges, but it's an
  Early heal that beats a Mid one.
- **Spark Flash** (Early, 30): ~100 BP-equivalent across both targets. It's Fire's identity, so leave it, but it's the reason
  Fire wants no more Burn-both moves.
- **Lacerate** (Mid, 50 + a *certain* Bleed for 35) beside the Slices (60 + a 50% Bleed for 40). With
  Bleed permanent, a certain Bleed for 5 less mana is the better card everywhere it appears (9 pools).

## 4. Unexciting: vanilla rows

Every type has one or more plain BP-for-mana rows: Inferno, Tsunami, Torrent, Splash, Magic Bolt,
Arcane Blast, Banish, Skyfall, Thunderclap, Solar Flare, Firestorm, Maelstrom, Cataclysm, Chain
Lightning, Deluge, Arc Pulse, Thrash, Animal Spirit, Swinging Chain, Titanic Crush. A vanilla nuke has
a job: it's the move that's never wrong. But fourteen types × 2–3 each is a lot of the Late band.
*Proposal:* **one vanilla Late per type, the reliable pick.** Every other plain row takes a hook in
its type's verb (a Burn, a Conduct, a Haunt, a field read). The Mid spreads at 45 / 60 (Deluge, Arc Pulse,
Thrash) are the dullest group and the first candidates.

Also flat: Crest (45 + a self Shield 25 for 40), Wave Shred (80 for 70, then cheaper each cast),
Snowball (40 on its first cast at 55, a Late move that's weak on the turn it's learned), Thousand
Cuts (25 ×3 for 70; it only lives on Edge).

## 5. Movepools: trim the bands

Today a hero makes **five offers** (two Early, two Mid, one Late). Its pool (kit excluded) averages
**8.2 Early / 7.2 Mid / 4.4 Late** across the 84 heroes, about 20 in all, and an Evolution path adds more. So a run
sees about a quarter of a hero's pool. Two heroes of the same kind, drafted twice, can feel like different
heroes, and the reason isn't a choice the player made but a roll of a 1-in-8. The extremes run from Squall (12 Early),
Clockwork (26 total) and Sentinel (24) down to Rook (13) and Leviathan (11).

*Proposal:* **4 Early / 4 Mid / 3 Late** (11, about half of today), plus the path's additions.
- Two offers from four Early is six possible pairs, enough that no two runs open the same way.
  One Late offer from three is a real roll.
- The Tutor's pick (any learnable move, Late first) becomes a menu of about 11 instead of 20+.
  The choice gets better because it gets shorter.
- **Off-type stays policy**: one or two off-type entries a hero.
  The heavy ones (Marrow 16 off-type of 21, Mellow 16 / 21, Tixwick 16 / 20, Ferra 15 / 18) need a per-hero
  look. Tixwick's Slices from every type are the point, so it may be a named exception the way Kata is Ronin's.
- Trim from the dead twins and vanilla rows first (§2, §4). A cut move should leave the catalog,
  not just the pool, unless an Evolution or a spawn kit still needs it.

## 6. Questions this opens

1. **Is Bleed the problem, or are the others?** Bleed is permanent and its riders sit at 50% on every
   Slice. Burn is three rounds and Poison a lump. If Poison comes up (§1a), Bleed may still be the
   only DoT worth building. One option is giving Bleed a clock the way Burn has. That would be a status change, not a move change.
2. **Who uses the cut moves?** The Titanspawn kits draw from the slates
   (`TitanspawnLine` move ids). A cut has to be checked against the spawn lines and the warbands.
3. **Does the pool trim run type by type** (the hero-audit rhythm: Fire first, a table per hero) or all
   at once with a single rule? Per type lets the designer pick which four Early moves are *this* hero's.

## 7. Decided 2026-10-15 (per user direction): the cross-cutting fixes

Built the same day. The numbers refer to the proposal list in the chat that day.

| Move | Now | Was |
|---|---|---|
| Vine Lash | 35 Pow, **Poison 10, always** | 40, 30%: Poison 5 |
| Miasma | detonates, plants **Poison 10** | plants 5 |
| Glimmer | **45 Pow, no rider** | 40, 10%: Daze |
| Radiant Blow | **certain Daze, 2 Charges** | 20%: Daze |
| Ki Strike | **50%: Wis ▼** | 20%: Daze |
| Stunning Bolt | Conduct only | Conduct, 30%: Daze |
| Blinding Flash | **certain Daze on both, 1 Charge** | 30%: Daze |
| Deity Blade | **certain Daze, 2 Charges** | 30%: Daze |
| Blinding Snow | Spd ▼, **certain Daze on both, 1 Charge**, +1 | 40%: Daze |
| Salvo | **70 on both for 70, 30% crit** | 65 for 90, 30%: Daze |
| Solar Pounce, Sandman (signatures) | **certain Daze, 2 Charges** | 50%: Daze |
| Pounce | 30, +1, **15 mana** | 35 |
| Shadowstrike | **50 Pow for 35**, +1 | 40 for 45 |
| Pack Leader | both **Atk ▲▲ Spd ▲▲** | ▲ / ▲ (Howl's stages) |
| Full Bloom | **40 mana** | 25 (so Overgrowth is no longer dead) |
| Momentum Swing | **60 Pow**, Atk ▲ | 50. The user ruled out ▲▲ as too strong |
| Rampage | **85 Pow** | 70 (buffed, not cut) |
| Exalt | Int ▲▲▲ to **both allies** | one ally |
| Spreading Blaze | **45 mana** | 30 |
| Rubble Rush | **35 mana** | 25 |

**Cut:** Swift Blow, Spark Burst, Drain (Soul Rend is the one Spirit drain), Rally. The kits that held
them swap to the nearest move: the Spirit spawn takes Spite, the Trials Jinx takes Fade Strike, the
Trials Mellow takes Howl. **Fire's Late slate is now three moves** (Inferno, Volcanic Surge,
Firestorm), so the Late Fire spawn holds three. `test/titanspawn` holds a thinner slate whole.

**Not taken:** Radiant Beam's ×2 against a Dazed target (it keeps its 20% Daze for now). And §1c, the
Early spreads: the user's read is that spread moves are already extremely strong. The 25-mana
spreads (Tremor, Gravel Spray, Steam Vent, Snow Blast) may be the outliers rather than the 35-mana ones.

**Held for a ruling:** Umbra Bolt, Umbral Beam and Umbral Wave. Certain Poison reverses the Shadow
slate's rule that *Shadow accumulates Poison as a side effect, and a guaranteed applier would make it a
second Nature* (`test/shadowMoves`).
