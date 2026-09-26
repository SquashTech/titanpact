import { useState, type CSSProperties, type ReactNode } from 'react';
import { rosterHeroes } from '../../data/content';
import { allCombatants } from '../../data/content';
import { equipment } from '../../data/equipment';
import type { HeroDefinition, TypeId } from '../../engine/content';
import type { RunState, RosterEntry } from '../../run/state';
import type { Squad } from '../../run/squad';
import { pickSquad } from '../../run/squad';
import { rosterEntryTypes } from '../../run/progression';
import type { Encounter } from '../../run/enemyGen';
import { HeroPreviewOverlay } from './HeroPreviewOverlay';
import { RosterManagementScreen } from './RosterManagementScreen';
import { getTypeColor } from '../combat/typeColors';
import { TypeBadge } from '../shared/TypeBadge';
import { PassiveGlyph, passiveColor, passiveTint } from '../shared/passiveIcons';
import { currentInnateOf, titansMarkOf } from '../../run/innate';
import { HeroPortrait } from '../shared/HeroPortrait';
import { hasDramaticEntrance } from '../shared/entrances';
import { useProfile } from '../shared/ProfileContext';
import { useLongPress } from '../shared/MoveTile';
import { ReferenceOverlay } from '../shared/ReferenceOverlay';
import { NodeSky, NODE_TINT_GOLD } from '../shared/NodeStage';
import { HubGlyph } from '../shared/nodeIcons';
import { useAmbientLocation } from '../shared/LocationContext';
import { matchupVerdict } from '../shared/matchupVerdict';
import { ResourceGlyph } from '../shared/RunGlyph';
import { reviveHero, standingRoster } from '../../run/wounds';
import { canUseRevive, spendRevive } from '../../run/consumables';
import { levelOf } from '../../run/growth';
import { statScaleFor } from '../../run/statScale';
import { WoundBar, entryHp } from '../shared/WoundBar';

interface Props {
  run: RunState;
  /** Generated at node-select time (App.tsx) so the enemy squad can be scouted before the player commits. */
  encounter: Encounter;
  onRunChange: (next: RunState) => void;
  onConfirm: (squad: Squad) => void;
}

/**
 * ONE 2-wide grid of the roster — always 6 cells (the roster cap), cells past the roster render
 * empty. There are no Active and Bench zones any more (2026-09-24, per user direction): the player
 * taps the two heroes who open the fight and confirms, and everyone else waits on the bench. The
 * cells never move, so the grid reads the same fight to fight.
 */
const SLOT_COUNT = 6;
const LEAD_COUNT = 2;

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface SquadSlotProps {
  hero?: HeroDefinition;
  entry?: RosterEntry;
  /** One of the two picked to open the fight. */
  picked: boolean;
  /** A fight left this hero down (run/wounds.ts): not fielded, not picked up, not swapped. */
  down: boolean;
  /** A Revive is held and this hero is down: the cell wears the key that spends it. */
  onRevive?: () => void;
  /** Tap: pick this hero to lead, or un-pick it. */
  onActivate: () => void;
  /** Hold: open the hero's sheet. Absent on an empty cell, which has nothing to review. */
  onInspect?: () => void;
}

/**
 * One cell of the squad grid.
 *
 * Extracted from the grid's `.map()` for one reason: it holds a `useLongPress`, and a hook cannot
 * live inside a loop body. Holding is what this screen was missing — every other card in the game
 * opens its sheet that way, and this one alone had a small circled `i` doing it instead, which is
 * why that `i` survived the twenty-seventh pass: it was not a redundant second route to the sheet
 * here, it was the only one.
 *
 * The hook swallows the click that a completed hold would otherwise deliver to the tap handler.
 *
 * A tap PICKS A LEAD (2026-09-24, per user direction): the player taps the two heroes that open
 * the fight, then Start Fight. It replaced Active/Bench bands with tap-to-select plus a move-here
 * key on every landing cell, and the drag that went with them.
 */
