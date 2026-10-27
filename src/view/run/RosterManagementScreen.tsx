import { companionCallMoveId, companionHeroId } from '../../run/companion';
import { CompanionDossier } from '../combat/CompanionFigure';
import { moves } from '../../data/moves';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { classes } from '../../data/classes';
import { progressionTable } from '../../data/progression';
import type { HeroDefinition } from '../../engine/content';
import { MAX_ITEM_SLOTS } from '../../run/equipment';
import { chosenClass } from '../../run/classes';
import { levelOf, xpProgress } from '../../run/growth';
import { chosenEvolutionPaths, itemSlotsFor, rosterEntryTypes, formIdFor } from '../../run/progression';
import type { RunState, RosterEntry } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { ItemDetailOverlay } from '../shared/ItemDossier';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { ItemBox, MergeMark, RARITY_COLOR_VARS, slotBoxes } from '../shared/EquipmentBox';
import { MasteryPips } from '../shared/MasteryPips';
import { WoundBar, entryHp } from '../shared/WoundBar';
import { BlessingMark } from '../shared/BlessingMark';
import { playSfx } from '../../audio/sfx';
import { moveItem, moveReceiptFor, type MoveReceipt } from '../../run/runProgress';
import { MergeBurst, type MergeEvent } from './MergeBurst';

interface Props {
  run: RunState;
  /** Given, a piece can be moved between heroes (docs/gear-absorption.md §2b); absent, the screen only reads. */
  onRunChange?: (next: RunState) => void;
  onClose: () => void;
}

type Socket = { rosterId: string; index: number };

/**
 * The Roster: the whole screen given to the squad, six heroes standing in six alcoves with what
 * the act has left them — level, HP, form, Mastery — and their sockets underneath. Tap a hero for
 * the full sheet. Tap a piece to lift it, then another hero's socket to move, swap or merge it
 * there (docs/gear-absorption.md §2b); hold a piece for what it does.
 */
