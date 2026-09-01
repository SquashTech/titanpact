// The 15-type chart (docs/types-and-heroes.md). The matrix is DATA — this file
// is where it lives, not a doc.
//
// AUTHORED CONTENT (2026-09-01). This started as a placeholder fixture built to
// exercise the engine; a full designer pass promoted it to the chart. The pass
// closed the two documented tuning issues:
//   • Nature and Beast's fragility (three weaknesses each, no compensating
//     resistance) — Nature now grounds Storm, Beast now shrugs off Mind.
//   • Light/Shadow's thin defence after the earlier mutual-2x retune — each
//     picked up a second resistance (Light vs Arcane, Shadow vs Mech).
// Tune cells here; don't rebuild the file from scratch.

import type { TypeChart } from '../engine/damage/typeMult';

export const TYPES = [
  'Fire',
  'Water',
  'Frost',
  'Storm',
  'Stone',
  'Nature',
  'Light',
  'Shadow',
  'Arcane',
  'Mind',
  'Spirit',
  'Iron',
  'Mech',
  'Beast',
  'Ancient',
] as const;

export type TitanpactType = (typeof TYPES)[number];

function buildChart(overrides: Partial<Record<TitanpactType, Partial<Record<TitanpactType, number>>>>): TypeChart {
  const chart: TypeChart = {};
  for (const attacker of TYPES) {
    chart[attacker] = {};
    for (const defender of TYPES) {
      chart[attacker][defender] = overrides[attacker]?.[defender] ?? 1;
    }
  }
  return chart;
}

// Ancient is a pure DEFENSIVE wall: it resists every other type (chart[X].Ancient
// = 0.5 on each row below) and its own attacker row is deliberately EMPTY —
// nothing it throws is super-effective or resisted. It's the end-of-act
// Guardian's type (CLAUDE.md "Run structure"), and the fantasy is "almost
// impossible to burst down", not "also hits like a truck". Do not move the
// resistances onto an `Ancient: { ... }` attacker row, and do not put offensive
// cells on that row.
//
// The chart's recurring motifs, so new cells stay coherent rather than ad hoc:
//   • Magic vs. machine — Arcane and Mech are a mutual 2x rivalry, the same
//     shape as Light/Shadow.
//   • The intangible — Spirit resists Iron and can't reach Mech; Arcane's
//     binding wards are what does get through to it.
//   • Sensors — Mech hits what it can see, so Shadow resists it and Water gets in.
//   • Instinct over intellect — Beast resists Mind and hits it hard.
export const typeChart: TypeChart = buildChart({
  Fire: { Nature: 2, Frost: 2, Iron: 2, Water: 0.5, Stone: 0.5, Light: 0.5, Ancient: 0.5 },
  Water: { Fire: 2, Stone: 2, Mech: 2, Storm: 0.5, Nature: 0.5, Ancient: 0.5 },
  Frost: { Water: 2, Nature: 2, Beast: 2, Fire: 0.5, Iron: 0.5, Ancient: 0.5 },
  Storm: { Water: 2, Iron: 2, Beast: 2, Stone: 0.5, Nature: 0.5, Mech: 0.5, Ancient: 0.5 },
  Stone: { Fire: 2, Storm: 2, Water: 0.5, Nature: 0.5, Ancient: 0.5 },
  Nature: { Water: 2, Stone: 2, Fire: 0.5, Frost: 0.5, Beast: 0.5, Ancient: 0.5 },
  Light: { Frost: 2, Shadow: 2, Fire: 0.5, Nature: 0.5, Spirit: 0.5, Ancient: 0.5 },
  Shadow: { Nature: 2, Light: 2, Mind: 2, Stone: 0.5, Spirit: 0.5, Beast: 0.5, Ancient: 0.5 },
  Arcane: { Storm: 2, Mind: 2, Spirit: 2, Mech: 2, Light: 0.5, Iron: 0.5, Ancient: 0.5 },
  Mind: { Light: 2, Spirit: 2, Mech: 2, Shadow: 0.5, Arcane: 0.5, Beast: 0.5, Ancient: 0.5 },
  Spirit: { Light: 2, Shadow: 2, Mind: 0.5, Mech: 0.5, Ancient: 0.5 },
  Iron: { Frost: 2, Stone: 2, Spirit: 0.5, Mech: 0.5, Ancient: 0.5 },
  Mech: { Arcane: 2, Iron: 2, Beast: 2, Water: 0.5, Shadow: 0.5, Mind: 0.5, Ancient: 0.5 },
  Beast: { Nature: 2, Arcane: 2, Mind: 2, Frost: 0.5, Storm: 0.5, Iron: 0.5, Mech: 0.5, Ancient: 0.5 },
  Ancient: {},
});
