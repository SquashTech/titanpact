import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { MoveDefinition, StatKey, StatusApplication } from '../../engine/content';
import { statusApplicationsOf } from '../../engine/content';
import { TYPE_MULT_FLOOR } from '../../engine/damage/typeMult';
import { statuses } from '../../data/statuses';
import { fieldEffects } from '../../data/fieldEffects';
import { getTypeColor } from '../combat/typeColors';
import { ElementGlyph } from './elementIcons';
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

/** Whether a move's strip ends in the enemy seats (it aims at the enemy row) or in figures. */
export function aimsAtEnemies(target: TargetMode): boolean {
  return ENEMY_TARGETS.has(target);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const chevrons = (stages: number) => (stages > 0 ? '▲' : '▼').repeat(Math.abs(stages));

// --- Glyphs the strip draws that no other vocabulary owns (24x24, currentColor) ---

const PATHS = {
  figure: <path d="M12 2.4a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4ZM3 22c.6-5.5 4.2-8.7 9-8.7s8.4 3.2 9 8.7Z" />,
  die: (
    <path
      fillRule="evenodd"
      d="M5 2.5h14A2.5 2.5 0 0 1 21.5 5v14a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 19V5A2.5 2.5 0 0 1 5 2.5ZM8 6.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm8 8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Zm-4-4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6Z"
    />
  ),
  burst: <path d="m12 1.5 2.4 6.3 6.6-1.9-3.9 5.6 4.4 5.2-6.8.2L12 23l-2.7-6.1-6.8-.2 4.4-5.2-3.9-5.6 6.6 1.9Z" />,
  crosshair: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
    </g>
  ),
  swap: (
    <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h16l-4-4" />
      <path d="M21 16H5l4 4" />
    </g>
  ),
  sparkle: (
    <path d="M12 2c.7 4.6 2.4 6.3 7 7-4.6.7-6.3 2.4-7 7-.7-4.6-2.4-6.3-7-7 4.6-.7 6.3-2.4 7-7Zm7 11.5c.3 2.2 1.1 3 3.3 3.3-2.2.3-3 1.1-3.3 3.3-.3-2.2-1.1-3-3.3-3.3 2.2-.3 3-1.1 3.3-3.3Z" />
  ),
  exit: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3H4v18h6" />
      <path d="M9 12h12M17 8l4 4-4 4" />
    </g>
  ),
  refill: (
    <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 3v5h-5" />
    </g>
  ),
  ret: (
    <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5 4 10l5 5" />
      <path d="M4 10h10a6 6 0 0 1 0 12h-3" />
    </g>
  ),
  ramp: <path d="M3 21h4v-5H3Zm7 0h4V11h-4Zm7 0h4V4h-4Z" />,
  arrowTag: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21 20 4" />
      <path d="M13 4h7v7" />
      <path d="M3 15v6h6" />
    </g>
  ),
  blade: <path d="M21.5 2.5 9 15l-2.5-.3L6.2 12 18.8.3ZM3 21l4.3-4.3 1.4 1.4L4.4 22.4Z" />,
  shuffle: (
    <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h4c5 0 5 12 10 12h4M18 15l3 3-3 3" />
      <path d="M3 18h4c2 0 3-2 3.8-4M13.2 10C14 8 15 6 17 6h4M18 3l3 3-3 3" />
    </g>
  ),
} as const;

