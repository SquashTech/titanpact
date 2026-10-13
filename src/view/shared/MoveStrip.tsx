import type { CSSProperties } from 'react';
import type { MoveDefinition, StatusApplication } from '../../engine/content';
import { statusApplicationsOf } from '../../engine/content';
import { TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { statuses } from '../../data/statuses';
import { StatGlyph, MoveKindGlyph } from './statIcons';
import { StatusGlyph, statusColor } from './statusIcons';
import { moveKindGlyph } from './moveKind';
import { statusAmountText } from './statusFacts';
import { STAT_LABELS } from './StatBars';

type TargetMode = MoveDefinition['target'];

/** Canonical player-facing name per TargetMode; FightScreen's targeting copy reads this too. */
export const TARGET_MODE_LABELS: Record<TargetMode, string> = {
  singleEnemy: 'Single Enemy',
  bothEnemies: 'Both Enemies',
  singleAlly: 'Single Ally',
  bothAllies: 'Both Allies',
  self: 'Self',
  allOthers: 'All',
  randomAlly: 'Random Ally',
  randomEnemy: 'Random Enemy',
};

const ENEMY_TARGETS: ReadonlySet<TargetMode> = new Set(['singleEnemy', 'bothEnemies', 'randomEnemy', 'allOthers']);

/** Whether a move's second line leads with the enemy seats (it aims at the enemy row) or the board. */
export function aimsAtEnemies(target: TargetMode): boolean {
  return ENEMY_TARGETS.has(target);
}

// --- Matchup arrows in the enemies' seats ---

type Tier = 'quad-super' | 'super' | 'neutral' | 'resist' | 'quad-resist';

function tierOf(mult: number): Tier {
  if (mult >= 4) return 'quad-super';
  if (mult > 1) return 'super';
  if (mult === 1) return 'neutral';
  if (mult <= TYPE_MULT_FLOOR) return 'quad-resist';
  return 'resist';
}

// The lead-pick panel's block arrow (MatchupArrows.tsx).
const UP = 'M12 4 21 14h-6v6H9v-6H3Z';
const DOWN = 'M12 20 3 10h6V4h6v6h6Z';

function SeatArrow({ mult }: { mult: number }) {
  const tier = tierOf(mult);
  if (tier === 'neutral') return <span className="move-seat-arrow eff-neutral" />;
  const one = (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={mult > 1 ? UP : DOWN} />
    </svg>
  );
  const double = tier === 'quad-super' || tier === 'quad-resist';
  return (
    <span className={`move-seat-arrow eff-${tier}${double ? ' is-double' : ''}`}>
      {one}
      {double && one}
    </span>
  );
}

/**
 * One seat per enemy slot, in the arena's left-to-right order; `null` is an empty slot (a downed
 * foe), which keeps its place so the other arrow never slides under the wrong enemy. A move that
 * hits both draws one bar under the pair.
 */
export function EnemySeats({ mults, target }: { mults: readonly (number | null)[]; target: TargetMode }) {
  const mode = target === 'bothEnemies' || target === 'allOthers' ? ' is-spread' : target === 'randomEnemy' ? ' is-random' : '';
  return (
    <span className={`move-seats${mode}`} title={TARGET_MODE_LABELS[target]}>
      {mults.map((mult, i) => (
        <span key={i} className={`move-seat${mult == null ? ' is-empty' : ''}`} title={mult == null ? undefined : `${Math.round(mult * 100) / 100}×`}>
          {mult != null && <SeatArrow mult={mult} />}
        </span>
      ))}
    </span>
  );
}

// --- Target board ---

type Cell = '' | 'hit' | 'pick' | 'you';

/**
 * The doubles board in four cells — enemies on top, your side below. Filled is always hit, hollow
 * is pick one, gold is the caster. `youSlot` puts the caster's cell where it stands.
 */
export function TargetBoard({ target, youSlot = 0, small }: { target: TargetMode; youSlot?: 0 | 1; small?: boolean }) {
  const ally: [Cell, Cell] = ['', ''];
  let enemy: [Cell, Cell] = ['', ''];
  const partner = youSlot === 0 ? 1 : 0;
  switch (target) {
    case 'singleEnemy':
    case 'randomEnemy':
      enemy = ['pick', 'pick'];
      break;
    case 'bothEnemies':
      enemy = ['hit', 'hit'];
      break;
    case 'self':
      ally[youSlot] = 'you';
      break;
    case 'singleAlly':
    case 'randomAlly':
      ally[0] = 'pick';
      ally[1] = 'pick';
      break;
    case 'bothAllies':
      ally[0] = 'hit';
      ally[1] = 'hit';
      break;
    case 'allOthers':
      enemy = ['hit', 'hit'];
      ally[partner] = 'hit';
      break;
  }
  const random = target === 'randomEnemy' || target === 'randomAlly';
  return (
    <span className={`target-board${small ? ' is-small' : ''}${random ? ' is-random' : ''}`} title={TARGET_MODE_LABELS[target]} aria-label={TARGET_MODE_LABELS[target]}>
      {[...enemy, ...ally].map((cell, i) => (
        <i key={i} className={cell ? `is-${cell}` : undefined} />
      ))}
    </span>
  );
}

// --- Rider icons ---

/** Where a rider lands, as a board — or null when it lands on the move's own target. */
function riderBoardTarget(move: MoveDefinition, where: StatusApplication['target'] | 'moveTarget'): TargetMode | null {
  if (where === 'moveTarget') return null;
  const mode = where === 'self' ? 'self' : where;
  return mode === move.target ? null : mode;
}

function statDeltaBoardTarget(move: MoveDefinition): TargetMode | null {
  if (!move.statDeltaTarget || move.statDeltaTarget === 'moveTarget') return null;
  return move.statDeltaTarget === move.target ? null : move.statDeltaTarget;
}

/** What a rider's magnitude reads, resolved for the caster by the caller (MoveTile riderMagnitude). */
export type RiderAmount = (app: StatusApplication) => number | undefined;

/**
 * The statuses and stat stages a move lands, as glyphs: a status wears its own icon and colour, a
 * stage the stat's glyph with its chevrons. A rider that lands somewhere other than the move's
 * target carries a small board saying where. Everything else stays in words.
 */
export function MoveRiderIcons({ move, amountOf, youSlot }: { move: MoveDefinition; amountOf: RiderAmount; youSlot?: 0 | 1 }) {
  const apps = statusApplicationsOf(move);
  const deltas = move.statDeltas ?? [];
  if (apps.length === 0 && deltas.length === 0) return null;
  const deltaWhere = statDeltaBoardTarget(move);
  return (
    <>
      {apps.map((app) => {
        const name = statuses[app.statusId]?.name ?? app.statusId;
        const amount = amountOf(app) ?? app.duration;
        const shown = amount == null ? null : app.magnitude != null ? statusAmountText(app.statusId, amount) : String(amount);
        const where = riderBoardTarget(move, app.target);
        return (
          <span
            key={app.statusId}
            className="move-rider"
            style={{ color: statusColor(app.statusId) } as CSSProperties}
            title={`${app.chance != null ? `${Math.round(app.chance * 100)}% ` : ''}${name}${shown ? ` ${shown}` : ''}`}
          >
            {app.chance != null && <span className="move-rider-odds">{Math.round(app.chance * 100)}%</span>}
            <StatusGlyph statusId={app.statusId} className="move-rider-glyph" />
            {shown && <span className="move-rider-amount">{shown}</span>}
            {where && <TargetBoard target={where} youSlot={youSlot} small />}
          </span>
        );
      })}
      {deltas.map(({ stat, stages }, i) => (
        <span key={stat} className="move-rider" title={`${STAT_LABELS[stat]} ${(stages > 0 ? '▲' : '▼').repeat(Math.abs(stages))}`}>
          {/* One roll gates the whole list, so the odds print once. */}
          {i === 0 && move.statDeltaChance != null && <span className="move-rider-odds">{Math.round(move.statDeltaChance * 100)}%</span>}
          <StatGlyph stat={stat} className="move-rider-glyph" />
          <span className={`move-rider-chevrons${stages > 0 ? ' is-up' : ' is-down'}`}>{(stages > 0 ? '▲' : '▼').repeat(Math.abs(stages))}</span>
          {i === deltas.length - 1 && deltaWhere && <TargetBoard target={deltaWhere} youSlot={youSlot} small />}
        </span>
      ))}
    </>
  );
}

// --- The stub ---

/**
 * The payoff, scored off the row's right end: the kind glyph over the number it delivers. A buff or
 * debuff has no number, so it shows its glyph alone.
 */
export function MoveStub({
  move,
  value,
  boosted,
  title,
}: {
  move: MoveDefinition;
  /** The figure to print — live power, a rolled range, a resolved heal; omitted for a buff or debuff. */
  value?: string | number;
  boosted?: boolean;
  title?: string;
}) {
  const kind = moveKindGlyph(move);
  const hits = move.hitCount ?? 1;
  const long = value != null && String(value).length > 3;
  return (
    <span className={`move-stub stub-${kind}${value == null ? ' is-bare' : ''}`} title={title}>
      <MoveKindGlyph kind={kind} className="move-stub-glyph" />
      {value != null && (
        <strong className={`move-stub-value${long ? ' is-long' : ''}${boosted ? ' is-boosted' : ''}`}>
          {value}
          {boosted && <span className="move-stub-boost">▲</span>}
          {hits > 1 && <span className="move-stub-hits">×{hits}</span>}
        </strong>
      )}
    </span>
  );
}
