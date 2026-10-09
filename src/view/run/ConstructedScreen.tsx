// Constructed (docs/constructed.md §9): the teambuilder. One screen with its own navigation —
// teams, a team, one hero's build (Path / Moves / Gems / Items, then Review), the hero picker, and
// the Trial to face. A team's edits land on the profile at once, as the deck does; a hero's land on
// Confirm. The verbs are run/constructed.ts's.

import { useMemo, useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { equipment } from '../../data/equipment';
import { constructedContent, suggestedSlotFor, TRIAL_LIST } from '../../data/trials';
import type { GrowthStatKey, HeroDefinition, MoveDefinition, MoveTier, TypeId } from '../../engine/content';
import {
  CONSTRUCTED_RARITY,
  TEAM_SIZE,
  TEAM_SLOTS,
  constructedMovePool,
  constructedPath,
  isTeamReady,
  overPoolMoveIds,
  setGem,
  setItem,
  slotManaPool,
  slotEntry,
  slotProblems,
  slotTypes,
  toggleMove,
  withPath,
  type Team,
  type TeamSlot,
} from '../../run/constructed';
import { BASE_ITEM_SLOTS, EQUIPMENT_FAMILIES, equipmentIdFor, parseEquipmentId, type EquipmentDefinition } from '../../run/equipment';
import { innatePassiveOf, masteredInnateOf } from '../../run/innate';
import { TRIAL_CLEAR_STARS } from '../../run/profile';
import { GEM_ORDER, gemAmount, gemPointsForPip } from '../../run/gems';
import { MASTERY_CAP } from '../../run/mastery';
import type { RosterEntry } from '../../run/state';
import { MOVE_CAP, pathTypes, signatureIdFor } from '../../run/progression';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { ElementGlyph } from '../shared/elementIcons';
import { MoveButtonReplica } from '../shared/MoveTile';
import { ItemBox } from '../shared/EquipmentBox';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { PassiveGrantRow } from './EvolutionScreen';
import { MoveDetailOverlay } from '../combat/MoveDetailOverlay';
import { PassiveDetailOverlay } from '../shared/PassiveDossier';
import { pathTint, pathTintStyle } from '../shared/pathTint';
import { PassiveReadout } from '../shared/passiveIcons';
import { EvolutionStar } from '../shared/EvolutionStar';
import { StageMovePopup } from '../shared/HeroStage';
import { STAT_LABELS, STAT_ORDER, StatGlyph } from '../shared/StatBars';
import { entryStatTotals } from '../shared/entryStatTotals';
import { healCasterForEntry } from '../shared/healCaster';
import { PlateButton } from '../shared/PlateButton';

/** The fourteen draftable types, in chart order — the picker's rail. */
const RAIL_TYPES: readonly TypeId[] = ['Fire', 'Water', 'Frost', 'Storm', 'Stone', 'Nature', 'Light', 'Shadow', 'Arcane', 'Mind', 'Spirit', 'Iron', 'Mech', 'Beast'];

type View =
  | { kind: 'teams' }
  | { kind: 'team'; team: number }
  /** `slot` past the team's end is a hero being added — on the team only once confirmed. */
  | { kind: 'hero'; team: number; slot: number; draft: TeamSlot }
  | { kind: 'pick'; team: number }
  | { kind: 'trials'; team: number };

type Tab = 'path' | 'moves' | 'gems' | 'items' | 'review';

/** The move list's order under the signature: the bands a level-30 team actually picks from, first. */
const TIER_RANK: Record<MoveTier, number> = { late: 1, mid: 2, early: 3 };

interface Props {
  teams: readonly Team[];
  /** Heroes the player may build (run/constructed.ts constructedHeroIds), or every hero in a dev session. */
  unlocked: ReadonlySet<string>;
  onChangeTeams: (teams: Team[]) => void;
  onFightTrial: (team: Team, trialId: string, teamIndex: number) => void;
  onClose: () => void;
  /** Where to land: a team after a Trial, else the list. */
  startTeam?: number | null;
  /** The Trials beaten (Profile.trialsCleared). */
  cleared: ReadonlySet<string>;
  /** Said once on landing — a Trial's result. */
  notice?: string | null;
}

function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cx-back" aria-label={label} onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

function Header({ title, onBack, backLabel, side }: { title: string; onBack: () => void; backLabel: string; side?: React.ReactNode }) {
  return (
    <div className="cx-header">
      <Back label={backLabel} onClick={onBack} />
      <h2 className="cx-title">{title}</h2>
      <div className="cx-header-side">{side}</div>
    </div>
  );
}

function slotLegal(slot: TeamSlot, unlocked: ReadonlySet<string>): boolean {
  return slotProblems(constructedContent, slot, unlocked).length === 0;
}

// --- Teams ---

function TeamsView({ teams, unlocked, onOpen, onNew, onClose }: { teams: readonly Team[]; unlocked: ReadonlySet<string>; onOpen: (i: number) => void; onNew: () => void; onClose: () => void }) {
  return (
    <>
      <Header title="The Trials" onBack={onClose} backLabel="Back to the title" />
      <div className="screen-scroll cx-list">
        {teams.map((team, i) => {
          const ready = isTeamReady(constructedContent, team, unlocked);
          return (
            <button key={i} type="button" className="cx-team-row" onClick={() => onOpen(i)}>
              <span className="cx-team-row-head">
                <span className="cx-team-name">{team.name}</span>
                <span className={`cx-team-state${ready ? ' is-ready' : ''}`}>{ready ? 'Ready' : `${team.slots.length} / ${TEAM_SIZE}`}</span>
              </span>
              <span className="cx-team-strip">
                {Array.from({ length: TEAM_SIZE }, (_, j) => {
                  const slot = team.slots[j];
                  return slot ? (
                    <HeroPortrait key={j} heroId={slot.heroId} pathId={slot.pathId ?? undefined} className="cx-strip-portrait" />
                  ) : (
                    <span key={j} className="cx-strip-empty" />
                  );
                })}
              </span>
            </button>
          );
        })}
        {teams.length < TEAM_SLOTS && (
          <button type="button" className="secondary-button cx-new-team" onClick={onNew}>
            + New team
          </button>
        )}
        {Array.from({ length: Math.max(0, TEAM_SLOTS - teams.length - 1) }, (_, i) => (
          <span key={i} className="cx-empty-row" aria-hidden="true" />
        ))}
      </div>
    </>
  );
}

// --- A team ---

function TeamView({
  team,
  unlocked,
  notice,
  onDismissNotice,
  onRename,
  onOpenSlot,
  onAdd,
  onDelete,
  onFight,
  onBack,
}: {
  team: Team;
  unlocked: ReadonlySet<string>;
  notice: string | null;
  onDismissNotice: () => void;
  onRename: (name: string) => void;
  onOpenSlot: (slot: number) => void;
  onAdd: () => void;
  onDelete: () => void;
  onFight: () => void;
  onBack: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ready = isTeamReady(constructedContent, team, unlocked);

  return (
    <>
      <div className="cx-header">
        <Back label="Back to Teams" onClick={onBack} />
        <input className="cx-name-input" value={team.name} maxLength={24} aria-label="Team name" onChange={(e) => onRename(e.target.value)} />
        <div className="cx-header-side" />
      </div>
      <div className="screen-scroll cx-team-body">
        {notice && (
          <button type="button" className="cx-notice" onClick={onDismissNotice}>
            {notice}
          </button>
        )}
        <div className="cx-grid">
          {Array.from({ length: TEAM_SIZE }, (_, i) => {
            const slot = team.slots[i];
            if (!slot) {
              return i === team.slots.length ? (
                <button key={i} type="button" className="secondary-button cx-add" onClick={onAdd}>
                  <span className="cx-add-plus">+</span>
                  Add a hero
                </button>
              ) : (
                <span key={i} className="cx-cell-empty" aria-hidden="true" />
              );
            }
            const hero = heroes[slot.heroId];
            const path = constructedPath(constructedContent.table, slot.heroId, slot.pathId);
            const legal = slotLegal(slot, unlocked);
            return (
              <button key={i} type="button" className={`cx-cell${legal ? '' : ' is-broken'}`} onClick={() => onOpenSlot(i)}>
                <HeroPortrait heroId={slot.heroId} pathId={slot.pathId ?? undefined} className="cx-cell-portrait" />
                <span className="cx-cell-name">{hero?.name ?? slot.heroId}</span>
                <span className="cx-cell-path">{legal ? (path?.name ?? 'Unevolved') : slot.moveIds.length === 0 ? 'No moves yet' : 'Needs a fix'}</span>
                <span className="cx-cell-types">
                  {slotTypes(constructedContent, slot).map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="cx-footer">
        <button type="button" className={`secondary-button cx-delete${confirmDelete ? ' is-armed' : ''}`} onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}>
          {confirmDelete ? 'Delete it' : 'Delete'}
        </button>
        <PlateButton className="cx-fight" disabled={!ready} onClick={onFight}>
          Fight a Trial
        </PlateButton>
      </div>
    </>
  );
}

// --- One hero's build ---

/** A path as the Evolution screen reads it: the form and its typing to pick, then each grant drawn as the fight draws it, tap to read. */
function PathTab({ hero, slot, caster, onPick }: { hero: HeroDefinition; slot: TeamSlot; caster: ReturnType<typeof healCasterForEntry>; onPick: (pathId: string) => void }) {
  const [readingMoveId, setReadingMoveId] = useState<string | null>(null);
  const [readingPassiveId, setReadingPassiveId] = useState<string | null>(null);
  const paths = (constructedContent.table.evolutions[hero.id] ?? []).flatMap((node) => node.paths);
  const reading = paths.find((p) => p.unlocksMoveIds.includes(readingMoveId ?? ''));
  return (
    <div className="cx-paths">
      {paths.map((path) => {
        const types = pathTypes(hero, path);
        const traded = path.typeGraft ? (hero.types[1] ?? null) : null;
        const pathCaster = { ...caster, types };
        return (
          <div key={path.id} className={`cx-path${path.id === slot.pathId ? ' is-active' : ''}`} style={pathTintStyle(hero, path)}>
            <button type="button" className="cx-path-head" aria-pressed={path.id === slot.pathId} onClick={() => onPick(path.id)}>
              <HeroPortrait heroId={hero.id} pathId={path.id} className="cx-path-portrait" />
              <span className="cx-path-text">
                <span className="cx-path-name" style={{ color: pathTint(hero, path).lead }}>
                  {path.name} <EvolutionStar path={path} />
                </span>
                <span className="cx-path-types">
                  {types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                  {traded && <span className="evo-show-kind-note">trades {traded}</span>}
                  {path.swapsOffense && <span className="cx-path-rewire">Atk ⇄ Int</span>}
                </span>
              </span>
              <span className="cx-path-pick">{path.id === slot.pathId ? 'Chosen' : 'Choose'}</span>
            </button>
            {path.unlocksMoveIds
              .filter((id) => moves[id])
              .map((id) => (
                <div key={id} className="cx-path-grant">
                  <div className="evo-show-kind">New move</div>
                  <MoveButtonReplica move={moves[id]} caster={pathCaster} onClick={() => setReadingMoveId(id)} onLongPress={() => setReadingMoveId(id)} />
                </div>
              ))}
            {(path.grantsPassiveIds ?? [])
              .filter((id) => passives[id])
              .map((id) => (
                <div key={id} className="cx-path-grant">
                  <div className="evo-show-kind">New passive</div>
                  <PassiveGrantRow passiveId={id} onRead={() => setReadingPassiveId(id)} />
                </div>
              ))}
          </div>
        );
      })}
      {readingMoveId && (
        <MoveDetailOverlay move={moves[readingMoveId]} caster={reading ? { ...caster, types: pathTypes(hero, reading) } : caster} onClose={() => setReadingMoveId(null)} />
      )}
      <PassiveDetailOverlay passive={readingPassiveId ? passives[readingPassiveId] : null} onClose={() => setReadingPassiveId(null)} />
    </div>
  );
}

function MovesTab({ slot, caster, mana, onToggle }: { slot: TeamSlot; caster: ReturnType<typeof healCasterForEntry>; mana: number; onToggle: (moveId: string) => void }) {
  const [filter, setFilter] = useState<string>('All');
  const [inspect, setInspect] = useState<MoveDefinition | null>(null);
  const hero = heroes[slot.heroId];
  const path = constructedPath(constructedContent.table, slot.heroId, slot.pathId);
  const signature = signatureIdFor(hero, { offenseSwapped: !!path?.swapsOffense });
  const rank =(id: string) => (id === signature ? 0 : TIER_RANK[moves[id].tier ?? 'early']);
  const pool = constructedMovePool(constructedContent, slot)
    .filter((id) => moves[id])
    .sort((a, b) => rank(a) - rank(b));
  const types = ['All', ...new Set(pool.map((id) => moves[id].type))];
  const shown = pool.filter((id) => filter === 'All' || moves[id].type === filter);
  // Over the pool still holds — Gems can lift the pool — but says so, and Review will not confirm it.
  const tagFor = (id: string) =>
    moves[id].manaCost > mana ? `Needs ${moves[id].manaCost} MP` : id === signature ? 'Signature' : path?.unlocksMoveIds.includes(id) ? 'Path' : undefined;

  return (
    <div className="cx-moves">
      <div className="cx-filters">
        {types.map((t) => (
          <button key={t} type="button" className={`cx-filter${t === filter ? ' is-active' : ''}`} onClick={() => setFilter(t)}>
            {t === 'All' ? 'All' : <ElementGlyph type={t} />}
            {t !== 'All' && <span className="cx-filter-label">{t}</span>}
          </button>
        ))}
      </div>
      <div className="cx-move-list move-list">
        {shown.map((id) => {
          const held = slot.moveIds.includes(id);
          return (
            <MoveButtonReplica
              key={id}
              move={moves[id]}
              selected={held}
              unusable={!held && slot.moveIds.length >= MOVE_CAP}
              tag={tagFor(id)}
              caster={caster}
              onClick={() => onToggle(id)}
              onLongPress={() => setInspect(moves[id])}
            />
          );
        })}
      </div>
      {inspect && <StageMovePopup move={inspect} caster={caster} onClose={() => setInspect(null)} />}
    </div>
  );
}

function ItemsTab({ slot, onSet, onNext }: { slot: TeamSlot; onSet: (index: number, itemId: string | null) => void; onNext: () => void }) {
  const [socket, setSocket] = useState(() => Math.min(slot.itemIds.length, BASE_ITEM_SLOTS - 1));
  const [inspect, setInspect] = useState<EquipmentDefinition | null>(null);
  const held = slot.itemIds[socket] ?? null;
  const elsewhere = new Set(slot.itemIds.filter((_, i) => i !== socket).map((id) => parseEquipmentId(id).base));
  const options = EQUIPMENT_FAMILIES.map((family) => equipment[equipmentIdFor(family, CONSTRUCTED_RARITY)]).filter((item): item is EquipmentDefinition => !!item);

  const equip = (itemId: string) => {
    const next = setItem(slot, socket, itemId);
    onSet(socket, itemId);
    // On to the next empty socket, so three items are three taps.
    if (next.itemIds.length < BASE_ITEM_SLOTS) setSocket(next.itemIds.length);
  };

  return (
    <div className="cx-items">
      <div className="cx-sockets">
        {Array.from({ length: BASE_ITEM_SLOTS }, (_, i) => {
          const id = slot.itemIds[i];
          const item = id ? (equipment[id] ?? null) : null;
          return (
            <div key={i} className="cx-socket">
              <ItemBox
                item={item}
                className={i === socket ? 'selected' : undefined}
                onTap={() => setSocket(Math.min(i, slot.itemIds.length))}
                onLongPress={item ? () => setInspect(item) : undefined}
              />
              <span className="cx-socket-name">{item ? item.name : 'Empty'}</span>
            </div>
          );
        })}
      </div>

      <div className="cx-step-actions">
        {held && (
          <button type="button" className="secondary-button" onClick={() => onSet(socket, null)}>
            Empty this socket
          </button>
        )}
        <button type="button" className="secondary-button" onClick={onNext}>
          Review
        </button>
      </div>

      <div className="cx-families">
        {options.map((item) => (
          <div key={item.id} className={`cx-family${elsewhere.has(parseEquipmentId(item.id).base) ? ' is-elsewhere' : ''}`}>
            <EquipChoiceCard item={item} picked={item.id === held} onPick={() => equip(item.id)} onInspect={() => setInspect(item)} revealDelayMs={0} />
          </div>
        ))}
      </div>
      {inspect && <EquipInspectOverlay item={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}

/** The guided order a build is walked in; Review is the lock-in, not a step. */
const STEPS: readonly Exclude<Tab, 'review'>[] = ['path', 'moves', 'gems', 'items'];

const gemsPlaced = (slot: TeamSlot) => (slot.gems ?? []).filter((g) => g !== null).length;

/** The next step after `after` neither finished nor already passed, else Review. */
function firstOpenStep(slot: TeamSlot, after: Tab | null, visited: ReadonlySet<Tab>): Tab {
  const done = (step: Tab) =>
    step === 'path' ? slot.pathId !== null : step === 'moves' ? slot.moveIds.length >= MOVE_CAP : step === 'gems' ? gemsPlaced(slot) >= MASTERY_CAP : slot.itemIds.length >= BASE_ITEM_SLOTS;
  const from = after === null ? 0 : STEPS.indexOf(after as Exclude<Tab, 'review'>) + 1;
  return STEPS.slice(from).find((step) => !done(step) && !visited.has(step)) ?? 'review';
}

/** What a held move over the pool still needs, said the same way on every step. */
function manaNeedLine(moveId: string, mana: number): string {
  const move = moves[moveId];
  return `${move.name} costs ${move.manaCost} Mana — ${move.manaCost - mana} more needed`;
}

/** Ten pips, sized as a run finds them; each one a stat the player picks, or left to fit (drawn dim). */
function GemsTab({
  slot,
  entry,
  mana,
  overPool,
  onSet,
  onNext,
}: {
  slot: TeamSlot;
  entry: RosterEntry;
  mana: number;
  overPool: string[];
  onSet: (index: number, stat: GrowthStatKey | null) => void;
  onNext: () => void;
}) {
  const [pip, setPip] = useState(() => Math.max(0, Array.from({ length: MASTERY_CAP }, (_, j) => j).findIndex((j) => !slot.gems?.[j])));
  const chosen = slot.gems?.[pip] ?? null;
  const points = gemPointsForPip(pip);

  const choose = (stat: GrowthStatKey) => {
    onSet(pip, stat);
    // On to the next pip still left to fit, so ten Gems are ten taps.
    const gems = Array.from({ length: MASTERY_CAP }, (_, j) => (j === pip ? stat : (slot.gems?.[j] ?? null)));
    const after = gems.findIndex((g, j) => g === null && j > pip);
    const before = gems.findIndex((g) => g === null);
    if (after >= 0) setPip(after);
    else if (before >= 0) setPip(before);
  };

  return (
    <div className="cx-gems">
      {overPool.length > 0 && (
        <div className="cx-mana-need">
          {overPool.map((id) => (
            <span key={id}>{manaNeedLine(id, mana)}</span>
          ))}
        </div>
      )}
      <div className="cx-gem-pips">
        {entry.gems.map((gem, i) => {
          const placed = !!slot.gems?.[i];
          return (
            <button
              key={i}
              type="button"
              className={`cx-gem-pip${i === pip ? ' is-active' : ''}${placed ? ' is-placed' : ''}`}
              aria-pressed={i === pip}
              aria-label={`Gem ${i + 1}: +${gemAmount(gem)} ${STAT_LABELS[gem.stat]}${placed ? '' : ', by fit'}`}
              onClick={() => setPip(i)}
            >
              <StatGlyph stat={gem.stat} />
              <span className="cx-gem-amount">{`+${gemAmount(gem)}`}</span>
            </button>
          );
        })}
      </div>
      <div className="cx-gem-stats">
        {GEM_ORDER.map((stat) => (
          <button key={stat} type="button" className={`cx-gem-stat${chosen === stat ? ' is-active' : ''}`} onClick={() => choose(stat)}>
            <StatGlyph stat={stat} />
            <span className="cx-gem-stat-label">{STAT_LABELS[stat]}</span>
            <span className="cx-gem-amount">{`+${gemAmount({ stat, points })}`}</span>
          </button>
        ))}
      </div>
      <div className="cx-step-actions">
        {chosen && (
          <button type="button" className="secondary-button" onClick={() => onSet(pip, null)}>
            Leave to fit
          </button>
        )}
        <button type="button" className="secondary-button" onClick={onNext}>
          {gemsPlaced(slot) >= MASTERY_CAP ? 'Next' : 'Fit the rest'}
        </button>
      </div>
    </div>
  );
}

/** The build read whole before it is locked in: what fields, and what still stops it. */
function ReviewPanel({
  slot,
  mana,
  overPool,
  caster,
  onRemove,
}: {
  slot: TeamSlot;
  mana: number;
  overPool: string[];
  caster: ReturnType<typeof healCasterForEntry>;
  onRemove: (() => void) | null;
}) {
  const [inspect, setInspect] = useState<MoveDefinition | null>(null);
  const [armed, setArmed] = useState(false);
  const hero = heroes[slot.heroId];
  const path = constructedPath(constructedContent.table, slot.heroId, slot.pathId);
  const chosenGems = gemsPlaced(slot);
  const blockers = [...(slot.moveIds.length === 0 ? ['Pick at least one move.'] : []), ...overPool.map((id) => manaNeedLine(id, mana))];
  return (
    <div className="cx-review">
      {blockers.length > 0 && (
        <div className="cx-mana-need">
          {blockers.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
      <div className="cx-review-row">
        <span className="cx-label">Path</span>
        <span className="cx-review-value" style={path ? { color: pathTint(hero, path).lead } : undefined}>
          {path?.name ?? 'Unevolved'}
        </span>
      </div>
      <div className="move-list cx-review-moves">
        {slot.moveIds
          .filter((id) => moves[id])
          .map((id) => (
            <MoveButtonReplica
              key={id}
              move={moves[id]}
              caster={caster}
              tag={overPool.includes(id) ? `Needs ${moves[id].manaCost} MP` : undefined}
              onClick={() => setInspect(moves[id])}
              onLongPress={() => setInspect(moves[id])}
            />
          ))}
      </div>
      <div className="cx-review-row">
        <span className="cx-label">Gems</span>
        <span className="cx-review-value">{chosenGems === 0 ? 'All by fit' : chosenGems >= MASTERY_CAP ? 'All chosen' : `${chosenGems} chosen, the rest by fit`}</span>
      </div>
      <div className="cx-review-row">
        <span className="cx-label">Items</span>
        <span className="cx-review-value">{slot.itemIds.length === 0 ? 'None' : slot.itemIds.map((id) => equipment[id]?.name ?? id).join(' · ')}</span>
      </div>
      {onRemove && (
        <button type="button" className={`secondary-button cx-delete cx-review-remove${armed ? ' is-armed' : ''}`} onClick={() => (armed ? onRemove() : setArmed(true))}>
          {armed ? 'Take off the team' : 'Remove'}
        </button>
      )}
      {inspect && <StageMovePopup move={inspect} caster={caster} onClose={() => setInspect(null)} />}
    </div>
  );
}

/**
 * One hero's build, walked Path → Moves → Gems → Items and locked in on Review. Edits stay on a
 * draft until Confirm; the top arrow leaves without them. A choice that finishes a step moves on.
 */
function HeroView({
  initial,
  isNew,
  unlocked,
  onConfirm,
  onRemove,
  onBack,
}: {
  initial: TeamSlot;
  isNew: boolean;
  unlocked: ReadonlySet<string>;
  onConfirm: (slot: TeamSlot) => void;
  onRemove: () => void;
  onBack: () => void;
}) {
  const [slot, setSlot] = useState(initial);
  const [visited, setVisited] = useState<ReadonlySet<Tab>>(() => new Set());
  const [tab, setTab] = useState<Tab>(() => (isNew ? 'path' : slotLegal(initial, unlocked) ? 'review' : firstOpenStep(initial, null, new Set())));
  const [lastStep, setLastStep] = useState<Tab>(() => (isNew ? 'path' : 'items'));
  const hero = heroes[slot.heroId];
  const entry = useMemo(() => slotEntry(constructedContent, slot), [slot]);
  const totals = useMemo(() => entryStatTotals(hero, entry), [hero, entry]);
  const caster = useMemo(() => healCasterForEntry(hero, entry), [hero, entry]);
  const mana = useMemo(() => slotManaPool(constructedContent, slot), [slot]);
  const overPool = useMemo(() => overPoolMoveIds(constructedContent, slot), [slot]);
  const innate = masteredInnateOf(hero) ?? innatePassiveOf(hero);
  const path = constructedPath(constructedContent.table, slot.heroId, slot.pathId);
  const suggested = suggestedSlotFor(slot.heroId);
  const legal = slotLegal(slot, unlocked);

  const go = (next: Tab) => {
    if (next !== 'review') setLastStep(next);
    setTab(next);
  };
  /** Off the step just finished to the next one still open — Review once none is. */
  const advance = (from: Tab, next: TeamSlot) => {
    const seen = new Set(visited).add(from);
    setVisited(seen);
    go(firstOpenStep(next, from, seen));
  };

  const tabs: { id: Exclude<Tab, 'review'>; label: string; summary: string }[] = [
    { id: 'path', label: 'Path', summary: path?.name ?? 'Choose' },
    { id: 'moves', label: 'Moves', summary: `${slot.moveIds.length} / ${MOVE_CAP}` },
    { id: 'gems', label: 'Gems', summary: `${gemsPlaced(slot)} / ${MASTERY_CAP}` },
    { id: 'items', label: 'Items', summary: `${slot.itemIds.length} / ${BASE_ITEM_SLOTS}` },
  ];

  return (
    <>
      <Header
        title={hero.name}
        onBack={onBack}
        backLabel={isNew ? 'Back to the team without this hero' : 'Back to the team without these changes'}
        side={
          suggested &&
          tab !== 'review' && (
            <button type="button" className="secondary-button cx-suggest" onClick={() => setSlot(suggested)}>
              Suggested
            </button>
          )
        }
      />
      <div className="cx-showcase">
        <HeroPortrait heroId={hero.id} pathId={slot.pathId ?? undefined} className="cx-showcase-portrait" />
        <div className="cx-showcase-text">
          <div className="cx-showcase-meta">
            <span>Lv 30 · Mastery 10</span>
            {slotTypes(constructedContent, slot).map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
          {innate && <PassiveReadout passive={innate} />}
        </div>
      </div>
      <div className="cx-stats">
        {STAT_ORDER.filter((s) => s !== 'mpRegen').map((stat) => (
          <span key={stat} className="cx-stat">
            <StatGlyph stat={stat} />
            <span className="cx-stat-value">{Math.round(totals[stat])}</span>
          </span>
        ))}
      </div>
      <div className="screen-scroll cx-tab-body" role="tabpanel">
        {tab === 'path' && (
          <PathTab
            hero={hero}
            slot={slot}
            caster={caster}
            onPick={(pathId) => {
              const next = withPath(constructedContent, slot, pathId);
              setSlot(next);
              advance('path', next);
            }}
          />
        )}
        {tab === 'moves' && (
          <MovesTab
            slot={slot}
            caster={caster}
            mana={mana}
            onToggle={(id) => {
              const next = toggleMove(slot, id);
              setSlot(next);
              if (next.moveIds.length >= MOVE_CAP && slot.moveIds.length < MOVE_CAP) advance('moves', next);
            }}
          />
        )}
        {tab === 'gems' && (
          <GemsTab
            slot={slot}
            entry={entry}
            mana={mana}
            overPool={overPool}
            onSet={(i, stat) => {
              const next = setGem(slot, i, stat);
              setSlot(next);
              if (gemsPlaced(next) >= MASTERY_CAP && gemsPlaced(slot) < MASTERY_CAP) advance('gems', next);
            }}
            onNext={() => advance('gems', slot)}
          />
        )}
        {tab === 'items' && (
          <ItemsTab
            slot={slot}
            onSet={(i, id) => {
              const next = setItem(slot, i, id);
              setSlot(next);
              if (next.itemIds.length >= BASE_ITEM_SLOTS && slot.itemIds.length < BASE_ITEM_SLOTS) advance('items', next);
            }}
            onNext={() => advance('items', slot)}
          />
        )}
        {tab === 'review' && <ReviewPanel slot={slot} mana={mana} overPool={overPool} caster={caster} onRemove={isNew ? null : onRemove} />}
      </div>
      {tab === 'review' ? (
        <div className="cx-footer is-even">
          <button type="button" className="secondary-button" onClick={() => go(lastStep)}>
            Back
          </button>
          <PlateButton disabled={!legal} onClick={() => onConfirm(slot)}>
            Confirm
          </PlateButton>
        </div>
      ) : (
        <div className="cx-tabs" role="tablist" aria-label="Build">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              aria-label={`${t.label}: ${t.summary}`}
              className={`cx-tab${t.id === tab ? ' is-active' : ''}`}
              onClick={() => go(t.id)}
            >
              <span className="cx-tab-label">{t.label}</span>
              <span className="cx-tab-summary">{t.summary}</span>
            </button>
          ))}
          <button type="button" role="tab" aria-selected={false} className={`cx-tab cx-tab-review${legal ? ' is-ready' : ''}`} onClick={() => go('review')}>
            <span className="cx-tab-label">Review</span>
            <span className="cx-tab-summary">{legal ? 'Ready' : '—'}</span>
          </button>
        </div>
      )}
    </>
  );
}

// --- The picker ---

function PickView({ team, unlocked, onPick, onBack }: { team: Team; unlocked: ReadonlySet<string>; onPick: (heroId: string) => void; onBack: () => void }) {
  const [type, setType] = useState<TypeId | 'All'>('All');
  const onTeam = new Set(team.slots.map((s) => s.heroId));
  const ofType = (t: TypeId) => Object.values(heroes).filter((h) => h.types[0] === t);
  const wonOf = (t: TypeId) => ofType(t).filter((h) => unlocked.has(h.id)).length;
  // All: every hero the player can build, in chart order. A type page also shows whom to go win with.
  const shown = type === 'All' ? RAIL_TYPES.flatMap(ofType).filter((h) => unlocked.has(h.id)) : ofType(type);

  return (
    <>
      <Header title="Add a hero" onBack={onBack} backLabel="Back to the team" />
      <div className="cx-pick">
        <div className="screen-scroll cx-pick-page">
          {type !== 'All' && (
            <div className="cx-pick-head">
              <TypeBadge type={type} />
            </div>
          )}
          <div className="cx-pick-grid">
            {shown.map((hero) => {
              const locked = !unlocked.has(hero.id);
              const taken = onTeam.has(hero.id);
              return (
                <button key={hero.id} type="button" className={`cx-pick-card${locked ? ' is-locked' : ''}${taken ? ' is-taken' : ''}`} disabled={locked || taken} onClick={() => onPick(hero.id)}>
                  {locked && (
                    <span className="cx-lock" aria-label="Locked">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                      </svg>
                    </span>
                  )}
                  <HeroPortrait heroId={hero.id} className="cx-pick-portrait" />
                  <span className="cx-pick-name">{hero.name}</span>
                  <span className="cx-pick-types">
                    {hero.types.map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </span>
                  {(locked || taken) && <span className="cx-pick-note">{locked ? `Win a run with ${hero.name}` : 'On this team'}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <nav className="cx-rail" aria-label="Types">
          <button type="button" className={`cx-rail-type cx-rail-all${type === 'All' ? ' is-active' : ''}`} aria-label={`All, ${unlocked.size} you can build`} onClick={() => setType('All')}>
            All
          </button>
          {RAIL_TYPES.map((t) => (
            <button key={t} type="button" className={`cx-rail-type${t === type ? ' is-active' : ''}`} aria-label={`${t}, ${wonOf(t)} of 6 won with`} onClick={() => setType(t)}>
              <ElementGlyph type={t} />
              <span className="cx-rail-count">{wonOf(t)}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}

// --- The Trial to face ---

function TrialsView({ cleared, onPick, onBack }: { cleared: ReadonlySet<string>; onPick: (trialId: string) => void; onBack: () => void }) {
  return (
    <>
      <Header title="Choose a Trial" onBack={onBack} backLabel="Back to the team" />
      <div className="screen-scroll cx-list">
        {TRIAL_LIST.map((trial) => (
          <button key={trial.id} type="button" className="cx-trial-row" onClick={() => onPick(trial.id)}>
            <span className="cx-trial-head">
              <TypeBadge type={trial.type} />
              <span className="cx-trial-name">{trial.name}</span>
              {cleared.has(trial.id) ? (
                <span className="cx-trial-beaten" aria-label="Beaten">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z" />
                  </svg>
                  Beaten
                </span>
              ) : (
                <span className="cx-trial-reward">+{TRIAL_CLEAR_STARS} ★</span>
              )}
            </span>
            <span className="cx-trial-line">{trial.line}</span>
            <span className="cx-trial-strip">
              {trial.team.slots.map((s) => (
                <HeroPortrait key={s.heroId} heroId={s.heroId} pathId={s.pathId ?? undefined} className="cx-strip-portrait" />
              ))}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

export function ConstructedScreen({ teams, unlocked, cleared, notice = null, onChangeTeams, onFightTrial, onClose, startTeam = null }: Props) {
  const [view, setView] = useState<View>(startTeam !== null && teams[startTeam] ? { kind: 'team', team: startTeam } : { kind: 'teams' });
  const [shownNotice, setShownNotice] = useState<string | null>(notice);

  const replaceTeam = (index: number, team: Team) => onChangeTeams(teams.map((t, i) => (i === index ? team : t)));
  const replaceSlot = (index: number, slot: number, next: TeamSlot) =>
    replaceTeam(index, { ...teams[index], slots: teams[index].slots.map((s, i) => (i === slot ? next : s)) });

  if (view.kind !== 'teams' && !teams[view.team]) return null;

  return (
    <div className="node-screen cx-screen">
      {view.kind === 'teams' && (
        <TeamsView
          teams={teams}
          unlocked={unlocked}
          onOpen={(i) => setView({ kind: 'team', team: i })}
          onNew={() => {
            onChangeTeams([...teams, { name: `Team ${teams.length + 1}`, slots: [] }]);
            setView({ kind: 'team', team: teams.length });
          }}
          onClose={onClose}
        />
      )}
      {view.kind === 'team' && (
        <TeamView
          team={teams[view.team]}
          unlocked={unlocked}
          notice={shownNotice}
          onDismissNotice={() => setShownNotice(null)}
          onRename={(name) => replaceTeam(view.team, { ...teams[view.team], name })}
          onOpenSlot={(slot) => setView({ kind: 'hero', team: view.team, slot, draft: teams[view.team].slots[slot] })}
          onAdd={() => setView({ kind: 'pick', team: view.team })}
          onDelete={() => {
            onChangeTeams(teams.filter((_, i) => i !== view.team));
            setView({ kind: 'teams' });
          }}
          onFight={() => setView({ kind: 'trials', team: view.team })}
          onBack={() => setView({ kind: 'teams' })}
        />
      )}
      {view.kind === 'hero' && (
        <HeroView
          key={`${view.team}:${view.slot}:${view.draft.heroId}`}
          initial={view.draft}
          isNew={view.slot >= teams[view.team].slots.length}
          unlocked={unlocked}
          onConfirm={(next) => {
            if (view.slot >= teams[view.team].slots.length) replaceTeam(view.team, { ...teams[view.team], slots: [...teams[view.team].slots, next] });
            else replaceSlot(view.team, view.slot, next);
            setView({ kind: 'team', team: view.team });
          }}
          onRemove={() => {
            replaceTeam(view.team, { ...teams[view.team], slots: teams[view.team].slots.filter((_, i) => i !== view.slot) });
            setView({ kind: 'team', team: view.team });
          }}
          onBack={() => setView({ kind: 'team', team: view.team })}
        />
      )}
      {view.kind === 'pick' && (
        <PickView
          team={teams[view.team]}
          unlocked={unlocked}
          onPick={(heroId) => {
            setView({ kind: 'hero', team: view.team, slot: teams[view.team].slots.length, draft: { heroId, pathId: null, moveIds: [], itemIds: [] } });
          }}
          onBack={() => setView({ kind: 'team', team: view.team })}
        />
      )}
      {view.kind === 'trials' && (
        <TrialsView cleared={cleared} onPick={(trialId) => onFightTrial(teams[view.team], trialId, view.team)} onBack={() => setView({ kind: 'team', team: view.team })} />
      )}
    </div>
  );
}
