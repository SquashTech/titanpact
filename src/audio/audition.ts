/**
 * Dev-only driver for audition.html — `npm run dev`, then open /audition.html.
 *
 * Not shipped: it has its own HTML entry at the repo root, so the app build
 * (which enters through index.html) never pulls it in. It exists because
 * tuning a synthesised sound by rebuilding the game and starting a fight is
 * a terrible loop, and because a rendered waveform tells you in one look
 * what "it sounds a bit weak" takes ten minutes to guess at.
 */

import { sounds, type SfxId } from './sounds';
import { initSfx, playSfx, setMuted, setSfxLevel, getAudioPrefs } from './sfx';
import { renderSpec } from './synth';

initSfx();

const UI_IDS: SfxId[] = [
  'ui.tap',
  'ui.confirm',
  'ui.commit',
  'ui.launch',
  'ui.back',
  'ui.select',
  'ui.denied',
  'ui.page',
  'levelUp',
  'pact.bind',
  'equip',
  'contract.sign',
  'shrine',
  'blessing',
  'class.learn',
];

const NOTES: Partial<Record<SfxId, string>> = {
  'ui.tap': 'default for every tappable control',
  'ui.confirm': 'commit — lock in, claim, buy',
  'ui.commit': 'the big one — draft sealed, class taken, evolution chosen',
  'ui.launch': 'Start a Run — the biggest sound in the UI table',
  levelUp: 'a hero gains a level',
  'pact.bind': 'a starter bound in the draft',
  equip: 'gear going onto a hero',
  'contract.sign': 'a Recruit Contract signed',
  shrine: 'arriving at a blessing shrine — re-pitched per shrine',
  blessing: 'a shrine grant landing on a hero',
  'class.learn': 'a Class conferred on a hero',
  'ui.back': 'close, cancel, exit',
  'ui.select': 'highlight without committing',
  'ui.denied': 'unaffordable move, unreachable node',
  'ui.page': 'screen transition',
  cast: 'the "X uses Y" beat',
  'hit.physical': 'Attack vs Defense',
  'hit.magical': 'Intelligence vs Wisdom',
  'hit.crit': 'layered on top of the base hit',
  heal: 'Healed beat',
  buff: 'StatChanged, positive',
  debuff: 'StatChanged, negative',
  status: 'a condition landing, and DoT ticks',
  detonate: 'Conduct going off',
  faint: 'knockout',
  mana: 'mana regen, Rest',
  switchIn: 'a hero arriving',
  field: 'a Field Effect taking the battlefield',
};

/**
 * Peak-per-column waveform, drawn on a SQRT amplitude scale.
 *
 * Linear looks "correct" and is useless here: a decay tail spends most of
 * its life under 0.02, which is a single pixel, so every sound rendered as
 * a blob followed by a flat line and the tail — the part that decides
 * whether a sound feels big or cheap — was invisible. Sqrt is still
 * monotonic and still the same transform for every card, so cards remain
 * comparable to each other; it just gives the quiet 90% somewhere to live.
 */
function drawWave(canvas: HTMLCanvasElement, samples: Float32Array): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  const g = canvas.getContext('2d');
  if (!g) return;
  g.scale(dpr, dpr);

  g.strokeStyle = '#2a303c';
  g.beginPath();
  g.moveTo(0, h / 2);
  g.lineTo(w, h / 2);
  g.stroke();

  // Trim trailing silence so a short sound isn't drawn as a speck followed
  // by a second of flat line.
  let end = samples.length - 1;
  while (end > 0 && Math.abs(samples[end]) < 0.0008) end--;
  const used = Math.max(1, end + 1);

  const step = used / w;
  let peak = 0;
  g.fillStyle = '#ffb454';
  for (let x = 0; x < w; x++) {
    let hi = 0;
    const from = Math.floor(x * step);
    const to = Math.min(used, Math.floor((x + 1) * step));
    for (let i = from; i < to; i++) {
      const v = Math.abs(samples[i]);
      if (v > hi) hi = v;
    }
    if (hi > peak) peak = hi;
    const barH = Math.max(1, Math.sqrt(hi) * (h - 4));
    g.fillRect(x, (h - barH) / 2, 1, barH);
  }

  // Clipping is the one failure a waveform makes obvious — flag it loudly.
  if (peak >= 0.999) {
    g.fillStyle = '#ff6b6b';
    g.fillRect(0, 0, w, 2);
  }
}

