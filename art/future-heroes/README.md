# Future heroes

Art for heroes that are not in the game yet: idle, `attack` and `damaged` frames at 48×48,
named the way `art/heroes/` expects. This folder is outside `art/heroes/`, so `heroArt.ts`
does not bundle it. To implement one, move its three files into `art/heroes/` (or
`art/heroes/unlocks/` for a Starfall or bundle hero) and author the hero in data
(`docs/types-and-heroes.md` for the rules, Drift/Rimehold/Carillon/Hart as the latest worked
examples).

Concepts from 2026-09-27; the role lines are first-pass pitches, not decisions.

| Hero | Type | Concept | Role pitch |
|---|---|---|---|
| Ashwing | Fire | phoenix | rebirth: a natural owner for the endure verb (refuse the first KO) |
| Aurum | Light | sun-maned lion | a physical Light attacker; the mane flares blinding light |
| Kappa | Water | river imp with a water dish on its head | physical brawler; spilling the dish could be its Burden |
| Kitsu | Spirit | kitsune with ghost-fire tails | fast magical Spirit caster, ghost-fire volleys |
| Morel | Nature | mushroom folk | spores: Poison and debuffs |
| Motley | Mind | mad jester juggling psychic orbs | chaos and confusion control |
| Omen | Shadow | black cat with a smoke tail | fast Shadow striker, bad luck as a verb |
| Ronin | Iron | wandering samurai | fast single-target physical, priority draw-cut |
| Scree | Stone | granite pangolin | rolls up into a wall, curl-and-charge tank |
| Silverback | Beast | gorilla warlord | heavy physical bruiser |
| Tome | Arcane | living spellbook with one eye | magical caster, rune volleys |
| Tusk | Frost | woolly mammoth | the slow physical Frost body the type lacks |

Facing is mixed on purpose, as on the live roster: Ashwing, Kappa, Omen and Scree face left;
Aurum, Kitsu, Ronin and Tusk face right; Morel, Motley, Silverback and Tome face the viewer.
Each hero's attack and damaged frames face the same way as its idle.

Known art nits: Omen's attack frame is barely different from its idle and wants a re-roll.
Rumble (Storm oni drummer) and Sprocket (Mech gnome walker) were set aside as weaker concepts.
