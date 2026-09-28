import { MASTERY_CAP, MASTERY_EVOLUTION, MASTERY_INNATE } from '../../run/mastery';

interface Props {
  mastery: number;
  /** Pips a pending grant would light, drawn after the held ones in the screen's colour. */
  gain?: number;
  /** Name the two milestones under the track — what the fifth and tenth pip do — where there is room. */
  marked?: boolean;
  className?: string;
}

const MARKS = [
  { pip: MASTERY_EVOLUTION, ahead: 'Evolve', done: 'Evolved' },
  { pip: MASTERY_INNATE, ahead: 'Master', done: 'Mastered' },
];

/**
 * A hero's ten Mastery pips (run/mastery.ts), the two milestones ringed: the fifth is the
 * Evolution, the tenth the innate mastered. The one place the count is drawn, so the sheet, the
 * who-screen and the report all read the same row.
 */
export function MasteryPips({ mastery, gain = 0, marked = false, className }: Props) {
  const lit = Math.min(MASTERY_CAP, mastery + gain);
  const classes = ['mastery-pips', marked ? 'is-marked' : '', className].filter(Boolean).join(' ');
  return (
    <span className={classes} aria-label={`Mastery ${mastery} of ${MASTERY_CAP}`}>
      {Array.from({ length: MASTERY_CAP }, (_, i) => {
        const pip = i + 1;
        const milestone = pip === MASTERY_EVOLUTION || pip === MASTERY_INNATE;
        const state = pip <= mastery ? 'is-held' : pip <= lit ? 'is-gain' : '';
        return <i key={pip} className={['mastery-pip', milestone ? 'is-milestone' : '', state].filter(Boolean).join(' ')} />;
      })}
      {marked &&
        MARKS.map(({ pip, ahead, done }) => (
          <span
            key={pip}
            className={`mastery-mark${mastery >= pip ? ' is-reached' : ''}`}
            style={{ gridColumn: pip }}
            aria-hidden="true"
          >
            {mastery >= pip ? done : ahead}
          </span>
        ))}
    </span>
  );
}
