import type { MapNodeType } from '../../run/map';

/**
 * Hand-drawn 16px map landmarks. These are deliberately authored as a tiny
 * pixel grid instead of borrowing the generic icon sheet: map nodes describe
 * the run's route, so they need a single, immediately recognizable silhouette
 * even at the compact portrait-mobile size.
 */
type Pixel = 'o' | 's' | 'a' | 'b' | 'c';
type Sprite = readonly string[];

const SPRITES: Record<MapNodeType, Sprite> = {
  fight: [
    '................', '...........o....', '..........oao...', '.........oaaa...', '........oaaa....', '.......oaaa.....', '......oaaa......', '.....oaaa.......', '....oaaa........', '...oaaa.........', '..oaaa..........', '.osssso.........', '.oosssoo........', '...oo...........', '................', '................',
  ],
  skirmish: [
    '................', '..o..........o..', '..oa........ao..', '..oaa......aao..', '..oaaa....aaao..', '..oaaaaaaaaaao..', '..ossssssssso..', '...oooo.oooo...', '.....o...o......', '.....o...o......', '.....o...o......', '.....o...o......', '....ooo.ooo.....', '................', '................', '................',
  ],
  battle: [
    '................', '.....oooooo.....', '....oaaaaaao....', '...oaabcaabao...', '...oaossoaoao...', '...oaaaaaaaao...', '....oaaoaao.....', '.....oaoao......', '.....oaoao......', '....oo...oo.....', '...oo.....oo....', '................', '................', '................', '................', '................',
  ],
  elite: [
    '................', '..o.o.o.o.o.o...', '..oaoaoaoaoao...', '...oaaaaaaaao...', '....oaaaaaao....', '.....oaaaao.....', '.....oaaaao.....', '....oaaaaaao....', '...oaaaaaaaao...', '...oaaabbaaao...', '...oaaaaaaaao...', '....osssssso....', '.....oooooo.....', '................', '................', '................',
  ],
  boss: [
    '................', '...oo......oo...', '..oao......oao..', '..oaa......aao..', '...oaa....aao...', '....oaaaaaao....', '...oaaabbbaao...', '..oaaabcbbaao...', '..oaaabcbbaao...', '...oaaabbbaao...', '....oaaaaaao....', '.....osssso.....', '......oooo......', '................', '................', '................',
  ],
  shop: [
    '................', '.......o........', '......oao.......', '.....oaaao......', '....oaaaaao.....', '...osssssssso...', '...oababababo...', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oao....oao...', '...oao....oao...', '...ooo....ooo...', '................', '................', '................', '................',
  ],
  equipmentReward: [
    '................', '................', '....ooooooo.....', '...oaaaaaaao....', '...oabbbbbbo....', '...oaaaaaaao....', '...osssssso.....', '...oaaaaaaao....', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oaaaaaaaao...', '....osssssso....', '.....oooooo.....', '................', '................', '................',
  ],
  relicReward: [
    '................', '.......o........', '......oao.......', '.....oaabo......', '....oaabbbo.....', '...oaabbbaao....', '....oaabbbo.....', '.....oaabo......', '......oao.......', '.......o........', '......ooo.......', '................', '................', '................', '................', '................',
  ],
  currencyReward: [
    '................', '......oooo......', '....ooaaaaoo....', '...oaaabbbaao...', '...oaabbbbaao...', '...oaabbbbaao...', '...oaaabbbaao...', '....ooaaaaoo....', '......oooo......', '................', '................', '................', '................', '................', '................', '................',
  ],
  upgradeReward: [
    '................', '........o.......', '........a.......', '.......aaa......', '..o....aaa....o.', '..ao..aaaaa..oa.', '...oaaaaaaaao...', '....oaaaaao....', '.....oaaao.....', '....oaaaaao....', '...oaaaaaaaao...', '..o....aaa....o.', '.......aaa......', '........a.......', '........o.......', '................',
  ],
  weaponReward: [
    '................', '...........o....', '..........oao...', '.........oaaa...', '........oaaa....', '.......oaaa.....', '......oaaa......', '.....oaaa.......', '....oaaa........', '...oaaa.........', '..oaaa..........', '.osssso.........', '.oosssoo........', '...oo...........', '................', '................',
  ],
  armorReward: [
    '................', '.....oooooo.....', '....oaaaaaao....', '....oaaaaaao....', '....oaaaaaao....', '....oaaaaaao....', '....oaaaaaao....', '....oaaaaaao....', '.....oaaaao.....', '.....oaaaao.....', '......oao.......', '.......o........', '................', '................', '................', '................',
  ],
  accessoryReward: [
    '................', '................', '.....oooooo.....', '....oaaaaaao....', '...oaa...aaao...', '...oa.....aao...', '...oa.....aao...', '...oaa...aaao...', '....oaaaaaao....', '.....oooooo.....', '.......bb.......', '................', '................', '................', '................', '................',
  ],
  hpBoostReward: [
    '................', '................', '....oo...oo.....', '...oaaaoaaao....', '...oaaaaaaaao...', '....oaaaaaao....', '.....oaaaao.....', '......oao.......', '.......o........', '................', '................', '................', '................', '................', '................', '................',
  ],
  manaBoostReward: [
    '.......o........', '......oao.......', '.....oaaao......', '....oaaaaao.....', '....oaaaaao.....', '...oaaaaaaao....', '...oaaaaaaao....', '....oaaaaao.....', '.....oaaaao.....', '......oao.......', '.......o........', '................', '................', '................', '................', '................',
  ],
  manaRegenBoostReward: [
    '................', '......oooo......', '....ooaaaao.....', '...oaaabbbo.....', '...oaabbboo.....', '...oaaaaao......', '....oaaao.......', '.....oao........', '......o.........', '................', '................', '................', '................', '................', '................', '................',
  ],
  classReward: [
    '................', '...oooo..oooo...', '...oaa....aao...', '...oaaa..aaao...', '...oaaaaaaaao...', '...oaaabbaaao...', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oaaaaaaaao...', '...oaaaaaaaao...', '...osssssssso...', '....ooooooo.....', '................', '................', '................', '................',
  ],
  event: [
    '................', '.....oooooo.....', '....oaaaaaao....', '...oaa...aaao...', '........aaaao...', '.......aaaao....', '.......aao......', '.......o........', '................', '.......o........', '......ooo.......', '................', '................', '................', '................', '................',
  ],
};

