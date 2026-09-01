// The 15-type chart (docs/types-and-heroes.md). Authored content — tune cells here.

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

// Ancient is a pure defensive wall: it resists every type via each attacker row's
// `Ancient: 0.5`, and its own attacker row is deliberately empty. Keep it that way.
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
