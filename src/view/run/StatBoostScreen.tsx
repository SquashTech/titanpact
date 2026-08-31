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
  /** The node's hue — carried by the sky, the eyebrow and the title's bloom (see NodeStage). */
  tint: string;
  /**
   * This shrine's key: multiplies every frequency in `shrine` (the arrival)
   * and `blessing` (the grant), so the three shrines are one sound in three
   * registers rather than three sounds.
   *
   * The order is the order of the stats themselves. Vitality is the body and
   * sits lowest; the Mana Well is the middle; the Regen Spring is a thin
   * trickle and sits highest. A player who has heard two of them can place
   * the third before the title has finished fading in.
   */
  pitch: number;
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

  /**
   * The arrival. Fires once on mount — the only sound in the game triggered
   * by a screen opening rather than by a press, which is why `shrine` is
   * built with no transient in it (see sounds.ts): it swells up underneath
   * the map node's own `ui.confirm` instead of competing with it, and the
   * short delay is what keeps the two from landing together.
   *
   * Empty deps on purpose. `config` is derived from `nodeType`, which cannot
   * change without App.tsx routing a different node — and a different node is
   * a different mount.
   */
  useEffect(() => {
    playSfx('shrine', { pitch: config.pitch, delay: 0.12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGrant(rosterId: string) {
    // Before the state change, not after: this is the press's feedback, and
    // the light welling up through the card starts on the same frame.
    playSfx('blessing', { pitch: config.pitch });
    onRunChange(grantStatBonus(run, rosterId, config.stat, config.amount));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? heroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;

  return (
    <div className="node-screen shrine-screen" style={{ '--node-rgb': config.tint } as CSSProperties}>
      <NodeSky />

      {/* The shrine's light coming down over the room, once, as the screen
          opens. A curtain in `--node-rgb` — so the Vitality Shrine is lit
          green and the two mana ones blue, from the same one property the
          sky and the header already read. It plays and is done; the ambient
          motes NodeSky draws are what the room settles into. */}
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
              /* Light welling UP through the card, against the forced-equip
                 screen's sweep coming DOWN it (`.equip-seat-flare`). The
                 direction is the difference between the two grants: gear is
                 strapped on from outside, a blessing rises through the hero
                 it lands on. Mounted only on the granted card, so mounting
                 is what starts it. */
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
