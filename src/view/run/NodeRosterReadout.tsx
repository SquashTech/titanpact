import type { CSSProperties, ReactNode } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import type { MapNodeType } from '../../run/map';
import { MASTERY_CAP, MASTERY_EVOLUTION } from '../../run/mastery';
import { MANA_WELL_AMOUNT, LEY_LINE_FORCE } from '../../run/runProgress';
import { levelOf } from '../../run/growth';
import { MOVE_CAP, rosterEntryTypes } from '../../run/progression';
import { equipmentStatusGrants } from '../../run/statusGrants';
import { rosterTypes } from '../../run/boons';
import { mentorMovePool, tutorMovePool } from '../../run/tutor';
import { mendPrice } from '../../run/wounds';
import { enemyLevelFor, type EncounterNodeKind } from '../../run/difficulty';
import type { RosterEntry, RunState } from '../../run/state';
import { getTypeColor } from '../combat/typeColors';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { MasteryPips } from '../shared/MasteryPips';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { EquipmentIcon, RARITY_COLOR_VARS } from '../shared/EquipmentBox';
import { entryStatTotals } from '../shared/entryStatTotals';
import { ResourceGlyph } from '../shared/RunGlyph';
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
  mentorReward: 'moves',
  tutorReward: 'moves',
  currencyReward: null,
  event: null,
};

const ENCOUNTERS: Partial<Record<MapNodeType, EncounterNodeKind>> = {
  fight: 'fight',
  battle: 'battle',
  skirmish: 'skirmish',
  elite: 'elite',
  boss: 'boss',
  finale: 'finale',
};

function masteryNote(mastery: number): string {
  if (mastery >= MASTERY_CAP) return 'Mastered';
  if (mastery < MASTERY_EVOLUTION) return `${MASTERY_EVOLUTION - mastery} to Evolve`;
  return `${MASTERY_CAP - mastery} to master`;
}

/** Force the hero already draws at its own element, off its gear and any Ley Line. */
function forceAt(entry: RosterEntry, type: string): number {
  const id = `${type}Force`;
  return (entry.bonusStatusGrants[id] ?? 0) + (equipmentStatusGrants(entry.equipment, equipment)[id] ?? 0);
}

function Row({ hero, entry, children, dim = false }: { hero: HeroDefinition; entry: RosterEntry; children: ReactNode; dim?: boolean }) {
  return (
    <div
      className={`node-roster-row${entry.down ? ' is-down' : ''}${dim ? ' is-dim' : ''}`}
      style={{ '--hero-color': getTypeColor(hero.types[0]) } as CSSProperties}
    >
      <HeroPortrait heroId={hero.id} className="node-roster-portrait" />
      <span className="node-roster-name">{hero.name}</span>
      <span className="node-roster-readout">{children}</span>
    </div>
  );
}

/**
 * Under a node's ledger, the roster read through the one lens that node's decision turns on —
 * the pips a Scroll lands on, the pool a Well deepens, the sockets a Cache fills — so the choice
 * on the map is made with the facts in view rather than after the tap.
 */
