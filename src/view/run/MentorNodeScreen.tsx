import { useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import mentorArt from '../../../art/npc/mentor.png';
import { rosterHeroes } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition } from '../../engine/content';
import type { RosterEntry, RunState } from '../../run/state';
import { MAX_XP, applySeededXp, levelForXp, levelOf, type HeroLevelUp } from '../../run/growth';
import { canTrain, mentorXpFor } from '../../run/mentor';
import { formIdFor } from '../../run/progression';
import { HeroPickCard, HeroPickGrid } from '../shared/HeroPickCard';
import { NodeMotes } from '../shared/NodeStage';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { LevelUpList } from './LevelUpList';
import { RosterPeek } from './RosterPeek';
import { KeeperVoice, useKeeperLine } from './RoadEncounter';
import { MENTOR_LINES } from '../../data/roadLines';
import { statScaleFor } from '../../run/statScale';

interface Props {
  run: RunState;
  onRunChange: (next: RunState) => void;
  /** The hero trained and its line of the report, or null when nobody could be. The caller routes what the levels owe. */
  onContinue: (line: HeroLevelUp | null) => void;
  /** Fixes the growth roll, so a resumed run lands the same stats (docs/save-system.md D2). */
  seed: number;
}

/** The Mentor's teal (the map tile's --buff). */
const MENTOR_RGB = '63, 184, 175';

/**
 * `mentorReward` node (acts 1–3, docs/mentor.md): pick a hero, and it takes the act's lump of XP.
 * Each card says where the grant would leave it — the cube lifts a hero behind par further — and
 * the result is that hero's line of the level-up report, stat rolls and all. A move or Evolution
 * the levels open is paid on the level-up screen after (App routes it).
 */
export function MentorNodeScreen({ run, onRunChange, onContinue, seed }: Props) {
  const [trained, setTrained] = useState<HeroLevelUp | null>(null);
  const [previewEntry, setPreviewEntry] = useState<{ hero: HeroDefinition; entry: RosterEntry } | null>(null);
  const voice = useKeeperLine(MENTOR_LINES);
  const xp = mentorXpFor(run.actNumber);
  const anyTrainable = run.roster.some(canTrain);

  function train(entry: RosterEntry) {
    if (trained || !canTrain(entry)) return;
    const { run: next, line } = applySeededXp(run, rosterHeroes, entry.rosterId, xp, seed);
    playSfx('levelUp');
    onRunChange(next);
    setTrained(line);
  }

  return (
    <div className="node-screen rite-screen is-mentor tutor-node-screen mentor-node-screen" style={{ '--node-rgb': MENTOR_RGB, '--rite-color': `rgb(${MENTOR_RGB})` } as CSSProperties}>
      <span className="node-sky mentor-ground" aria-hidden="true" />
      <NodeMotes count={14} />
      <RosterPeek run={run} />

      <header className="keeper-head">
        <span className="keeper-figure">
          <span className="rite-pool" aria-hidden="true" />
          <img src={mentorArt} className="keeper-art" alt="" draggable={false} />
        </span>
        <span className="keeper-words">
          <span className="rite-eyebrow">By the Roadside</span>
          <h2 className="rite-name">The Mentor</h2>
          <KeeperVoice line={voice} />
          {anyTrainable ? (
            <span className="keeper-offer">
              <span className="keeper-line">Trains one hero: +{xp.toLocaleString()} XP.</span>
              <span className="keeper-terms">A hero further behind climbs more levels</span>
            </span>
          ) : (
            <span className="keeper-offer">Every hero is at the level cap. There is nothing left to teach.</span>
          )}
        </span>
      </header>

      {trained ? (
        <section className="mentor-result">
          <LevelUpList report={[trained]} gains formFor={(id) => {
            const entry = run.roster.find((r) => r.rosterId === id);
            return entry ? formIdFor(entry) : null;
          }} />
          <button className="resolve-button" onClick={() => onContinue(trained)}>
            Continue
          </button>
        </section>
      ) : anyTrainable ? (
        <HeroPickGrid count={run.roster.length} fill>
          {run.roster.map((entry) => {
            const hero = rosterHeroes[entry.heroId];
            const open = canTrain(entry);
            const from = levelOf(entry);
            const to = levelForXp(Math.min(MAX_XP, entry.xp + xp));
            return (
              <HeroPickCard
                key={entry.rosterId}
                hero={hero}
                entry={entry}
                disabled={!open}
                onActivate={() => train(entry)}
                onPreview={() => setPreviewEntry({ hero, entry })}
                ariaLabel={`${hero.name}, level ${from} — ${open ? `would reach level ${to}` : 'at the level cap'}`}
                detail={
                  open ? (
                    <span className="tutor-fit mentor-levels">
                      Lv {from} → <strong>{to}</strong>
                    </span>
                  ) : undefined
                }
                ctaClassName="is-accent"
                cta={open ? `+${to - from} ${to - from === 1 ? 'level' : 'levels'}` : 'At the cap'}
              />
            );
          })}
        </HeroPickGrid>
      ) : (
        <div className="node-spacer" />
      )}

      {!anyTrainable && (
        <button className="resolve-button" onClick={() => onContinue(null)}>
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
