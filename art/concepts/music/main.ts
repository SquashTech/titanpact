import { chipSongs, type SongId } from '../../../src/audio/chipSongs';
import { startSong, type ChipPlayer } from '../../../src/audio/chiptune';
import { tracks } from '../../../src/audio/tracks';

const ROWS: [SongId, string][] = [
  ['titleScreen', 'Title'],
  ['starterScreen', 'The draft'],
  ['wildsEdge', "Wild's Edge"],
  ['blightedShrine', 'Blighted Shrine'],
  ['forbiddenForest', 'Forbidden Forest'],
  ['moltenFoundry', 'Molten Foundry'],
  ['stormCoast', 'Storm Coast'],
  ['necropolis', 'Necropolis'],
  ['holySanctum', 'Holy Sanctum'],
  ['dreamingSpires', 'Dreaming Spires'],
  ['thunderAerie', 'Thunder Aerie'],
  ['frozenReach', 'Frozen Reach'],
  ['theThreshold', 'The Threshold'],
  ['battle', 'Battle'],
  ['boss', 'Guardian'],
  ['finale', 'Finale'],
];

let ctx: AudioContext | null = null;
let player: ChipPlayer | null = null;
const audio = new Audio();
audio.loop = true;
const buttons: HTMLButtonElement[] = [];

function stopAll(): void {
  player?.stop(0.2);
  player = null;
  audio.pause();
  buttons.forEach((b) => b.classList.remove('on'));
}

function button(cls: string, label: string, note: string, run: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.innerHTML = `<b>${label}</b><span>${note}</span>`;
  b.addEventListener('click', () => {
    const wasOn = b.classList.contains('on');
    stopAll();
    if (wasOn) return;
    run();
    b.classList.add('on');
  });
  buttons.push(b);
  return b;
}

const rows = document.getElementById('rows')!;
for (const [id, title] of ROWS) {
  const song = chipSongs[id];
  const row = document.createElement('section');
  row.className = 'row';
  const h = document.createElement('h2');
  h.textContent = title;
  const opts = document.createElement('div');
  opts.className = 'opts';
  const file = (tracks as Record<string, { url: string }>)[id];
  opts.append(
    file
      ? button('track', 'Your track', 'Original soundtrack', () => {
          audio.src = file.url;
          void audio.play();
        })
      : button('track none', 'Your track', 'none yet — silent here today', () => {}),
    button('chip', 'Chiptune', `${song.bpm} bpm · ${song.chords.length} bars`, () => {
      ctx ??= new AudioContext();
      void ctx.resume();
      player = startSong(ctx, ctx.destination, song, 0.1);
    })
  );
  row.append(h, opts);
  rows.append(row);
}

document.getElementById('stop')!.addEventListener('click', stopAll);
