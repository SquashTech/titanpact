import type { CSSProperties, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';
import { statuses } from '../../data/statuses';
import { StatGlyph } from './statIcons';
import { StatusGlyph, statusColor } from './statusIcons';

// The abbreviations the move rows print beside a stage; HP and MP stay words, being everywhere.
const STAT_WORDS: Record<string, StatKey> = { ATK: 'attack', DEF: 'defense', INT: 'intelligence', WIS: 'wisdom', SPD: 'speed' };

// Longest names first, so "Ice Shell" wins over a shorter name inside it.
const STATUS_BY_NAME = new Map(Object.values(statuses).map((def) => [def.name, def.id]));
const STATUS_NAMES = [...STATUS_BY_NAME.keys()].sort((a, b) => b.length - a.length);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERN = new RegExp(
  `(${[...STATUS_NAMES.map((n) => `\\b${escape(n)}\\b`), `\\b(?:${Object.keys(STAT_WORDS).join('|')})\\b`, '[▲▼]+'].join('|')})`,
  'g'
);

/**
 * A rules sentence with the icons the move rows use set beside their words — a status by its
 * glyph and colour, a stat abbreviation by its glyph, stage chevrons in their colours — so reading
 * the words is how the row's icons are learned. `glyphs: false` keeps only the chevron colour, for
 * a line whose own tile already draws the glyph.
 */
export function IconText({ text, glyphs = true }: { text: string; glyphs?: boolean }) {
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PATTERN)) {
    const token = match[0];
    const at = match.index ?? 0;
    if (at > cursor) out.push(text.slice(cursor, at));
    const key = `${at}`;
    if (/^[▲▼]+$/.test(token)) {
      out.push(
        <span key={key} className={`icon-text-chevrons${token[0] === '▲' ? ' is-up' : ' is-down'}`}>
          {token}
        </span>
      );
    } else if (!glyphs) {
      out.push(token);
    } else if (STAT_WORDS[token]) {
      out.push(
        <span key={key} className="icon-text-term">
          <StatGlyph stat={STAT_WORDS[token]} className="icon-text-glyph" />
          {token}
        </span>
      );
    } else {
      const id = STATUS_BY_NAME.get(token)!;
      out.push(
        <span key={key} className="icon-text-term" style={{ color: statusColor(id) } as CSSProperties}>
          <StatusGlyph statusId={id} className="icon-text-glyph" />
          {token}
        </span>
      );
    }
    cursor = at + token.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}
