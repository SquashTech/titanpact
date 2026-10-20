import { createCombatant, effectiveTypes, getMaxHp, getMaxMana, moveForHero, type Combatant, type Side } from '../../engine/state';
import { ConsoleGlyph } from '../combat/consoleGlyphs';
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { HeroDefinition, MoveDefinition } from '../../engine/content';
import { resolveTypeMult } from '../../engine/damage/typeMult';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { fieldEffects } from '../../data/fieldEffects';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import { isHallScene, type TipHallScene, type TipPicture, type TipScene as Scene, type TipSceneCallout, type TipSceneFighter } from '../../data/tipScenes';
import { createRosterEntry, createRunState, type RunState } from '../../run/state';
import { xpForLevel } from '../../run/growth';
import { rosterHeroes } from '../../data/content';
import { entryHp } from '../shared/WoundBar';
import { GuildHallPanel } from './GuildHallPanel';
import { GearCounter, GemCounter } from './HallCounters';
import { HallSigns } from './guildHallArt';
import { CombatantCard } from '../combat/CombatantCard';
import { getTypeColorRgb } from '../combat/typeColors';
import { MoveButtonReplica } from '../shared/MoveTile';
import { ResourceGlyph } from '../shared/RunGlyph';
import { Coin } from '../shared/Coin';
import { FieldGlyph } from '../shared/fieldIcons';
import { moveKindGlyph } from '../shared/moveKind';

/** A scene's fighters are full-strength level-5 heroes unless the scene says otherwise. */
const SCENE_LEVEL = 5;

interface Built {
  hero: HeroDefinition;
  combatant: Combatant;
  level: number;
}

function build(fighter: TipSceneFighter, id: string, side: Side): Built | null {
  const hero = allCombatants[fighter.heroId];
  if (!hero) return null;
  const combatant = createCombatant(id, hero.id, side, 0, 0);
  combatant.statStages = { ...(fighter.stages ?? {}) };
  combatant.currentHp = Math.round(getMaxHp(hero, combatant) * (fighter.hp ?? 1));
  combatant.currentMana = Math.round(getMaxMana(hero, combatant) * (fighter.mana ?? 1));
  return { hero, combatant, level: fighter.level ?? SCENE_LEVEL };
}

const HALL_SIGNS = [
  { id: 'tavern', label: 'Tavern' },
  { id: 'gems', label: 'Gems' },
  { id: 'gear', label: 'Gear' },
] as const;

const noop = () => {};

/** The made-up visit a hall scene stands on: its roster, its purse, nothing else. */
function stagedRun(scene: TipHallScene): RunState {
  const run = createRunState(scene.gold, 1);
  run.roster = scene.roster
    .filter((h) => rosterHeroes[h.heroId])
    .map((h, i) => {
      const hero = rosterHeroes[h.heroId];
      const entry = createRosterEntry(`scene-${i}`, hero.id, hero.moveIds);
      entry.xp = xpForLevel(SCENE_LEVEL);
      entry.mastery = h.mastery ?? 0;
      entry.equipment = [...(h.items ?? [])];
      if (h.wounded) entry.wounds = Math.round(entryHp(hero, entry, run.relics).maxHp * h.wounded);
      return entry;
    });
  return run;
}

/** A Guild Hall counter mid-visit, drawn by the hall's own panel. */
function HallScene({ scene }: { scene: TipHallScene }) {
  const run = stagedRun(scene);
  const classes = ['tip-scene', 'is-hall', `is-${scene.hall}`, ...(scene.focus ?? []).map((f) => `focus-${f}`)];
  return (
    <div className={classes.join(' ')} aria-hidden="true">
      <div className="tip-scene-hall">
        {scene.hall === 'tavern' && (
          <GuildHallPanel
            run={run}
            offers={{ heroOfferIds: (scene.hires ?? []).map((id) => `guild-${id}`), itemIds: [], gems: [] }}
            tab="tavern"
            gemsBought={[]}
            called={false}
            callTypes={[]}
            itemsBought={[]}
            onRunChange={noop}
            onBuyGem={() => null}
            onGemPlaced={noop}
            onBuyItem={() => null}
            onCall={() => null}
            onBuyMend={noop}
            onRequestRosterReplace={noop}
          />
        )}
        {scene.hall === 'gems' && (
          <GemCounter run={run} gems={scene.gems ?? []} sold={[]} onBuy={() => null} onPlaced={noop} initialPick={scene.pick} />
        )}
        {scene.hall === 'gear' && <GearCounter run={run} itemIds={scene.items ?? []} sold={[]} onBuy={() => null} initialPick={scene.pick} />}
      </div>
      <HallSigns tabs={HALL_SIGNS} active={scene.hall} onSelect={noop} />
    </div>
  );
}

