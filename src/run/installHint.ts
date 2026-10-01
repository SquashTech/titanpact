// The first-launch "put this on your home screen" card: which instructions a device gets. Pure, so
// it reads a plain snapshot of the browser rather than `navigator` (the run tier has no DOM); the
// view takes the snapshot in src/app/installPrompt.ts.

/** The install card's id in `Profile.seenTipIds`: shown once an account, like the lore card. */
export const INSTALL_TIP_ID = 'install';

/**
 * - `ios`: Safari's Share sheet, the only route Apple offers — no API, so the card can only explain.
 * - `android`: the browser's own install dialog when it has offered one, else its menu.
 * - `inApp`: a social app's embedded browser, which can install nothing on either platform.
 */
export type InstallPlatform = 'ios' | 'android' | 'inApp';

export interface BrowserSnapshot {
  userAgent: string;
  maxTouchPoints: number;
  /** Launched from the home screen already (`display-mode: standalone`, or iOS's `navigator.standalone`). */
  standalone: boolean;
}

/** Instagram, Facebook, Messenger, TikTok, Snapchat, Line, Discord, Reddit, Android WebView. */
const IN_APP_PATTERN = /FBAN|FBAV|FB_IAB|Instagram|Messenger|musical_ly|BytedanceWebview|TikTok|Snapchat|\bLine\/|Discord|Reddit|; wv\)/i;

/** Which card this device gets, or null for none: a desktop, or a game already on the home screen. */
export function installPlatform(browser: BrowserSnapshot): InstallPlatform | null {
  if (browser.standalone) return null;
  const ua = browser.userAgent;
  // iPadOS reports itself as a Mac; a Mac with a touchscreen is an iPad.
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && browser.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  if (!ios && !android) return null;
  if (IN_APP_PATTERN.test(ua)) return 'inApp';
  return ios ? 'ios' : 'android';
}
