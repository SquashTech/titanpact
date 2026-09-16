// Writes docs/art/guardian-bestiary.html: every Guardian figure (src/view/shared/guardianFigures.ts)
// in its three poses, and the Endbringer. The
// Titanspawn gallery carries its own generator script; this one is rendered FROM the game's module,
// so the page is always what ships. `npm run build && node dist/scripts/art/guardian-gallery.js`.

import * as fs from 'fs';
import * as path from 'path';
import { CHAMPION_IDS, ENDBRINGER_ID, enemies } from '../../src/data/enemies';
import { guardianMarkup, GUARDIAN_VIEW_BOX, type GuardianPose } from '../../src/view/shared/guardianFigures';
import { getTypeColor } from '../../src/view/combat/typeColors';

const POSES: readonly GuardianPose[] = ['idle', 'attack', 'hurt'];

let n = 0;
function svg(heroId: string, pose: GuardianPose): string {
  return `<svg viewBox="${GUARDIAN_VIEW_BOX}" preserveAspectRatio="xMidYMax meet">${guardianMarkup(heroId, pose, `g${(n++).toString(36)}`)}</svg>`;
}

function card(heroId: string, label: string): string {
  return `<div class="tier"><div class="tier-head"><span class="name">${label}</span></div><div class="poses">${POSES.map((pose) => `<div class="pose">${svg(heroId, pose)}<div class="cap">${pose}</div></div>`).join('')}</div></div>`;
}

function line(championId: string): string {
  const champion = enemies[championId];
  const [mortal] = champion.types;
  return `<div class="line" id="${championId}">
    <div class="rail"><div class="type"><span class="swatch" style="background:${getTypeColor(mortal)}"></span>${champion.name}</div><div class="excel">${mortal} / Ancient</div></div>
    <div class="tiers">${card(championId, champion.name)}</div>
  </div>`;
}

const html = `<!doctype html>
<meta charset="utf-8">
<title>Guardian Bestiary</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Spectral:ital,wght@0,400;0,500;1,400&display=swap">
<style>
  :root { --bg: #12111a; --panel: #1b1a25; --line: #2e2c3c; --ink: #d9d6e4; --muted: #8c889c; --faint: #5e5a6e; --mono: 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace; --serif: 'Spectral', Georgia, serif; }
  body { background: var(--bg); color: var(--ink); font-family: var(--serif); font-size: 15px; line-height: 1.5; margin: 0; }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 36px 24px 80px; }
  header { display: grid; grid-template-columns: 1fr minmax(280px, 420px); gap: 32px; align-items: end; margin-bottom: 28px; }
  h1 { font-family: var(--mono); font-weight: 500; font-size: 26px; letter-spacing: 0.02em; margin: 0 0 8px; }
  .eyebrow { font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  header p { margin: 0; max-width: 62ch; } header p em { color: var(--muted); }
  .rules { font-family: var(--mono); font-size: 12px; color: var(--muted); border-left: 2px solid var(--line); padding-left: 14px; display: grid; gap: 6px; } .rules b { color: var(--ink); font-weight: 500; }
  .line { display: grid; grid-template-columns: 150px 1fr; border-top: 1px solid var(--line); padding: 18px 0 14px; } .line:last-child { border-bottom: 1px solid var(--line); }
  .rail { padding-right: 16px; } .rail .type { font-family: var(--mono); font-weight: 600; font-size: 13px; letter-spacing: 0.06em; display: flex; align-items: center; gap: 8px; }
  .rail .swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; } .rail .excel { font-size: 13px; color: var(--muted); margin-top: 6px; } .rail .home { font-family: var(--mono); font-size: 10.5px; color: var(--faint); margin-top: 10px; letter-spacing: 0.06em; }
  .tiers { display: grid; grid-template-columns: 1fr; }
  .tier { background: var(--panel); border: 1px solid var(--line); padding: 10px 10px 8px; }
  .tier-head .name { font-family: var(--mono); font-weight: 500; font-size: 13px; }
  .poses { display: grid; grid-template-columns: repeat(3, 1fr); padding-top: 40px; max-width: 560px; }
  .pose { display: grid; justify-items: center; } .pose svg { width: 132px; height: 132px; display: block; overflow: visible; }
  .pose .cap { font-family: var(--mono); font-size: 10px; color: var(--faint); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
  .end .poses { padding-top: 64px; } .end .pose svg { width: 160px; height: 160px; }
  /* #id in the URL shows the page from that Guardian down. */
  body:has(.line:target) header, .line:has(~ .line:target) { display: none; }
  @media (max-width: 900px) { .line { grid-template-columns: 1fr; } header { grid-template-columns: 1fr; } .rail { padding-bottom: 8px; } }
  @media (prefers-reduced-motion: no-preference) { .pose svg .halo { animation: breathe 2.6s ease-in-out infinite; } }
  @keyframes breathe { 0%,100% { opacity: .22 } 50% { opacity: .38 } }
</style>
<div class="wrap">
  <header>
    <div>
      <div class="eyebrow">Titanpact · the Guardians · 6 champions × 3 poses, and the Endbringer</div>
      <h1>Guardian Bestiary</h1>
      <p>What the spawn are a miniature of. Six wardens grafted into the binding and decayed under it (<em>lore §2</em>): each is its mortal type's geometry at a Late's scale or past it, with the Titan's eye in it.</p>
    </div>
    <div class="rules">
      <div><b>One eye.</b> The Titan's, half-lidded, the one thing on the body that is not type-coloured.</div>
      <div><b>Every Guardian breaks the frame.</b> The Endbringer breaks it on every edge.</div>
      <div><b>The Endbringer is the Titan's herald</b>, in Ancient's colour: the Titan's eye rides its banner, and the five broken seals are threaded on its pole.</div>
    </div>
  </header>
  ${CHAMPION_IDS.map(line).join('')}
  <div class="line end" id="end">
    <div class="rail"><div class="type"><span class="swatch" style="background:${getTypeColor('Ancient')}"></span>${enemies[ENDBRINGER_ID].name}</div><div class="excel">Ancient</div><div class="home">the Threshold · the Titan's herald</div></div>
    <div class="tiers">${card(ENDBRINGER_ID, 'The Herald')}</div>
  </div>
</div>
`;

const out = path.resolve(__dirname, '../../../docs/art/guardian-bestiary.html');
fs.writeFileSync(out, html);
console.log(`wrote ${out}`);
