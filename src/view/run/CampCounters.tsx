import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { playSfx } from '../../audio/sfx';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { rollCampGear, rollCampGemShelf } from '../../run/camp';
import { GEM_ORDER, gemAmount, placeGem, type Gem } from '../../run/gems';
import { MASTERY_CAP, MASTERY_EVOLUTION, anyMasteryEligible, canTakeMastery, crossesMastery } from '../../run/mastery';
import { itemSlotsFor } from '../../run/progression';
import { absorbItem, anyoneCanReceive, type ItemReceipt } from '../../run/runProgress';
import type { RosterEntry, RunState } from '../../run/state';
import { ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { GemIcon, GEM_STONES } from '../shared/GemIcon';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { MasteryPips } from '../shared/MasteryPips';
import { useLongPress } from '../shared/MoveTile';
import { NodeMotes } from '../shared/NodeStage';
import { overlayHost } from '../shared/overlayHost';
import { seededRandom } from '../shared/seededRandom';
import { entryStatTotals } from '../shared/entryStatTotals';
import { EquipChoiceCard, EquipInspectOverlay } from './EquipChoiceCard';
import { EvolutionScreen } from './EvolutionScreen';
import { GearSockets, Preview, ReplaceSheet, useItemReceipts, type PreviewState } from './gearShared';
import { MasteredInnateOverlay } from './MasteredInnateOverlay';
import { useMasteryFlow } from './masteryFlow';
import { MergeBurst, type MergeEvent } from './MergeBurst';
import { MoveOfferOverlay } from './MoveOfferOverlay';
import { mapNodeIcon } from './mapNodeArt';
import './campNode.css';

// The Camp's Gem and Gear counters (docs/guild-hall-overhaul.md §10): the Guild Hall's counters with
// no price. The whole roster above, the stock below; pick a piece, then the hero, and it lands on the
// spot — Mastery pips at the Gems, sockets at the Gear — until the door's count is taken.

const BURST_MS = 700;

const GEM_STAT_SHORT: Record<Gem['stat'], string> = { hp: 'HP', manaPool: 'Mana', attack: 'Atk', defense: 'Def', intelligence: 'Int', wisdom: 'Wis', speed: 'Spd' };

interface CounterProps {
  run: RunState;
  take: number;
  of: number;
  /** Fixes the stock, so a reload lays out the same. */
  seed: number;
  /** Stock slots already taken, held by the caller so a reload neither repays nor forgets them. */
  taken: readonly number[];
  /** A slot taken: the run it landed on. */
  onTaken: (slot: number, next: RunState) => void;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** The camp's firelit frame around a counter: the place's mark, its name, and Continue once the count is taken. */
function CounterFrame({ title, icon, done, onContinue, children }: { title: string; icon: string | undefined; done: boolean; onContinue: () => void; children: React.ReactNode }) {
  return (
    <div className="node-screen rite-screen is-camp camp-node-screen camp-counter-screen" style={{ '--rite-color': '#ec9640' } as CSSProperties}>
      <span className="node-sky camp-ground" aria-hidden="true" />
      <NodeMotes count={10} />
      <header className="rite-head camp-counter-head">
        <span className="rite-place">
          <span className="rite-pool" aria-hidden="true" />
          <img src={icon} className="rite-place-art is-icon" alt="" draggable={false} />
        </span>
        <span className="rite-eyebrow">The Camp</span>
        <h2 className="rite-name">{title}</h2>
      </header>
      {children}
      {done && (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}
    </div>
  );
}

/** Gems: a shelf of distinct stats, `take` of them set straight onto the heroes tapped. */
export function CampGemCounter({ run, take, of, seed, taken, onTaken, onRunChange, onContinue }: CounterProps) {
  const [gems] = useState(() => rollCampGemShelf(run.actNumber, of, seededRandom(seed, 'campGems')));
  const [pick, setPick] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ rosterId: string; key: number } | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const flow = useMasteryFlow(run, onRunChange);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [burst]);

  const full = taken.length >= Math.min(take, gems.length);
  const done = (full || !anyMasteryEligible(run.roster)) && !flow.busy;
  const gem = pick !== null && !taken.includes(pick) && !full ? gems[pick] : null;

  function handleHero(entry: RosterEntry) {
    if (pick === null || !gem || !canTakeMastery(entry)) return;
    const landed = placeGem(run, entry.rosterId, gem);
    const milestone = crossesMastery(entry, 1, MASTERY_EVOLUTION) || crossesMastery(entry, 1, MASTERY_CAP);
    playSfx('gem.set', { pitch: (milestone ? 1.26 : 1) * (0.9 + GEM_ORDER.indexOf(gem.stat) * 0.035) });
    setBurst({ rosterId: entry.rosterId, key: Date.now() });
    setPick(null);
    onTaken(pick, landed);
    flow.raise(entry.rosterId, landed, entry.mastery);
  }

  const evolvingEntry = flow.evolving ? (run.roster.find((r) => r.rosterId === flow.evolving!.rosterId) ?? null) : null;
  if (flow.evolving && evolvingEntry) {
    return <EvolutionScreen hero={rosterHeroes[evolvingEntry.heroId]} entry={evolvingEntry} node={flow.evolving.node} run={run} onChoose={flow.chooseEvolution} />;
  }
  const overflowEntry = flow.overflow ? (run.roster.find((r) => r.rosterId === flow.overflow!.rosterId) ?? null) : null;
  const masteredEntry = flow.mastered ? (run.roster.find((r) => r.rosterId === flow.mastered!.rosterId) ?? null) : null;

  return (
    <CounterFrame title="Gems" icon={mapNodeIcon('scrollReward')} done={done} onContinue={onContinue}>
      <div className="hall-counter-room is-gems camp-counter-room" style={gem ? ({ '--gem-color': GEM_STONES[gem.stat].tones[1] } as CSSProperties) : undefined}>
        <HeroPickGrid count={run.roster.length} columns={3} fill className="counter-roster">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const eligible = canTakeMastery(entry);
            const open = !!gem && eligible;
            const evolves = crossesMastery(entry, 1, MASTERY_EVOLUTION);
            const masters = crossesMastery(entry, 1, MASTERY_CAP) && !!hero.masteredPassiveIds?.length;
            const flaring = burst?.rosterId === entry.rosterId;
            const now = gem ? entryStatTotals(hero, entry, run.relics)[gem.stat] : 0;
            const cta = !eligible ? 'Mastered' : !gem ? `${entry.mastery}/${MASTERY_CAP}` : evolves ? 'Evolves!' : masters ? 'Masters!' : `+${gemAmount(gem)} ${GEM_STAT_SHORT[gem.stat]}`;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!!gem && !open}
                className={[open ? 'is-offered' : '', flaring ? 'is-gem-burst' : ''].filter(Boolean).join(' ') || undefined}
                overlay={flaring ? <span key={burst!.key} className="gem-burst" aria-hidden="true" /> : undefined}
                onActivate={gem ? () => handleHero(entry) : () => setPreview({ hero, entry })}
                onPreview={() => setPreview({ hero, entry })}
                ariaLabel={`${hero.name}, Mastery ${entry.mastery} of ${MASTERY_CAP} — ${cta}`}
                ctaClassName={open ? 'is-accent' : undefined}
                detail={
                  <span className="gem-card-detail">
                    <span className={`gem-card-stat${gem ? '' : ' is-empty'}`} aria-hidden={!gem}>
                      <span className="gem-card-label">{gem ? GEM_STAT_SHORT[gem.stat] : 'HP'}</span>
                      <span className="gem-card-value">{gem ? now : 0}</span>
                      {open && <span className="gem-card-gain">+{gemAmount(gem!)}</span>}
                    </span>
                    <MasteryPips mastery={entry.mastery} gain={open ? 1 : 0} />
                  </span>
                }
                cta={cta}
              />
            );
          })}
        </HeroPickGrid>

        <div className="counter-stock is-gems">
          {gems.map((g, i) => {
            const gone = taken.includes(i) || (full && !taken.includes(i));
            return (
              <button
                key={g.stat}
                type="button"
                className={`counter-good${pick === i ? ' is-picked' : ''}${gone ? ' is-sold' : ''}`}
                disabled={gone}
                onClick={() => {
                  playSfx('ui.pick');
                  setPick(pick === i ? null : i);
                }}
              >
                <span className="counter-good-art">
                  <GemIcon stat={g.stat} size={40} large={g.points >= 10} live={pick === i} />
                </span>
                <span className="counter-good-words">
                  <span className="counter-good-name">
                    +{gemAmount(g)} {GEM_STAT_SHORT[g.stat]}
                  </span>
                  {taken.includes(i) && <span className="counter-good-price is-note">Taken</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {preview && createPortal(<Preview run={run} preview={preview} onClose={() => setPreview(null)} />, overlayHost())}
      {flow.mastered && masteredEntry && <MasteredInnateOverlay entry={masteredEntry} turn={flow.mastered.turn} onClose={flow.closeMastered} />}
      {flow.overflow && overflowEntry && (
        <MoveOfferOverlay
          run={run}
          entry={overflowEntry}
          moveId={flow.overflow.queue[0]}
          eyebrow={flow.overflow.eyebrow ?? 'The Evolution grants a move, and the kit is full'}
          onResolve={flow.resolveOverflow}
        />
      )}
    </CounterFrame>
  );
}

/** A piece on the counter: tap picks it, hold reads it whole. */
function GearGood({ itemId, picked, gone, isTaken, onPick, onInspect }: { itemId: string; picked: boolean; gone: boolean; isTaken: boolean; onPick: () => void; onInspect: () => void }) {
  const item = equipment[itemId];
  const longPress = useLongPress(onInspect, gone ? undefined : onPick);
  if (!item) return null;
  return (
    <button
      type="button"
      className={`counter-good is-gear${picked ? ' is-picked' : ''}${gone ? ' is-sold' : ''}`}
      style={{ '--rarity-color': RARITY_COLOR_VARS[item.rarity] } as CSSProperties}
      aria-disabled={gone}
      data-sfx="none"
      {...longPress}
    >
      <span className="counter-good-art is-piece">
        <ItemPiece item={item} />
      </span>
      <span className="counter-good-words">
        <span className="counter-good-name">{item.name}</span>
        <span className="counter-good-price is-note">{isTaken ? 'Taken' : RARITY_LABELS[item.rarity]}</span>
      </span>
    </button>
  );
}

/** Gear: `of` pieces on the act's curve, `take` of them seated straight onto the heroes tapped. */
export function CampGearCounter({ run, take, of, seed, taken, onTaken, onContinue }: CounterProps) {
  const [itemIds] = useState(() => rollCampGear(run.actNumber, of, seededRandom(seed, 'campGear')));
  const [pick, setPick] = useState<number | null>(null);
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [burst, setBurst] = useState<MergeEvent | null>(null);
  const [flare, setFlare] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [replacing, setReplacing] = useState<RosterEntry | null>(null);

  const full = taken.length >= Math.min(take, itemIds.length);
  const item = pick !== null && !taken.includes(pick) && !full ? equipment[itemIds[pick]] : undefined;
  const receipts = useItemReceipts(run, item);
  // Done at the door's count, or when nobody can take a piece still on the counter.
  const done = full || itemIds.every((id, i) => taken.includes(i) || !equipment[id] || !anyoneCanReceive(run, equipment[id], equipment, rosterHeroes));

  useEffect(() => {
    if (!flare) return;
    const timer = window.setTimeout(() => setFlare(null), BURST_MS);
    return () => window.clearTimeout(timer);
  }, [flare]);

  function handleHero(entry: RosterEntry, replaceIndex?: number) {
    if (pick === null || !item) return;
    const receipt = receipts.get(entry.rosterId);
    if (!receipt || receipt.kind === 'none') return;
    if (receipt.kind === 'replace' && replaceIndex === undefined) {
      setReplacing(entry);
      return;
    }
    setReplacing(null);
    const landed = absorbItem(run, entry.rosterId, item.id, equipment, rosterHeroes, replaceIndex);
    if (receipt.kind === 'merge') setBurst({ resultId: receipt.resultId, inputIds: [receipt.heldItemId, item.id] });
    else playSfx('equip');
    setFlare(entry.rosterId);
    setPick(null);
    onTaken(pick, landed);
  }

  function ctaFor(receipt: ItemReceipt | undefined): string {
    if (!receipt || receipt.kind === 'none') return receipt?.reason === 'ceiling' ? 'At its peak' : 'Full';
    if (receipt.kind === 'merge') return `Merge → ${RARITY_LABELS[receipt.resultRarity]}`;
    if (receipt.kind === 'replace') return 'Replace';
    return 'Take';
  }

  return (
    <CounterFrame title="Gear" icon={mapNodeIcon('equipmentReward')} done={done} onContinue={onContinue}>
      <div className="hall-counter-room is-gear camp-counter-room">
        <div className="counter-focus">{item && <EquipChoiceCard key={item.id} item={item} revealDelayMs={0} labelled showcase onInspect={() => setInspecting(item.id)} />}</div>

        <HeroPickGrid count={run.roster.length} columns={3} fill className="counter-roster">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const receipt = receipts.get(entry.rosterId);
            const open = !!item && !!receipt && receipt.kind !== 'none';
            const cta = item ? ctaFor(receipt) : `${entry.equipment.length}/${itemSlotsFor(hero, entry)}`;
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!!item && !open}
                className={[item && open ? 'is-offered' : '', flare === entry.rosterId ? 'is-blessed' : ''].filter(Boolean).join(' ') || undefined}
                onActivate={item ? () => handleHero(entry) : () => setPreview({ hero, entry })}
                onPreview={() => setPreview({ hero, entry })}
                ariaLabel={`${hero.name} — ${cta}`}
                ctaClassName={receipt?.kind === 'merge' && open ? 'is-accent is-merge' : open ? 'is-accent' : undefined}
                overlay={flare === entry.rosterId ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
                detail={<GearSockets hero={hero} entry={entry} receipt={receipt} open={open} />}
                cta={cta}
              />
            );
          })}
        </HeroPickGrid>

        <div className="counter-stock is-gear">
          {itemIds.map((id, i) => (
            <GearGood
              key={i}
              itemId={id}
              picked={pick === i}
              gone={taken.includes(i) || full}
              isTaken={taken.includes(i)}
              onPick={() => {
                playSfx('ui.pick');
                setPick(pick === i ? null : i);
              }}
              onInspect={() => setInspecting(id)}
            />
          ))}
        </div>
      </div>

      {createPortal(
        <>
          {burst && equipment[burst.resultId] && <MergeBurst merge={burst} onDone={() => setBurst(null)} />}
          {inspecting && equipment[inspecting] && <EquipInspectOverlay item={equipment[inspecting]} onClose={() => setInspecting(null)} />}
          {preview && <Preview run={run} preview={preview} onClose={() => setPreview(null)} />}
          {replacing && <ReplaceSheet entry={replacing} onReplace={(index) => handleHero(replacing, index)} onClose={() => setReplacing(null)} />}
        </>,
        overlayHost()
      )}
    </CounterFrame>
  );
}
