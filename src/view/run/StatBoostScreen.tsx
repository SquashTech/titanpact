import { useState, type CSSProperties } from 'react';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantStatBonus } from '../../run/runProgress';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_MANA, NODE_TINT_VITAL } from '../shared/NodeStage';
import { RunGlyph, type RunGlyphKind } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';

export type StatBoostNodeType = 'hpBoostReward' | 'manaBoostReward' | 'manaRegenBoostReward';

interface Props {
  nodeType: StatBoostNodeType;
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

interface StatBoostConfig {
  stat: StatKey;
  amount: number;
  glyph: RunGlyphKind | null;
  /** The node's hue — carried by the sky, the eyebrow and the title's bloom (see NodeStage). */
  tint: string;
  eyebrow: string;
  title: string;
  /** What the grant is, in the exact words the card's CTA line and the readout both use. */
  ctaLabel: string;
}

const STAT_BOOST_CONFIG: Record<StatBoostNodeType, StatBoostConfig> = {
  hpBoostReward: {
    stat: 'hp',
    amount: 20,
    glyph: null,
    tint: NODE_TINT_VITAL,
    eyebrow: 'A Blessing',
    title: 'Vitality Shrine',
    ctaLabel: '+20 Max HP',
  },
  manaBoostReward: {
    stat: 'manaPool',
    amount: 10,
    glyph: 'mana',
    tint: NODE_TINT_MANA,
    eyebrow: 'A Blessing',
    title: 'Mana Well',
    ctaLabel: '+10 Mana',
  },
  manaRegenBoostReward: {
    stat: 'mpRegen',
    amount: 5,
    glyph: 'mana',
    tint: NODE_TINT_MANA,
    eyebrow: 'A Blessing',
    title: 'Regen Spring',
    ctaLabel: '+5 MP Regen',
  },
};

/**
 * hpBoostReward/manaBoostReward/manaRegenBoostReward node resolution: pick
 * one roster hero to receive a flat, permanent-for-the-run stat grant
 * (runProgress.ts grantStatBonus) — CLAUDE.md "flat additive integers,
 * multiples of 5 or 10". No 3-choice picker here, just which hero receives
 * it.
 *
 * Rebuilt 2026-08-28 onto the shared node stage (docs/visual-language.md,
 * ninth pass). What was here: a bordered `.reward-panel` carrying a heading
 * and a line of hint text — a box around no action — above `.hero-grid`,
 * whose 30px portraits were the fractional-downscale defect that doc opens
 * with. The panel is now the sky and the header; the grid is the shared
 * HeroPickCard, so the six figures are the only boxed things on the screen
 * and each one says what the tap buys. The grant is also worth inspecting a
 * hero for now — a permanent +20 HP is a real decision — so the cards carry
 * the same hold-to-inspect sheet the rest of the run loop's pick screens do.
 */
export function StatBoostScreen({ nodeType, run, onRunChange, onContinue }: Props) {
  const config = STAT_BOOST_CONFIG[nodeType];
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  function handleGrant(rosterId: string) {
    onRunChange(grantStatBonus(run, rosterId, config.stat, config.amount));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? heroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;

  return (
    <div className="node-screen" style={{ '--node-rgb': config.tint } as CSSProperties}>
      <NodeSky />

      <NodeHeader
        eyebrow={config.eyebrow}
        title={config.title}
        glyph={config.glyph ? <RunGlyph kind={config.glyph} /> : undefined}
        readoutKey={grantedTo ?? 'idle'}
        readoutLive={!!grantedHero}
        readout={
          grantedHero
            ? `${grantedHero.name} gained ${config.ctaLabel}.`
            : `Choose a hero to permanently grant ${config.ctaLabel}. Hold to review a sheet.`
        }
      />

      <HeroPickGrid count={run.roster.length} fill>
        {run.roster.map((entry) => {
          const hero = heroes[entry.heroId];
          const isGranted = grantedTo === entry.rosterId;
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!!grantedTo && !isGranted}
              onActivate={() => !grantedTo && handleGrant(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${entry.level} — grant ${config.ctaLabel}`}
              ctaClassName={isGranted ? 'is-done' : 'is-accent'}
              cta={isGranted ? 'Granted' : config.ctaLabel}
            />
          );
        })}
      </HeroPickGrid>

      <button className="resolve-button" disabled={!grantedTo} onClick={onContinue}>
        Continue
      </button>

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
