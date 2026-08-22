import { useState } from 'react';
import { heroes } from '../../data/heroes';
import type { StatKey } from '../../engine/content';
import type { RunState } from '../../run/state';
import { grantStatBonus } from '../../run/runProgress';
import { rosterEntryTypes } from '../../run/progression';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { HeroPortrait } from '../shared/HeroPortrait';

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
  icon: string;
  title: string;
  ctaLabel: string;
}

const STAT_BOOST_CONFIG: Record<StatBoostNodeType, StatBoostConfig> = {
  hpBoostReward: { stat: 'hp', amount: 20, icon: '❤️', title: 'Vitality Shrine', ctaLabel: '+20 Max HP' },
  manaBoostReward: { stat: 'manaPool', amount: 10, icon: '💧', title: 'Mana Well', ctaLabel: '+10 Mana' },
  manaRegenBoostReward: { stat: 'mpRegen', amount: 5, icon: '🔄', title: 'Regen Spring', ctaLabel: '+5 Mana Regen' },
};

/**
 * hpBoostReward/manaBoostReward/manaRegenBoostReward node resolution: pick
 * one roster hero to receive a flat, permanent-for-the-run stat grant
 * (runProgress.ts grantStatBonus) — CLAUDE.md "flat additive integers,
 * multiples of 5 or 10". No 3-choice picker here, just which hero receives
 * it — mirrors NodeRewardScreen's relicReward tap-to-claim, but choosing a
 * target instead of a reward. Reuses ForceEquipScreen's hero-card layout
 * (.equip-target-*) so the "tap a hero card" gesture reads the same across
 * every forced-target node type.
 */
export function StatBoostScreen({ nodeType, run, onRunChange, onContinue }: Props) {
  const config = STAT_BOOST_CONFIG[nodeType];
  const [grantedTo, setGrantedTo] = useState<string | null>(null);

  function handleGrant(rosterId: string) {
    onRunChange(grantStatBonus(run, rosterId, config.stat, config.amount));
    setGrantedTo(rosterId);
  }

  const grantedHero = grantedTo ? heroes[run.roster.find((r) => r.rosterId === grantedTo)!.heroId] : null;

  return (
    <div className="node-screen">
      <div className="screen-scroll">
        <div className="bottom-pinned">
          <div className="reward-panel">
            <h2>
              {config.icon} {config.title}
            </h2>
            <p className="hint">
              {grantedHero ? `${grantedHero.name} gained ${config.ctaLabel}.` : `Choose a hero to permanently grant ${config.ctaLabel}.`}
            </p>
          </div>
          <div className="hero-grid">
            {run.roster.map((entry) => {
              const hero = heroes[entry.heroId];
              const isGranted = grantedTo === entry.rosterId;
              return (
                <button
                  key={entry.rosterId}
                  className="hero-grid-card"
                  style={{ borderLeftColor: getTypeColor(hero.types[0]) }}
                  disabled={!!grantedTo}
                  onClick={() => handleGrant(entry.rosterId)}
                >
                  <HeroPortrait heroId={hero.id} className="hero-grid-portrait" />
                  <div className="hero-grid-name-row">
                    <span className="hero-grid-name">{hero.name}</span>
                    <span className="training-hero-level">Lv {entry.level}</span>
                  </div>
                  <div className="hero-grid-types">
                    {rosterEntryTypes(hero, entry).map((t) => (
                      <TypeBadge key={t} type={t} />
                    ))}
                  </div>
                  <span className="hero-grid-cta">{isGranted ? 'Granted' : config.ctaLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <button className="resolve-button" disabled={!grantedTo} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