export function RosterManagementScreen({ run, onRunChange, onClose }: Props) {
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const [viewedItemId, setViewedItemId] = useState<string | null>(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [lifted, setLifted] = useState<Socket | null>(null);
  const [burst, setBurst] = useState<MergeEvent | null>(null);
  const companionId = companionHeroId(run);
  const callMoveId = companionCallMoveId(run);

  function handleSocket(at: Socket) {
    const heldHere = run.roster.find((r) => r.rosterId === at.rosterId)?.equipment[at.index];
    if (!lifted || lifted.rosterId === at.rosterId) {
      const same = lifted && lifted.rosterId === at.rosterId && lifted.index === at.index;
      if (same || !heldHere) {
        setLifted(null);
        return;
      }
      playSfx('ui.pick');
      setLifted(at);
      return;
    }
    const receipt = moveReceiptFor(run, lifted, at, equipment, rosterHeroes);
    if (receipt.kind === 'none') return;
    const liftedId = run.roster.find((r) => r.rosterId === lifted.rosterId)?.equipment[lifted.index];
    onRunChange!(moveItem(run, lifted, at, equipment, rosterHeroes));
    setLifted(null);
    if (receipt.kind === 'merge') {
      setBurst({ resultId: receipt.resultId, inputIds: [liftedId ?? receipt.resultId, heldHere ?? receipt.resultId] });
    } else playSfx('equip');
  }

  return (
    <div
      className="log-overlay roster-sheet-overlay"
      onClick={() => {
        // The long-press item popup mounts mid-gesture, so the release click's mousedown and
        // mouseup targets differ and the browser dispatches it on their common ancestor — this
        // overlay — bypassing the popup's own stopPropagation. Treat that click as closing the popup.
        if (viewedItemId) {
          setViewedItemId(null);
          return;
        }
        if (lifted) {
          setLifted(null);
          return;
        }
        onClose();
      }}
    >
      <div className="log-panel roster-sheet" onClick={(e) => { e.stopPropagation(); setLifted(null); }}>
        <div className="log-panel-header roster-sheet-header">
          <span>Roster</span>
        </div>

        <div className="roster-sheet-grid">
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            return (
              <RosterSheetCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                relicIds={run.relics}
                onInspect={() => {
                  playSfx('ui.select');
                  setInspecting({ hero, entry });
                }}
                onItem={setViewedItemId}
                lifted={lifted}
                receiptAt={(index) => (lifted && lifted.rosterId !== entry.rosterId ? moveReceiptFor(run, lifted, { rosterId: entry.rosterId, index }, equipment, rosterHeroes) : null)}
                onSocket={onRunChange ? (index) => handleSocket({ rosterId: entry.rosterId, index }) : undefined}
              />
            );
          })}
        </div>

        {/* The companion travels with the six but is not one of them (docs/companion-call.md §8): read here, never managed. */}
        {companionId && callMoveId && (
          <button
            type="button"
            className="roster-companion"
            style={{ '--hero-rgb': getTypeColorRgb(moves[callMoveId].type) } as CSSProperties}
            onClick={() => setCompanionOpen(true)}
            aria-label={`${rosterHeroes[companionId].name}, travelling with you — view its Call`}
          >
            <CenteredFigure heroId={companionId} />
            <span className="roster-companion-ident">
              <span className="roster-companion-kicker">Companion</span>
              <span className="roster-companion-name">{rosterHeroes[companionId].name}</span>
            </span>
            <span className="roster-companion-call">
              <span className="roster-companion-kicker">Call</span>
              <span className="roster-companion-move">{moves[callMoveId].name}</span>
            </span>
          </button>
        )}

        {/* The sheet's one way out, pinned to the bottom in thumb reach. */}
        <button className="resolve-button roster-close-button" onClick={onClose}>
          Close
        </button>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setInspecting(null)}
        />
      )}

      <ItemDetailOverlay item={viewedItemId ? (equipment[viewedItemId] ?? null) : null} onClose={() => setViewedItemId(null)} />
      {companionOpen && <CompanionDossier run={run} onClose={() => setCompanionOpen(false)} />}
      {burst && equipment[burst.resultId] && <MergeBurst merge={burst} onDone={() => setBurst(null)} />}
    </div>
  );
}

/**
 * The companion's figure, centred in its seat by what it draws: a spawn stands on the floor of its
 * frame and an Early one fills little of it, so the frame's middle is not the figure's.
 */
