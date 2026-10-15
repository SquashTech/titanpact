// The wordmark (2026-10-14, per user direction): TITANPACT in a bold pixel alphabet, nine pixels
// tall, gold lit from above falling to bronze, a dark outline and drop under it. Drawn in grid units
// and scaled by a whole number so every pixel lands square.

/** Each letter as rows of its grid: '#' is a pixel. */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  T: ['######', '######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  A: ['..##..', '.####.', '##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  N: ['##...##', '###..##', '###..##', '####.##', '##.####', '##..###', '##..###', '##...##', '##...##'],
  P: ['#####.', '######', '##..##', '##..##', '######', '#####.', '##....', '##....', '##....'],
  C: ['.#####', '######', '##....', '##....', '##....', '##....', '##....', '######', '.#####'],
};

const WORD = 'TITANPACT';
const ROWS = 9;
/** Screen px per grid pixel. */
const SCALE = 5;

/** Gold by row: pale where the light strikes the top, down through gold to bronze at the foot. */
function rowFill(y: number): string {
  if (y <= 1) return '#fff4cc';
  if (y <= 3) return '#f1c45e';
  if (y <= 6) return '#d59a36';
  return '#8e5c1d';
}

const PIXELS: readonly (readonly [number, number])[] = (() => {
  const cells: [number, number][] = [];
  let x = 0;
  for (const ch of WORD) {
    const glyph = GLYPHS[ch];
    glyph.forEach((row, y) => [...row].forEach((c, i) => c === '#' && cells.push([x + i, y])));
    x += glyph[0].length + 1;
  }
  return cells;
})();

const COLUMNS = [...WORD].reduce((w, ch) => w + GLYPHS[ch][0].length + 1, -1);
/** Room round the letters for the outline and the drop. */
const PAD = 1;

export function TitleLogo() {
  return (
    <svg
      className="title-wordmark"
      viewBox={`${-PAD} ${-PAD} ${COLUMNS + PAD * 2} ${ROWS + PAD * 2}`}
      width={(COLUMNS + PAD * 2) * SCALE}
      height={(ROWS + PAD * 2) * SCALE}
      shapeRendering="crispEdges"
      role="img"
      aria-label="Titanpact"
    >
      <defs>
        <filter id="title-wordmark-edge" x="-5%" y="-20%" width="110%" height="150%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="grown" />
          <feFlood floodColor="#140c05" />
          <feComposite in2="grown" operator="in" result="edge" />
          <feOffset in="edge" dy="0.6" result="drop" />
          <feMerge>
            <feMergeNode in="drop" />
            <feMergeNode in="edge" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#title-wordmark-edge)">
        {PIXELS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={rowFill(y)} />
        ))}
      </g>
    </svg>
  );
}
