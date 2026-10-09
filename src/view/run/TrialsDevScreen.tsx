// TEMPORARY DEV/TEST — the Trials before the teambuilder (docs/constructed.md §11 step 6):
// pick a Trial team to pilot, pick a Trial to face, fight.

import { useState } from 'react';
import { heroes } from '../../data/heroes';
import { moves } from '../../data/moves';
import { equipment } from '../../data/equipment';
import { progressionTable } from '../../data/progression';
import { TRIAL_LIST } from '../../data/trials';
import { constructedPath, type TeamSlot, type TrialDefinition } from '../../run/constructed';
import { HeroPortrait } from '../shared/HeroPortrait';
import { TypeBadge } from '../shared/TypeBadge';
import { PlateButton } from '../shared/PlateButton';

type Pick = 'player' | 'opponent';

interface Props {
  onFight: (playerTrialId: string, opponentTrialId: string) => void;
  onClose: () => void;
}

function SlotLine({ slot }: { slot: TeamSlot }) {
  const hero = heroes[slot.heroId];
  const path = constructedPath(progressionTable, slot.heroId, slot.pathId);
  return (
    <div className="trials-dev-slot">
      <HeroPortrait heroId={slot.heroId} pathId={slot.pathId ?? undefined} className="trials-dev-portrait" />
      <div className="trials-dev-slot-text">
        <div className="trials-dev-slot-name">
          {hero?.name ?? slot.heroId}
          {path && <span className="trials-dev-slot-path"> · {path.name}</span>}
        </div>
        <div className="trials-dev-slot-detail">{slot.moveIds.map((id) => moves[id]?.name ?? id).join(', ')}</div>
        <div className="trials-dev-slot-detail">{slot.itemIds.map((id) => equipment[id]?.name ?? id).join(', ')}</div>
      </div>
    </div>
  );
}

function TrialCard({ trial, selected, onSelect }: { trial: TrialDefinition; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={`trials-dev-card${selected ? ' selected' : ''}`} onClick={onSelect}>
      <div className="trials-dev-card-head">
        <TypeBadge type={trial.type} />
        <span className="trials-dev-card-name">{trial.name}</span>
      </div>
      <div className="trials-dev-card-line">{trial.gameplan}</div>
      {selected && (
        <>
          <div className="trials-dev-card-line trials-dev-cover">{trial.cover}</div>
          <div className="trials-dev-slots">
            {trial.team.slots.map((slot) => (
              <SlotLine key={slot.heroId} slot={slot} />
            ))}
          </div>
        </>
      )}
    </button>
  );
}

export function TrialsDevScreen({ onFight, onClose }: Props) {
  const [tab, setTab] = useState<Pick>('player');
  const [playerId, setPlayerId] = useState(TRIAL_LIST[0].id);
  const [opponentId, setOpponentId] = useState(TRIAL_LIST[1]?.id ?? TRIAL_LIST[0].id);
  const selectedId = tab === 'player' ? playerId : opponentId;
  const select = tab === 'player' ? setPlayerId : setOpponentId;

  return (
    <div className="node-screen sandbox-screen">
      <div className="sandbox-header">
        <h2>Trials</h2>
        <button className="log-close-button" onClick={onClose} aria-label="Back to title">
          ✕
        </button>
      </div>

      <div className="sandbox-tabs">
        <button type="button" className={`sandbox-tab${tab === 'player' ? ' active' : ''}`} onClick={() => setTab('player')}>
          Your team
        </button>
        <button type="button" className={`sandbox-tab${tab === 'opponent' ? ' active' : ''}`} onClick={() => setTab('opponent')}>
          Opponent
        </button>
      </div>

      <div className="screen-scroll">
        <div className="trials-dev-list">
          {TRIAL_LIST.map((trial) => (
            <TrialCard key={trial.id} trial={trial} selected={trial.id === selectedId} onSelect={() => select(trial.id)} />
          ))}
        </div>
      </div>

      <PlateButton onClick={() => onFight(playerId, opponentId)}>
        Fight: {TRIAL_LIST.find((t) => t.id === playerId)?.name} vs {TRIAL_LIST.find((t) => t.id === opponentId)?.name}
      </PlateButton>
    </div>
  );
}
