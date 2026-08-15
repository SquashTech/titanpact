// The 15-type chart (docs/types-and-heroes.md). The matrix is DATA — this file
// is where it lives, not a doc.
//
// ⚠️ PLACEHOLDER CONTENT. This is a minimal test fixture built to exercise the
// engine (multiplicative dual-type stacking, the 0.25x floor, STAB), NOT the
// authored balance chart from the prototype. docs/types-and-heroes.md flags
// known-mistuned matchups (Light/Shadow over-resist, Nature/Beast fragile)
// that this fixture does not attempt to reproduce. Replace wholesale once the
// real 15x15 chart is authored — do not hand-tune this file into "the" chart.

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
  'Forge',
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

// Illustrative-only overrides for engine tests; NOT authored balance content.
export const typeChart: TypeChart = buildChart({
  Fire: { Nature: 2, Frost: 2, Water: 0.5, Stone: 0.5 },
  Water: { Fire: 2, Stone: 2, Nature: 0.5, Storm: 0.5 },
  Frost: { Nature: 2, Beast: 2, Fire: 0.5, Iron: 0.5 },
  Storm: { Water: 2, Beast: 2, Stone: 0.5 },
  Stone: { Fire: 2, Storm: 2, Water: 0.5, Nature: 0.5 },
  Nature: { Water: 2, Stone: 2, Fire: 0.5, Frost: 0.5, Beast: 0.5 },
  Light: { Shadow: 2, Spirit: 0.5 },
  Shadow: { Light: 0.5, Mind: 2 },
  Arcane: { Mind: 2, Iron: 0.5 },
  Mind: { Spirit: 2, Shadow: 0.5, Arcane: 0.5 },
  Spirit: { Shadow: 2, Light: 2, Mind: 0.5 },
  Iron: { Stone: 2, Frost: 2, Forge: 0.5 },
  Forge: { Iron: 2, Beast: 2, Water: 0.5 },
  Beast: { Nature: 2, Forge: 0.5, Frost: 0.5, Storm: 0.5 },
  Ancient: { Fire: 0.5, Water: 0.5, Frost: 0.5, Storm: 0.5, Stone: 0.5, Nature: 0.5, Light: 0.5, Shadow: 0.5, Arcane: 0.5, Mind: 0.5, Spirit: 0.5, Iron: 0.5, Forge: 0.5, Beast: 0.5 },
});
