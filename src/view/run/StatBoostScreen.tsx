import { useEffect, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { heroes } from '../../data/heroes';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, StatKey } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { grantStatBonus } from '../../run/runProgress';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeHeader, NodeSky, NODE_TINT_MANA, NODE_TINT_VITAL } from '../shared/NodeStage';
import { RunGlyph, type RunGlyphKind } from '../shared/RunGlyph';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterPeek } from './RosterPeek';

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
  tint: string;
  /** Multiplies every frequency in `shrine` and `blessing` — one sound in three registers. */
  pitch: number;
  eyebrow: string;
  title: string;
  /** Used verbatim by the card CTA and the readout. */
  ctaLabel: string;
}

const STAT_BOOST_CONFIG: Record<StatBoostNodeType, StatBoostConfig> = {
  hpBoostReward: {
    stat: 'hp',
    amount: 20,
    glyph: null,
    tint: NODE_TINT_VITAL,
    pitch: 0.86,
    eyebrow: 'A Blessing',
    title: 'Vitality Shrine',
    ctaLabel: '+20 Max HP',
  },
  manaBoostReward: {
    stat: 'manaPool',
    amount: 10,
    glyph: 'mana',
    tint: NODE_TINT_MANA,
    pitch: 1,
    eyebrow: 'A Blessing',
    title: 'Mana Well',
    ctaLabel: '+10 Mana',
  },
  manaRegenBoostReward: {
    stat: 'mpRegen',
    amount: 5,
    glyph: 'mana',
    tint: NODE_TINT_MANA,
    pitch: 1.18,
    eyebrow: 'A Blessing',
    title: 'Regen Spring',
    ctaLabel: '+5 MP Regen',
  },
};

// Pick one hero for a flat, permanent-for-the-run stat grant (runProgress.ts grantStatBonus).
export function StatBoostScreen({ nodeType, run, onRunChange, onContinue }: Props) {
  const config = STAT_BOOST_CONFIG[nodeType];
  const [grantedTo, setGrantedTo] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);

  // Empty deps on purpose: `nodeType` cannot change without a different mount.
  useEffect(() => {
    playSfx('shrine', { pitch: config.pitch, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGrant(rosterId: string) {
    playSfx('blessing', { pitch: config.pitch });
    onRunChange(grantStatBonus(run, rosterId, config.stat, config.amount));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? heroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;

  return (
    <div className="node-screen shrine-screen" style={{ '--node-rgb': config.tint } as CSSProperties}>
      <NodeSky />

      <span className="shrine-descent" aria-hidden="true" />

      <RosterPeek run={run} />

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
              className={isGranted ? 'is-blessed' : ''}
              disabled={!!grantedTo && !isGranted}
              onActivate={() => !grantedTo && handleGrant(entry.rosterId)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${entry.level} — grant ${config.ctaLabel}`}
              /* Mounted only on the granted card, so mounting is what starts it. */
              overlay={isGranted ? <span className="blessing-flare" aria-hidden="true" /> : undefined}
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
