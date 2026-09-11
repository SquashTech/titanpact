import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { canvasPoint, overlayHost } from './overlayHost';

/**
 * Picking a piece up and carrying it, on a phone.
 *
 * The gear board was on HTML5 drag-and-drop, which does not exist on touch — `dragstart` never
 * fires from a finger, so the drag half of "tap it, or drag it" was desktop-only and the game is
 * portrait-mobile. This is the pointer-event replacement: one gesture, same on both.
 *
 * Three gestures share one pointerdown, separated by what happens next:
 *   - release without moving      -> a TAP (the caller's select / place)
 *   - hold ~500ms without moving   -> the long-press readout (useLongPress owns that)
 *   - move past DRAG_START_PX      -> a DRAG, and the other two are cancelled
 *
 * Hit-testing is `elementFromPoint` against a `data-gear-slot` attribute rather than per-slot
 * pointer events, because the carried piece sits under the finger and would eat every one of them.
 */

/** Past this the gesture is a carry. Under useLongPress's 12px cancel, so a drag never also fires a hold. */
const DRAG_START_PX = 7;

/** The attribute every droppable slot stamps. Its value is the caller's own slot key. */
export const GEAR_SLOT_ATTR = 'data-gear-slot';

export interface GearDragState {
  /** The slot key the carry started from. */
  fromKey: string;
  /** The slot key currently under the finger, or null over dead ground. */
  overKey: string | null;
  /** Where the finger is, in CANVAS px — the piece is drawn inside the scaled shell, not the viewport. */
  x: number;
  y: number;
  /** The source box's side, in canvas px, so the carried piece leaves at the size it sat at. */
  size: number;
}

interface Options {
  /** What the piece looks like in the air. Null for a slot that cannot be carried from. */
  render: (fromKey: string) => ReactNode;
  /** Whether `overKey` would accept the carried piece — drives the carried piece's own "this lands" state. */
  canDrop: (fromKey: string, overKey: string) => boolean;
  /** A completed carry onto a slot that accepts it. */
  onDrop: (fromKey: string, overKey: string) => void;
  /** Fired the moment a carry begins, so the caller can select the source and play its cue. */
  onLift?: (fromKey: string) => void;
}

export interface GearDrag {
  /** Spread onto every draggable box. Returns nothing for an empty slot. */
  handleProps: (key: string, draggable: boolean) => { onPointerDown?: (e: ReactPointerEvent) => void };
  /** State classes for a slot: `is-lifted` for the source, `is-over` for the one under the finger. */
  slotClass: (key: string) => string;
  drag: GearDragState | null;
  /** The carried piece. Render it once, anywhere — it portals to the shell. */
  overlay: ReactNode;
}

function slotKeyAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const slot = el?.closest(`[${GEAR_SLOT_ATTR}]`);
  return slot?.getAttribute(GEAR_SLOT_ATTR) ?? null;
}

export function useGearDrag({ render, canDrop, onDrop, onLift }: Options): GearDrag {
  const [drag, setDrag] = useState<GearDragState | null>(null);
  // The gesture before it is a drag: where it started and which slot from, held out of state so a
  // pointermove that is still under the threshold costs no render.
  const arm = useRef<{ key: string; x: number; y: number; size: number; pointerId: number } | null>(null);
  const dragRef = useRef<GearDragState | null>(null);
  dragRef.current = drag;

  // Window-level, not on the box: the finger leaves the 46px box within the first few pixels of any
  // real carry, and a captured pointer on the box would still not tell us what is underneath it.
  useEffect(() => {
    function move(e: PointerEvent) {
      const armed = arm.current;
      if (armed && !dragRef.current) {
        if (Math.hypot(e.clientX - armed.x, e.clientY - armed.y) < DRAG_START_PX) return;
        onLift?.(armed.key);
        const at = canvasPoint(e.clientX, e.clientY);
        setDrag({ fromKey: armed.key, overKey: slotKeyAt(e.clientX, e.clientY), x: at.x, y: at.y, size: armed.size });
        return;
      }
      if (!dragRef.current) return;
      e.preventDefault();
      const overKey = slotKeyAt(e.clientX, e.clientY);
      const at = canvasPoint(e.clientX, e.clientY);
      setDrag((d) => (d ? { ...d, overKey, x: at.x, y: at.y } : d));
    }
    function up(e: PointerEvent) {
      const current = dragRef.current;
      arm.current = null;
      if (!current) return;
      setDrag(null);
      const overKey = slotKeyAt(e.clientX, e.clientY);
      if (overKey && overKey !== current.fromKey && canDrop(current.fromKey, overKey)) onDrop(current.fromKey, overKey);
    }
    // `passive: false` on move so a carry can preventDefault the page scroll under it.
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [canDrop, onDrop, onLift]);

  const handleProps = useCallback((key: string, draggable: boolean) => {
    if (!draggable) return {};
    return {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        // The box measures in viewport px; the carry is drawn in canvas px, so it comes off the scale.
        const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const { scale } = canvasPoint(e.clientX, e.clientY);
        arm.current = { key, x: e.clientX, y: e.clientY, size: Math.max(box.width, box.height) / scale, pointerId: e.pointerId };
      },
    };
  }, []);

  const slotClass = useCallback(
    (key: string) => {
      if (!drag) return '';
      if (drag.fromKey === key) return ' is-lifted';
      if (drag.overKey === key && canDrop(drag.fromKey, key)) return ' is-over';
      return '';
    },
    [drag, canDrop]
  );

  const landing = drag ? !!drag.overKey && drag.overKey !== drag.fromKey && canDrop(drag.fromKey, drag.overKey) : false;
  const overlay =
    drag &&
    createPortal(
      <div
        className={`gear-carry${landing ? ' is-landing' : ''}`}
        style={{ left: drag.x, top: drag.y, width: drag.size, height: drag.size }}
        aria-hidden="true"
      >
        {render(drag.fromKey)}
      </div>,
      overlayHost()
    );

  return { handleProps, slotClass, drag, overlay };
}
