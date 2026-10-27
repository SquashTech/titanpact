import type { CSSProperties, ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { relics } from '../../data/relics';
import { statuses } from '../../data/statuses';
import { STAT_ORDER, type HeroDefinition, type StatKey } from '../../engine/content';
import { moveForHero } from '../../engine/state';
import { entryPassiveCounts, entryStatModifiers } from '../../run/entryStats';
import type { EquipmentDefinition } from '../../run/equipment';
import { levelOf } from '../../run/growth';
import { innatePassiveIdsFor } from '../../run/innate';
import { itemFitChips, type ItemFitChip } from '../../run/itemFit';
import { relicTeamPassiveGrants } from '../../run/passives';
import { relicTeamStatModifiers } from '../../run/relics';
import type { ItemReceipt } from '../../run/runProgress';
import type { RosterEntry, RunState } from '../../run/state';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { useLongPress } from '../shared/MoveTile';
import { STAT_FULL_LABELS } from '../shared/relicStacks';
import { STAT_COLORS, StatGlyph } from '../shared/statIcons';
import { StatusGlyph } from '../shared/statusIcons';
import { GearSockets } from './HallCounters';

export interface LedgerRow {
  hero: HeroDefinition;
  entry: RosterEntry;
  receipt: ItemReceipt | undefined;
  open: boolean;
  isTaker: boolean;
  /** What a tap on the row does, for a screen reader: the row itself carries no button. */
  label: string;
}

const forceColor = (statusId: string) => {
  const type = statuses[statusId]?.forceType;
  return type ? getTypeColor(type) : '#ffd98a';
};

function currentStats(run: RunState, hero: HeroDefinition, entry: RosterEntry): Record<StatKey, number> {
  const counts = entryPassiveCounts(entry, equipment, relicTeamPassiveGrants(run.relics, relics), innatePassiveIdsFor(hero, entry));
  const grants = entryStatModifiers(entry, equipment, passives, counts, relicTeamStatModifiers(run.relics, relics), run.gold);
  return Object.fromEntries(STAT_ORDER.map((stat) => [stat, hero.baseStats[stat] + (grants[stat] ?? 0)])) as Record<StatKey, number>;
}

/**
 * The item who-screen's roster as a table (docs/gear-absorption.md §2 "The ledger"): the piece's
 * grants are the columns, each hero a row holding its own figure for each. A figure is bright where
 * the hero leans on that stat, and the biggest of those in a column glows in the stat's colour.
 */
export function ItemLedger({ run, item, rows, onGive, onPreview }: { run: RunState; item: EquipmentDefinition; rows: readonly LedgerRow[]; onGive: (entry: RosterEntry) => void; onPreview: (row: LedgerRow) => void }) {
  const reads = rows.map((row) => {
    const stats = currentStats(run, row.hero, row.entry);
    const kit = row.entry.unlockedMoveIds.flatMap((id) => (moves[id] ? [moveForHero(moves[id], row.hero)] : []));
    return { row, stats, chips: itemFitChips(item, stats, kit, statuses) };
  });
  const columns = reads[0]?.chips ?? [];
  const best = columns.map((_, i) => {
    const lit = reads.filter((r) => r.chips[i].lit && r.chips[i].kind === 'stat');
    return lit.length > 1 ? Math.max(...lit.map((r) => r.stats[(r.chips[i] as Extract<ItemFitChip, { kind: 'stat' }>).stat])) : null;
  });
  const wide = columns.length > 3;
  const roomy = rows.length <= 3;
  const template = ['var(--ledger-who)', ...columns.map((col) => (col.kind === 'force' ? 'var(--ledger-force)' : 'var(--ledger-col)'))].join(' ');

  return (
    <div className={['item-ledger', wide ? 'is-wide' : '', roomy ? 'is-roomy' : ''].filter(Boolean).join(' ')} style={{ '--ledger-template': template } as CSSProperties}>
      <div className="item-ledger-head" aria-hidden="true">
        <span />
        {columns.map((col) =>
          col.kind === 'stat' ? (
            <span key={col.stat} className="item-ledger-colhead" style={{ color: STAT_COLORS[col.stat] }} title={STAT_FULL_LABELS[col.stat]}>
              <StatGlyph stat={col.stat} tone="inherit" />
              <em>+{item.statGrants[col.stat]}</em>
            </span>
          ) : (
            <span key={col.statusId} className="item-ledger-colhead" style={{ color: forceColor(col.statusId) }} title={statuses[col.statusId]?.name}>
              <StatusGlyph statusId={col.statusId} />
            </span>
          )
        )}
      </div>
      <div className="item-ledger-rows">
        {reads.map(({ row, stats, chips }) => (
          <LedgerRowView key={row.entry.rosterId} row={row} onGive={onGive} onPreview={onPreview}>
            {chips.map((chip, i) =>
              chip.kind === 'stat' ? (
                <span
                  key={chip.stat}
                  className={`item-ledger-cell${chip.lit ? ' is-used' : ''}${chip.lit && stats[chip.stat] === best[i] ? ' is-best' : ''}`}
                  style={{ '--cell-color': STAT_COLORS[chip.stat] } as CSSProperties}
                >
                  {stats[chip.stat]}
                </span>
              ) : (
                <span key={chip.statusId} className={`item-ledger-cell is-force${chip.lit ? ' is-used' : ''}`} style={{ '--cell-color': forceColor(chip.statusId) } as CSSProperties}>
                  {chip.lit ? <StatusGlyph statusId={chip.statusId} /> : '—'}
                </span>
              )
            )}
          </LedgerRowView>
        ))}
      </div>
    </div>
  );
}

function LedgerRowView({ row, onGive, onPreview, children }: { row: LedgerRow; onGive: (entry: RosterEntry) => void; onPreview: (row: LedgerRow) => void; children: ReactNode }) {
  const activate = row.open ? () => { playSfx('ui.pick'); onGive(row.entry); } : () => onPreview(row);
  const longPress = useLongPress(() => onPreview(row), activate);
  return (
    <div
      className={['item-ledger-row', row.open ? 'is-offered' : '', row.isTaker ? 'is-blessed' : '', !row.open && !row.isTaker ? 'is-locked' : ''].filter(Boolean).join(' ')}
      style={{ '--type-rgb': getTypeColorRgb(row.hero.types[0]) } as CSSProperties}
      role="button"
      tabIndex={row.open ? 0 : -1}
      aria-label={`${row.hero.name} — ${row.label}`}
      data-sfx="none"
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && row.open) {
          e.preventDefault();
          activate();
        }
      }}
      {...longPress}
    >
      {row.isTaker && <span className="blessing-flare" aria-hidden="true" />}
      <span className="item-ledger-who">
        <HeroPortrait heroId={row.hero.id} className="item-ledger-portrait" />
        <span className="item-ledger-name">
          <b>
            {row.hero.name} <small>Lv {levelOf(row.entry)}</small>
          </b>
          <GearSockets hero={row.hero} entry={row.entry} receipt={row.receipt} open={row.open} />
        </span>
      </span>
      {children}
    </div>
  );
}