/** Each callout's mark on the move row, and whether its label sits above the row or below it. */
const CALLOUT_PARTS: Readonly<Record<TipSceneCallout, { selector: string; band: 'above' | 'below' }>> = {
  mana: { selector: '.mana-gem', band: 'above' },
  type: { selector: '.move-type-code', band: 'above' },
  kind: { selector: '.move-stub-glyph', band: 'above' },
  power: { selector: '.move-stub-value', band: 'below' },
  matchup: { selector: '.move-seats', band: 'below' },
};

const KIND_NAMES: Readonly<Record<string, string>> = { physical: 'Physical', magical: 'Magical', buff: 'Buff', debuff: 'Debuff', heal: 'Heal' };

function calloutLabel(part: TipSceneCallout, move: MoveDefinition): string {
  if (part === 'mana') return 'Mana';
  if (part === 'type') return 'Type';
  if (part === 'kind') return KIND_NAMES[moveKindGlyph(move)] ?? 'Kind';
  if (part === 'power') return 'Power';
  return 'Matchup';
}

interface PlacedCallout {
  part: TipSceneCallout;
  label: string;
  /** The ringed mark, in the scene's own px. */
  ring: { x: number; y: number; w: number; h: number };
  /** The label's centre. */
  at: { x: number; y: number };
}

/** Labels never closer than this, centre to centre, in a band. */
const LABEL_GAP = 62;
const LABEL_EDGE = 30;

/**
 * Measures the first focus row's marks inside `root` and lays a label for each in the band above
 * or below the row, pushed apart so none overlaps and none leaves the frame.
 */
function useCallouts(root: RefObject<HTMLDivElement | null>, callouts: readonly TipSceneCallout[] | undefined, move: MoveDefinition | null): PlacedCallout[] {
  const [placed, setPlaced] = useState<PlacedCallout[]>([]);
  const key = callouts?.join('|') ?? '';
  useLayoutEffect(() => {
    const el = root.current;
    const row = el?.querySelector('.tip-scene-row.is-focus-row .move-button');
    if (!el || !row || !callouts || !move) {
      setPlaced([]);
      return;
    }
    const box = el.getBoundingClientRect();
    // The tip sits inside the scaled canvas: client px back to the scene's own.
    const scale = el.offsetWidth / (box.width || 1);
    const local = (r: DOMRect) => ({ x: (r.left - box.left) * scale, y: (r.top - box.top) * scale, w: r.width * scale, h: r.height * scale });
    const rowBox = local(row.getBoundingClientRect());
    const found = callouts.flatMap((part) => {
      const mark = row.querySelector(CALLOUT_PARTS[part].selector);
      return mark ? [{ part, ring: local(mark.getBoundingClientRect()) }] : [];
    });
    const out: PlacedCallout[] = [];
    for (const band of ['above', 'below'] as const) {
      const inBand = found.filter((f) => CALLOUT_PARTS[f.part].band === band).sort((a, b) => a.ring.x - b.ring.x);
      const xs = inBand.map((f) => f.ring.x + f.ring.w / 2);
      for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + LABEL_GAP);
      const width = el.offsetWidth;
      const over = (xs[xs.length - 1] ?? 0) - (width - LABEL_EDGE);
      if (over > 0) for (let i = xs.length - 1; i >= 0; i--) xs[i] = Math.min(xs[i], (xs[i + 1] ?? width - LABEL_EDGE + LABEL_GAP) - LABEL_GAP);
      const y = band === 'above' ? rowBox.y - 18 : rowBox.y + rowBox.h + 18;
      inBand.forEach((f, i) => out.push({ part: f.part, label: calloutLabel(f.part, move), ring: f.ring, at: { x: Math.max(LABEL_EDGE, xs[i]), y } }));
    }
    setPlaced(out);
    // Keyed on the joined callouts and the move: a fresh array with the same contents is no change.
  }, [key, move?.id]);
  return placed;
}

/** Each named mark ringed, a line from it to its label. */
function CalloutLayer({ placed }: { placed: readonly PlacedCallout[] }) {
  if (placed.length === 0) return null;
  return (
    <>
      <svg className="tip-callout-lines" aria-hidden="true">
        {placed.map(({ part, ring, at }) => {
          const above = at.y < ring.y;
          return (
            <g key={part}>
              <rect className="tip-callout-ring" x={ring.x - 2} y={ring.y - 2} width={ring.w + 4} height={ring.h + 4} rx="4" />
              <line className="tip-callout-leader" x1={at.x} y1={at.y + (above ? 8 : -8)} x2={ring.x + ring.w / 2} y2={above ? ring.y - 2 : ring.y + ring.h + 2} />
            </g>
          );
        })}
      </svg>
      {placed.map(({ part, label, at }) => (
        <span key={part} className={`tip-callout is-${part}`} style={{ left: at.x, top: at.y }}>
          {label}
        </span>
      ))}
    </>
  );
}

/** Whichever picture a tip page carries. */
export function TipPictureView({ scene }: { scene: TipPicture }) {
  return isHallScene(scene) ? <HallScene scene={scene} /> : <TipScene scene={scene} />;
}

