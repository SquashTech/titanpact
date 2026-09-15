import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import type { EquipmentDefinition } from '../../run/equipment';
import { CONSUMABLE_NAMES, type ConsumableKind } from '../../run/consumables';
import { MAX_LEVEL, MAX_XP, levelForXp, levelOf, xpForLevel, xpProgress } from '../../run/growth';
import { WoundBar } from '../shared/WoundBar';
import type { RosterEntry } from '../../run/state';
import { ItemEffectChips, ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { ItemDetailOverlay } from '../shared/ItemDossier';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NODE_TINT_GOLD, NodeMotes } from '../shared/NodeStage';
import { prefersReducedMotion } from '../shared/reducedMotion';
import { ResourceGlyph } from '../shared/RunGlyph';
import { playXpBar, xpBarSegments, xpBarTickTimes, xpBarTotalMs } from '../shared/xpBar';
import { getTypeColor } from './typeColors';

/** A loss wears the enemy's red; a win, the run's gold — the Location's own tint stays on the field behind. */
const TINT_LOSS = '217, 83, 79';

/** The strike lands and is read before anything under it moves. */
const TITLE_HOLD_MS = 480;
/** A wave down the row rather than six bars in lockstep — small enough that they still read as ONE grant. */
const HERO_STAGGER_MS = 35;
const CAPTION_LEAD_MS = 60;
const LEDGER_LEAD_MS = 200;
const LEDGER_STAGGER_MS = 150;
const CTA_LEAD_MS = 180;

/** Gold counts up in the ledger the way a Cache does, at one strike a step until it has to stride. */
const COIN_TICK_MS = 50;
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
  /** XP this win pays every roster hero. How many levels that is, is each hero's own (run/growth.ts). */
  xpGained: number;
  /** The purse before this fight paid, so the ledger can show where it lands. */
  goldFrom: number;
  goldReward: number;
  equipmentReward: EquipmentDefinition | null;
  /** A potion drop (run/consumables.ts). Null on the common no-drop win. */
  consumableReward?: ConsumableKind | null;
  /**
   * Where each roster hero's HP stands going into the next node (run/wounds.ts) — the fielded
   * read off the fight's end, the reserve off what they were already carrying. Omit (a fight
   * outside a run) and no bar is drawn.
   */
  hpAfter?: ReadonlyMap<string, { hp: number; maxHp: number }>;
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
  xpGained,
  goldFrom,
  goldReward,
  equipmentReward,
  consumableReward = null,
  hpAfter,
  onContinue,
}: FightResultProps) {
  const won = outcome === 'win';
  const showParty = won && xpGained > 0 && roster.length > 0;
  // The same XP lands a different number of levels on each hero — a hero behind par climbs
  // further, one part-way to a level tops out sooner — so the bar count is per hero and the
  // caption reads the spread. The longest bar sets the clock.
  const fillsByHero = roster.map((entry) => levelsCrossed(entry, xpGained));
  const mostFills = Math.max(0, ...fillsByHero);
  const fewestFills = Math.min(mostFills, ...fillsByHero.filter((n) => n > 0));
  const barsByHero = roster.map((entry) => xpBarSegments(entry.xp, entry.xp + xpGained));
  const longestBar = barsByHero.reduce((best, bar) => (xpBarTotalMs(bar) > xpBarTotalMs(best) ? bar : best), barsByHero[0] ?? []);

  const ledger = useMemo(() => {
    const rows: { key: string; render: (shown: boolean) => ReactNode }[] = [];
    if (!won) return rows;
    if (goldReward > 0) rows.push({ key: 'gold', render: (shown) => <GoldRow from={goldFrom} amount={goldReward} shown={shown} /> });
    if (equipmentReward) rows.push({ key: 'item', render: () => <ItemRow item={equipmentReward} onInspect={() => setInspecting(true)} /> });
    if (consumableReward) rows.push({ key: 'potion', render: () => <PotionRow kind={consumableReward} /> });
    return rows;
  }, [won, goldFrom, goldReward, equipmentReward, consumableReward]);

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
      // event, and six pips inside 45ms is a machine. Timed off the longest bar; a hero on a
      // different footing ticks a beat off it, silently.
      xpBarTickTimes(longestBar).forEach((tick, level) => {
        at(t + tick, () => playSfx('xp.orb', { pitch: 1 + level * 0.12 }));
      });
      t += xpBarTotalMs(longestBar) + HERO_STAGGER_MS * (roster.length - 1) + CAPTION_LEAD_MS;
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
                  xp={xpGained}
                  fielded={fieldedIds.has(entry.rosterId)}
                  filling={stage >= STAGE_FILL && !landed && stage < STAGE_CAPTION}
                  landed={landed || stage >= STAGE_CAPTION}
                  hpAfter={hpAfter?.get(entry.rosterId)}
                />
              ))}
            </div>
            <div className="fight-result-captions">
              {/* The number itself, as the bars start: XP is what a fight pays, and the level is what
                  the cube makes of it per hero. */}
              <span className={`fight-result-xp-gain${stage >= STAGE_FILL ? ' is-shown' : ''}`}>+{xpGained} XP</span>
              <span className={`fight-result-caption${stage >= STAGE_CAPTION ? ' is-shown' : ''}`}>
                {mostFills === 0
                  ? roster.every((entry) => levelOf(entry) >= MAX_LEVEL)
                    ? 'Heroes at max'
                    : 'No level yet'
                  : `Heroes +${fewestFills === mostFills ? mostFills : `${fewestFills}–${mostFills}`} ${mostFills === 1 ? 'Level' : 'Levels'}`}
              </span>
            </div>
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

      {inspecting && <ItemDetailOverlay item={equipmentReward} onClose={() => setInspecting(false)} />}
    </div>
  );
}

