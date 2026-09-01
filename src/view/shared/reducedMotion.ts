/**
 * The JavaScript half of the stylesheet's `prefers-reduced-motion` collapse.
 *
 * styles.css already flattens every CSS animation and transition to 0.01ms for
 * a player who asks for reduced motion, but a beat that is *sequenced in
 * JavaScript* — the cache opening, the level-up screen counting its orbs in,
 * the event screen holding on its flavor line before the offer arrives — is a
 * chain of `setTimeout`s the stylesheet cannot reach. Left alone, those players
 * would get the full delay with none of the motion it exists to carry, which
 * is the worst of both: a screen that just sits there.
 *
 * Read at the moment a beat starts rather than subscribed to. These sequences
 * last about a second; a player who changes the OS setting mid-beat is not a
 * case worth a listener, and the next beat picks the new answer up anyway.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
