import '../../../src/app/styles.css';
import '../../../src/app/storybook.css';
import './skins.css';

// The real move rows of five heroes, lifted out of the fight harness and shown under four skins.
const HEROES = ['cinderKnight', 'tidecaller', 'wildOracle', 'dawnwarden', 'revenant', 'valor'];
const SKINS = [
  { id: 'now', name: 'Now', note: 'Every icon inherits the ink.' },
  { id: 'a', name: 'A · Cream, colour back', note: 'Same cream face; the type sits in a coloured disc, every icon wears its own colour again.' },
  { id: 'b', name: 'B · Tinted by type', note: 'The face is washed in the move’s type colour, rim and lip a shade deeper.' },
  { id: 'c', name: 'C · Night card', note: 'A deep plum card with a white inked name, the way Clash Royale’s cards sit dark under bright icons.' },
  { id: 'd', name: 'D · Type candy', note: 'The whole face is the type colour; the riders sit on a paper pill so they never clash with it.' },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function liftMoves(heroId: string): Promise<string> {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-2000px;top:0;width:394px;height:780px';
  f.src = `/art/concepts/storybook-fight/index.html?p=${heroId},valor&e=ursa,kong`;
  document.body.appendChild(f);
  await new Promise((r) => (f.onload = r));
  await wait(2200);
  const doc = f.contentDocument!;
  for (let i = 0; i < 6 && !doc.querySelector('.move-list .move-button'); i++) {
    doc.elementFromPoint(196, 600)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(1200);
  }
  const html = doc.querySelector('.move-list')?.outerHTML ?? '';
  f.remove();
  return html;
}

async function main() {
  const root = document.getElementById('root')!;
  root.className = 'mb-page';
  root.innerHTML = '<h1 class="mb-title">Move buttons</h1><div class="mb-grid"></div>';
  const lists = await Promise.all(HEROES.map(liftMoves));
  const grid = root.querySelector('.mb-grid')!;
  for (const skin of SKINS) {
    const col = document.createElement('section');
    col.className = `mb-col skin-${skin.id}`;
    col.innerHTML = `<h2>${skin.name}</h2><p>${skin.note}</p><div class="mb-console">${lists.join('')}</div>`;
    grid.appendChild(col);
  }
}

main();
