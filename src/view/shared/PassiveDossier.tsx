import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
import type { PassiveDefinition } from '../../engine/content';
import { statuses } from '../../data/statuses';
import { passiveKeywordOf, reactionKeywordOf, type PassiveKeyword } from '../../run/keywords';
import { BURDEN_SURPLUS, HERO_STAT_TOTAL } from '../../run/statBudget';
import { STAT_LABELS } from './StatBars';
import { StatGlyph } from './statIcons';
import { StatusGlyph, statusColor } from './statusIcons';
import { PassiveGlyph, passiveColor, passiveStatGrants, passiveTint } from './passiveIcons';
import { statusFactsLine, statusGrantText } from './statusFacts';
import { statusMentions } from './IconText';
import { overlayHost } from './overlayHost';
import { KeywordBadge, keywordMeaning, PassiveText } from './PassiveText';

type GlossEntry = { at: number; key: string; term: ReactNode; meaning: string; color?: string };

// The magnitude the passive lands a status at, wherever in the definition the effect sits.
function landedMagnitude(node: unknown, statusId: string): number | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const o = node as Record<string, unknown>;
  if (o.kind === 'applyStatus' && o.statusId === statusId && typeof o.magnitude === 'number') return o.magnitude;
  for (const value of Object.values(o)) {
    const found = landedMagnitude(value, statusId);
    if (found !== undefined) return found;
  }
  return undefined;
}

function landedDuration(node: unknown, statusId: string): number | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const o = node as Record<string, unknown>;
  if (o.kind === 'applyStatus' && o.statusId === statusId && typeof o.duration === 'number') return o.duration;
  for (const value of Object.values(o)) {
    const found = landedDuration(value, statusId);
    if (found !== undefined) return found;
  }
  return undefined;
}

function appliedStatusIds(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const o = node as Record<string, unknown>;
  if (o.kind === 'applyStatus' && typeof o.statusId === 'string' && !out.includes(o.statusId)) out.push(o.statusId);
  for (const value of Object.values(o)) appliedStatusIds(value, out);
  return out;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// A Force reads at the magnitude the passive lands; anything else by its rule.
function statusMeaning(statusId: string, magnitude: number | undefined): string {
  const def = statuses[statusId];
  if (!def) return '';
  const force = def.forceType || def.forceTag || def.forceHeal || def.forceAllTypes;
  return capitalize(force ? statusGrantText(def, magnitude) : statusFactsLine(def));
}

/** Every term the sentence uses, explained in the order the sentence reads them: the trigger first. */
function glossary(passive: PassiveDefinition): GlossEntry[] {
  const text = passive.description;
  const entries: GlossEntry[] = [];
  const keyword = (k: PassiveKeyword | undefined, slot: string, fallback: number) => {
    if (!k) return;
    const at = text.indexOf(slot);
    const meaning = `${keywordMeaning(k)}${k.once ? ' Once a fight.' : ''}`;
    entries.push({ at: at < 0 ? fallback : at, key: slot, term: <KeywordBadge keyword={k} />, meaning });
  };
  keyword(passiveKeywordOf(passive), '{trigger}', -1);
  keyword(passive.alsoReactive ? reactionKeywordOf(passive.alsoReactive) : undefined, '{also}', text.length);

  const named = statusMentions(text);
  const unnamed = appliedStatusIds(passive).filter((id) => !named.some((m) => m.statusId === id));
  for (const { statusId, at } of [...named, ...unnamed.map((statusId) => ({ statusId, at: text.length + 1 }))]) {
    const rule = statusMeaning(statusId, landedMagnitude(passive, statusId));
    if (!rule) continue;
    const rounds = landedDuration(passive, statusId);
    const meaning = !rounds
      ? rule
      : /^Counts down/.test(rule)
        ? rule.replace(/^Counts down/, `Counts down from ${rounds}`)
        : `${rule} · ${rounds} ${rounds === 1 ? 'round' : 'rounds'}`;
    entries.push({
      at,
      key: statusId,
      color: statusColor(statusId),
      term: (
        <span className="passive-gloss-term">
          <StatusGlyph statusId={statusId} />
          {statuses[statusId]?.name ?? statusId}
        </span>
      ),
      meaning,
    });
  }
  if (passive.burden) {
    entries.push({
      at: text.length + 2,
      key: 'burden',
      term: <span className="passive-gloss-term">Burden</span>,
      meaning: `Its stats run ${HERO_STAT_TOTAL + BURDEN_SURPLUS} where others run ${HERO_STAT_TOTAL}, in return for carrying this.`,
    });
  }
  return entries.sort((a, b) => a.at - b.at);
}

/**
 * The passive dossier: what a tap on any passive chip opens — the hero sheets, a Class's passive,
 * an Evolution path's. Its glyph in a medallion, the name under it, the sentence, and every term
 * the sentence leans on explained beneath it in reading order.
 */
export function PassiveDetailCard({ passive }: { passive: PassiveDefinition }) {
  const color = passiveColor(passive.id);
  const grants = passiveStatGrants(passive);
  const gloss = glossary(passive);
  return (
    <div className="passive-detail-card" style={{ '--passive-color': color, '--passive-tint': passiveTint(passive.id, 0.18) } as CSSProperties}>
      <span className="passive-detail-medal">
        <PassiveGlyph passiveId={passive.id} />
      </span>
      <div className="passive-detail-name">{passive.name}</div>
      <div className="passive-detail-rule" aria-hidden="true" />

      {grants.length > 0 && (
        <div className="move-detail-stats passive-detail-grants">
          {grants.map(([stat, amount]) => (
            <span key={stat} className={`move-detail-stat${amount < 0 ? ' is-loss' : ''}`}>
              <StatGlyph stat={stat} />
              <strong>{amount > 0 ? `+${amount}` : amount}</strong>
              <span className="move-detail-unit">{STAT_LABELS[stat]}</span>
            </span>
          ))}
        </div>
      )}

      <div className="passive-detail-sentence"><PassiveText passive={passive} /></div>

      {gloss.length > 0 && (
        <div className="passive-gloss">
          {gloss.map((entry) => (
            <div key={entry.key} className="passive-gloss-row" style={entry.color ? ({ '--gloss-color': entry.color } as CSSProperties) : undefined}>
              {entry.term}
              <span className="passive-gloss-meaning">{entry.meaning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The passive dossier on the `.detail-overlay` / `.detail-panel` chassis, "tap anywhere to close".
 * Portalled into overlayHost(), never document.body — see overlayHost.ts.
 */
export function PassiveDetailOverlay({ passive, onClose }: { passive: PassiveDefinition | null; onClose: () => void }) {
  if (!passive) return null;
  const color = passiveColor(passive.id);

  function closeAndStop(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    onClose();
  }

  return createPortal(
    <div className="detail-overlay" onClick={closeAndStop}>
      <div className="detail-panel passive-detail-panel" style={{ '--passive-color': color } as CSSProperties} onClick={closeAndStop}>
        <PassiveDetailCard passive={passive} />
        <div className="detail-close-hint">Tap anywhere to close</div>
      </div>
    </div>,
    overlayHost()
  );
}