function SquadSlot({
  hero,
  entry,
  picked,
  down,
  onRevive,
  onActivate,
  onInspect,
  children,
}: SquadSlotProps & { children: ReactNode }) {
  const press = useLongPress(onInspect, onActivate);
  return (
    <div
      className={`squad-slot${hero ? ' filled' : ' empty'}${picked ? ' is-picked' : ''}${down ? ' is-down' : ''}`}
      style={hero ? ({ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties) : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={hero && !down ? picked : undefined}
      aria-label={
        hero && entry
          ? `${hero.name}, level ${levelOf(entry)} — ${down ? 'down, hold to review' : `${picked ? 'leading, tap to un-pick' : 'tap to lead'}, hold to review`}`
          : 'Empty slot'
      }
      // The cell had `role="button"` and a tab stop and answered neither key. Enter and Space now
      // do what a tap does; the sheet is keyboard-reachable through the roster button in the corner.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
      {...press}
    >
      {children}
      {picked && (
        <span className="squad-slot-pick" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" focusable="false">
            <path d="M9.4 16.6 4.8 12l-1.9 1.9 6.5 6.5L21.1 8.7l-1.9-1.9Z" />
          </svg>
        </span>
      )}
      {onRevive && (
        <button
          type="button"
          className="squad-slot-swap squad-slot-revive"
          aria-label={`Revive ${hero?.name ?? ''}`}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRevive();
          }}
        >
          <ResourceGlyph kind="revive" tone="inherit" />
        </button>
      )}
    </div>
  );
}

/**
 * What the scouted enemy was born with (docs/innate-passives.md §6): its innate's glyph and name,
 * or the Titan's Mark on a spawn. The name is the read — a Skirmish against spawn is a fight
 * against a clock — and the tap on the chip opens the sheet that says the rest.
 */
function ScoutedPassive({ hero, entry }: { hero: HeroDefinition; entry: RosterEntry }) {
  const innate = currentInnateOf(hero, entry);
  const mark = innate ? null : titansMarkOf(hero);
  const passive = innate ?? mark;
  if (!passive) return null;
  return (
    <span
      className={`enemy-scout-innate${mark ? ' is-mark' : ''}`}
      style={{ '--passive-color': passiveColor(passive.id), '--passive-tint': passiveTint(passive.id, 0.16) } as CSSProperties}
      title={`${passive.name} — ${passive.description}`}
    >
      <PassiveGlyph passiveId={passive.id} />
      <span className="enemy-scout-innate-name">{mark ? 'Mark' : passive.name}</span>
    </span>
  );
}

/**
 * One hero against one scouted enemy: up for a matchup the hero comes out ahead in, down for one it
 * comes out behind in, and an empty slot otherwise — the slot is always drawn so nothing changes
 * height when a verdict comes or goes. In every hero cell's row.
 */
function MatchupArrow({ verdict }: { verdict: 'up' | 'down' | null }) {
  return (
    <span
      className={`enemy-scout-verdict enemy-scout-verdict-small${verdict ? ` is-${verdict}` : ''}`}
      aria-label={verdict === 'up' ? 'Good matchup' : verdict === 'down' ? 'Bad matchup' : undefined}
    >
      {verdict && (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          {verdict === 'up' ? <path d="M12 4 21 14h-6v6H9v-6H3Z" /> : <path d="M12 20 3 10h6V4h6v6h6Z" />}
        </svg>
      )}
    </span>
  );
}

/**
 * Every scouted enemy's verdict against one hero, in the chips' order, so the whole grid is read at
 * a glance (2026-09-17, per user direction). It used to take a tap per hero: the arrows landed under
 * the enemies only while that hero was held, and reading six heroes was six taps and a memory.
 */
function MatchupRow({ heroTypes, enemies }: { heroTypes: readonly TypeId[]; enemies: readonly RosterEntry[] }) {
  const verdicts = enemies.map((enemy) => matchupVerdict(heroTypes, rosterEntryTypes(allCombatants[enemy.heroId], enemy)));
  const up = verdicts.filter((v) => v === 'up').length;
  const down = verdicts.filter((v) => v === 'down').length;
  return (
    <div
      className={`squad-slot-matchups${enemies.length > 4 ? ' squad-slot-matchups-dense' : ''}`}
      aria-label={`${up} good ${up === 1 ? 'matchup' : 'matchups'}, ${down} bad`}
    >
      {verdicts.map((verdict, i) => (
        <MatchupArrow key={enemies[i].rosterId} verdict={verdict} />
      ))}
    </div>
  );
}

