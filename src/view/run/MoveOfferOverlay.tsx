import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { rosterHeroes } from '../../data/content';
import { moves } from '../../data/moves';
import type { RosterEntry, RunState } from '../../run/state';
import { MOVE_CAP } from '../../run/progression';
import { levelOf } from '../../run/growth';
import { getTypeColor, getTypeColorRgb } from '../combat/typeColors';
import { playSfx } from '../../audio/sfx';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { HeroPortrait } from '../shared/HeroPortrait';
import { MoveButtonReplica, useLongPress } from '../shared/MoveTile';
import { HubGlyph } from '../shared/nodeIcons';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { healCasterForEntry } from '../shared/healCaster';
import { overlayHost } from '../shared/overlayHost';

/** The largest `data-fit` step styles.css authors for this overlay. */
const MAX_FIT_STEP = 2;

/**
 * Sizes the offer to the screen it lands on: tries each `data-fit` step from the largest down and
 * keeps the first under which the panel does not scroll (styles.css, "Fit steps"). Written to the
 * DOM rather than to state, so every try is measured and discarded inside one layout pass and the
 * player never sees a size that did not fit. `deps` are whatever changes the panel's content height.
 */
function useFitStep(overlayRef: RefObject<HTMLDivElement | null>, deps: readonly unknown[]) {
  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const panel = overlay?.querySelector<HTMLElement>('.moveoffer-panel');
    if (!overlay || !panel) return;
    const fit = () => {
      for (let step = MAX_FIT_STEP; step >= 0; step--) {
        overlay.dataset.fit = String(step);
        if (step === 0 || panel.scrollHeight <= panel.clientHeight) break;
      }
    };
    fit();
    // The overlay's box is the canvas's, so this fires on a resize or a rotation and never on a step change.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(overlay);
    // A web font landing after the first pass can change a line's height.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

interface Props {
  run: RunState;
  entry: RosterEntry;
  moveId: string;
  /** Line above the card — what bought this offer. */
  eyebrow: string;
  /** `null` declines. The move is already burned from the pool either way; the caller owns that. */
  onResolve: (replaceMoveId: string | null, learn: boolean) => void;
  /** The hero's own signature (docs/mastery.md §5): the same question, dressed as the event it is. */
  signature?: boolean;
}

/**
 * One move, offered to one hero: learn it, or decline. At `MOVE_CAP` the offer grows a second
 * question — which of the four goes — and the confirm waits on an answer to it.
 *
 * Its own component rather than LevelUpScreen's, which is a full-screen stage and only ever
 * handles the at-cap half. This is the shape a Mastery Scroll needs (docs/growth-overhaul.md §4),
 * and it wears the same `.reward-panel` / `.moveoffer-*` classes so the two read as one screen.
 */
export function MoveOfferOverlay({ run, entry, moveId, eyebrow, onResolve, signature = false }: Props) {
  const [selectedReplaceId, setSelectedReplaceId] = useState<string | null>(null);
  const [popupMoveId, setPopupMoveId] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  // The Learn button's line changes with the pick, and a longer one can wrap.
  useFitStep(overlayRef, [moveId, entry, selectedReplaceId]);

  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const atCap = entry.unlockedMoveIds.length >= MOVE_CAP;
  const headPress = useLongPress(() => setPopupMoveId(moveId));

  function resolve(replaceMoveId: string | null, learn: boolean) {
    playSfx(learn ? 'scroll.spend' : 'ui.back');
    onResolve(replaceMoveId, learn);
  }

  return createPortal(
    <div className={`log-overlay moveoffer-overlay${signature ? ' is-signature' : ''}`} style={signature ? signatureStyle(hero.types[0]) : undefined} ref={overlayRef}>
      <div className={`reward-panel moveoffer-panel${signature ? ' is-signature' : ''}`}>
        {signature && <SignatureCrest />}
        {/* The cards below are terse — the rule under each payload is in here instead. */}
        <button
          type="button"
          className="moveoffer-reference"
          onClick={() => setReferenceOpen(true)}
          aria-label="Reference"
          title="Reference"
        >
          <HubGlyph name="reference" />
        </button>
        <div className="offer-hero-head" {...headPress}>
          <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
          <h3>{hero.name}</h3>
        </div>
        <p className="offer-hero-eyebrow">{eyebrow}</p>

        <SignatureFrame on={signature}>
          <MoveDetailCard move={moves[moveId]} label="New move offered" caster={caster} terse />
        </SignatureFrame>

        {atCap && (
          <>
            <div className="offer-swap-arrow" aria-hidden="true">
              ↓ replaces one of
            </div>
            <div className="move-list offer-replace-list">
              {entry.unlockedMoveIds.map((id) => (
                <MoveButtonReplica
                  key={id}
                  move={moves[id]}
                  selected={selectedReplaceId === id}
                  caster={caster}
                  onClick={() => setSelectedReplaceId(id)}
                  onLongPress={() => setPopupMoveId(id)}
                />
              ))}
            </div>
          </>
        )}

        <div className="reward-panel-actions moveoffer-actions">
          <button className="moveoffer-button moveoffer-decline" onClick={() => resolve(null, false)}>
            <span className="moveoffer-icon" aria-hidden="true">
              ✕
            </span>
            <span className="moveoffer-label">{atCap ? 'Keep moveset' : 'Decline'}</span>
          </button>
          <button
            className="moveoffer-button moveoffer-confirm"
            disabled={atCap && !selectedReplaceId}
            onClick={() => resolve(selectedReplaceId, true)}
          >
            <span className="moveoffer-icon" aria-hidden="true">
              ✓
            </span>
            <span className="moveoffer-label">Learn</span>
            <span className="moveoffer-sub">
              {atCap ? (selectedReplaceId ? `Replace ${moves[selectedReplaceId].name}` : 'Pick a move first') : moves[moveId].name}
            </span>
          </button>
        </div>
      </div>

      {popupMoveId && (
        <div className="log-overlay" onClick={() => setPopupMoveId(null)}>
          <div className="log-panel move-popup-panel" onClick={(e) => e.stopPropagation()}>
            <MoveDetailCard move={moves[popupMoveId]} caster={caster} />
            <div className="move-popup-hint">Tap anywhere to close</div>
          </div>
        </div>
      )}
      {referenceOpen && <ReferenceOverlay initialTab="statuses" onClose={() => setReferenceOpen(false)} />}
    </div>,
    overlayHost()
  );
}

interface LearnedProps {
  run: RunState;
  entry: RosterEntry;
  moveId: string;
  eyebrow: string;
  onClose: () => void;
  signature?: boolean;
}

/**
 * The receipt for a Scroll poured into a hero with room in its kit (2026-09-10, per user
 * direction): the move is already learned by the time this mounts, so there is nothing to ask —
 * one card and one button. The same panel the offer wears, so a pour below the cap and a pour at
 * it read as the same beat with a question added, not as two screens.
 */
export function MoveLearnedOverlay({ run, entry, moveId, eyebrow, onClose, signature = false }: LearnedProps) {
  const hero = rosterHeroes[entry.heroId];
  const caster = healCasterForEntry(hero, entry, run.relics);
  const overlayRef = useRef<HTMLDivElement>(null);
  useFitStep(overlayRef, [moveId, entry]);
  return createPortal(
    <div className={`log-overlay moveoffer-overlay${signature ? ' is-signature' : ''}`} style={signature ? signatureStyle(hero.types[0]) : undefined} ref={overlayRef}>
      <div className={`reward-panel moveoffer-panel is-learned${signature ? ' is-signature' : ''}`}>
        {signature && <SignatureCrest />}
        <div className="offer-hero-head">
          <HeroPortrait heroId={hero.id} className="offer-hero-portrait" />
          <h3>{hero.name}</h3>
        </div>
        <p className="offer-hero-eyebrow">{eyebrow}</p>

        <SignatureFrame on={signature}>
          <MoveDetailCard move={moves[moveId]} label="Move learned" caster={caster} terse />
        </SignatureFrame>

        <div className="reward-panel-actions moveoffer-actions">
          <button className="moveoffer-button moveoffer-confirm" onClick={onClose}>
            <span className="moveoffer-icon" aria-hidden="true">
              ✓
            </span>
            <span className="moveoffer-label">Continue</span>
            <span className="moveoffer-sub">{moves[moveId].name} learned</span>
          </button>
        </div>
      </div>
    </div>,
    overlayHost()
  );
}

interface SignatureBoxProps {
  run: RunState;
  entry: RosterEntry;
  offer: { moveId: string; learned: boolean };
  onResolve: (replaceMoveId: string | null, learn: boolean) => void;
  onClose: () => void;
}

/**
 * The box a hero's signature ends in (docs/mastery.md §5; levelUpFlow.ts): a receipt below the
 * cap, the replace question at it — the same two boxes a level's offer uses, dressed for the one
 * move that is this hero's and nobody else's: a crest that bursts in over the hero's name, the
 * card framed in the hero's own type colour, a fanfare in its element's voice. A signature is
 * learned once a run, so it gets the one screen here allowed to be loud.
 */
export function SignatureBox({ run, entry, offer, onResolve, onClose }: SignatureBoxProps) {
  const hero = rosterHeroes[entry.heroId];
  const eyebrow = `Level ${levelOf(entry)} — ${hero.name}'s own move`;
  useEffect(() => {
    playSfx('class.learn');
    playSfx(`cast.${hero.types[0]}` as Parameters<typeof playSfx>[0], { delay: 0.25 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return offer.learned ? (
    <MoveLearnedOverlay run={run} entry={entry} moveId={offer.moveId} eyebrow={eyebrow} onClose={onClose} signature />
  ) : (
    <MoveOfferOverlay run={run} entry={entry} moveId={offer.moveId} eyebrow={eyebrow} onResolve={onResolve} signature />
  );
}

/** The hero's type colour, handed to every signature layer as one pair of custom properties. */
function signatureStyle(type: string): CSSProperties {
  return { '--sig-color': getTypeColor(type), '--sig-rgb': getTypeColorRgb(type) } as CSSProperties;
}

/** The crest that bursts in above a signature: a flash, wheeling rays, a star-flanked title. Decorative — the eyebrow and the card label say the same in text. */
function SignatureCrest() {
  return (
    <div className="signature-crest" aria-hidden="true">
      <span className="signature-crest-flash" />
      <span className="signature-crest-rays" />
      <span className="signature-crest-title">
        <span className="signature-crest-star">✦</span>
        Signature Move
        <span className="signature-crest-star">✦</span>
      </span>
    </div>
  );
}

/** The move card's panel — for a signature, inside a shimmering type-coloured frame with motes rising off it. */
function SignatureFrame({ on, children }: { on: boolean; children: ReactNode }) {
  if (!on) return <div className="offer-move-highlight">{children}</div>;
  return (
    <div className="signature-frame">
      <span className="signature-frame-sheen" aria-hidden="true" />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="signature-mote" style={{ '--mote': i } as CSSProperties} aria-hidden="true" />
      ))}
      <div className="offer-move-highlight is-signature">{children}</div>
    </div>
  );
}
