import { useState, type CSSProperties, type ReactNode } from 'react';
import { rosterHeroes } from '../../data/content';
import { classes } from '../../data/classes';
import { equipment } from '../../data/equipment';
import { moves } from '../../data/moves';
import { passives } from '../../data/passives';
import { fittedRarity, heldFamilyIndex, patronItemId, studentOf, type PatronDefinition, type PatronStep } from '../../run/patrons';
import type { RunState } from '../../run/state';
import { MoveDetailCard } from '../combat/MoveDetailOverlay';
import { healCasterForEntry } from '../shared/healCaster';
import { ItemDetailOverlay } from '../shared/ItemDossier';
import { ItemPiece, RARITY_COLOR_VARS, RARITY_LABELS } from '../shared/EquipmentBox';
import { HubGlyph } from '../shared/nodeIcons';
import { PassiveReadout } from '../shared/passiveIcons';
import { SectionGlyph } from '../shared/sectionIcons';
import { EquipChoiceCard } from './EquipChoiceCard';
import { mapNodeIcon } from './mapNodeArt';

/**
 * What a patron's meeting pays, shown as the thing itself on the greeting (2026-10-15, per user
 * direction): the piece as its card, the move as its card, a service as its picture and what it
 * does to the piece. It was a two-word ledger row, which said nothing a player could act on.
 */
export function PatronOffer({ run, patron, steps }: { run: RunState; patron: PatronDefinition; steps: readonly PatronStep[] }) {
  const [inspecting, setInspecting] = useState<string | null>(null);
  const student = patron.hasStudent ? studentOf(run, patron.id) : null;
  const studentEntry = student ? run.roster.find((r) => r.rosterId === student) : undefined;
  const item = (id: string) => <EquipChoiceCard key={id} item={equipment[id]} revealDelayMs={0} labelled showcase onPick={() => setInspecting(id)} onInspect={() => setInspecting(id)} />;

  const one = (step: PatronStep, key: number): ReactNode => {
    switch (step.kind) {
      case 'item':
        return item(patronItemId(step.familyId, run.actNumber));
      case 'unique':
        return item(step.uniqueId);
      case 'uniqueChoice':
        return (
          <div key={key} className="patron-offer-list">
            {step.uniqueIds.map(item)}
          </div>
        );
      case 'liftItem': {
        const held = studentEntry && student ? heldFamilyIndex(run, student, step.familyId) : -1;
        if (!studentEntry || held < 0) return item(patronItemId(step.familyId, run.actNumber));
        const piece = equipment[studentEntry.equipment[held]!];
        return (
          <Service key={key} art={<ItemPiece item={piece} />} title={`${piece.name}, a tier up`} color={RARITY_COLOR_VARS[piece.rarity]}>
            {rosterHeroes[studentEntry.heroId].name}'s {piece.name} comes back one rarity finer.
          </Service>
        );
      }
      case 'forge':
        return (
          <Service key={key} art={<img src={mapNodeIcon('forgeReward')} alt="" draggable={false} />} title="Reforge a piece" color="#ff8a2a">
            <span className="patron-offer-verbs">
              <span>
                <HubGlyph name="anvil" /> One rarity finer
              </span>
              <span>
                <SectionGlyph name="matchups" /> Enchanted in an element you choose
              </span>
            </span>
            Any piece a hero of yours already wears.
          </Service>
        );
      case 'fittedItem': {
        const rarity = fittedRarity(run.actNumber, step.tiersAhead);
        return (
          <Service key={key} art={<img src={mapNodeIcon('equipmentReward')} alt="" draggable={false} />} title={`A ${RARITY_LABELS[rarity]} piece, made to measure`} color={RARITY_COLOR_VARS[rarity]}>
            Pick a hero and it is forged for them: the stat they hit with, an element they fight in.
          </Service>
        );
      }
      case 'move': {
        const caster = studentEntry ? healCasterForEntry(rosterHeroes[studentEntry.heroId], studentEntry, run.relics) : undefined;
        return (
          <div key={key} className="patron-offer-move">
            <MoveDetailCard move={moves[step.moveId]} caster={caster} terse />
          </div>
        );
      }
      case 'passive':
        return <PassiveReadout key={key} passive={passives[step.passiveId]} source={patron.title} />;
      case 'class':
        return (
          <Service key={key} art={<HubGlyph name="hall" />} title="A Class" color="#c9a6ff">
            {step.pick ? `Choose from ${step.count} Classes` : `One of ${step.count} Classes`} for a hero who has none: a move or a passive that hero keeps.
          </Service>
        );
      case 'masterClass':
        return (
          <Service key={key} art={<HubGlyph name="hall" />} title="A Master Class" color="#c9a6ff">
            {step.classIds.map((id) => classes[id]?.name ?? id).join(' · ')}
          </Service>
        );
    }
  };

  return (
    <div className="patron-offer">
      {steps.map(one)}
      {inspecting && <ItemDetailOverlay item={equipment[inspecting]} onClose={() => setInspecting(null)} />}
    </div>
  );
}

function Service({ art, title, color, children }: { art: ReactNode; title: string; color: string; children: ReactNode }) {
  return (
    <div className="patron-service" style={{ '--service-color': color } as CSSProperties}>
      <span className="patron-service-art">
        <span className="patron-service-glow" aria-hidden="true" />
        {art}
      </span>
      <span className="patron-service-words">
        <strong>{title}</strong>
        <span>{children}</span>
      </span>
    </div>
  );
}
