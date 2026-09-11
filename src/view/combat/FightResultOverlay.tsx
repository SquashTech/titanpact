import { useEffect, useMemo, useState, type AnimationEvent, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import type { EquipmentDefinition } from '../../run/equipment';
import { MAX_LEVEL } from '../../run/growth';
import type { RosterEntry } from '../../run/state';
import { ItemEffectChips, ItemPiece, ItemSummaryPopup, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NODE_TINT_GOLD, NodeMotes } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { ResourceGlyph } from '../shared/RunGlyph';
import { getTypeColor } from './typeColors';

/** A loss wears the enemy's red; a win, the run's gold — the Location's own tint stays on the field behind. */
const TINT_LOSS = '217, 83, 79';

/** The strike lands and is read before anything under it moves. */
const TITLE_HOLD_MS = 640;
/** One level's worth of bar. Roster-wide, so every bar runs the same clock. */
const FILL_MS = 620;
/** A wave down the row rather than six bars in lockstep — small enough that they still read as ONE grant. */
const HERO_STAGGER_MS = 45;
const CAPTION_LEAD_MS = 90;
const LEDGER_LEAD_MS = 280;
const LEDGER_STAGGER_MS = 200;
const CTA_LEAD_MS = 260;

/** Gold counts up in the ledger the way a Cache does, at one strike a step until it has to stride. */
const COIN_TICK_MS = 60;
const COIN_MAX_TICKS = 12;

const STAGE_TITLE = 0;
const STAGE_FILL = 1;
const STAGE_CAPTION = 2;
const STAGE_LEDGER = 3;

export interface FightResultProps {
  outcome: 'win' | 'loss';
  roundsFought: number;
  /** The whole roster, in roster order — the same order the level-up report will list it in. */
  roster: readonly RosterEntry[];
  /** Roster ids that took the field. The rest are the reserve, and level all the same. */
  fieldedIds: ReadonlySet<string>;
  levelsGained: number;
  /** The purse before this fight paid, so the ledger can show where it lands. */
  goldFrom: number;
  goldReward: number;
  scrollReward: number;
  equipmentReward: EquipmentDefinition | null;
  onContinue: () => void;
}

/**
 * The fight's result, over the dimmed field. A sequence rather than a card: the strike, then
 * the roster's bars filling once per level — which is what makes the stat sheet on the next
 * screen read as the consequence of THIS fight rather than as a grant from nowhere — then the
 * ledger, then the way out. Every beat is timed, and a tap anywhere lands all of them: this
 * plays after every won fight, so waiting it out must never be the only way through.
 *
 * Nothing here is boxed but the item chit, which is the one thing that can be tapped for more
 * (docs/visual-language.md, "a rectangle means you can act on this").
 */
export function FightResultOverlay({
  outcome,
  roundsFought,
  roster,
  fieldedIds,
  levelsGained,
  goldFrom,
  goldReward,
  scrollReward,
  equipmentReward,
  onContinue,
}: FightResultProps) {
  const won = outcome === 'win';
  const showParty = won && levelsGained > 0 && roster.length > 0;

  const ledger = useMemo(() => {
    const rows: { key: string; render: (shown: boolean) => ReactNode }[] = [];
    if (!won) return rows;
    if (goldReward > 0) rows.push({ key: 'gold', render: (shown) => <GoldRow from={goldFrom} amount={goldReward} shown={shown} /> });
    if (scrollReward > 0) rows.push({ key: 'scroll', render: () => <ScrollRow amount={scrollReward} /> });
    if (equipmentReward) rows.push({ key: 'item', render: () => <ItemRow item={equipmentReward} onInspect={() => setInspecting(true)} /> });
    return rows;
  }, [won, goldFrom, goldReward, scrollReward, equipmentReward]);

  const stageDone = STAGE_LEDGER + ledger.length;
  const [stage, setStage] = useState(() => (prefersReducedMotion() ? stageDone : STAGE_TITLE));
  const landed = stage >= stageDone;
  // Held here and drawn at the root: a ledger row is mid-animation on transform, which would
  // pin the popup's fixed scrim to the row instead of the screen.
  const [inspecting, setInspecting] = useState(false);

  useEffect(() => {
    playSfx(won ? 'victory' : 'defeat');
    if (prefersReducedMotion() || !won) {
      setStage(stageDone);
      return;
    }
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    let t = TITLE_HOLD_MS;
    if (showParty) {
      at(t, () => setStage((s) => Math.max(s, STAGE_FILL)));
      // One pip a level for the whole roster, not one a hero: six bars landing together is one
      // event, and six pips inside 45ms is a machine.
      for (let level = 0; level < levelsGained; level++) {
        at(t + FILL_MS * (level + 1), () => playSfx('xp.orb', { pitch: 1 + level * 0.12 }));
      }
      t += FILL_MS * levelsGained + HERO_STAGGER_MS * (roster.length - 1) + CAPTION_LEAD_MS;
      at(t, () => setStage((s) => Math.max(s, STAGE_CAPTION)));
    }
    t += LEDGER_LEAD_MS;
    ledger.forEach((_, i) => {
      at(t + i * LEDGER_STAGGER_MS, () => setStage((s) => Math.max(s, STAGE_LEDGER + i + 1)));
    });
    t += ledger.length * LEDGER_STAGGER_MS + CTA_LEAD_MS;
    at(t, () => setStage(stageDone));
    return () => timers.forEach(window.clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`fight-result ${won ? 'is-win' : 'is-loss'}${landed ? ' is-landed' : ''}`}
      style={{ '--node-rgb': won ? NODE_TINT_GOLD : TINT_LOSS } as CSSProperties}
      onClick={() => setStage(stageDone)}
    >
      <div className="fight-result-veil" aria-hidden="true" />
      {won && <NodeMotes count={10} />}

      <div className="fight-result-body">
        <header className="fight-result-banner">
          {won && <span className="fight-result-flash" aria-hidden="true" />}
          {won && <span className="fight-result-rays" aria-hidden="true" />}
          <h2 className="fight-result-title" data-text={won ? 'Victory!' : 'Defeat'}>
            <span className="fight-result-title-glow" aria-hidden="true">
              {won ? 'Victory!' : 'Defeat'}
            </span>
            {won ? 'Victory!' : 'Defeat'}
          </h2>
          <span className="fight-result-sub">
            {won ? 'Won' : 'Fell'} in {roundsFought} {roundsFought === 1 ? 'round' : 'rounds'}
          </span>
        </header>

        {showParty && (
          <section className={`fight-result-party${stage >= STAGE_FILL ? ' is-filling' : ''}`}>
            <div className="fight-result-party-row" style={{ '--party-size': roster.length } as CSSProperties}>
              {roster.map((entry, i) => (
                <PartyMember
                  key={entry.rosterId}
                  entry={entry}
                  index={i}
                  levels={levelsGained}
                  fielded={fieldedIds.has(entry.rosterId)}
                  filling={stage >= STAGE_FILL && !landed && stage < STAGE_CAPTION}
                  landed={landed || stage >= STAGE_CAPTION}
                />
              ))}
            </div>
            <span className={`fight-result-caption${stage >= STAGE_CAPTION ? ' is-shown' : ''}`}>
              Whole roster +{levelsGained} {levelsGained === 1 ? 'Level' : 'Levels'}
            </span>
          </section>
        )}

        {ledger.length > 0 && (
          <section className="fight-result-ledger">
            {ledger.map((row, i) => {
              const shown = stage >= STAGE_LEDGER + i + 1;
              return (
                <div key={row.key} className={`fight-result-ledger-slot${shown ? ' is-shown' : ''}`}>
                  {row.render(shown)}
                </div>
              );
            })}
          </section>
        )}
      </div>

      <button
        className={`resolve-button fight-result-cta${landed ? ' is-lit' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onContinue();
        }}
      >
        Continue
      </button>

      {inspecting && <ItemSummaryPopup item={equipmentReward} onClose={() => setInspecting(false)} />}
    </div>
  );
}

interface MemberProps {
  entry: RosterEntry;
  index: number;
  levels: number;
  fielded: boolean;
  /** The bar is running its fills. */
  filling: boolean;
  /** Everything this hero gains is on screen, whether it animated there or was tapped there. */
  landed: boolean;
}

/**
 * One hero: the figure, its level, and the bar under it. The bar is a CSS animation iterated
 * once a level, and each iteration boundary ticks the badge — so the number climbs on exactly
 * the frame the bar tops out, without a timer per hero per level.
 */
function PartyMember({ entry, index, levels, fielded, filling, landed }: MemberProps) {
  const definition = heroes[entry.heroId];
  const [fills, setFills] = useState(0);
  if (!definition) return null;

  const toLevel = Math.min(MAX_LEVEL, entry.level + levels);
  const fillsToRun = toLevel - entry.level;
  const capped = fillsToRun <= 0;
  const shownFills = landed ? fillsToRun : Math.min(fills, fillsToRun);
  const shownLevel = entry.level + shownFills;
  const barDone = capped || landed || shownFills >= fillsToRun;

  const onFillEvent = (e: AnimationEvent<HTMLElement>) => {
    if (e.animationName !== 'fight-result-xp-fill') return;
    setFills((n) => Math.min(fillsToRun, n + 1));
  };

  return (
    <div
      className={`fight-result-hero${fielded ? '' : ' is-reserve'}${capped ? ' is-capped' : ''}${barDone ? ' is-done' : ''}`}
      style={
        {
          '--plate-color': getTypeColor(definition.types[0]),
          '--hero-delay': `${index * HERO_STAGGER_MS}ms`,
        } as CSSProperties
      }
      title={`${definition.name} — Level ${entry.level}${capped ? ' (max)' : ` → ${toLevel}`}`}
    >
      <div className="fight-result-figure">
        {shownFills > 0 && !landed && <span key={shownFills} className="fight-result-figure-bloom" aria-hidden="true" />}
        <HeroPortrait heroId={definition.id} className="fight-result-portrait" />
      </div>

      <span className="fight-result-lv">
        {capped ? (
          <span className="fight-result-lv-max">Max</span>
        ) : (
          <>
            <span className="fight-result-lv-word">Lv</span>
            <span key={shownFills} className={`fight-result-lv-num${shownFills > 0 ? ' is-struck' : ''}`}>
              {shownLevel}
            </span>
          </>
        )}
      </span>

      <span className="fight-result-xp" aria-hidden="true">
        {!capped && filling && !barDone && (
          <i
            className="fight-result-xp-fill is-running"
            style={{ '--fills': fillsToRun } as CSSProperties}
            onAnimationIteration={onFillEvent}
            onAnimationEnd={onFillEvent}
          />
        )}
        {(capped || barDone) && <i className="fight-result-xp-fill is-full" />}
      </span>

      {!fielded && <span className="fight-result-reserve-tag">Reserve</span>}
    </div>
  );
}

/** Runs 0 up to `amount`, one coin-strike a step. */
function useCoinCount(amount: number, active: boolean): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? amount : 0));

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setShown(amount);
      return;
    }
    const steps = Math.max(1, Math.min(COIN_MAX_TICKS, amount));
    let step = 0;
    const interval = window.setInterval(() => {
      step += 1;
      setShown(Math.round((amount * step) / steps));
      playSfx('gold.coin', { pitch: 1 + step * 0.04 });
      if (step >= steps) {
        window.clearInterval(interval);
        playSfx('gold.purse', { delay: 0.05 });
      }
    }, COIN_TICK_MS);
    return () => window.clearInterval(interval);
  }, [amount, active]);

  return active ? shown : 0;
}

/** The count starts when the row lands, not when the overlay does — so it is heard where it is seen. */
function GoldRow({ from, amount, shown }: { from: number; amount: number; shown: boolean }) {
  const counted = useCoinCount(amount, shown);
  const settled = counted >= amount;
  return (
    <div className={`fight-result-row${settled ? ' is-settled' : ''}`}>
      <span className="fight-result-row-glyph">
        <ResourceGlyph kind="gold" />
      </span>
      <span className="fight-result-row-text">
        <span className="fight-result-row-label">Gold</span>
        <span className="fight-result-row-sub">Purse {from + counted}g</span>
      </span>
      <span className="fight-result-row-value">+{counted}g</span>
    </div>
  );
}

function ScrollRow({ amount }: { amount: number }) {
  return (
    <div className="fight-result-row">
      <span className="fight-result-row-glyph is-scroll">
        <ResourceGlyph kind="scroll" />
      </span>
      <span className="fight-result-row-text">
        <span className="fight-result-row-label">Mastery {amount === 1 ? 'Scroll' : 'Scrolls'}</span>
        <span className="fight-result-row-sub">Teaches a move</span>
      </span>
      <span className="fight-result-row-value">+{amount}</span>
    </div>
  );
}

/** The drop, as the chit it will be on the roster; a tap opens the full readout. */
function ItemRow({ item, onInspect }: { item: EquipmentDefinition; onInspect: () => void }) {
  return (
    <div className="fight-result-row is-item" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}>
      <button
        type="button"
        className="item-box filled fight-result-chit"
        aria-label={`${item.name}, ${RARITY_LABELS[item.rarity]}`}
        onClick={(e) => {
          e.stopPropagation();
          onInspect();
        }}
      >
        <ItemPiece item={item} />
      </button>
      <span className="fight-result-row-text">
        <span className="fight-result-row-label fight-result-item-name">{item.name}</span>
        <span className="fight-result-row-chips">
          <ItemEffectChips item={item} />
        </span>
      </span>
      <span className="fight-result-row-value fight-result-rarity">{RARITY_LABELS[item.rarity]}</span>
    </div>
  );
}