/**
 * A fight tip's picture (docs/tutorial.md "Scenes"): a staged board drawn with the fight's own
 * figure, move row and command bar, so it reads exactly as the screen it explains. Inert — a tap
 * anywhere on it turns the tip's page. The ring is CSS, keyed off `focus-*` classes on the root.
 */
export function TipScene({ scene }: { scene: Scene }) {
  const root = useRef<HTMLDivElement>(null);
  const hero = build(scene.hero, 'scene-hero', 'A');
  const calledId = scene.callouts ? (scene.focusMoves?.[0] ?? scene.moves?.[0]) : undefined;
  const called = hero && calledId && moves[calledId] ? moveForHero(moves[calledId], hero.hero) : null;
  const placed = useCallouts(root, scene.callouts, called);
  if (!hero) return null;
  const foes = (scene.foes ?? []).map((f, i) => build(f, `scene-foe-${i}`, 'B')).filter((f): f is Built => f !== null);
  const caster = { wisdom: hero.hero.baseStats.wisdom, types: hero.hero.types };
  const focusRows = scene.focusMoves;
  const classes = ['tip-scene', ...(scene.focus ?? []).map((f) => `focus-${f}`), ...(scene.callouts ? ['has-callouts'] : [])];

  return (
    <div ref={root} className={classes.join(' ')} aria-hidden="true">
      {foes.length > 0 && (
        <div className="team-row enemy tip-scene-foes">
          {foes.map(({ hero: h, combatant, level }) => (
            <CombatantCard key={combatant.combatantId} hero={h} combatant={combatant} level={level} />
          ))}
        </div>
      )}

      {scene.heroFigure && (
        <div className="team-row ally tip-scene-hero">
          <CombatantCard hero={hero.hero} combatant={hero.combatant} level={hero.level} />
        </div>
      )}

      {scene.field && fieldEffects[scene.field] && (
        <span
          className="field-effect-badge"
          style={{ '--field-effect-rgb': getTypeColorRgb(fieldEffects[scene.field].flavorType ?? 'Arcane') } as CSSProperties}
        >
          <FieldGlyph fieldEffectId={scene.field} className="field-effect-glyph" />
          <span className="field-effect-name">{fieldEffects[scene.field].name}</span>
          <span className="field-effect-pips">
            {Array.from({ length: FIELD_EFFECT_DURATION_ROUNDS }, (_, i) => (
              <span key={i} className={`field-effect-pip${i < 3 ? '' : ' spent'}`} />
            ))}
          </span>
        </span>
      )}

      {scene.rest && (
        <div className="move-list">
          <div className="tip-scene-row is-focus-row">
            <button type="button" className="move-button rest-move">
              <div className="move-row-top">
                <span className="rest-move-gem" aria-hidden="true">
                  ☾
                </span>
                <span className="move-name">Rest</span>
              </div>
              <div className="move-row-effect">
                <span className="move-effect-text">Recovers all Mana, but skips the turn</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {scene.moves && scene.moves.length > 0 && (
        <div className="move-list">
          {scene.moves.map((id) => {
            const authored = moves[id];
            if (!authored) return null;
            const move = moveForHero(authored, hero.hero);
            const seats =
              move.kind === 'damage' && foes.length > 0
                ? foes.map(({ hero: h, combatant }) => resolveTypeMult(typeChart, move.type, effectiveTypes(h, combatant)))
                : undefined;
            const tag = scene.tags?.[id];
            return (
              <div key={id} className={`tip-scene-row${!focusRows || focusRows.includes(id) ? ' is-focus-row' : ''}`}>
                <MoveButtonReplica
                  move={move}
                  caster={caster}
                  matchups={seats}
                  tag={tag ? <span className="tip-scene-tag">{tag}</span> : undefined}
                />
              </div>
            );
          })}
        </div>
      )}

      {scene.bar && (
        <div className="bottom-bar tip-scene-bar">
          <span className="bottom-action bottom-action-primary bottom-action-back">
            <span className="bottom-action-glyph"><ConsoleGlyph kind="back" /></span>
            Back
          </span>
          <span className="bottom-action bottom-action-primary bottom-action-switch">
            <span className="bottom-action-glyph">⇄</span>
            Switch
          </span>
          <span className="bottom-action bottom-action-primary bottom-action-rest">
            <span className="bottom-action-glyph">☾</span>
            Rest
          </span>
          <span className="bottom-action bottom-action-primary bottom-action-bag">
            <span className="bottom-action-glyph bottom-action-bag-coin">
              <Coin />
              <ResourceGlyph kind="hpPotion" tone="inherit" className="bottom-action-bag-glyph" />
              <span className="bottom-action-bag-count">2</span>
            </span>
            Bag
          </span>
        </div>
      )}
      <CalloutLayer placed={placed} />
    </div>
  );
}
