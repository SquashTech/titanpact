// Scales the app shell as a fixed-size design canvas (~394px wide) transform-scaled to fill the
// device viewport. JS-measured px + `transform: scale()` on purpose: CSS `zoom` + dvh/vw measured
// inconsistently across real mobile webviews. Scale is min(width ratio, height ratio) so short
// viewports don't gain overflow; REFERENCE_HEIGHT sits well below phone heights so it rarely binds.
// The width ratio uses the footprint (capped at MAX_WIDTH), not the raw viewport — otherwise a wide
// screen inflates scale and *narrows* the canvas.

const REFERENCE_WIDTH = 394;
const REFERENCE_HEIGHT = 700;
const MAX_WIDTH = 430;
const MIN_SCALE = 1;
// Backstop only: the capped footprint keeps the width ratio ≤ 430/394 ≈ 1.09.
const MAX_SCALE = 1.2;

// Layout viewport px plus the page zoom relating them to device px. At zoom 0.5 an iPhone with
// `screen 390x844` reports `innerWidth 780`; page zoom is a per-site browser setting the page can't
// prevent, so it is measured and compensated for — `layout()` works in device px throughout.
function viewportMetrics(): { vw: number; vh: number; zoom: number } {
  const vv = window.visualViewport;
  if (!vv) return { vw: window.innerWidth, vh: window.innerHeight, zoom: 1 };
  return { vw: vv.width, vh: vv.height, zoom: vv.scale > 0 ? vv.scale : 1 };
}

// Portrait only. The manifest's `orientation: portrait` covers an installed Android PWA and
// nothing else — a browser tab obeys the device, and iOS ignores the manifest entirely. So the
// lock is asked for where the API will grant it, and where it will not the canvas is ROTATED into
// the landscape viewport rather than squashed into it. The game never renders landscape.
function lockPortrait(): void {
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
    | undefined;
  // Rejects outside fullscreen / an installed app — which is exactly when `rotate` below covers it.
  orientation?.lock?.('portrait').catch(() => {});
}

/** A phone, not a desktop window that happens to be short and wide. */
function isHandheld(): boolean {
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false;
}

/**
 * Which way to turn the canvas back, in degrees. A quarter turn is upright for one of the two
 * landscape orientations and upside-down for the other, so it is taken from the device rather than
 * assumed: at angle 90 the top of the phone points LEFT, so it is righted by turning it clockwise,
 * and the canvas has to lean the same way for that to be the gesture the screen asks for.
 */
function quarterTurn(): 90 | -90 {
  const angle = window.screen?.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
  return angle === 90 ? -90 : 90;
}

function layout(shell: HTMLElement): void {
  const { vw, vh, zoom } = viewportMetrics();

  const deviceWidth = vw * zoom;
  const deviceHeight = vh * zoom;

  // A turned phone: lay the canvas against the screen's SHORT edge and give it a quarter turn.
  // A landscape tablet is excluded by REFERENCE_HEIGHT — the portrait canvas still fits upright
  // there, and turning a screen the player did not turn would be the bug, not the fix.
  const rotate = deviceWidth > deviceHeight && deviceHeight < REFERENCE_HEIGHT && isHandheld();
  // The screen extents the canvas's own width and height are laid along.
  const across = rotate ? deviceHeight : deviceWidth;
  const along = rotate ? deviceWidth : deviceHeight;

  const footprintWidth = Math.min(across, MAX_WIDTH);
  const rawScale = Math.min(footprintWidth / REFERENCE_WIDTH, along / REFERENCE_HEIGHT);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));

  // Back to layout px; the transform carries the extra 1/zoom so the shell still covers the screen.
  shell.style.width = `${footprintWidth / scale}px`;
  shell.style.height = `${along / scale}px`;

  if (rotate) {
    // transform-origin is top left, so the quarter turn sweeps the element clean off one edge of the
    // screen: it is translated a whole viewport back onto it, then centred along the short edge.
    const turn = quarterTurn();
    const canvas = footprintWidth / zoom;
    const x = turn === 90 ? vw : 0;
    const y = turn === 90 ? (vh - canvas) / 2 : (vh + canvas) / 2;
    shell.style.left = '0px';
    shell.style.transform = `translate(${x}px, ${y}px) rotate(${turn}deg) scale(${scale / zoom})`;
  } else {
    shell.style.left = `${(vw - footprintWidth / zoom) / 2}px`;
    shell.style.transform = `scale(${scale / zoom})`;
  }
}

/** Call from a mount effect once the app-shell element exists. Returns a cleanup function. */
export function initUiScale(shell: HTMLElement): () => void {
  const relayout = () => layout(shell);
  lockPortrait();
  relayout();
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  window.visualViewport?.addEventListener('resize', relayout);
  return () => {
    window.removeEventListener('resize', relayout);
    window.removeEventListener('orientationchange', relayout);
    window.visualViewport?.removeEventListener('resize', relayout);
  };
}