/** Lead pick before every fight node — the whole roster fields (docs/combat.md "The fielded roster"). Tap the two heroes that open, then Start Fight. */
export function SquadSelectScreen({ run, encounter, onRunChange, onConfirm }: Props) {
  const [slots] = useState<(string | null)[]>(() => {
    // The downed last, so the ones who can fight read first.
    const rank = (id: string) => (run.roster.find((r) => r.rosterId === id)!.down ? 1 : 0);
    const ids = run.roster.map((r) => r.rosterId).sort((a, b) => rank(a) - rank(b));
    return Array.from({ length: SLOT_COUNT }, (_, i) => ids[i] ?? null);
  });
  // Scrambled once into state: `encounter.run.roster` is generated active-first, and a fixed
  // order (or a per-drag reshuffle) would tell the player which enemies open the fight. A later
  // PHASE (Squad.reserves — the Titan's Eyes behind the Herald, docs/titan-eyes.md §10) is not
  // scouted until the profile has cleared a run: the first time through, what walks on when the
  // Herald falls is the surprise (per user direction).
  const profile = useProfile();
  const [scoutOrder] = useState(() => {
    const reserved = new Set((encounter.squad.reserves ?? []).flat());
    const seen = profile.runsCompleted > 0;
    return shuffled(encounter.run.roster.filter((entry) => seen || !reserved.has(entry.rosterId)));
  });
  // The two who open, in tap order. Nothing is picked for the player unless there is no choice to
  // make — two or fewer standing — so every fight's opening pair is one the player chose.
  const [picks, setPicks] = useState<string[]>(() => {
    const standing = standingRoster(run.roster).map((r) => r.rosterId);
    return standing.length <= LEAD_COUNT ? standing : [];
  });
  /** `enemy`: a scouted-opponent sheet gets no relic grants folded in. */
  const [inspecting, setInspecting] = useState<{ hero: HeroDefinition; entry: RosterEntry; enemy: boolean } | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const location = useAmbientLocation();
  const rosterById = new Map(run.roster.map((r) => [r.rosterId, r]));

  function isDownSlot(index: number): boolean {
    const id = slots[index];
    return id !== null && (rosterById.get(id)?.down ?? false);
  }

  // The fielded are the STANDING (run/wounds.ts): a downed hero keeps its cell and is not picked.
  const standingCount = standingRoster(run.roster).length;
  const leadsNeeded = Math.min(LEAD_COUNT, standingCount);
  const benchIds = slots.filter((id): id is string => id !== null && !rosterById.get(id)!.down && !picks.includes(id));
  const pickedIds = picks.concat(benchIds);
  const canStart = leadsNeeded > 0 && picks.length === leadsNeeded;

  /** One Revive off the purse, one hero up at half (run/wounds.ts reviveHero). It stands up in the cell it held. */
  function handleRevive(rosterId: string) {
    const entry = rosterById.get(rosterId);
    if (!entry || !entry.down || !canUseRevive(run)) return;
    const { maxHp } = entryHp(rosterHeroes[entry.heroId], entry, run.relics);
    onRunChange(spendRevive(reviveHero(run, rosterId, maxHp)));
  }

  // A tap picks a hero or un-picks it. A third pick replaces the EARLIER of the two, so the last two
  // heroes tapped are always the pair and the player never has to un-pick first.
  function handleSlotClick(index: number) {
    const id = slots[index];
    if (id === null || isDownSlot(index)) return;
    setPicks((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      return [...prev, id].slice(-LEAD_COUNT);
    });
  }

  function handleConfirm() {
    onConfirm(pickSquad(run.roster, pickedIds));
  }

  return (
    // `--node-rgb` is the Location's tint here (docs/locations.md §5.5), not a node's.
    <div className="squad-select" style={{ '--node-rgb': location?.tintRgb ?? NODE_TINT_GOLD } as CSSProperties}>
      <NodeSky />

      <div className="screen-scroll">
        <div className="squad-stage">
          {/* Who is coming: a chapter mark in the enemy's red, then the four (or however many)
              scouted, in an order that says nothing about who opens. */}
          <section className="squad-section squad-section-enemy">
            <h2 className="squad-section-title">Scouted enemies</h2>
            {/* Six scouted (the finale) go three abreast in a row chip, so the band stays the height
                four take and the screen keeps its one-page shape. */}
            <div className={`enemy-scout-grid${scoutOrder.length > 4 ? ' enemy-scout-grid-dense' : ''}`}>
              {scoutOrder.map((entry) => {
                const hero = allCombatants[entry.heroId];
                const types = rosterEntryTypes(hero, entry);
                // Hidden-card enemy (shared/entrances.ts): silhouette and typing only, and
                // deliberately not a button — there is no sheet behind it.
                if (hasDramaticEntrance(hero.id)) {
                  return (
                    <div
                      key={entry.rosterId}
                      className="enemy-scout-chip enemy-scout-chip-concealed"
                      style={{ '--plate-color': getTypeColor(types[0]) } as CSSProperties}
                      aria-label={`An unidentified ${types.join('/')} enemy, level ${levelOf(entry)}`}
                    >
                      <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                      <span className="pick-level enemy-scout-level" aria-hidden="true">
                        {levelOf(entry)}
                      </span>
                      <div className="enemy-scout-types">
                        {types.map((t) => (
                          <TypeBadge key={t} type={t} />
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <button
                    key={entry.rosterId}
                    className="enemy-scout-chip"
                    style={{ '--plate-color': getTypeColor(hero.types[0]) } as CSSProperties}
                    onClick={() => setInspecting({ hero, entry, enemy: true })}
                    aria-label={`View ${hero.name} details, level ${levelOf(entry)}`}
                  >
                    <HeroPortrait heroId={hero.id} className="enemy-scout-portrait" />
                    <span className="pick-level enemy-scout-level" aria-hidden="true">
                      {levelOf(entry)}
                    </span>
                    <span className="enemy-scout-name">{hero.name}</span>
                    <div className="enemy-scout-types">
                      {types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                    <ScoutedPassive hero={hero} entry={entry} />
                  </button>
                );
              })}
            </div>
          </section>

          {/* Struck between two hairlines, like the fight's own opening beat. */}
          <div className="squad-vs-divider" aria-hidden="true">
            <span>VS</span>
          </div>

          <section className="squad-section squad-section-player">
            <h2 className="squad-section-title">Your squad</h2>
            <div className="squad-pick-hint" aria-live="polite">
              {standingCount > LEAD_COUNT ? `Pick two to lead · ${picks.length}/${LEAD_COUNT}` : 'Everyone standing leads'}
            </div>
            <div className="squad-grid">
              {Array.from({ length: SLOT_COUNT }, (_, index) => {
                const rosterId = slots[index];
                const entry = rosterId ? rosterById.get(rosterId) : undefined;
                const hero = entry ? rosterHeroes[entry.heroId] : undefined;
                const isDown = isDownSlot(index);
                return (
                  <SquadSlot
                    key={index}
                    hero={hero}
                    entry={entry}
                    picked={rosterId !== null && picks.includes(rosterId)}
                    down={isDown}
                    onRevive={isDown && rosterId && canUseRevive(run) ? () => handleRevive(rosterId) : undefined}
                    onActivate={() => handleSlotClick(index)}
                    onInspect={hero && entry ? () => setInspecting({ hero, entry, enemy: false }) : undefined}
                  >
                    {hero && entry ? (
                      <>
                        <HeroPortrait heroId={hero.id} className="roster-card-portrait" />
                        {/* On the figure's corner as the pick cards wear it, not on the name line: a row
                            cell's line holds a ten-letter name OR a level, not both. */}
                        <span className="pick-level squad-slot-level" aria-hidden="true">
                          {levelOf(entry)}
                        </span>
                        <div className="roster-card-name">{hero.name}</div>
                        <div className="roster-card-types">
                          {rosterEntryTypes(hero, entry).map((t) => (
                            <TypeBadge key={t} type={t} />
                          ))}
                        </div>
                        {/* A downed hero has no matchups to read: it is not going. */}
                        {entry.down ? <div className="squad-slot-down-label">Down</div> : <MatchupRow heroTypes={rosterEntryTypes(hero, entry)} enemies={scoutOrder} />}
                        {/* Where the act has left this hero (run/wounds.ts) — the read the pick is made on. */}
                        <WoundBar {...entryHp(hero, entry, run.relics)} figure />
                      </>
                    ) : (
                      <div className="squad-slot-empty-label">Empty</div>
                    )}
                  </SquadSlot>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* The two tools flank the one CTA (2026-09-11, per user direction): they were 44px tiles in
          the top-right corner, the far end of a thumb's reach on a phone. Roster on the left — it
          opens Manage Roster, since moving gear before a fight is the point — reference on the
          right, and Start Fight between them where the thumb already rests. */}
      <div className="squad-footer">
        <button type="button" className="squad-tool-button" onClick={() => setShowRoster(true)} aria-label="Manage your roster" title="Manage your roster">
          <HubGlyph name="roster" />
        </button>
        <button className="resolve-button" disabled={!canStart} onClick={handleConfirm}>
          Start Fight
        </button>
        <button
          type="button"
          className="squad-tool-button"
          onClick={() => setShowReference(true)}
          aria-label="Type chart and reference"
          title="Type chart and reference"
        >
          <HubGlyph name="codex" />
        </button>
      </div>

      {inspecting && (
        <HeroPreviewOverlay
          hero={inspecting.hero}
          entry={inspecting.entry}
          equipmentLookup={equipment}
          relicIds={inspecting.enemy ? [] : run.relics}
          scale={statScaleFor(run)}
          onClose={() => setInspecting(null)}
        />
      )}
      {showReference && <ReferenceOverlay onClose={() => setShowReference(false)} />}
      {showRoster && <RosterManagementScreen run={run} onClose={() => setShowRoster(false)} />}
    </div>
  );
}
