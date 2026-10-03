import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import pactwardenArt from '../../../art/npc/pactwarden.png';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import { PACTWARDEN_LINES } from '../../data/roadLines';
import type { HeroDefinition } from '../../engine/content';
import { canBless, grantBlessing } from '../../run/blessings';
import { levelOf } from '../../run/growth';
import { formIdFor } from '../../run/progression';
import type { RosterEntry, RunState } from '../../run/state';
import { statScaleFor } from '../../run/statScale';
import { BlessingMark } from '../shared/BlessingMark';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { HeroPortrait } from '../shared/HeroPortrait';
import { NodeMotes } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { KeeperVoice, useKeeperLine } from './RoadEncounter';
import { RosterPeek } from './RosterPeek';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  onContinue: () => void;
}

/** The Blessing's gold (styles.css --blessing). */
const BLESSING_RGB = '246, 220, 140';

/**
 * `blessingReward` node, the Pactwarden's Shrine (2026-10-03, per user direction): one hero not
 * already Blessed takes a Blessing (run/blessings.ts) — the first blow that would knock it out is
 * turned aside. Very rare, and the only way to add to the supply the opening pair starts with.
 */
export function BlessingShrineScreen({ run, onRunChange, onContinue }: Props) {
  const [blessedId, setBlessedId] = useState<string | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const voice = useKeeperLine(PACTWARDEN_LINES);
  const anyEligible = run.roster.some(canBless);
  const style = { '--node-rgb': BLESSING_RGB, '--rite-color': 'var(--blessing)' } as CSSProperties;

  function bless(entry: RosterEntry) {
    if (!canBless(entry) || blessedId) return;
    playSfx('blessing');
    onRunChange(grantBlessing(run, entry.rosterId));
    setBlessedId(entry.rosterId);
  }

  const blessedEntry = blessedId ? (run.roster.find((r) => r.rosterId === blessedId) ?? null) : null;
  if (blessedEntry) {
    const hero = rosterHeroes[blessedEntry.heroId];
    return (
      <div className="node-screen rite-screen is-blessing blessing-shrine-screen" style={style}>
        <span className="node-sky blessing-ground" aria-hidden="true" />
        <NodeMotes count={14} />
        <div className="screen-scroll">
          <div className="rite-reveal">
            <span className="rite-reveal-flash" aria-hidden="true" />
            <span className="rite-hero">
              <span className="rite-pool" aria-hidden="true" />
              <span className="blessing-shrine-shaft" aria-hidden="true" />
              <HeroPortrait heroId={hero.id} pathId={formIdFor(blessedEntry)} className="rite-portrait" />
              <span className="rite-mark is-reveal" aria-hidden="true">
                <BlessingMark />
              </span>
            </span>
            <span className="rite-eyebrow">The Light Settles</span>
            <h2 className="rite-name">{hero.name}</h2>
            <span className="rite-reveal-name">Blessed</span>
            <p className="blessing-shrine-rule">The first blow that would knock {hero.name} out is turned aside, and the Blessing is used up.</p>
          </div>
        </div>
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="node-screen rite-screen is-blessing tutor-node-screen blessing-shrine-screen" style={style}>
      <span className="node-sky blessing-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="keeper-head">
        <span className="keeper-figure">
          <span className="rite-pool" aria-hidden="true" />
          <img src={pactwardenArt} className="keeper-art" alt="" draggable={false} />
        </span>
        <span className="keeper-words">
          <span className="rite-eyebrow">A Shrine of Old Stones</span>
          <h2 className="rite-name">The Pactwarden</h2>
          <KeeperVoice line={voice} />
          {anyEligible ? (
            <span className="keeper-offer">
              <span className="keeper-line">Blesses one hero.</span>
              <span className="keeper-terms">Turns aside one knockout · one a hero</span>
            </span>
          ) : (
            <span className="keeper-offer">Every hero already holds a Blessing.</span>
          )}
        </span>
      </header>

      <HeroPickGrid count={run.roster.length} fill columns={run.roster.length > 4 ? 3 : 2}>
        {run.roster.map((entry) => {
          const hero = rosterHeroes[entry.heroId];
          const eligible = canBless(entry);
          return (
            <HeroPickCard
              key={entry.rosterId}
              hero={hero}
              entry={entry}
              disabled={!eligible}
              onActivate={() => bless(entry)}
              onPreview={() => setPreviewEntry({ hero, entry })}
              ariaLabel={`${hero.name}, level ${levelOf(entry)} — ${eligible ? 'Bless' : 'already Blessed'}`}
              ctaClassName={eligible ? 'is-accent' : ''}
              cta={eligible ? 'Bless' : 'Blessed'}
            />
          );
        })}
      </HeroPickGrid>

      {!anyEligible && (
        <button className="resolve-button" onClick={onContinue}>
          Continue
        </button>
      )}

      {previewEntry && (
        <HeroPreviewOverlay
          hero={previewEntry.hero}
          entry={previewEntry.entry}
          equipmentLookup={equipment}
          relicIds={run.relics}
          gold={run.gold}
          scale={statScaleFor(run)}
          onClose={() => setPreviewEntry(null)}
        />
      )}
    </div>
  );
}
