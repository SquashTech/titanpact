/**
 * The public audio surface. Everything outside src/audio/ talks to the game's
 * sound through this file and nothing else — call `playSfx('ui.confirm')`,
 * never touch an AudioContext.
 *
 * Volume and mute persist in localStorage so a player who turns the game
 * down stays turned down across sessions.
 */

import { sounds, type SfxId } from './sounds';
import { playSpec, setMasterVolume, setMusicVolume, setSfxVolume, unlockAudio, type PlayOptions } from './synth';

const STORAGE_KEY = 'titanpact.audio';

interface AudioPrefs {
  muted: boolean;
  /** 0–1, the effects bus. */
  sfx: number;
  /** 0–1, reserved for the atmospheric music tracks. */
  music: number;
}

const DEFAULT_PREFS: AudioPrefs = { muted: false, sfx: 0.7, music: 0.5 };

let prefs: AudioPrefs = { ...DEFAULT_PREFS };
let started = false;

/**
 * Last play time per sound id. Several beats can land inside one frame (a
 * spread move hitting two targets, a status tick chain), and two identical
 * impacts a millisecond apart don't sound like two hits — they sound like
 * one loud, phasey hit. Suppressing the duplicate is better than either.
 */
const lastPlayedAt = new Map<SfxId, number>();
const DEDUPE_MS = 35;

function loadPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_PREFS.muted,
      sfx: typeof parsed.sfx === 'number' ? parsed.sfx : DEFAULT_PREFS.sfx,
      music: typeof parsed.music === 'number' ? parsed.music : DEFAULT_PREFS.music,
    };
  } catch {
    // Private-mode Safari throws on localStorage access rather than
    // returning null. Silence there means silent settings, not a crash.
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Storage unavailable — the session's settings still apply, just don't persist. */
  }
}

function applyPrefs(): void {
  setMasterVolume(prefs.muted ? 0 : 1);
  setSfxVolume(prefs.sfx);
  setMusicVolume(prefs.music);
}

/**
 * Installs the audio system. Call once at startup. The AudioContext itself
 * stays suspended until the first real gesture — browsers require that — so
 * this also arms one-shot unlock listeners.
 */
export function initSfx(): void {
  if (started) return;
  started = true;
  prefs = loadPrefs();

  const unlock = () => {
    unlockAudio();
    applyPrefs();
  };
  // pointerdown rather than click: it fires at the start of the press, so the
  // context is already running by the time the press's own sound plays.
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
}

export function playSfx(id: SfxId, opts: PlayOptions = {}): void {
  if (prefs.muted) return;
  const spec = sounds[id];
  if (!spec) return;

  const now = performance.now();
  const last = lastPlayedAt.get(id);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  lastPlayedAt.set(id, now);

  playSpec(spec, opts);
}

export function isMuted(): boolean {
  return prefs.muted;
}

export function setMuted(muted: boolean): void {
  prefs.muted = muted;
  applyPrefs();
  savePrefs();
}

export function toggleMuted(): boolean {
  setMuted(!prefs.muted);
  return prefs.muted;
}

export function getAudioPrefs(): Readonly<AudioPrefs> {
  return prefs;
}

export function setSfxLevel(v: number): void {
  prefs.sfx = Math.max(0, Math.min(1, v));
  applyPrefs();
  savePrefs();
}

export function setMusicLevel(v: number): void {
  prefs.music = Math.max(0, Math.min(1, v));
  applyPrefs();
  savePrefs();
}

export type { SfxId };
