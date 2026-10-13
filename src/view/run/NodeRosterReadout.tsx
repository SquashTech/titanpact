import type { CSSProperties, ReactNode } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { MapNodeType } from '../../run/map';
import { MASTERY_CAP } from '../../run/mastery';
import { MANA_WELL_AMOUNT, LEY_LINE_FORCE } from '../../run/runProgress';
import { levelOf } from '../../run/growth';
import { MOVE_CAP, formIdFor } from '../../run/progression';
import { equipmentStatusGrants } from '../../run/statusGrants';
import { rosterTypes } from '../../run/boons';
import { tutorMovePool } from '../../run/tutor';
import type { RosterEntry, RunState } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { MasteryPips } from '../shared/MasteryPips';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { entryStatTotals } from '../shared/entryStatTotals';
import { BlessingMark } from '../shared/BlessingMark';

/** What of the roster a node's decision turns on. Null: nothing on the roster changes the answer. */
type Lens = 'mastery' | 'mana' | 'force' | 'gear' | 'hp' | 'moves' | 'types' | 'level' | null;

const LENS: Record<MapNodeType, Lens> = {
  fight: 'level',
  battle: 'level',
  skirmish: 'level',
  elite: 'level',
  boss: 'level',
  finale: 'level',
  shop: 'hp',
  muster: 'hp',
  restReward: 'hp',
  equipmentReward: 'gear',
  forgeReward: 'gear',
  scrollReward: 'mastery',
  scribeReward: 'mastery',
  manaWellReward: 'mana',
  leyLineReward: 'force',
  passiveReward: 'types',
  blessingReward: 'hp',
  mentorReward: 'level',
  tutorReward: 'moves',
  academyReward: 'moves',
  currencyReward: null,
  contractReward: null,
  event: null,
};

/** Force the hero already draws at its own element, off its gear and any Ley Line. */
function forceAt(entry: RosterEntry, type: string): number {
  const id = `${type}Force`;
  return (entry.bonusStatusGrants[id] ?? 0) + (equipmentStatusGrants(entry.equipment, equipment)[id] ?? 0);
}

function Cell({ hero, entry, children, dim = false }: { hero: HeroDefinition; entry: RosterEntry; children: ReactNode; dim?: boolean }) {
  return (
    <div
      className={`node-roster-cell${entry.down ? ' is-down' : ''}${dim ? ' is-dim' : ''}`}
      style={{ '--hero-color': getTypeColor(hero.types[0]) } as CSSProperties}
      title={hero.name}
    >
      <span className="node-roster-figure-wrap">
        <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="node-roster-portrait" />
        {entry.blessed && <BlessingMark className="node-roster-blessing" />}
      </span>
      <span className="node-roster-mark">{children}</span>
    </div>
  );
}

/** "50→90": what the node would make of a figure the hero holds now. */
function Lift({ from, to }: { from: number; to: number }) {
  return (
    <span className="node-roster-lift">
      {from}
      <span className="node-roster-arrow">→</span>
      <strong>{to}</strong>
    </span>
  );
}

/**
 * Under a node's figures, the roster as one strip of portraits, each wearing the one mark that
 * node's decision turns on — the pips a Gem lands on, the pool a Well deepens, the sockets a chest
 * fills — so the choice on the map is made with the facts in view rather than after the tap.
 */
export function NodeRosterReadout({ type, run }: { type: MapNodeType; run: RunState }) {
  const lens = LENS[type];
  if (lens === null) return null;

  if (lens === 'types') {
    return (
      <div className="node-roster">
        <span className="move-detail-eyebrow">Type Boons on offer</span>
        <div className="node-roster-types">
          {[...rosterTypes(run.roster, rosterHeroes)].map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
    );
  }

  const entries = run.roster.map((entry) => ({ entry, hero: rosterHeroes[entry.heroId] })).filter((r) => r.hero);
  return (
    <div className="node-roster node-roster-strip">
      {entries.map(({ entry, hero }) => {
        const key = entry.rosterId;
        switch (lens) {
          case 'mastery':
            return (
              <Cell key={key} hero={hero} entry={entry} dim={entry.mastery >= MASTERY_CAP}>
                <MasteryPips mastery={entry.mastery} className="node-roster-pips" />
              </Cell>
            );
          case 'mana': {
            const pool = entryStatTotals(hero, entry, run.relics).manaPool;
            return (
              <Cell key={key} hero={hero} entry={entry}>
                <Lift from={pool} to={pool + MANA_WELL_AMOUNT} />
              </Cell>
            );
          }
          case 'force': {
            const element = hero.types[0];
            const now = forceAt(entry, element);
            const count = entry.unlockedMoveIds.filter((id) => moves[id]?.type === element).length;
            return (
              <Cell key={key} hero={hero} entry={entry} dim={count === 0}>
                <Lift from={now} to={now + LEY_LINE_FORCE} />
              </Cell>
            );
          }
          case 'gear': {
            const worn = entry.equipment.map((id) => equipment[id]).filter(Boolean);
            return (
              <Cell key={key} hero={hero} entry={entry} dim={type === 'forgeReward' ? worn.length === 0 : worn.length >= 3}>
                <span className="node-roster-gear">
                  {[0, 1, 2].map((i) => {
                    const item = worn[i];
                    return item ? (
                      <span key={i} className="node-roster-socket is-filled" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties} />
                    ) : (
                      <span key={i} className="node-roster-socket" />
                    );
                  })}
                </span>
              </Cell>
            );
          }
          case 'moves': {
            const pool = tutorMovePool(progressionTable, moves, entry);
            return (
              <Cell key={key} hero={hero} entry={entry} dim={pool.length === 0}>
                <span className="node-roster-lift">
                  <strong>{entry.unlockedMoveIds.length}</strong>/{MOVE_CAP}
                </span>
              </Cell>
            );
          }
          case 'hp':
          case 'level': {
            const { hp, maxHp } = entryHp(hero, entry, run.relics);
            return (
              <Cell key={key} hero={hero} entry={entry}>
                {lens === 'level' && <span className="node-roster-level">Lv {levelOf(entry)}</span>}
                {!entry.down && <WoundBar hp={hp} maxHp={maxHp} className="node-roster-hp" />}
              </Cell>
            );
          }
        }
      })}
    </div>
  );
}