function Glyph({ name, className }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg className={`strip-glyph${className ? ` ${className}` : ''}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
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

export function SeatArrow({ mult }: { mult: number }) {
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

// --- Target figures ---

type Side = 'foe' | 'ally' | 'self';

function Figures({ side, count, random, small }: { side: Side; count: 1 | 2; random?: boolean; small?: boolean }) {
  return (
    <span className={`target-figures is-${side}${count === 2 ? ' is-pair' : ''}${small ? ' is-small' : ''}`}>
      <Glyph name="figure" />
      {count === 2 && <Glyph name="figure" />}
      {random && <span className="target-figures-random">?</span>}
    </span>
  );
}

/** Who a move reaches, as figures: one or two, red for foes, blue for your side, white for the caster. */
export function TargetFigures({ target, small }: { target: TargetMode; small?: boolean }) {
  const label = TARGET_MODE_LABELS[target];
  const body = ((): ReactNode => {
    switch (target) {
      case 'singleEnemy':
        return <Figures side="foe" count={1} small={small} />;
      case 'randomEnemy':
        return <Figures side="foe" count={1} random small={small} />;
      case 'bothEnemies':
        return <Figures side="foe" count={2} small={small} />;
      case 'self':
        return <Figures side="self" count={1} small={small} />;
      case 'singleAlly':
        return <Figures side="ally" count={1} small={small} />;
      case 'randomAlly':
        return <Figures side="ally" count={1} random small={small} />;
      case 'bothAllies':
        return <Figures side="ally" count={2} small={small} />;
      case 'allOthers':
        return (
          <>
            <Figures side="foe" count={2} small={small} />
            <Figures side="ally" count={1} small={small} />
          </>
        );
    }
  })();
  return (
    <span className="target-mark" title={label} aria-label={label}>
      {body}
    </span>
  );
}

// --- Rider icons ---

/** Where a rider lands, or null when it lands on the move's own target. */
function riderTarget(move: MoveDefinition, where: StatusApplication['target']): TargetMode | null {
  if (where === 'moveTarget') return null;
  return where === move.target ? null : where;
}

function statDeltaTarget(move: MoveDefinition): TargetMode | null {
  if (!move.statDeltaTarget || move.statDeltaTarget === 'moveTarget') return null;
  return move.statDeltaTarget === move.target ? null : move.statDeltaTarget;
}

/** Stats that move by the same steps share one set of chevrons: ATK and INT ▲▲, not ATK ▲▲ INT ▲▲. */
function stageGroups(deltas: readonly { stat: StatKey; stages: number }[]): { stats: StatKey[]; stages: number }[] {
  const groups: { stats: StatKey[]; stages: number }[] = [];
  for (const { stat, stages } of deltas) {
    const group = groups.find((g) => g.stages === stages);
    if (group) group.stats.push(stat);
    else groups.push({ stats: [stat], stages });
  }
  return groups;
}

/** What a rider's magnitude reads, resolved for the caster by the caller (MoveTile riderMagnitude). */
export type RiderAmount = (app: StatusApplication) => number | undefined;

/**
 * The statuses and stat stages a move lands: a status in its own icon and colour, a stage as the
 * stat's glyph and its chevrons. A rider landing somewhere other than the move's target carries
 * small figures saying where.
 */
function MoveRiderIcons({ move, amountOf }: { move: MoveDefinition; amountOf: RiderAmount }) {
  const apps = statusApplicationsOf(move);
  const deltas = move.statDeltas ?? [];
  const deltaWhere = statDeltaTarget(move);
  return (
    <>
      {apps.map((app) => {
        const name = statuses[app.statusId]?.name ?? app.statusId;
        // A magnitude is part of what the rider does; a duration is detail for the dossier.
        const amount = app.magnitude != null ? amountOf(app) : undefined;
        const shown = amount == null ? null : statusAmountText(app.statusId, amount);
        const where = riderTarget(move, app.target);
        return (
          <span
            key={app.statusId}
            className="move-rider"
            style={{ color: statusColor(app.statusId) } as CSSProperties}
            title={`${app.chance != null ? `${pct(app.chance)} ` : ''}${name}${shown ? ` ${shown}` : ''}${where ? ` (${TARGET_MODE_LABELS[where]})` : ''}`}
          >
            {app.chance != null && <span className="move-rider-odds">{pct(app.chance)}</span>}
            <StatusGlyph statusId={app.statusId} className="move-rider-glyph" />
            {shown && <span className="move-rider-amount">{shown}</span>}
            {where && <TargetFigures target={where} small />}
          </span>
        );
      })}
      {stageGroups(deltas).map(({ stats, stages }, i, groups) => (
        <span key={stats.join()} className="move-rider" title={stats.map((stat) => `${STAT_LABELS[stat]} ${chevrons(stages)}`).join(', ')}>
          {/* One roll gates the whole list, so the odds print once. */}
          {i === 0 && move.statDeltaChance != null && <span className="move-rider-odds">{pct(move.statDeltaChance)}</span>}
          {stats.map((stat) => (
            <StatGlyph key={stat} stat={stat} className="move-rider-glyph" />
          ))}
          <span className={`move-rider-chevrons${stages > 0 ? ' is-up' : ' is-down'}`}>{chevrons(stages)}</span>
          {i === groups.length - 1 && deltaWhere && <TargetFigures target={deltaWhere} small />}
        </span>
      ))}
    </>
  );
}

/** The priority bracket as the Speed glyph and its sign; nothing at bracket 0. */
export function MovePriorityChip({ move }: { move: MoveDefinition }) {
  // A randomPriority move's authored `priority` is dead; its clause says so.
  const bracket = move.randomPriority?.length ? 0 : move.priority;
  if (!bracket) return null;
  return (
    <span
      className={`move-eff-priority${bracket > 0 ? ' is-fast' : ' is-slow'}`}
      title={
        bracket > 0
          ? `Priority +${bracket} — resolves before every priority-0 move, whatever the Speed`
          : `Priority ${bracket} — resolves after every priority-0 move, whatever the Speed`
      }
    >
      <StatGlyph stat="speed" tone="inherit" />
      {bracket > 0 ? `+${bracket}` : bracket}
    </span>
  );
}

// --- Clauses: everything else a move does, one glyph each, its words in the title ---

/** What a fight knows that a sheet does not. Every field is optional; out of a fight the clause states its rule. */
export interface MoveLiveFacts {
  /** The board's answer for a conditional target. */
  target?: TargetMode;
  /** Each enemy seat's multiplier, left to right; null for an empty seat. */
  seats?: readonly (number | null)[];
  gateUnmet?: boolean;
  /** The half of a conditionalPower answerable without a target. */
  userConditionMet?: boolean;
  packBonusActive?: boolean;
  banked?: number;
  selfHpCost?: number;
  /** Live cost, for the discount clause's next price. */
  cost?: number;
  /** Live power, for a ramp's next figure. */
  power?: number;
}

function Status({ id }: { id: string }) {
  return (
    <span className="move-clause-status" style={{ color: statusColor(id) } as CSSProperties}>
      <StatusGlyph statusId={id} className="move-clause-glyph" />
    </span>
  );
}

function Field({ id }: { id: string }) {
  const type = fieldEffects[id as keyof typeof fieldEffects]?.flavorType;
  return (
    <span className="move-clause-field" style={{ color: type ? getTypeColor(type) : undefined } as CSSProperties}>
      {type ? <ElementGlyph type={type} className="move-clause-glyph" /> : <Glyph name="sparkle" />}
    </span>
  );
}

function Stat({ stat }: { stat: StatKey }) {
  return <StatGlyph stat={stat} className="move-clause-glyph" />;
}

function Partner({ type }: { type: string }) {
  return (
    <span className="move-clause-partner" style={{ color: getTypeColor(type) } as CSSProperties}>
      <ElementGlyph type={type} className="move-clause-glyph" />
      <Figures side="ally" count={1} small />
    </span>
  );
}

const fieldName = (id: string) => fieldEffects[id as keyof typeof fieldEffects]?.name ?? id;
const statusName = (id: string) => statuses[id]?.name ?? id;

function moveClauses(move: MoveDefinition, live: MoveLiveFacts): ReactNode[] {
  const out: ReactNode[] = [];
  const add = (key: string, title: string, body: ReactNode, opts?: { unmet?: boolean; tone?: string }) =>
    out.push(
      <span key={key} className={`move-clause${opts?.unmet ? ' is-unmet' : ''}${opts?.tone ? ` is-${opts.tone}` : ''}`} title={title}>
        {body}
      </span>
    );

  if (move.metamorphic) {
    add(
      'metamorphic',
      typeof move.metamorphic === 'object' ? 'Shows one move a round; the first one cast stays for the fight' : 'Becomes a random move each round',
      <Glyph name="shuffle" />
    );
  }

  if (move.manaGrant) add('manaGrant', `Gives ${move.manaGrant} MP, past their max`, <><Stat stat="manaPool" />+{move.manaGrant}</>);

  if (move.conditionalStatDeltas) {
    const { multiplier, requiresPartnerType } = move.conditionalStatDeltas;
    add('pack', `×${multiplier} beside a ${requiresPartnerType} partner`, <>×{multiplier}<Partner type={requiresPartnerType} /></>, {
      unmet: live.packBonusActive === false,
    });
  }

  if (move.randomStatDeltas) {
    const { count, stages } = move.randomStatDeltas;
    add('randomStats', `${chevrons(stages)} to ${count === 1 ? 'a random stat' : `${count} random stats`}`, (
      <>
        <Glyph name="die" />
        <span className="move-rider-chevrons is-up">{chevrons(stages)}</span>
        {count > 1 && `×${count}`}
      </>
    ));
  }

  if (move.clearsRaisedStages) add('clears', 'Clears raised stats', <span className="move-clause-struck">▲</span>, { tone: 'bad' });

  if (move.mpRegenGrant) add('regen', `+${move.mpRegenGrant} ${STAT_LABELS.mpRegen}`, <><Stat stat="mpRegen" />+{move.mpRegenGrant}</>);

  if (move.doublesStages) {
    add('doubles', `Doubles your ${move.doublesStages.map((s) => STAT_LABELS[s]).join(' and ')} steps, ▲▲ from none`, (
      <>
        {move.doublesStages.map((s) => <Stat key={s} stat={s} />)}
        ×2
      </>
    ));
  }

  if (move.stagesPerManaHeld) {
    const { stats, per, max } = move.stagesPerManaHeld;
    add('perMana', `${stats.map((s) => STAT_LABELS[s]).join(' and ')} ▲ per ${per} Mana held, up to ${chevrons(max)}`, (
      <>
        {stats.map((s) => <Stat key={s} stat={s} />)}
        <span className="move-rider-chevrons is-up">▲</span>/{per}
        <Stat stat="manaPool" />
      </>
    ));
  }

  if (move.requiresTargetStatus) {
    const gate = move.requiresTargetStatus;
    add('gate', live.gateUnmet ? `Needs ${statusName(gate)}` : `Only targets ${statusName(gate)}`, <><Glyph name="crosshair" /><Status id={gate} /></>, {
      unmet: live.gateUnmet,
    });
  }

  if (move.conditionalPower) {
    const c = move.conditionalPower;
    const userSide = c.requiresLastCharge || c.requiresPartnerType || c.requiresFieldEffect || c.requiresUserHpBelow != null || c.requiresUserStatus;
    const spent = c.consumesStatus && !c.requiresFieldEffect ? ', consumed' : '';
    let title = '';
    let cond: ReactNode = null;
    if (c.requiresLastCharge) {
      title = 'on its last Charge';
      cond = <span className="move-clause-pip" />;
    } else if (c.requiresPartnerType) {
      title = `while your partner is a ${c.requiresPartnerType}`;
      cond = <Partner type={c.requiresPartnerType} />;
    } else if (c.requiresFieldEffect) {
      title = `while ${fieldName(c.requiresFieldEffect)} is up`;
      cond = <Field id={c.requiresFieldEffect} />;
    } else if (c.requiresUserHpBelow != null) {
      title = `while you are below ${pct(c.requiresUserHpBelow)} HP`;
      cond = <><Figures side="self" count={1} small /><Stat stat="hp" />&lt;{pct(c.requiresUserHpBelow)}</>;
    } else if (c.requiresTargetHpBelow != null) {
      title = `vs a target below ${pct(c.requiresTargetHpBelow)} HP`;
      cond = <><Stat stat="hp" />&lt;{pct(c.requiresTargetHpBelow)}</>;
    } else if (c.requiresTargetStatReduction) {
      title = 'vs a target whose stats have been lowered';
      cond = <span className="move-rider-chevrons is-down">▼</span>;
    } else if (c.requiresUserStatus) {
      title = `while you have ${statusName(c.requiresUserStatus)}`;
      cond = <><Figures side="self" count={1} small /><Status id={c.requiresUserStatus} /></>;
    } else if (c.requiresTargetStatus) {
      title = `vs ${statusName(c.requiresTargetStatus)}`;
      cond = <Status id={c.requiresTargetStatus} />;
    }
    add('power', `×${c.multiplier} power ${title}${spent}`, <>×{c.multiplier}{cond}</>, { unmet: !!userSide && live.userConditionMet === false });
  }

  if (move.conditionalTarget) {
    const { target, requiresFieldEffect } = move.conditionalTarget;
    add('condTarget', `Hits ${TARGET_MODE_LABELS[target].toLowerCase()} while ${fieldName(requiresFieldEffect)} is up`, (
      <>
        <TargetFigures target={target} small />
        <Field id={requiresFieldEffect} />
      </>
    ), { unmet: live.target != null && live.target !== target });
  }

  if (move.randomBasePower) {
    add('rolls', `Base Power rolls ${move.randomBasePower.min}-${move.randomBasePower.max} each round`, <Glyph name="die" />);
  }

  if (move.basePowerGainOnUse) {
    const { amount, max } = move.basePowerGainOnUse;
    const next = live.power != null ? Math.min(max, live.power + amount) : null;
    add('ramp', next != null ? `Next cast: ${next} power` : `+${amount} Base Power each use this fight, up to ${max}`, <><Glyph name="ramp" />{next != null ? next : `+${amount}`}</>);
  }

  if (move.critChance != null) add('crit', `${pct(move.critChance)} crit`, <><Glyph name="burst" />{pct(move.critChance)}</>);

  if (move.offStatOverride) {
    const replaced = move.category === 'physical' ? 'attack' : 'intelligence';
    add('offStat', `Uses ${STAT_LABELS[move.offStatOverride]} in place of ${STAT_LABELS[replaced]}`, <><Stat stat={move.offStatOverride} /><Glyph name="swap" /></>);
  }

  if (move.retributionPercent != null) {
    const share = move.retributionPercent === 1 ? 'all' : pct(move.retributionPercent);
    const banked = live.banked != null ? Math.round(live.banked * move.retributionPercent) : null;
    add('retribution', banked != null ? `${banked} damage banked` : `Deals ${share} of damage taken since your last turn`, <><Glyph name="ret" />{banked ?? share}</>, {
      unmet: live.banked === 0,
    });
  }

  if (move.recoilPercent) add('recoil', `Costs ${pct(move.recoilPercent)} of damage dealt as recoil`, <><Stat stat="hp" />−{pct(move.recoilPercent)}</>, { tone: 'bad' });

  if (move.selfHpCost) {
    const { mode, amount } = move.selfHpCost;
    const title = mode === 'percentMaxHp' ? `Costs the user ${pct(amount)} of max HP` : `Drops the user to ${amount} HP`;
    const body = live.selfHpCost != null ? `−${live.selfHpCost}` : mode === 'percentMaxHp' ? `−${pct(amount)}` : `→${amount}`;
    add('selfHp', title, <><Stat stat="hp" />{body}</>, { tone: 'bad' });
  }

  if (move.drainPercent) add('drain', `Heals ${pct(move.drainPercent)} of damage dealt`, <><Stat stat="hp" />+{pct(move.drainPercent)}</>, { tone: 'good' });

  if (move.randomStatusApplication?.length) {
    const ids = move.randomStatusApplication.map((app) => app.statusId);
    add('randomStatus', `Applies one of: ${ids.map(statusName).join(', ')}`, (
      <>
        <Glyph name="die" />
        {ids.map((id) => <Status key={id} id={id} />)}
      </>
    ));
  }

  if (move.detonatesStatus) add('detonate', `Detonates ${statusName(move.detonatesStatus)}`, <><Status id={move.detonatesStatus} /><Glyph name="burst" /></>);

  if (move.cleanses) add('cleanse', move.cleanseCount != null ? `Cleanses ${move.cleanseCount} at random` : 'Cleanses', <><Glyph name="sparkle" />{move.cleanseCount ?? ''}</>, { tone: 'good' });

  if (move.manaDiscountOnUse) {
    const next = live.cost != null ? Math.max(0, live.cost - move.manaDiscountOnUse) : null;
    add('discount', next != null ? `Next cast costs ${next} MP` : `Costs ${move.manaDiscountOnUse} less each use`, <><Stat stat="manaPool" />{next != null ? `→${next}` : `−${move.manaDiscountOnUse}`}</>);
  }

  if (move.randomPriority?.length) {
    const brackets = [...move.randomPriority].sort((a, b) => a - b).map((p) => (p >= 0 ? `+${p}` : `${p}`));
    add('randomPriority', `Priority ${brackets.join(' or ')}, at random`, <><StatGlyph stat="speed" className="move-clause-glyph" /><Glyph name="die" /></>);
  }

  if (move.conditionalPriority) {
    const { bonus, requiresTargetStatus } = move.conditionalPriority;
    const sign = bonus >= 0 ? '+' : '';
    add('condPriority', `${sign}${bonus} priority vs ${statusName(requiresTargetStatus)}`, (
      <>
        <StatGlyph stat="speed" className="move-clause-glyph" />
        {sign}
        {bonus}
        <Status id={requiresTargetStatus} />
      </>
    ));
  }

  if (move.conditionalManaCost) {
    const { manaCost, requiresAllEnemiesStatus, requiresAnyEnemyStatus, requiresPartnerType } = move.conditionalManaCost;
    const gate = requiresAllEnemiesStatus ?? requiresAnyEnemyStatus;
    if (requiresPartnerType) {
      add('condMana', `${manaCost} MP beside a ${requiresPartnerType} partner`, <><Stat stat="manaPool" />{manaCost}<Partner type={requiresPartnerType} /></>);
    } else if (gate) {
      add('condMana', `${manaCost} MP if ${requiresAllEnemiesStatus ? 'both enemies have' : 'an enemy has'} ${statusName(gate)}`, (
        <>
          <Stat stat="manaPool" />
          {manaCost}
          <Status id={gate} />
          {requiresAllEnemiesStatus && '×2'}
        </>
      ));
    }
  }

  if (move.switchesUserOut) add('switch', 'Then switch out', <Glyph name="exit" />);
  if (move.manaCostAll) add('allMana', 'Spends all Mana', <><Stat stat="manaPool" /><span className="move-clause-word">All</span></>);
  if (move.firstTurnOnly) add('firstTurn', 'First turn out only', <span className="move-clause-word">1st</span>);
  if (move.tags?.includes('arrow')) add('arrow', 'Arrow', <Glyph name="arrowTag" />);
  if (move.tags?.includes('slice')) add('slice', 'Slice', <Glyph name="blade" />);

  if (move.restoresCharges) {
    const { amount, moveTag } = move.restoresCharges;
    const which = moveTag === 'arrow' ? 'Arrow' : 'spent move';
    add('refill', amount === 'all' ? `Every ${which} refills` : `${amount} Charge${amount === 1 ? '' : 's'} back on every ${which}`, <><Glyph name="refill" />{amount === 'all' ? '' : `+${amount}`}</>);
  }

  if (move.fieldEffectApplication) add('field', `Sets ${fieldName(move.fieldEffectApplication)}`, <Field id={move.fieldEffectApplication} />);

  return out;
}

// Mirrors the CSS sizes below (.move-seat, .target-figures): a seat 20px, a figure 15px, a paired one 9px more.
const SEAT_W = 20;
const SEAT_GAP = 3;
const FIGURE_W = 15;
const PAIR_W = 24;
const SMALL_FIGURE_W = 10;

function reachWidth(target: TargetMode, seats: readonly (number | null)[] | null): number {
  if (seats) return seats.length * SEAT_W + (seats.length - 1) * SEAT_GAP + (target === 'allOthers' ? SMALL_FIGURE_W + SEAT_GAP : 0);
  switch (target) {
    case 'bothEnemies':
    case 'bothAllies':
      return PAIR_W;
    case 'allOthers':
      return PAIR_W + 3 + FIGURE_W;
    case 'randomEnemy':
    case 'randomAlly':
      return FIGURE_W + 5;
    default:
      return FIGURE_W;
  }
}

/**
 * The move row's strip: every clause as a glyph, then the riders and priority, then who it reaches —
 * the enemy seats on an attack in a fight, figures otherwise. Right-aligned against the stub, so
 * the seats land in one column down the list and overflow clips from the left.
 */
export function MoveStrip({ move, amountOf, live = {} }: { move: MoveDefinition; amountOf: RiderAmount; live?: MoveLiveFacts }) {
  const target = live.target ?? move.target;
  const seats = move.kind === 'damage' && aimsAtEnemies(target) && live.seats && live.seats.length > 0 ? live.seats : null;
  // Who it reaches sits outside the clipping strip in a slot of stated width: WebKit mis-measured it
  // from its contents on first layout and let it run under the stub.
  return (
    <>
      <span className="move-strip">
        {moveClauses(move, live)}
        <MoveRiderIcons move={move} amountOf={amountOf} />
        <MovePriorityChip move={move} />
      </span>
      <span className="move-reach-slot" style={{ width: reachWidth(target, seats) } as CSSProperties}>
      <span className="move-reach">
        {seats ? (
          <>
            {target === 'allOthers' && <Figures side="ally" count={1} small />}
            <EnemySeats mults={seats} target={target} />
          </>
        ) : (
          <TargetFigures target={target} />
        )}
      </span>
      </span>
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
  label,
}: {
  move: MoveDefinition;
  /** The figure to print — live power, a rolled range, a resolved heal; omitted for a buff or debuff. */
  value?: string | number;
  boosted?: boolean;
  title?: string;
  /** A word under the figure, for the dossier's enlarged stub. */
  label?: string;
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
      {label && <span className="move-stub-label">{label}</span>}
    </span>
  );
}

// --- The name ---

// 17px, 15px, 13.5px, then two lines at 13.5px.
const NAME_FIT_STEPS = 3;

/**
 * The move's name, which steps its size down (styles.css `.is-fit-N`) rather than being cut off when
 * the strip beside it is crowded, and wraps to two lines before it would ever be cut off.
 */
export function MoveName({ text, children }: { text: string; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ text, step: 0 });
  const step = fit.text === text ? fit.step : 0;
  useLayoutEffect(() => {
    const el = ref.current;
    if (fit.text !== text) {
      setFit({ text, step: 0 });
      return;
    }
    if (el && el.scrollWidth > el.clientWidth + 0.5 && step < NAME_FIT_STEPS) setFit({ text, step: step + 1 });
  });
  return (
    <span ref={ref} className={`move-name${step ? ` is-fit-${step}` : ''}`}>
      {children}
      {text}
    </span>
  );
}
