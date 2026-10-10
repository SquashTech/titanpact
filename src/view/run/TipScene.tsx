import { createCombatant, effectiveTypes, getMaxHp, getMaxMana, moveForHero, type Combatant, type Side } from '../../engine/state';
import type { CSSProperties } from 'react';
import type { HeroDefinition } from '../../engine/content';
import { resolveTypeMult } from '../../engine/damage/typeMult';
import { allCombatants } from '../../data/content';
import { moves } from '../../data/moves';
import { typeChart } from '../../data/typechart';
import { fieldEffects } from '../../data/fieldEffects';
import { FIELD_EFFECT_DURATION_ROUNDS } from '../../engine/combat/fieldEffectEngine';
import type { TipScene as Scene, TipSceneFighter } from '../../data/tipScenes';
import { CombatantCard } from '../combat/CombatantCard';
import { formatMult, multClass } from '../combat/MoveDetailOverlay';
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
            const chips =
              move.kind === 'damage' && foes.length > 0
                ? foes.map(({ hero: h, combatant }) => {
                    const mult = resolveTypeMult(typeChart, move.type, effectiveTypes(h, combatant));
                    return (
                      <span key={combatant.combatantId} className={`move-eff-chip ${multClass(mult)}`}>
                        <span className="move-eff-name">{h.name}</span>
                        <span className="move-eff-mult">{formatMult(mult)}</span>
                      </span>
                    );
                  })
                : null;
            const tag = scene.tags?.[id];
            return (
              <div key={id} className={`tip-scene-row${!focusRows || focusRows.includes(id) ? ' is-focus-row' : ''}`}>
                <MoveButtonReplica
                  move={move}
                  caster={caster}
                  lead={chips}
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