function CenteredFigure({ heroId }: { heroId: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [lift, setLift] = useState(0);
  useLayoutEffect(() => {
    const seat = ref.current;
    const figure = seat?.firstElementChild;
    if (!seat || !figure) return;
    const parts = Array.from(figure.children).filter((part) => part.tagName.toLowerCase() !== 'defs');
    if (parts.length === 0) return;
    const box = seat.getBoundingClientRect();
    const rects = parts.map((part) => part.getBoundingClientRect());
    const middle = (Math.min(...rects.map((r) => r.top)) + Math.max(...rects.map((r) => r.bottom))) / 2;
    if (box.height > 0) setLift(((middle - (box.top + box.height / 2)) / box.height) * 100);
  }, [heroId]);
  return (
    <span ref={ref} className="roster-companion-seat" style={{ translate: `0 ${-lift}%` }}>
      <HeroPortrait heroId={heroId} className="roster-companion-portrait" />
    </span>
  );
}

interface CardProps {
  hero: HeroDefinition;
  entry: RosterEntry;
  relicIds: readonly string[];
  onInspect: () => void;
  onItem: (itemId: string) => void;
  lifted: Socket | null;
  /** What dropping the lifted piece on this hero's socket would do; null when nothing is lifted or it is this hero's own. */
  receiptAt: (index: number) => MoveReceipt | null;
  /** Absent on a read-only roster: a tap then shows the piece. */
  onSocket?: (index: number) => void;
}

function socketClass(receipt: MoveReceipt | null, isLifted: boolean): string | undefined {
  if (isLifted) return 'selected';
  if (!receipt) return undefined;
  if (receipt.kind === 'merge') return 'merge-target';
  return receipt.kind === 'none' ? 'is-refused' : 'drop-target';
}

/** One hero: the alcove it stands in (tap for the sheet), then its HP, Mastery and sockets. */
function RosterSheetCard({ hero, entry, relicIds, onInspect, onItem, lifted, receiptAt, onSocket }: CardProps) {
  const level = levelOf(entry);
  const { hp, maxHp } = entryHp(hero, entry, relicIds);
  const form = chosenEvolutionPaths(progressionTable, entry).slice(-1)[0]?.name ?? null;
  const heroClass = chosenClass(classes, entry);
  const boxes = slotBoxes(entry.equipment, itemSlotsFor(hero, entry));
  const locked = Math.max(0, MAX_ITEM_SLOTS - boxes.length);
  const types = rosterEntryTypes(hero, entry);

  const label = `${hero.name}, level ${level} — view sheet`;
  const formLine = [form, heroClass?.name.replace('Class - ', '')].filter(Boolean).join(' · ');

  return (
    <div
      className={`roster-sheet-card${entry.down ? ' is-down' : ''}`}
      style={{ '--hero-color': getTypeColor(types[0]), '--hero-rgb': getTypeColorRgb(types[0]) } as CSSProperties}
    >
      <div className="roster-sheet-top">
        <button type="button" className="roster-sheet-alcove" data-sfx="none" onClick={onInspect} aria-label={label}>
          <HeroPortrait heroId={hero.id} pathId={formIdFor(entry)} className="roster-sheet-figure" />
          <span className="roster-sheet-level">
            <small>Lv</small>
            {level}
          </span>
          <span className="roster-sheet-types">
            {types.map((t) => (
              <TypeBadge key={t} type={t} iconOnly />
            ))}
          </span>
          {entry.down && <span className="roster-sheet-down">Down</span>}
          {entry.blessed && <BlessingMark className="roster-sheet-blessing" />}
          {/* The level's bar, laid along the alcove's floor. */}
          <span className="roster-sheet-xp" aria-hidden="true">
            <span style={{ width: `${Math.round(xpProgress(entry.xp) * 100)}%` }} />
          </span>
        </button>

        <div className="equip-mount roster-sheet-mount" onClick={onSocket ? (e) => e.stopPropagation() : undefined}>
          {boxes.map((itemId, index) => {
            const item = itemId ? (equipment[itemId] ?? null) : null;
            const receipt = receiptAt(index);
            const isLifted = lifted?.rosterId === entry.rosterId && lifted.index === index;
            return (
              <ItemBox
                key={index}
                item={item}
                className={socketClass(receipt, isLifted)}
                style={receipt?.kind === 'merge' ? ({ '--merge-color': RARITY_COLOR_VARS[receipt.resultRarity] } as CSSProperties) : undefined}
                sfx={onSocket ? 'none' : undefined}
                onTap={onSocket ? () => onSocket(index) : item ? () => onItem(item.id) : undefined}
                onLongPress={item ? () => onItem(item.id) : undefined}
              >
                {receipt?.kind === 'merge' && <MergeMark />}
              </ItemBox>
            );
          })}
          {Array.from({ length: locked }, (_, i) => (
            <span key={`locked-${i}`} className="item-box is-locked" aria-hidden="true" />
          ))}
        </div>
      </div>

      <button type="button" className="roster-sheet-foot" data-sfx="none" onClick={onInspect} aria-label={label} tabIndex={-1}>
        <span className="roster-sheet-ident">
          <span className="roster-sheet-name">{hero.name}</span>
          {formLine && <span className="roster-sheet-form">{formLine}</span>}
        </span>
        <WoundBar hp={hp} maxHp={maxHp} figure className="roster-sheet-hp" />
        <MasteryPips mastery={entry.mastery} marked className="roster-sheet-mastery" />
      </button>
    </div>
  );
}
