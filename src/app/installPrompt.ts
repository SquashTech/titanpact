// Android's install dialog. Chrome, Edge and Samsung Internet fire `beforeinstallprompt` once the
// page qualifies — often before React mounts — so the listener goes on at boot (main.tsx) and the
// event is held here until the install card asks for it. Safari never fires it.

import { installPlatform, type InstallPlatform } from '../run/installHint';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Held rather than shown: the browser's own mini-infobar would race the card.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    listeners.forEach((notify) => notify());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((notify) => notify());
  });
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

/** Notified when the dialog becomes available (or goes away). Returns the unsubscribe. */
export function onInstallPromptChange(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** Opens the system dialog. True when the player installed; the event is spent either way. */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

/** This device's install card, read off the live browser. */
export function currentInstallPlatform(): InstallPlatform | null {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0, standalone });
}
