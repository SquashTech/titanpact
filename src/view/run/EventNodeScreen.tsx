import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { seededRandom, withSeededRandom } from '../shared/seededRandom';
import { equipment, rollEquipmentDrops } from '../../data/equipment';
import { heroes } from '../../data/heroes';
import { curses } from '../../data/curses';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import type { EventCost, EventOption, EventTone, HeroOutcome, ResolvableOutcome, RunEventDefinition } from '../../data/events';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { rarityWeightsFor } from '../../run/equipment';
import {
  applyEventCost,
  applyCurse,
  applyHeroOutcome,
  applyStatShift,
  curseTurnsOnBite,
  outcomeForAct,
  costAffordable,
  eventRecruitEntry,
  grantEventPassive,
  heroOutcomeAllowed,
  joinEventRecruit,
  recruitPool,
  resolveGamble,
  rollEventMove,
  rollRecruits,
  statShiftAllowed,
} from '../../run/events';
import { freshRosterId } from '../../run/recruitment';
import { grantMove, MOVE_CAP, replaceableMoveIds } from '../../run/progression';
import { ROSTER_CAP, type RosterEntry, type RunState } from '../../run/state';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { entryStatTotals } from '../shared/entryStatTotals';
import { healCasterForEntry } from '../shared/healCaster';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MoveButtonReplica } from '../shared/MoveTile';
import {
  NodeHeader,
  NodeSky,
  NODE_TINT_ARCANE,
  NODE_TINT_GOLD,
  NODE_TINT_MANA,
  NODE_TINT_TEAL,
  NODE_TINT_VITAL,
} from '../shared/NodeStage';
import { passiveColor, PassiveGlyph } from '../shared/passiveIcons';
import { eventIcon } from './mapNodeArt';
import { StatGlyph, STAT_LABELS } from '../shared/StatBars';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';

interface Props {
  /** Rolled at node-select time (App.tsx) — see src/run/events.ts. */
  event: RunEventDefinition;
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** Loot hand-off to App.tsx's item gate. Advances the node itself — an alternative to onContinue. `base` carries a cost already paid. */
  onGrantEquipment: (itemIds: string[], base?: RunState) => void;
  /** A recruit has joined: App plays the fanfare. */
  onRecruited?: (heroId: string) => void;
  onContinue: () => void;
  /** Fixes what every option holds and how a gamble falls, so a resumed run meets the same (docs/save-system.md D2). */
  seed: number;
}

const TONE_TINT: Record<EventTone, string> = {
  gold: NODE_TINT_GOLD,
  arcane: NODE_TINT_ARCANE,
  teal: NODE_TINT_TEAL,
  vital: NODE_TINT_VITAL,
  mana: NODE_TINT_MANA,
};

/** One `discovery` sound in five keys, a whole tone either side of centre. */
const TONE_PITCH: Record<EventTone, number> = {
  gold: 1,
  arcane: 0.9,
  teal: 1.06,
  vital: 1.12,
  mana: 0.95,
};

/** A breath before the offer and roster arrive (ms). Short: the road scene has just typed the flavor line, and the header keeps it. */
const EVENT_BEAT_MS = 250;

/** What an outcome's contents rolled to, once, at mount — every option's, so a choice can show what it holds. */
interface Rolled {
  moveId?: string;
  loot: EquipmentDefinition[];
  recruits: RosterEntry[];
}

function rollContents(outcome: ResolvableOutcome, run: RunState): Rolled {
  if (outcome.kind === 'learnMove') return { moveId: rollEventMove(outcome.pool, moves), loot: [], recruits: [] };
  if (outcome.kind === 'loot') {
    return { loot: rollEquipmentDrops(outcome.count, rarityWeightsFor(run.actNumber, 'standard')), recruits: [] };
  }
  if (outcome.kind === 'recruit') {
    const ids = rollRecruits(run, outcome.pool, outcome.count, recruitPool(run, heroes));
    return { loot: [], recruits: ids.map((id) => eventRecruitEntry(run, heroes[id], freshRosterId(run, id))) };
  }
  return { loot: [], recruits: [] };
}