const PALETTES: Record<MapNodeType, Record<Pixel, string>> = {
  fight: { o: '#26151a', s: '#6e2730', a: '#df5962', b: '#ffd08a', c: '#592530' },
  skirmish: { o: '#182337', s: '#31527b', a: '#6db6ff', b: '#d5f1ff', c: '#365f8d' },
  battle: { o: '#201b2b', s: '#4c3d66', a: '#9a83c8', b: '#f0d9ff', c: '#6d598e' },
  elite: { o: '#332517', s: '#806028', a: '#e0a63c', b: '#fff0a6', c: '#a66c2f' },
  boss: { o: '#301b27', s: '#73364f', a: '#c65a80', b: '#ffd4ed', c: '#7f314c' },
  shop: { o: '#17262b', s: '#315a5d', a: '#62c3aa', b: '#d6fff1', c: '#2d7669' },
  equipmentReward: { o: '#252433', s: '#57566d', a: '#9ca3bc', b: '#f0f4ff', c: '#636b84' },
  relicReward: { o: '#2d1e39', s: '#74428d', a: '#b578e1', b: '#ffe0ff', c: '#74378b' },
  currencyReward: { o: '#342513', s: '#896326', a: '#e0a63c', b: '#fff0a6', c: '#b57c26' },
  upgradeReward: { o: '#193529', s: '#34734e', a: '#66c97b', b: '#e0ffad', c: '#438e55' },
  weaponReward: { o: '#2f171a', s: '#7c353b', a: '#d65d62', b: '#ffe1a5', c: '#93404a' },
  armorReward: { o: '#202938', s: '#53667e', a: '#8da0b8', b: '#e9f3ff', c: '#647996' },
  accessoryReward: { o: '#173137', s: '#3d7780', a: '#72d4dc', b: '#e0ffff', c: '#42959b' },
  hpBoostReward: { o: '#1d3424', s: '#4c8a54', a: '#75c66b', b: '#e5ffbd', c: '#4b9957' },
  manaBoostReward: { o: '#192c4a', s: '#386eb3', a: '#5ea8f4', b: '#d5f3ff', c: '#397bc5' },
  manaRegenBoostReward: { o: '#18382d', s: '#3b8d68', a: '#58d19a', b: '#d6ffe7', c: '#3c9a78' },
  classReward: { o: '#32251e', s: '#806036', a: '#d7a85c', b: '#fff0b3', c: '#9c7343' },
  event: { o: '#293040', s: '#596274', a: '#9ba6ba', b: '#edf4ff', c: '#758197' },
};

/** Renders one authored sprite at an exact pixel grid; no browser smoothing. */
export function MapNodeIcon({ type }: { type: MapNodeType }) {
  const palette = PALETTES[type];
  const pixels = SPRITES[type].flatMap((row, y) =>
    [...row].flatMap((pixel, x) => (pixel === '.' ? [] : [{ pixel: pixel as Pixel, x, y }])),
  );

  return (
    <svg className="map-pixel-icon" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
      {pixels.map(({ pixel, x, y }) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[pixel]} />)}
    </svg>
  );
}
