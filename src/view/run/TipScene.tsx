import { createCombatant, effectiveTypes, getMaxHp, getMaxMana, moveForHero, type Combatant, type Side } from '../../engine/state';
import type { CSSProperties } from 'react';
import type { HeroDefinition } from '../../engine/content';
import { resolveTypeMult } from '../../engine/damage/typeMult';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { fieldEffects } from '../../data/fieldEffects';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import { isHallScene, type TipHallScene, type TipPicture, type TipScene as Scene, type TipSceneFighter } from '../../data/tipScenes';
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

/** A scene's fighters are full-strength level-5 heroes unless the scene says otherwise. */
const SCENE_LEVEL = 5;

interface Built {
  hero: HeroDefinition;
  combatant: Combatant;
}

function build(fighter: TipSceneFighter, id: string, side: Side): Built | null {
  const hero = allCombatants[fighter.heroId];
  if (!hero) return null;
  const combatant = createCombatant(id, hero.id, side, 0, 0);
  combatant.statStages = { ...(fighter.stages ?? {}) };
  combatant.currentHp = Math.round(getMaxHp(hero, combatant) * (fighter.hp ?? 1));
  combatant.currentMana = Math.round(getMaxMana(hero, combatant) * (fighter.mana ?? 1));
  return { hero, combatant };
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
            rerolls={0}
            itemsBought={[]}
            onRunChange={noop}
            onBuyGem={() => null}
            onGemPlaced={noop}
            onBuyItem={() => null}
            onReroll={noop}
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
  const hero = build(scene.hero, 'scene-hero', 'A');
  if (!hero) return null;
  const foes = (scene.foes ?? []).map((f, i) => build(f, `scene-foe-${i}`, 'B')).filter((f): f is Built => f !== null);
  const caster = { wisdom: hero.hero.baseStats.wisdom, types: hero.hero.types };
  const focusRows = scene.focusMoves;
  const classes = ['tip-scene', ...(scene.focus ?? []).map((f) => `focus-${f}`)];

  return (
    <div className={classes.join(' ')} aria-hidden="true">
      {foes.length > 0 && (
        <div className="team-row enemy tip-scene-foes">
          {foes.map(({ hero: h, combatant }) => (
            <CombatantCard key={combatant.combatantId} hero={h} combatant={combatant} level={SCENE_LEVEL} />
          ))}
        </div>
      )}

      {scene.heroFigure && (
        <div className="team-row ally tip-scene-hero">
          <CombatantCard hero={hero.hero} combatant={hero.combatant} level={SCENE_LEVEL} />
        </div>
      )}

      {scene.field && fieldEffects[scene.field] && (
        <span
          className="field-effect-badge"
          style={{ '--field-effect-rgb': getTypeColorRgb(fieldEffects[scene.field].flavorType ?? 'Arcane') } as CSSProperties}
        >
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
            <button type="button" className="move-button rest-button">
              <div className="move-row-top">
                <span className="move-name">Rest</span>
              </div>
              <div className="move-row-effect">
                <span className="move-effect-text">Out of Mana — recovers to full, but skips the turn</span>
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
            <span className="bottom-action-glyph">←</span>
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
    </div>
  );
}
