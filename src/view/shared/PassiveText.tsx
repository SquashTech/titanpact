import type { CSSProperties, ReactNode } from 'react';
import type { PassiveDefinition } from '../../engine/content';
import { triggerKeywords } from '../../data/keywords';
import { passiveKeywordLabel, passiveKeywordOf, reactionKeywordOf, type PassiveKeyword } from '../../run/keywords';
import { KeywordGlyph } from './keywordIcons';
import { ElementGlyph } from './elementIcons';
import { MoveKindGlyph } from './statIcons';
import { getTypeColor } from '../combat/typeColors';
import { IconText } from './IconText';

function keywordsOf(passive: PassiveDefinition): { trigger?: PassiveKeyword; also?: PassiveKeyword } {
  return {
    trigger: passiveKeywordOf(passive),
    also: passive.alsoReactive ? reactionKeywordOf(passive.alsoReactive) : undefined,
  };
}

function badgeLabel(keyword: PassiveKeyword): string {
  return passiveKeywordLabel(keyword, triggerKeywords[keyword.id].name);
}

function marks(keyword: PassiveKeyword): ReactNode {
  if (keyword.once) return <span className="kw-pip">1</span>;
  if (keyword.everyNRounds) return <span className="kw-pip">{keyword.everyNRounds}</span>;
  return null;
}

/** The trigger as a badge: glyph and word, an element's own glyph and colour on a narrowed On Hit. */
export function KeywordBadge({ keyword }: { keyword: PassiveKeyword }) {
  const glyph = keyword.moveType ? (
    <ElementGlyph type={keyword.moveType} />
  ) : keyword.category ? (
    <MoveKindGlyph kind={keyword.category} />
  ) : (
    <KeywordGlyph keyword={keyword.id} />
  );
  const tint = keyword.moveType ? getTypeColor(keyword.moveType) : keyword.category ? `var(--${keyword.category})` : undefined;
  return (
    <span className="kw-badge" style={tint ? ({ '--kw-color': tint } as CSSProperties) : undefined}>
      {marks(keyword)}
      {glyph}
      <span className="kw-word">{badgeLabel(keyword)}</span>
    </span>
  );
}

/** A passive's sentence with its trigger badge at the head, or where `{trigger}` / `{also}` sit. */
export function PassiveText({ passive }: { passive: PassiveDefinition }) {
  const { trigger, also } = keywordsOf(passive);
  const text = passive.description;
  const parts = text.split(/(\{trigger\}|\{also\})/);
  const placed = parts.includes('{trigger}');
  return (
    <>
      {trigger && !placed && <><KeywordBadge keyword={trigger} /> </>}
      {parts.map((part, i) => {
        if (part === '{trigger}') return trigger ? <KeywordBadge key={i} keyword={trigger} /> : null;
        if (part === '{also}') return also ? <KeywordBadge key={i} keyword={also} /> : null;
        return part ? <span key={i}><IconText text={part} /></span> : null;
      })}
    </>
  );
}

/** The same sentence as plain words, for a `title` or an `aria-label`. */
export function passivePlainText(passive: PassiveDefinition): string {
  const { trigger, also } = keywordsOf(passive);
  const word = (k: PassiveKeyword | undefined) => (k ? `${k.once ? 'Once, ' : ''}${badgeLabel(k)}:` : '');
  const body = passive.description.replace('{trigger}', word(trigger)).replace('{also}', word(also)).trim();
  return trigger && !passive.description.includes('{trigger}') ? `${word(trigger)} ${body}` : body;
}

function ordinal(n: number): string {
  return n === 2 ? 'second' : n === 3 ? 'third' : n === 4 ? 'fourth' : `${n}th`;
}

/** What a badge means, in full — the dossier's trigger row. */
export function keywordMeaning(keyword: PassiveKeyword): string {
  const narrowed = keyword.moveType ?? keyword.category;
  if (narrowed) return `When this hero hits a foe with a ${narrowed} move.`;
  if (keyword.everyNRounds) return `At the end of every ${ordinal(keyword.everyNRounds)} round.`;
  return triggerKeywords[keyword.id].meaning;
}
