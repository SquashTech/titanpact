import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { canvasPoint } from '../shared/overlayHost';
import { PlateButton } from '../shared/PlateButton';

export interface PreviewTile {
  id: string;
  el: HTMLElement;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TILE_PAD = 6;
/** The least gap the preview card keeps from the header above it and the row below it. */
const CARD_MARGIN = 8;

/** Each tile's box in canvas px (the overlay lives inside the scaled shell). */
function measureTiles(tiles: readonly PreviewTile[]): Record<string, Box> {
  const boxes: Record<string, Box> = {};
  for (const { id, el } of tiles) {
    const rect = el.getBoundingClientRect();
    const a = canvasPoint(rect.left, rect.top);
    const b = canvasPoint(rect.right, rect.bottom);
    boxes[id] = { left: a.x - TILE_PAD, top: a.y - TILE_PAD, width: b.x - a.x + TILE_PAD * 2, height: b.y - a.y + TILE_PAD * 2 };
  }
  return boxes;
}

/** The top of the row as drawn, in canvas px: the highest tile, its name or its lead-on marks over it. */
function measureRowTop(tiles: readonly PreviewTile[], boxes: Record<string, Box>): number {
  let top = Math.min(...Object.values(boxes).map((b) => b.top));
  for (const { el } of tiles) {
    const choice = el.closest('.road-stop');
    if (!choice) continue;
    for (const part of Array.from(choice.children)) {
      if (!part.childElementCount && !part.textContent?.trim()) continue;
      const rect = part.getBoundingClientRect();
      if (rect.height > 0) top = Math.min(top, canvasPoint(rect.left, rect.top).y);
    }
  }
  return top;
}

/** An element of the screen around the route, in canvas px; null when it is not drawn. */
function measureSelector(selector: string): Box | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const a = canvasPoint(rect.left, rect.top);
  const b = canvasPoint(rect.right, rect.bottom);
  return { left: a.x, top: a.y, width: b.x - a.x, height: b.y - a.y };
}

/**
 * The map's preview: the tile being read lit, the rest of its row half-lit and still tappable, the
 * node's card just above the row, and the plate that goes centred between the
 * row and the footer. The header and the footer stay lit — the footer's chips wear the node's mark
 * meanwhile (MapScreen) — and a tap anywhere else closes it.
 */
export function MapPreview({
  tiles,
  previewId,
  color,
  label,
  onTap,
  onBack,
  onGo,
  pages,
}: {
  tiles: readonly PreviewTile[];
  previewId: string;
  color: string;
  label: string;
  onTap: (id: string) => void;
  onBack: () => void;
  onGo: () => void;
  /** Every readable tile's sheet in the row, stacked so the card is the tallest and holds still between taps. */
  pages: readonly { id: string; content: ReactNode }[];
}) {
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [frame, setFrame] = useState<{ header: Box | null; footer: Box | null }>({ header: null, footer: null });
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardSeat, setCardSeat] = useState<{ top: number; maxHeight?: number } | null>(null);
  const maskId = useId();
  const tileKey = tiles.map((t) => t.id).join(',');
  useLayoutEffect(() => {
    const measure = () => {
      const measured = measureTiles(tiles);
      const header = measureSelector('.map-header');
      setBoxes(measured);
      setFrame({ header, footer: measureSelector('.map-footer') });
      // The card sits just above the row, and the row never moves: a card too tall for the room
      // under the header scrolls inside itself.
      const card = cardRef.current;
      const rowTop = measureRowTop(tiles, measured);
      if (!card || !Number.isFinite(rowTop)) return;
      const ceiling = header ? header.top + header.height : 0;
      const room = Math.max(0, rowTop - ceiling - CARD_MARGIN * 2);
      const height = card.scrollHeight + card.offsetHeight - card.clientHeight;
      if (height > room + 1) setCardSeat({ top: ceiling + CARD_MARGIN, maxHeight: room });
      else setCardSeat({ top: rowTop - CARD_MARGIN - height });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileKey, previewId]);

  const rowFoot = Math.max(0, ...Object.values(boxes).map((b) => b.top + b.height));
  const lit = [frame.header, frame.footer].filter((b): b is Box => b !== null);

  return (
    <div className="map-preview" onClick={onBack} style={{ '--node-color': color } as CSSProperties}>
      <svg className="map-preview-scrim" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {lit.map((b, i) => (
              <rect key={i} x={b.left} y={b.top} width={b.width} height={b.height} fill="black" />
            ))}
            {Object.entries(boxes).map(([id, b]) => (
              <rect key={id} x={b.left} y={b.top} width={b.width} height={b.height} rx="12" fill={id === previewId ? 'black' : '#666'} />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" className="map-preview-scrim-fill" mask={`url(#${maskId})`} />
      </svg>
      {Object.entries(boxes).map(([id, b]) => (
        <button
          key={id}
          type="button"
          className={`map-preview-hit${id === previewId ? ' is-lit' : ''}`}
          style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
          aria-label={id === previewId ? `Go: ${label}` : 'Read this one'}
          data-sfx="none"
          onClick={(e) => {
            e.stopPropagation();
            onTap(id);
          }}
        />
      ))}
      <div
        className="map-preview-card"
        ref={cardRef}
        style={{
          top: cardSeat?.top ?? (frame.header ? frame.header.top + frame.header.height : 0) + CARD_MARGIN,
          maxHeight: cardSeat?.maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="map-preview-stack">
          {pages.map((page) => (
            <div key={page.id} className={`map-preview-page${page.id === previewId ? '' : ' is-hidden'}`} aria-hidden={page.id !== previewId}>
              {page.content}
            </div>
          ))}
        </div>
      </div>
      {rowFoot > 0 && (
        <div className="map-preview-go-seat" style={{ top: frame.footer ? (rowFoot + frame.footer.top) / 2 : rowFoot + 40 }} onClick={(e) => e.stopPropagation()}>
          <PlateButton tint={color} onClick={onGo} data-sfx="none" className="map-preview-go">
            {label}
          </PlateButton>
        </div>
      )}
    </div>
  );
}
