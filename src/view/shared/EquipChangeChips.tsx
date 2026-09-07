import type { CSSProperties } from 'react';
import type { StatKey } from '../../engine/content';
import type { EquipChange } from '../../run/equipCompare';
import { passives } from '../../data/passives';
import { statuses } from '../../data/statuses';
import { getTypeAbbr, getTypeColor } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';
import { PassiveGlyph } from './passiveIcons';
import { StatGlyph, STAT_LABELS } from './StatBars';

/**
 * One line of an equipment diff (src/run/equipCompare.ts) as a chip: `ATK 5→15`, a bare `+15` /
 * `−5` when one side is zero, a passive gained or lost. Deliberately not a verdict — Attack on an
 * Int hero is not worth what it is on a physical one, and the game cannot know the build.
 */

/** `−` is U+2212, not a hyphen: at 9px a hyphen-minus next to a digit reads as a word break. */
function fmtAmount(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

function ChipValue({ change }: { change: EquipChange }) {
  if (change.from === 0 || change.to === 0) return <span className="equip-chip-value">{fmtAmount(change.delta)}</span>;
  return (
    <span className="equip-chip-value">
      <span className="equip-chip-was">{change.from}</span>
      <span className="equip-chip-arrow" aria-hidden="true">
        →
      </span>
      {change.to}
    </span>
  );
}

export function ChangeChip({ change }: { change: EquipChange }) {
  const tone = change.delta > 0 ? 'is-gain' : 'is-loss';

  if (change.kind === 'passive') {
    const def = passives[change.key];
    const name = def?.name ?? change.key;
    return (
      <span className={`equip-chip is-effect ${tone}`} title={def?.description ?? name}>
        <span className="equip-chip-mark" aria-hidden="true">
          {change.delta > 0 ? '+' : '−'}
        </span>
        {def ? <PassiveGlyph passiveId={change.key} className="equip-chip-glyph" /> : null}
        <span className="equip-chip-label">{name}</span>
      </span>
    );
  }

  if (change.kind === 'status') {
    const def = statuses[change.key];
    // Elemental Force is worth its magnitude only to a hero of that type, so the chip is drawn in
    // the type's colour to be checked against the hero's own types.
    const forceType = def?.forceType;
    const label = forceType ? getTypeAbbr(forceType) : (def?.name ?? change.key);
    return (
      <span
        className={`equip-chip ${tone}`}
        style={forceType ? ({ '--chip-tint': getTypeColor(forceType) } as CSSProperties) : undefined}
        title={forceType ? `${def?.name}: flat Base Power on ${forceType} moves` : def?.name}
      >
        {forceType ? <ElementGlyph type={forceType} className="equip-chip-glyph" /> : null}
        <span className="equip-chip-label">{label}</span>
        <ChipValue change={change} />
      </span>
    );
  }

  const stat = change.key as StatKey;
  return (
    <span className={`equip-chip ${tone}`}>
      <StatGlyph stat={stat} className="equip-chip-glyph" />
      <span className="equip-chip-label">{STAT_LABELS[stat]}</span>
      <ChipValue change={change} />
    </span>
  );
}

export function ChangeChips({ changes }: { changes: readonly EquipChange[] }) {
  if (changes.length === 0) return <span className="equip-chip is-neutral">No change</span>;
  return (
    <>
      {changes.map((change) => (
        <ChangeChip key={`${change.kind}:${change.key}`} change={change} />
      ))}
    </>
  );
}

/** The same diff as a sentence, for an aria-label. */
export function spokenChanges(changes: readonly EquipChange[]): string {
  return changes
    .map((c) => {
      const label =
        c.kind === 'stat'
          ? STAT_LABELS[c.key as StatKey]
          : c.kind === 'status'
            ? (statuses[c.key]?.name ?? c.key)
            : (passives[c.key]?.name ?? c.key);
      if (c.kind === 'passive') return `${c.delta > 0 ? 'gains' : 'loses'} ${label}`;
      return `${label} ${c.from} to ${c.to}`;
    })
    .join(', ');
}
