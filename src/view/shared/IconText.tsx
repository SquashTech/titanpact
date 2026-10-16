import type { CSSProperties, ReactNode } from 'react';
import type { StatKey } from '../../engine/content';
import { statuses } from '../../data/statuses';
import { StatGlyph, STAT_COLORS } from './statIcons';
import { StatusGlyph, statusColor } from './statusIcons';

// The abbreviations the move rows print beside a stage; HP and MP stay words, being everywhere.
const STAT_WORDS: Record<string, StatKey> = { ATK: 'attack', DEF: 'defense', INT: 'intelligence', WIS: 'wisdom', SPD: 'speed' };

// Longest names first, so "Ice Shell" wins over a shorter name inside it.
const STATUS_BY_NAME = new Map(Object.values(statuses).map((def) => [def.name, def.id]));
const STATUS_NAMES = [...STATUS_BY_NAME.keys()].sort((a, b) => b.length - a.length);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const STATUS_PATTERN = new RegExp(STATUS_NAMES.map((n) => `\\b${escape(n)}\\b`).join('|'), 'g');
const PATTERN = new RegExp(
  `(${[...STATUS_NAMES.map((n) => `\\b${escape(n)}\\b`), `\\b(?:${Object.keys(STAT_WORDS).join('|')})\\b(?:\\s*[▲▼]+)?`, '[▲▼]+'].join('|')})`,
  'g'
);
const STAT_TOKEN = /^([A-Z]{3})\s*([▲▼]*)$/;
// Between two stat tags the joining word goes: the tags sit side by side.
const JOINER = /^(?:\s*,?\s*(?:and|&)?\s*)$/;

/** The statuses a sentence names, in reading order, each at its first mention. */
export function statusMentions(text: string): { statusId: string; at: number }[] {
  const seen = new Set<string>();
  const out: { statusId: string; at: number }[] = [];
  for (const match of text.matchAll(STATUS_PATTERN)) {
    const statusId = STATUS_BY_NAME.get(match[0])!;
    if (seen.has(statusId)) continue;
    seen.add(statusId);
    out.push({ statusId, at: match.index ?? 0 });
  }
  return out;
}

/**
 * A rules sentence with the icons the move rows use set beside their words — a status by its
 * glyph and colour, a stat and its stage as one tag in the stat's colour, stage chevrons in their
 * colours — so reading the words is how the row's icons are learned. `glyphs: false` keeps only
 * the chevron colour, for a line whose own tile already draws the glyph; `tags: false` keeps a
 * stat as its glyph and word.
 */
export function IconText({ text, glyphs = true, tags = true }: { text: string; glyphs?: boolean; tags?: boolean }) {
  const out: ReactNode[] = [];
  let cursor = 0;
  let lastWasTag = false;
  for (const match of text.matchAll(PATTERN)) {
    const token = match[0];
    const at = match.index ?? 0;
    const stat = STAT_TOKEN.exec(token);
    const isTag = glyphs && tags && stat != null && STAT_WORDS[stat[1]] != null;
    const between = text.slice(cursor, at);
    if (isTag && lastWasTag && stat![2] && JOINER.test(between)) out.push(' ');
    else if (between) out.push(between);
    const key = `${at}`;
    if (isTag) {
      out.push(
        <span key={key} className="stat-tag" style={{ '--tag-color': STAT_COLORS[STAT_WORDS[stat![1]]] } as CSSProperties}>
          {stat![1]}
          {stat![2] && ` ${stat![2]}`}
        </span>
      );
    } else if (/^[▲▼]+$/.test(token)) {
      out.push(
        <span key={key} className={`icon-text-chevrons${token[0] === '▲' ? ' is-up' : ' is-down'}`}>
          {token}
        </span>
      );
    } else if (stat && STAT_WORDS[stat[1]]) {
      const word = glyphs ? (
        <span key={key} className="icon-text-term">
          <StatGlyph stat={STAT_WORDS[stat[1]]} className="icon-text-glyph" />
          {stat[1]}
        </span>
      ) : (
        stat[1]
      );
      out.push(word);
      if (stat[2]) {
        out.push(' ');
        out.push(
          <span key={`${key}-c`} className={`icon-text-chevrons${stat[2][0] === '▲' ? ' is-up' : ' is-down'}`}>
            {stat[2]}
          </span>
        );
      }
    } else if (!glyphs) {
      out.push(token);
    } else {
      const id = STATUS_BY_NAME.get(token)!;
      out.push(
        <span key={key} className="icon-text-term" style={{ color: statusColor(id) } as CSSProperties}>
          <StatusGlyph statusId={id} className="icon-text-glyph" />
          {token}
        </span>
      );
    }
    lastWasTag = isTag && !!stat![2];
    cursor = at + token.length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{gluePunctuation(out)}</>;
}

/** A comma or stop after an icon term stays on the term's line, never wrapping alone. */
function gluePunctuation(parts: ReactNode[]): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];
    const punct = typeof next === 'string' ? /^[,.;:!?)]+/.exec(next)?.[0] : undefined;
    if (punct && typeof part === 'object' && part !== null) {
      out.push(
        <span key={`glue-${i}`} className="icon-text-glue">
          {part}
          {punct}
        </span>
      );
      parts[i + 1] = (next as string).slice(punct.length);
      continue;
    }
    if (part !== '') out.push(part);
  }
  return out;
}