function shiftEntries(deltas: Partial<Record<StatKey, number>>): [StatKey, number][] {
  return Object.entries(deltas).filter(([, amount]) => !!amount) as [StatKey, number][];
}

/** True minus sign, not a hyphen — these sit next to a plus. */
function ShiftChips({ deltas, className }: { deltas: Partial<Record<StatKey, number>>; className?: string }) {
  return (
    <div className={`detail-modifier-list${className ? ` ${className}` : ''}`}>
      {shiftEntries(deltas).map(([stat, amount]) => (
        <span key={stat} className={`detail-modifier-chip ${amount > 0 ? 'stat-buff' : 'stat-debuff'}`}>
          <StatGlyph stat={stat} tone="inherit" /> {STAT_LABELS[stat]} {amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`}
        </span>
      ))}
    </div>
  );
}

function HeroOutcomeLine({ outcome }: { outcome: HeroOutcome }) {
  if (outcome.kind === 'statShift') return <ShiftChips deltas={outcome.deltas} />;
  const passive = passives[outcome.passiveId];
  return (
    <span className="event-passive-name" style={{ '--passive-color': passiveColor(passive.id) } as CSSProperties}>
      <PassiveGlyph passiveId={passive.id} />
      {passive.name}
    </span>
  );
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

function costLine(cost: EventCost | undefined): string | null {
  if (!cost) return null;
  const parts: string[] = [];
  if (cost.gold) parts.push(`Costs ${cost.gold} gold`);
  if (cost.woundAll) parts.push(`Everyone loses ${percent(cost.woundAll)} HP`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** An option's sub-line: what it holds, read off what was rolled. */
function optionSummary(outcome: ResolvableOutcome, rolled: Rolled): ReactNode {
  switch (outcome.kind) {
    case 'learnMove':
      return rolled.moveId ? `Learn ${moves[rolled.moveId].name}` : 'Nothing here after all';
    case 'statShift':
      return <ShiftChips deltas={outcome.deltas} className="event-option-chips" />;
    case 'grantPassive':
      return `Learn ${passives[outcome.passiveId].name}`;
    case 'loot':
      return `${rolled.loot.length} ${rolled.loot.length === 1 ? 'piece' : 'pieces'} of gear`;
    case 'recruit':
      return rolled.recruits.length > 0
        ? `${rolled.recruits.map((entry) => heroes[entry.heroId].name).join(' or ')} joins`
        : 'Nobody answers';
    case 'gamble':
      return `${percent(outcome.chance)} chance`;
    case 'curse':
      return `A curse: at Mastery ${curses[outcome.curseId].turnAt}, the ${curses[outcome.curseId].name}`;
  }
}

/** An option that would resolve onto nothing — an empty roll — is greyed rather than a dead end. */
function optionEmpty(outcome: ResolvableOutcome, rolled: Rolled): boolean {
  if (outcome.kind === 'learnMove') return !rolled.moveId;
  if (outcome.kind === 'recruit') return rolled.recruits.length === 0;
  return false;
}

// Branches on `outcome.kind`, never on an event id — a new branch means
// extending the vocabulary in src/data/events.ts, not adding a case here.
export function EventNodeScreen({ event, run, onRunChange, onGrantEquipment, onRecruited, onContinue, seed }: Props) {
  const isChoice = event.outcome.kind === 'choice';
  // As THIS act pays them: an event's stat gains grow with the act, as the Item Cache does (run/events.ts).
  const options: readonly EventOption[] = (
    event.outcome.kind === 'choice' ? event.outcome.options : [{ label: event.name, outcome: event.outcome, cost: event.cost }]
  ).map((option) => ({ ...option, outcome: outcomeForAct(option.outcome, run.actNumber) }));

  // Contents roll here, off the screen's seed: a reload rolls the same.
  const [rolls] = useState<Rolled[]>(() => withSeededRandom(seed, () => options.map((option) => rollContents(option.outcome, run))));
  /** The option being played out; a non-choice event is its own one option. */
  const [picked, setPicked] = useState<number | null>(isChoice ? null : 0);

  /** The roster hero this event resolved onto — also the "done" flag for hero-picking outcomes. */
  const [resolvedTo, setResolvedTo] = useState<string | null>(null);
  const [gambleResult, setGambleResult] = useState<'win' | 'lose' | null>(null);
  /** learnMove only: the at-cap hero weighing a swap. Null = the hero grid is showing. */
  const [swapping, setSwapping] = useState<string | null>(null);
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  /** recruit only, at the cap: the arriving hero, while the player names who leaves. */
  const [arriving, setArriving] = useState<RosterEntry | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [inspectItemId, setInspectItemId] = useState<string | null>(null);

  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    playSfx('discovery', { pitch: TONE_PITCH[event.tone] });
    if (prefersReducedMotion()) {
      setArrived(true);
      return;
    }
    const timer = window.setTimeout(() => setArrived(true), EVENT_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [event.tone]);

  const active = picked !== null ? options[picked] : null;
  const outcome = active?.outcome ?? null;
  const rolled = picked !== null ? rolls[picked] : null;
  const curse = outcome?.kind === 'curse' ? curses[outcome.curseId] : undefined;
  const offeredMove = curse ? moves[curse.moveId] : rolled?.moveId ? moves[rolled.moveId] : undefined;
  const grantedPassive = outcome?.kind === 'grantPassive' ? passives[outcome.passiveId] : undefined;
  const lootItems = rolled?.loot ?? [];
  const resolvedEntry = resolvedTo ? run.roster.find((r) => r.rosterId === resolvedTo) ?? null : null;
  const resolvedHero = resolvedEntry ? rosterHeroes[resolvedEntry.heroId] : null;
  const swappingEntry = swapping ? run.roster.find((r) => r.rosterId === swapping) ?? null : null;
  const swappingCaster = swappingEntry ? healCasterForEntry(rosterHeroes[swappingEntry.heroId], swappingEntry, run.relics) : undefined;

  const maxHpOf = (entry: RosterEntry) => entryStatTotals(rosterHeroes[entry.heroId], entry, run.relics).hp;

  /** Every resolution goes through here, so the option's cost lands in the same transform as its payoff. */
  function commit(next: RunState) {
    onRunChange(applyEventCost(next, active?.cost, maxHpOf));
  }

  function teach(rosterId: string, replaceMoveId?: string) {
    if (outcome?.kind === 'curse') {
      commit(applyCurse(run, rosterId, outcome.curseId, replaceMoveId));
      setResolvedTo(rosterId);
      setSwapping(null);
      setSelectedReplaceId(null);
      return;
    }
    if (!offeredMove) return;
    // grantMove, not grantLevelUpMove: an event's gift is not an offer out of the level-up
    // pool, so it must not spend one — swap it away later and it can still be offered.
    commit(grantMove(run, rosterId, offeredMove.id, replaceMoveId));
    setResolvedTo(rosterId);
    setSwapping(null);
    setSelectedReplaceId(null);
  }

  function recruit(entry: RosterEntry, terminatedRosterId?: string) {
    commit(joinEventRecruit(run, entry, terminatedRosterId));
    setResolvedTo(entry.rosterId);
    setArriving(null);
    setLeavingId(null);
    onRecruited?.(entry.heroId);
  }

  function handleHeroPick(entry: RosterEntry) {
    if (resolvedTo || !outcome) return;
    if (outcome.kind === 'learnMove') {
      if (entry.unlockedMoveIds.length >= MOVE_CAP) setSwapping(entry.rosterId);
      else teach(entry.rosterId);
      return;
    }
    if (outcome.kind === 'statShift') {
      commit(applyStatShift(run, entry.rosterId, outcome.deltas));
      setResolvedTo(entry.rosterId);
      return;
    }
    if (outcome.kind === 'grantPassive') {
      commit(grantEventPassive(run, entry.rosterId, outcome.passiveId, passives));
      setResolvedTo(entry.rosterId);
      return;
    }
    if (outcome.kind === 'curse') {
      // Only a hero the bite Turns on the spot learns the move now; the rest learn it at the Turn.
      const needsSwap = curseTurnsOnBite(entry, outcome.curseId) && !!offeredMove && !entry.unlockedMoveIds.includes(offeredMove.id) && entry.unlockedMoveIds.length >= MOVE_CAP;
      if (needsSwap) setSwapping(entry.rosterId);
      else teach(entry.rosterId);
      return;
    }
    if (outcome.kind === 'gamble') {
      const result = resolveGamble(outcome.chance, seededRandom(seed, 'gamble'));
      commit(applyHeroOutcome(run, entry.rosterId, result === 'win' ? outcome.win : outcome.lose, passives));
      setGambleResult(result);
      setResolvedTo(entry.rosterId);
    }
  }

  function handleRecruitPick(entry: RosterEntry) {
    if (resolvedTo) return;
    if (run.roster.length < ROSTER_CAP) recruit(entry);
    else setArriving(entry);
  }

  // A stat shift, and either branch of a gamble, is floored (src/run/events.ts MIN_HP_AFTER_SHIFT).
  // Relics are deliberately excluded from the HP floor: they are team-wide
  // and cannot change WHICH hero is eligible.
  function heroBlocked(entry: RosterEntry): boolean {
    if (!outcome) return false;
    const hp = entryStatTotals(rosterHeroes[entry.heroId], entry).hp;
    if (outcome.kind === 'statShift') return !statShiftAllowed(outcome.deltas, hp);
    if (outcome.kind === 'gamble') return !heroOutcomeAllowed(outcome.win, hp) || !heroOutcomeAllowed(outcome.lose, hp);
    return false;
  }

  function heroCta(entry: RosterEntry, blocked: boolean): ReactNode {
    if (resolvedTo === entry.rosterId) {
      if (outcome?.kind === 'statShift') return 'Traded';
      if (outcome?.kind === 'gamble') return gambleResult === 'win' ? 'Jackpot' : 'Won';
      if (outcome?.kind === 'curse') return entry.curseTurned ? 'Turned' : 'Bitten';
      return 'Learned';
    }
    if (blocked) return 'Too frail';
    if (outcome?.kind === 'learnMove') return entry.unlockedMoveIds.length >= MOVE_CAP ? 'Replace…' : 'Teach';
    if (outcome?.kind === 'statShift') return 'Trade';
    if (outcome?.kind === 'gamble') return 'Risk it';
    if (outcome?.kind === 'curse') return curseTurnsOnBite(entry, outcome.curseId) ? 'Turns now' : 'Choose';
    return 'Learn';
  }

  /** The ask, or what just happened. Never the flavor — that has its own line. */
  function readout(): ReactNode {
    if (!outcome) return 'Choose what to do, or walk on.';
    if (outcome.kind === 'recruit') {
      if (resolvedTo) {
        const joined = run.roster.find((r) => r.rosterId === resolvedTo);
        return joined ? `${heroes[joined.heroId].name} joins the pact.` : '';
      }
      if (arriving) return `${heroes[arriving.heroId].name} would join, but the roster is full. Choose who leaves — their gear goes with them.`;
      return rolled && rolled.recruits.length > 0 ? 'Choose who joins. Hold a hero to review its sheet.' : 'Nobody answers.';
    }
    if (resolvedHero) {
      if (outcome.kind === 'learnMove' && offeredMove) return `${resolvedHero.name} learned ${offeredMove.name}.`;
      if (outcome.kind === 'statShift') return `${resolvedHero.name} made the trade.`;
      if (outcome.kind === 'gamble') return gambleResult === 'win' ? `${resolvedHero.name} hit the jackpot.` : `${resolvedHero.name} took the smaller prize.`;
      if (outcome.kind === 'curse' && curse) return resolvedEntry?.curseTurned ? `${resolvedHero.name} Turns.` : `${resolvedHero.name} is bitten. At Mastery ${curse.turnAt}, it Turns.`;
      if (grantedPassive) return `${resolvedHero.name} learned ${grantedPassive.name}.`;
    }
    if (outcome.kind === 'learnMove') {
      return offeredMove ? 'Choose who learns it. Hold a hero to review its sheet.' : 'Nothing here after all.';
    }
    if (outcome.kind === 'statShift') return 'Choose who makes the trade. Hold a hero to review its sheet.';
    if (outcome.kind === 'grantPassive') return 'Choose who learns it. Hold a hero to review its sheet.';
    if (outcome.kind === 'gamble') return 'Choose who takes the chance. Hold a hero to review its sheet.';
    if (outcome.kind === 'curse') return 'Choose who it takes. Hold a hero to review its sheet.';
    return `${lootItems.length} ${lootItems.length === 1 ? 'piece' : 'pieces'} of gear. Take them, then place each one.`;
  }

  const heroPicking = outcome !== null && outcome.kind !== 'loot' && outcome.kind !== 'recruit';
  // A recruit can always be declined: walking past a stranger is never a dead end.
  const canContinue = outcome !== null && (outcome.kind === 'loot' || outcome.kind === 'recruit' || resolvedTo !== null);
  const cost = costLine(active?.cost);

  return (
    <div className="node-screen event-node-screen" style={{ '--node-rgb': TONE_TINT[event.tone] } as CSSProperties}>
      <NodeSky />
      <RosterPeek run={run} />

      {!swapping && (
        <NodeHeader
          compact={outcome?.kind !== 'statShift'}
          eyebrow={event.eyebrow}
          title={event.name}
          art={<img src={eventIcon(event.id)} className="event-art" alt="" draggable={false} />}
          readoutKey={arrived ? `${picked ?? 'choose'}:${resolvedTo ?? (arriving ? 'leaving' : 'idle')}` : 'arriving'}
          readoutLive={!!resolvedTo}
          /* Empty, not undefined, during the beat: NodeHeader reserves the readout's height. */
          readout={arrived ? readout() : ''}
        >
          <p className="event-flavor">{event.flavor}</p>

          {arrived && outcome?.kind === 'statShift' && (
            <div className="node-item-effects event-reveal-in">
              <ShiftChips deltas={outcome.deltas} />
            </div>
          )}
          {arrived && grantedPassive && (
            <div
              className="node-item-effects event-passive-offer event-reveal-in"
              style={{ '--passive-color': passiveColor(grantedPassive.id) } as CSSProperties}
            >
              <span className="event-passive-name">
                <PassiveGlyph passiveId={grantedPassive.id} />
                {grantedPassive.name}
              </span>
              <p className="event-passive-desc">{grantedPassive.description}</p>
            </div>
          )}
          {arrived && outcome?.kind === 'gamble' && (
            <div className="node-item-effects event-gamble event-reveal-in">
              <div className={`event-gamble-branch${gambleResult === 'lose' ? ' is-dimmed' : ''}`}>
                <span className="event-gamble-odds">{percent(outcome.chance)}</span>
                <HeroOutcomeLine outcome={outcome.win} />
              </div>
              <div className={`event-gamble-branch${gambleResult === 'win' ? ' is-dimmed' : ''}`}>
                <span className="event-gamble-odds">{percent(1 - outcome.chance)}</span>
                <HeroOutcomeLine outcome={outcome.lose} />
              </div>
            </div>
          )}
          {arrived && curse && (
            <div className="node-item-effects event-transform event-reveal-in">
              <p className="event-transform-line">
                The bite marks the hero. At <strong>Mastery {curse.turnAt}</strong> it Turns — at once, if it is already there:
              </p>
              <p className="event-transform-line">
                Pure {curse.types.join(' / ')}, a {Object.values(curse.baseStats).reduce((a, b) => a + b, 0)}-stat body, {offeredMove?.name}, and{' '}
                <strong>{passives[curse.passiveIds[0]]?.name}</strong> in place of its own innate.
              </p>
            </div>
          )}
          {arrived && cost && !resolvedTo && <p className="event-cost-line event-reveal-in">{cost}</p>}
        </NodeHeader>
      )}

      {/* --- choice: the options, and Leave --- */}
      {arrived && picked === null && (
        <div className="screen-scroll">
          <div className="stage-centered">
            <div className="event-options event-reveal-in">
              {options.map((option, index) => {
                const affordable = costAffordable(run, option.cost);
                const empty = optionEmpty(option.outcome, rolls[index]);
                const optionCost = costLine(option.cost);
                return (
                  <button
                    key={option.label}
                    className="moveoffer-button event-option"
                    disabled={!affordable || empty}
                    onClick={() => setPicked(index)}
                  >
                    <span className="moveoffer-label">{option.label}</span>
                    <span className="moveoffer-sub">{optionSummary(option.outcome, rolls[index])}</span>
                    {optionCost && <span className="moveoffer-sub event-option-cost">{affordable ? optionCost : `${optionCost} — not enough`}</span>}
                  </button>
                );
              })}
              <button className="moveoffer-button moveoffer-decline event-option" onClick={onContinue}>
                <span className="moveoffer-label">Leave</span>
                <span className="moveoffer-sub">Walk on</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- learnMove: the swap panel --- */}
      {swapping && swappingEntry && offeredMove ? (
        <div className="screen-scroll moveoffer-stage">
          <div className="stage-centered">
            <div className="reward-panel">
              <p className="offer-hero-sub">
                {rosterHeroes[swappingEntry.heroId].name} already knows {MOVE_CAP} moves — pick one to replace, or go back.
              </p>
              <div className="offer-move-highlight">
                <MoveDetailCard
                  move={offeredMove}
                  label="Offered by the event"
                  caster={swappingCaster}
                  rowHead
                />
              </div>
              <div className="offer-swap-arrow" aria-hidden="true">
                ↓ replaces one of
              </div>
              <div className="move-list offer-replace-list">
                {replaceableMoveIds(swappingEntry.unlockedMoveIds).map((moveId) => (
                  <MoveButtonReplica
                    key={moveId}
                    move={moves[moveId]}
                    selected={selectedReplaceId === moveId}
                    caster={swappingCaster}
                    onClick={() => setSelectedReplaceId(moveId)}
                  />
                ))}
              </div>
              <div className="reward-panel-actions moveoffer-actions">
                <button
                  className="moveoffer-button moveoffer-decline"
                  onClick={() => {
                    setSwapping(null);
                    setSelectedReplaceId(null);
                  }}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✕
                  </span>
                  <span className="moveoffer-label">Back</span>
                  <span className="moveoffer-sub">Pick a different hero</span>
                </button>
                <button
                  className="moveoffer-button moveoffer-confirm"
                  disabled={!selectedReplaceId}
                  onClick={() => selectedReplaceId && teach(swappingEntry.rosterId, selectedReplaceId)}
                >
                  <span className="moveoffer-icon" aria-hidden="true">
                    ✓
                  </span>
                  <span className="moveoffer-label">Replace</span>
                  <span className="moveoffer-sub">{selectedReplaceId ? moves[selectedReplaceId].name : 'Select a move'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* --- learnMove: the offered move --- */}
          {arrived && outcome?.kind === 'learnMove' && offeredMove && (
            <div className="event-offer-move event-reveal-in">
              <MoveDetailCard move={offeredMove} label="Offered by the event" rowHead />
            </div>
          )}

          {/* --- loot --- */}
          {/* The wrapper stays mounted through the beat: it is the only flex:1
              child on this path, and gating it collapsed the column. */}
          {outcome?.kind === 'loot' && (
            <div className="screen-scroll">
              <div className="stage-centered">
                {arrived && (
                  <div className="equip-cache-list">
                    {lootItems.map((item, i) => (
                      <EquipChoiceCard
                        key={item.id}
                        item={item}
                        onInspect={() => setInspectItemId(item.id)}
                        revealDelayMs={120 + i * 90}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- recruit: who joins, then (at the cap) who leaves --- */}
          {outcome?.kind === 'recruit' && rolled && !arriving && (
            <HeroPickGrid count={rolled.recruits.length} fill className={arrived ? 'is-waking' : 'is-asleep'}>
              {rolled.recruits.map((entry) => {
                const hero = heroes[entry.heroId];
                const joined = resolvedTo === entry.rosterId;
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    disabled={!arrived || (resolvedTo !== null && !joined)}
                    onActivate={() => handleRecruitPick(entry)}
                    onPreview={() => setPreviewEntry({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${event.name}`}
                    ctaClassName={joined ? 'is-done' : 'is-accent'}
                    cta={joined ? 'Joined' : 'Recruit'}
                  />
                );
              })}
            </HeroPickGrid>
          )}
          {outcome?.kind === 'recruit' && arriving && (
            <HeroPickGrid count={run.roster.length} fill columns={3} className="is-waking">
              {run.roster.map((entry) => {
                const hero = rosterHeroes[entry.heroId];
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    selected={leavingId === entry.rosterId}
                    onActivate={() => setLeavingId(entry.rosterId)}
                    onPreview={() => setPreviewEntry({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${levelOf(entry)} — leaves the pact`}
                    ctaClassName={leavingId === entry.rosterId ? 'is-danger' : undefined}
                    cta={leavingId === entry.rosterId ? 'Leaves' : 'Dismiss'}
                  />
                );
              })}
            </HeroPickGrid>
          )}

          {/* --- the hero grid ---
              Three columns, explicitly: the move on offer sits above this grid and takes half the
              stage, so the fill-aware default would pick two and squash the cards past what their
              content needs. */}
          {heroPicking && (
            <HeroPickGrid count={run.roster.length} fill columns={3} className={arrived ? 'is-waking' : 'is-asleep'}>
              {run.roster.map((entry) => {
                const hero = rosterHeroes[entry.heroId];
                const isResolved = resolvedTo === entry.rosterId;
                const blocked = heroBlocked(entry);
                return (
                  <HeroPickCard
                    key={entry.rosterId}
                    hero={hero}
                    entry={entry}
                    disabled={!arrived || (resolvedTo !== null && !isResolved) || blocked}
                    onActivate={() => handleHeroPick(entry)}
                    onPreview={() => setPreviewEntry({ hero, entry })}
                    ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${event.name}`}
                    ctaClassName={isResolved ? 'is-done' : 'is-accent'}
                    cta={heroCta(entry, blocked)}
                  />
                );
              })}
            </HeroPickGrid>
          )}
        </>
      )}

      {/* Disabled through the beat: a live Continue is an invitation to skip it. */}
      {!swapping && picked !== null && arriving && (
        <div className="reward-panel-actions moveoffer-actions event-leave-actions">
          <button
            className="moveoffer-button moveoffer-decline"
            onClick={() => {
              setArriving(null);
              setLeavingId(null);
            }}
          >
            <span className="moveoffer-label">Back</span>
            <span className="moveoffer-sub">Nobody leaves</span>
          </button>
          <button className="moveoffer-button moveoffer-confirm" disabled={!leavingId} onClick={() => leavingId && recruit(arriving, leavingId)}>
            <span className="moveoffer-label">Confirm</span>
            <span className="moveoffer-sub">
              {leavingId ? `${rosterHeroes[run.roster.find((r) => r.rosterId === leavingId)!.heroId].name} leaves` : 'Choose who leaves'}
            </span>
          </button>
        </div>
      )}
      {!swapping &&
        picked !== null &&
        !arriving &&
        (outcome?.kind === 'loot' ? (
          <button
            className="resolve-button"
            disabled={!arrived}
            onClick={() => onGrantEquipment(lootItems.map((i) => i.id), applyEventCost(run, active?.cost, maxHpOf))}
          >
            {lootItems.length > 0 ? `Take all ${lootItems.length}` : 'Continue'}
          </button>
        ) : isChoice && !resolvedTo ? (
          <button className="resolve-button event-back-button" disabled={!arrived} onClick={() => setPicked(null)}>
            Back
          </button>
        ) : (
          <button className="resolve-button" disabled={!arrived || !canContinue} onClick={onContinue}>
            Continue
          </button>
        ))}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}

      {inspectItemId &&
        (() => {
          const item = lootItems.find((i) => i.id === inspectItemId);
          return item ? <EquipInspectOverlay item={item} onClose={() => setInspectItemId(null)} /> : null;
        })()}
    </div>
  );
}
