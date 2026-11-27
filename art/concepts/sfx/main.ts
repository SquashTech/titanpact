import { sounds } from '../../../src/audio/sounds';
import { playSpec, unlockAudio, setMasterVolume, setSfxVolume, type SoundSpec, type PlayOptions } from '../../../src/audio/synth';
import { damageVoicing } from '../../../src/audio/beatSfx';
import { KEY_SOUNDS, type KeySound } from './candidates';

type Look = 'now' | 'a' | 'b';

const unlock = () => {
  unlockAudio();
  setMasterVolume(1);
  setSfxVolume(0.7);
};
window.addEventListener('pointerdown', unlock, { capture: true });

function specFor(key: KeySound, look: Look): SoundSpec {
  return look === 'now' ? sounds[key.id] : key[look].spec;
}

function hitOf(look: Look): SoundSpec {
  return specFor(KEY_SOUNDS.find((k) => k.id === 'hit.physical')!, look);
}

function play(key: KeySound, look: Look, opts: PlayOptions = {}): void {
  if (key.id === 'hit.crit') {
    playSpec(hitOf(look), { ...damageVoicing(75, 1), delay: opts.delay });
    playSpec(specFor(key, look), opts);
    return;
  }
  if (key.id === 'hit.physical') {
    playSpec(specFor(key, look), { ...damageVoicing(40, 1), ...opts });
    return;
  }
  playSpec(specFor(key, look), opts);
}

const rows = document.getElementById('rows')!;
for (const key of KEY_SOUNDS) {
  const row = document.createElement('section');
  row.className = 'row';
  const h = document.createElement('h2');
  h.textContent = key.title;
  row.append(h);

  const opts = document.createElement('div');
  opts.className = 'opts';
  const looks: [Look, string, string][] = [
    ['now', 'Live', 'what the game plays now'],
    ['a', key.a.label, key.a.note],
    ['b', key.b.label, key.b.note],
  ];
  for (const [look, label, note] of looks) {
    const b = document.createElement('button');
    b.className = look;
    b.innerHTML = `<b>${label}</b><span>${note}</span>`;
    b.addEventListener('click', () => play(key, look));
    opts.append(b);
  }
  row.append(opts);

  if (key.id === 'hit.physical') {
    const extra = document.createElement('div');
    extra.className = 'extra';
    const cases: [string, number, number][] = [
      ['chip (8)', 8, 1],
      ['heavy (110)', 110, 1],
      ['resisted', 40, 0.5],
      ['super effective', 40, 2],
    ];
    for (const look of ['now', 'a', 'b'] as Look[]) {
      for (const [label, amount, mult] of cases) {
        const b = document.createElement('button');
        b.className = look;
        b.textContent = `${look === 'now' ? 'Now' : look.toUpperCase()} · ${label}`;
        b.addEventListener('click', () => playSpec(specFor(key, look), damageVoicing(amount, mult)));
        extra.append(b);
      }
    }
    row.append(extra);
  }
  rows.append(row);
}

const sweep = document.getElementById('sweep')!;
for (const [look, label] of [
  ['now', 'Play all · Now'],
  ['a', 'Play all · A Toybox'],
  ['b', 'Play all · B Bubblegum'],
] as [Look, string][]) {
  const b = document.createElement('button');
  b.className = look;
  b.innerHTML = `<b>${label}</b>`;
  b.addEventListener('click', () => KEY_SOUNDS.forEach((key, i) => play(key, look, { delay: i * 0.9 })));
  sweep.append(b);
}
