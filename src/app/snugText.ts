// A line of copy that wraps by a word or two is drawn a touch smaller so it stays on one line.
// Runs over the whole document, so a new screen's text is covered by its class names alone; a
// subtree that wants to wrap as authored opts out with `data-snug="off"`.

/** Text blocks by naming convention: a description, a rule, a subline, a note, a label. */
const SNUG_SELECTOR = [
  'p',
  '[class*="-desc"]',
  '[class*="-text"]',
  '[class*="-sub"]',
  '[class*="-note"]',
  '[class*="-readout"]',
  '[class*="-label"]',
  '[class*="-line"]',
  '[class*="-rule"]',
  '[class*="-hint"]',
].join(',');

/** The sizes tried, largest first. Past the last the text wraps as authored (text-wrap: pretty keeps a word off the line alone). */
const SHRINK_STEPS = [0.96, 0.92, 0.89];

const measured = new WeakMap<HTMLElement, string>();

/** Lines the element's text occupies, read off its line boxes (transforms do not change wrapping). */
function lineCount(el: HTMLElement): number {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .sort((a, b) => a.top - b.top);
  let lines = 0;
  let bottom = -Infinity;
  for (const r of rects) {
    // An icon taller than the text overlaps its own line; a new line starts clear of the last.
    if (r.top >= bottom - r.height * 0.4) {
      lines++;
      bottom = r.bottom;
    } else bottom = Math.max(bottom, r.bottom);
  }
  return lines;
}

function snug(el: HTMLElement): void {
  if (!el.isConnected || el.clientWidth === 0) return;
  const key = `${el.clientWidth}|${el.textContent}`;
  if (measured.get(el) === key) return;
  measured.set(el, key);

  el.style.removeProperty('font-size');
  if ((el.textContent?.trim().length ?? 0) < 8 || el.closest('[data-snug="off"]')) return;
  const style = getComputedStyle(el);
  if (style.whiteSpace.includes('nowrap') || style.whiteSpace === 'pre') return;
  // Stacked children are a layout, not a line of copy.
  for (const child of Array.from(el.children)) {
    if (!getComputedStyle(child).display.startsWith('inline')) return;
  }
  if (lineCount(el) !== 2) return;

  const base = parseFloat(style.fontSize);
  for (const step of SHRINK_STEPS) {
    el.style.fontSize = `${(base * step).toFixed(2)}px`;
    if (lineCount(el) === 1) return;
  }
  el.style.removeProperty('font-size');
}

function snugWithin(root: Element): void {
  const found = new Set<HTMLElement>();
  const owner = root.closest<HTMLElement>(SNUG_SELECTOR);
  if (owner) found.add(owner);
  root.querySelectorAll<HTMLElement>(SNUG_SELECTOR).forEach((el) => found.add(el));
  found.forEach(snug);
}

export function installSnugText(): void {
  if (typeof MutationObserver === 'undefined') return;
  let pending = new Set<Element>();
  let frame = 0;
  const flush = () => {
    frame = 0;
    const roots = pending;
    pending = new Set();
    roots.forEach((root) => root.isConnected && snugWithin(root));
  };
  const queue = (root: Element) => {
    pending.add(root);
    if (!frame) frame = requestAnimationFrame(flush);
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') {
        if (record.target.parentElement) queue(record.target.parentElement);
        continue;
      }
      // Only what arrived is new; a changed text node means its parent's copy changed.
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) queue(node as Element);
        else if (node.parentElement) queue(node.parentElement);
      });
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // A new width or a font landing late changes every wrap, so everything is measured again.
  const remeasureAll = () => {
    document.querySelectorAll<HTMLElement>(SNUG_SELECTOR).forEach((el) => measured.delete(el));
    queue(document.body);
  };
  window.addEventListener('resize', remeasureAll);
  document.fonts?.ready.then(remeasureAll).catch(() => {});
}
