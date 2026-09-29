import type { TypeId } from '../../engine/content';
import { matchupVerdict, type MatchupVerdict } from './matchupVerdict';

/**
 * One hero against one enemy: up for a matchup the hero comes out ahead in, down for one it comes
 * out behind in, and an empty slot otherwise — the slot is always drawn so nothing changes height
 * when a verdict comes or goes.
 */
export function MatchupArrow({ verdict }: { verdict: MatchupVerdict }) {
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

/** Every enemy's verdict against one hero, in the enemies' order, so a whole grid of heroes is read at a glance. */
export function MatchupRow({ heroTypes, enemyTypes }: { heroTypes: readonly TypeId[]; enemyTypes: readonly (readonly TypeId[])[] }) {
  const verdicts = enemyTypes.map((types) => matchupVerdict(heroTypes, types));
  const up = verdicts.filter((v) => v === 'up').length;
  const down = verdicts.filter((v) => v === 'down').length;
  return (
    <div
      className={`squad-slot-matchups${enemyTypes.length > 4 ? ' squad-slot-matchups-dense' : ''}`}
      aria-label={`${up} good ${up === 1 ? 'matchup' : 'matchups'}, ${down} bad`}
    >
      {verdicts.map((verdict, i) => (
        <MatchupArrow key={i} verdict={verdict} />
      ))}
    </div>
  );
}