function card(id: SfxId): HTMLElement {
  const el = document.createElement('button');
  el.className = 'card';
  el.type = 'button';

  const name = document.createElement('span');
  name.className = 'id';
  name.textContent = id;

  const canvas = document.createElement('canvas');

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = NOTES[id] ?? '';

  el.append(name, canvas, meta);
  el.addEventListener('click', () => playSfx(id));

  void renderSpec(sounds[id], 2).then((samples) => {
    if (!samples) return;
    // Redraw on resize, not just once: the grid's column width shifts as the
    // later cards land (and again when the scrollbar appears), so a single
    // draw bakes in a stale width and the canvas gets stretched.
    const draw = () => drawWave(canvas, samples);
    requestAnimationFrame(draw);
    new ResizeObserver(draw).observe(canvas);
  });

  return el;
}

const uiGrid = document.getElementById('grid-ui')!;
const combatGrid = document.getElementById('grid-combat')!;
for (const id of Object.keys(sounds) as SfxId[]) {
  (UI_IDS.includes(id) ? uiGrid : combatGrid).append(card(id));
}

/**
 * The context demos. These call playSfx with the same pitch/gain the real
 * damage curve produces (beatSfx.ts damageVoicing), so what you hear here is
 * what a fight sounds like — not an idealised single trigger.
 */
interface Demo {
  label: string;
  run: () => void;
}

function voiceDamage(amount: number, typeMult: number): { pitch: number; gain: number } {
  const weight = amount / (amount + 55);
  let pitch = 1.22 - weight * 0.52;
  let gain = 0.7 + weight * 0.55;
  if (typeMult >= 2) {
    pitch *= 1.1;
    gain *= 1.2;
  } else if (typeMult <= 0.5) {
    pitch *= 0.9;
    gain *= 0.6;
  }
  return { pitch, gain };
}

const demos: Demo[] = [
  { label: 'chip hit (8)', run: () => playSfx('hit.physical', voiceDamage(8, 1)) },
  { label: 'solid hit (40)', run: () => playSfx('hit.physical', voiceDamage(40, 1)) },
  { label: 'heavy hit (110)', run: () => playSfx('hit.physical', voiceDamage(110, 1)) },
  { label: 'resisted (40 × 0.5)', run: () => playSfx('hit.physical', voiceDamage(40, 0.5)) },
  { label: 'super effective (40 × 2)', run: () => playSfx('hit.physical', voiceDamage(40, 2)) },
  {
    label: 'critical hit',
    run: () => {
      playSfx('hit.physical', voiceDamage(75, 1));
      playSfx('hit.crit');
    },
  },
  { label: 'magic hit (40)', run: () => playSfx('hit.magical', voiceDamage(40, 1)) },
  {
    label: 'exchange → KO',
    run: () => {
      playSfx('cast');
      window.setTimeout(() => playSfx('hit.physical', voiceDamage(60, 2)), 420);
      window.setTimeout(() => playSfx('faint'), 900);
    },
  },
];

const demoRow = document.getElementById('demos')!;
for (const demo of demos) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = demo.label;
  b.addEventListener('click', demo.run);
  demoRow.append(b);
}

const vol = document.getElementById('sfx-vol') as HTMLInputElement;
const mute = document.getElementById('mute') as HTMLInputElement;
const status = document.getElementById('status')!;

vol.value = String(getAudioPrefs().sfx);
mute.checked = getAudioPrefs().muted;
vol.addEventListener('input', () => setSfxLevel(Number(vol.value)));
mute.addEventListener('change', () => setMuted(mute.checked));

window.addEventListener(
  'pointerdown',
  () => {
    status.textContent = 'audio running';
  },
  { once: true }
);