interface MemberProps {
  entry: RosterEntry;
  index: number;
  xp: number;
  fielded: boolean;
  /** The bar is running its fills. */
  filling: boolean;
  /** Everything this hero gains is on screen, whether it animated there or was tapped there. */
  landed: boolean;
  hpAfter?: { hp: number; maxHp: number };
}

/** Levels `xp` more would cross for this hero — zero at the cap. */
function levelsCrossed(entry: RosterEntry, xp: number): number {
  return levelForXp(Math.min(MAX_XP, entry.xp + xp)) - levelOf(entry);
}

/**
 * One hero: the figure, its level, and the bar under it. The bar starts wherever this hero's XP
 * already stood in its level and sweeps to wherever the grant leaves it — through the top once
 * a level, ticking the badge on exactly the frame it does (shared/xpBar.ts). A grant that lands
 * no level still moves the bar; that partial IS the information.
 */
function PartyMember({ entry, index, xp, fielded, filling, landed, hpAfter }: MemberProps) {
  const definition = rosterHeroes[entry.heroId];
  const [fills, setFills] = useState(0);
  const fillRef = useRef<HTMLElement>(null);
  const segments = useMemo(() => xpBarSegments(entry.xp, entry.xp + xp), [entry.xp, xp]);

  useEffect(() => {
    const fill = fillRef.current;
    if (!filling || landed || !fill || segments.length === 0) return;
    return playXpBar(fill, segments, index * HERO_STAGGER_MS, (n) => setFills(n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filling, landed]);

  // Tapped through: whatever was mid-sweep gives way to the resting width.
  useEffect(() => {
    if (landed) fillRef.current?.getAnimations().forEach((a) => a.cancel());
  }, [landed]);

  if (!definition) return null;

  const fromLevel = levelOf(entry);
  const toXp = Math.min(MAX_XP, entry.xp + xp);
  const fillsToRun = levelsCrossed(entry, xp);
  const toLevel = fromLevel + fillsToRun;
  const capped = fromLevel >= MAX_LEVEL;
  const shownFills = landed ? fillsToRun : Math.min(fills, fillsToRun);
  const shownLevel = fromLevel + shownFills;
  const restingWidth = landed || segments.length === 0 ? xpProgress(toXp) : xpProgress(entry.xp);
  const nextCost = toLevel >= MAX_LEVEL ? null : xpForLevel(toLevel + 1);

  return (
    <div
      className={`fight-result-hero${fielded ? '' : ' is-reserve'}${capped ? ' is-capped' : ''}${landed || capped ? ' is-done' : ''}`}
      style={
        {
          '--plate-color': getTypeColor(definition.types[0]),
          '--hero-delay': `${index * HERO_STAGGER_MS}ms`,
        } as CSSProperties
      }
      title={`${definition.name} — Level ${fromLevel}${capped ? ' (max)' : ` → ${toLevel}`}${nextCost ? ` · ${toXp} / ${nextCost} XP` : ''}`}
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
        <i ref={fillRef} className="fight-result-xp-fill" style={{ width: `${restingWidth * 100}%` }} />
      </span>

      {/* What the fight left, under what it paid: HP carries to the next node (run/wounds.ts). */}
      {hpAfter && <WoundBar hp={hpAfter.hp} maxHp={hpAfter.maxHp} className="fight-result-hp" />}

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

function PotionRow({ kind }: { kind: ConsumableKind }) {
  return (
    <div className="fight-result-row">
      <span className={`fight-result-row-glyph is-${kind}`}>
        <ResourceGlyph kind={kind} />
      </span>
      <span className="fight-result-row-text">
        <span className="fight-result-row-label">{CONSUMABLE_NAMES[kind]}</span>
        <span className="fight-result-row-sub">{kind === 'hpPotion' ? 'Restores half of max HP' : 'Restores half of max Mana'}</span>
      </span>
      <span className="fight-result-row-value">+1</span>
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
