// JS half of styles.css's `prefers-reduced-motion` collapse, for beats sequenced with setTimeout
// that the stylesheet cannot reach. Read at beat start, not subscribed — beats last ~1s.
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