export function NodeRosterReadout({ type, run }: { type: MapNodeType; run: RunState }) {
  const lens = LENS[type];
  const entries = run.roster.map((entry) => ({ entry, hero: rosterHeroes[entry.heroId] })).filter((r) => r.hero);

  const gold = (
    <span className="node-roster-purse">
      <ResourceGlyph kind="gold" /> {run.gold}
    </span>
  );

  if (lens === null) {
    return (
      <div className="node-roster">
        <div className="node-roster-head">
          <span className="move-detail-eyebrow">Your purse</span>
          {gold}
        </div>
      </div>
    );
  }

  if (lens === 'types') {
    const types = [...rosterTypes(run.roster, rosterHeroes)];
    return (
      <div className="node-roster">
        <div className="node-roster-head">
          <span className="move-detail-eyebrow">Type Boons on offer</span>
        </div>
        <div className="node-roster-types">
          {types.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
      </div>
    );
  }

  const encounter = ENCOUNTERS[type];
  let head: ReactNode = null;
  if (lens === 'level' && encounter) {
    head = <span className="node-roster-aside">Enemies Lv {enemyLevelFor(encounter, run.actNumber)}</span>;
  } else if (type === 'shop' || type === 'muster') {
    const mend = mendPrice(run, (entry) => entryStatTotals(rosterHeroes[entry.heroId], entry, run.relics).hp);
    const missing = run.roster.some((e) => e.down || e.wounds > 0);
    head = (
      <span className="node-roster-aside">
        {missing ? `Mend ${mend}g · ` : ''}
        {gold}
      </span>
    );
  }

  return (
    <div className="node-roster">
      <div className="node-roster-head">
        <span className="move-detail-eyebrow">Your roster</span>
        {head}
      </div>
      {entries.map(({ entry, hero }) => {
        switch (lens) {
          case 'mastery':
            return (
              <Row key={entry.rosterId} hero={hero} entry={entry} dim={entry.mastery >= MASTERY_CAP}>
                <MasteryPips mastery={entry.mastery} className="node-roster-pips" />
                <span className="node-roster-note">{masteryNote(entry.mastery)}</span>
              </Row>
            );
          case 'mana': {
            const pool = entryStatTotals(hero, entry, run.relics).manaPool;
            return (
              <Row key={entry.rosterId} hero={hero} entry={entry}>
                <span className="node-roster-figure">
                  {pool} <span className="node-roster-arrow">→</span> <strong>{pool + MANA_WELL_AMOUNT}</strong>
                </span>
                <span className="node-roster-note">max Mana</span>
              </Row>
            );
          }
          case 'force': {
            const element = hero.types[0];
            const now = forceAt(entry, element);
            const count = entry.unlockedMoveIds.filter((id) => moves[id]?.type === element).length;
            return (
              <Row key={entry.rosterId} hero={hero} entry={entry} dim={count === 0}>
                <TypeBadge type={element} iconOnly />
                <span className="node-roster-figure">
                  {now} <span className="node-roster-arrow">→</span> <strong>{now + LEY_LINE_FORCE}</strong>
                </span>
                <span className="node-roster-note">
                  {count} {count === 1 ? 'move' : 'moves'}
                </span>
              </Row>
            );
          }
          case 'gear': {
            const worn = entry.equipment.map((id) => equipment[id]).filter(Boolean);
            return (
              <Row key={entry.rosterId} hero={hero} entry={entry} dim={type === 'forgeReward' && worn.length === 0}>
                <span className="node-roster-gear">
                  {[0, 1, 2].map((i) => {
                    const item = worn[i];
                    return item ? (
                      <span key={i} className="node-roster-socket is-filled" style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties} title={item.name}>
                        <EquipmentIcon item={item} className="node-roster-item" />
                      </span>
                    ) : (
                      <span key={i} className="node-roster-socket" />
                    );
                  })}
                </span>
                <span className="node-roster-note">{3 - worn.length} free</span>
              </Row>
            );
          }
          case 'moves': {
            const pool = (type === 'tutorReward' ? tutorMovePool : mentorMovePool)(progressionTable, moves, entry);
            const held = entry.unlockedMoveIds.length;
            return (
              <Row key={entry.rosterId} hero={hero} entry={entry} dim={pool.length === 0}>
                <span className="node-roster-figure">
                  <strong>{held}</strong>/{MOVE_CAP}
                </span>
                <span className="node-roster-note">{pool.length === 0 ? 'nothing to roll' : held >= MOVE_CAP ? 'replaces one' : 'learns outright'}</span>
              </Row>
            );
          }
          case 'hp':
          case 'level': {
            const { hp, maxHp } = entryHp(hero, entry, run.relics);
            return (
              <Row key={entry.rosterId} hero={hero} entry={entry}>
                {lens === 'level' && <span className="node-roster-level">Lv {levelOf(entry)}</span>}
                {rosterEntryTypes(hero, entry).map((t) => (
                  <TypeBadge key={t} type={t} iconOnly />
                ))}
                {entry.blessed && <BlessingMark className="node-roster-blessing" />}
                {entry.down ? <span className="node-roster-down">Down</span> : <WoundBar hp={hp} maxHp={maxHp} figure className="node-roster-hp" />}
              </Row>
            );
          }
        }
      })}
    </div>
  );
}
