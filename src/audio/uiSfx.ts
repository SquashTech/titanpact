// UI click sounds as one delegated capture-phase listener, so a control authored tomorrow is
// audible with no audio code in it.
//
// Resolution, walking up from the tapped node:
//   1. `data-sfx="<id>"` — explicit; `data-sfx="none"` silences.
//   2. a class in CLASS_SFX.
//   3. any <button>/[role=button]/<a href>/<summary> — the default tap.
// Disabled controls (`disabled` or `aria-disabled="true"`) play the refusal sound instead.
// Plain <div onClick> is deliberately NOT caught (backdrops, the beat-advance overlay).

import { playSfx } from './sfx';
import type { SfxId } from './sounds';

// First match wins: title-cta, draft-cta and class-shrine-confirm-button also carry
// `resolve-button`, so they must precede it.
const CLASS_SFX: readonly (readonly [string, SfxId])[] = [
  ['log-close-button', 'ui.back'],
  ['detail-close-button', 'ui.back'],
  ['exit-button', 'ui.back'],
  ['bottom-action-back', 'ui.back'],
  ['title-cta', 'ui.launch'],
  ['draft-cta', 'ui.commit'],
  ['class-shrine-confirm-button', 'ui.commit'],
  ['resolve-button', 'ui.confirm'],
  ['replacement-confirm-button', 'ui.confirm'],
  ['relic-shrine-claim-button', 'ui.confirm'],
  ['moveoffer-button', 'ui.confirm'],
  ['move-button', 'ui.select'],
  ['map-node', 'ui.confirm'],
];

const CLICKABLE = 'button, [role="button"], a[href], summary, input[type="checkbox"], input[type="radio"]';

/** Deep enough for an icon inside a span inside a button. */
const MAX_DEPTH = 6;

function isDisabled(el: Element): boolean {
  if (el.getAttribute('aria-disabled') === 'true') return true;
  return 'disabled' in el && (el as HTMLButtonElement).disabled === true;
}

export function resolveSfx(target: Element | null): SfxId | null {
  let el: Element | null = target;
  for (let depth = 0; el && depth < MAX_DEPTH; depth++, el = el.parentElement) {
    const explicit = el.getAttribute('data-sfx');
    if (explicit) {
      if (explicit === 'none') return null;
      if (isDisabled(el)) return 'ui.denied';
      return explicit as SfxId;
    }

    for (const [cls, id] of CLASS_SFX) {
      if (el.classList.contains(cls)) return isDisabled(el) ? 'ui.denied' : id;
    }

    if (el.matches(CLICKABLE)) return isDisabled(el) ? 'ui.denied' : 'ui.tap';
  }
  return null;
}

let installed = false;

export function installUiSfx(): void {
  if (installed) return;
  installed = true;

  // pointerdown, not click: feedback after the press completes reads as lag.
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      const id = resolveSfx(event.target as Element | null);
      if (id) playSfx(id);
    },
    { capture: true }
  );
}
