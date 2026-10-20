import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { playSfx } from '../../audio/sfx';
import { paintingAt, stageAt, type StageMark, type StoryActor, type StoryLine, type StoryMood, type StoryVoice } from '../../run/story';
import { HeroPortrait } from '../shared/HeroPortrait';
import { locationBackdrop } from '../shared/locationBackdrops';
import { NightSky } from '../run/NightSky';
import { prefersReducedMotion } from '../shared/reducedMotion';
import './story.css';

const PORTRAITS = import.meta.glob<string>('../../../art/portraits/*/*.png', { eager: true, query: '?url', import: 'default' });
/** A character's bust in a mood, falling back to their neutral face. */
function portraitUrl(id: string, mood: StoryMood): string | undefined {
  const at = (m: string) => Object.entries(PORTRAITS).find(([path]) => path.endsWith(`/${id}/${m}.png`))?.[1];
  return at(mood) ?? at('neutral');
}

/** The speaker's face in the dialogue box, on their own side, looking in at the line. Keyed on the character so a new face fades in. */
function Face({ actor, mood }: { actor: StoryActor; mood: StoryMood }) {
  const url = actor.portrait ? portraitUrl(actor.portrait, mood) : undefined;
  if (!url) return null;
  return (
    <span key={actor.id} className={`story-face is-${actor.stands}`} aria-hidden="true">
      <img src={url} alt="" draggable={false} />
    </span>
  );
}

const PAINTINGS = import.meta.glob<string>('../../../art/stories/paintings/*.png', { eager: true, query: '?url', import: 'default' });
const paintingUrl = (id: string) => Object.entries(PAINTINGS).find(([path]) => path.endsWith(`/${id}.png`))?.[1];

/** A painted moment over the scene, cross-faded in and out. One not yet painted shows a plain plate with its name. */
function Painting({ id, up }: { id: string | null; up: boolean }) {
  if (!id) return null;
  const url = paintingUrl(id);
  return (
    <div className={`story-painting${up ? ' is-up' : ''}`} aria-hidden="true">
      {url ? <img key={id} className="story-painting-art" src={url} alt="" draggable={false} /> : <span key={id} className="story-painting-placeholder">{id}</span>}
    </div>
  );
}

/** How long the scroll from the stars to the place runs, matching story.css `story-descent-scroll`. */
const DESCENT_MS = 5200;
const DESCENTS = import.meta.glob<string>('../../../art/stories/descents/*.png', { eager: true, query: '?url', import: 'default' });
/** A place's descent strip: its backdrop with two screens of sky above it, three times its height. */
const descentUrl = (locationId: string) => Object.entries(DESCENTS).find(([path]) => path.endsWith(`/${locationId}.png`))?.[1];

/** Narration, and anyone with no voice of their own, types with a typewriter's click. */
const TYPEWRITER: StoryVoice = { timbre: 'click', pitch: 1 };

/** Ms a character; a blip every BLIP_EVERY characters typed, spaces skipped. */
const TYPE_MS = 28;
const BLIP_EVERY = 2;

/**
 * A line typed out a character at a time with its speaker's blip under it (audio/sounds.ts
 * `voice.*`). `finish` shows the rest at once: the first tap on a line still typing.
 */
function useTypedLine(text: string, voice: StoryVoice | undefined): { shown: number; done: boolean; finish: () => void } {
  const instant = prefersReducedMotion();
  // The count is kept with the line it counts, so a new line's first frame never shows the last one's count.
  const [count, setCount] = useState({ text, n: instant ? text.length : 0 });
  const shown = count.text === text ? count.n : instant ? text.length : 0;
  const setShown = (n: number) => setCount({ text, n });
  const typed = useRef(0);
  useEffect(() => {
    typed.current = instant ? text.length : 0;
    setShown(typed.current);
    if (instant || !text) return;
    let sinceBlip = BLIP_EVERY;
    const timer = window.setInterval(() => {
      typed.current += 1;
      setShown(typed.current);
      const char = text[typed.current - 1];
      if (voice && char && char.trim() && ++sinceBlip >= BLIP_EVERY) {
        sinceBlip = 0;
        playSfx(`voice.${voice.timbre}`, { pitch: voice.pitch });
      }
      if (typed.current >= text.length) window.clearInterval(timer);
    }, TYPE_MS);
    return () => window.clearInterval(timer);
  }, [text, voice, instant]);
  return {
    shown,
    done: shown >= text.length,
    finish: () => {
      typed.current = text.length;
      setShown(text.length);
    },
  };
}

/** The line's text, the untyped part held in place (invisible) so nothing reflows as it types. */
function TypedText({ text, shown }: { text: string; shown: number }) {
  return (
    <p className="story-line-text">
      {text.slice(0, shown)}
      <span className="story-untyped">{text.slice(shown)}</span>
    </p>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      className="story-skip"
      onClick={(e) => {
        e.stopPropagation();
        playSfx('ui.tap');
        onSkip();
      }}
    >
      Skip
    </button>
  );
}

interface Props {
  locationId: string;
  cast: readonly StoryActor[];
  lines: readonly StoryLine[];
  stage?: Readonly<Record<string, StageMark>>;
  skipped: string;
  onDone: () => void;
}

/** Which way a figure looks: the speaker at whoever stands nearest, everyone else at the speaker. Sprites are drawn facing right. */
function facesLeft(id: string, marks: Record<string, StageMark>, speakerId: string | null): boolean {
  const me = marks[id];
  const onStage = Object.entries(marks).filter(([other, mark]) => other !== id && !mark.off);
  if (speakerId && speakerId !== id && marks[speakerId] && !marks[speakerId].off) return marks[speakerId].x < me.x;
  const nearest = onStage.sort(([, a], [, b]) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
  return nearest ? nearest[1].x < me.x : me.x > 50;
}

/** A Story scene (docs/stories.md §10): the cast on the place's backdrop, one line a tap, the speaker stepping forward. */
export function StoryScene({ locationId, cast, lines, stage, skipped, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [skipping, setSkipping] = useState(false);
  const line = lines[Math.min(step, lines.length - 1)];
  const speaker = cast.find((actor) => actor.id === line?.speaker) ?? null;
  const backdrop = locationBackdrop(locationId);
  const text = skipping ? skipped : (line?.text ?? '');
  const typing = useTypedLine(text, speaker?.voice ?? TYPEWRITER);

  useEffect(() => {
    if (!skipping && line?.sound) playSfx(line.sound);
  }, [step, skipping, line]);

  function advance() {
    if (!typing.done) {
      typing.finish();
      return;
    }
    if (skipping || step >= lines.length - 1) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    setStep((i) => i + 1);
  }

  const painting = skipping ? null : paintingAt(lines, step);
  // The last painting stays mounted after it is taken down, so it can fade out.
  const lastPainting = useRef<string | null>(null);
  if (painting) lastPainting.current = painting;
  const marks = stageAt(cast, stage, lines, step);
  const face = !skipping && speaker?.portrait ? speaker : null;
  const before = step > 0 ? stageAt(cast, stage, lines, step - 1) : marks;
  const figure = (actor: StoryActor) => {
    const mark = marks[actor.id];
    if (!mark) return null;
    const was = before[actor.id];
    const walking = !!was && !was.off && !mark.off && (was.x !== mark.x || was.depth !== mark.depth);
    const style = {
      left: `${mark.x}%`,
      bottom: `${(1 - mark.depth) * 100}%`,
      zIndex: Math.round(mark.depth * 100),
      '--figure-scale': (0.7 + 0.45 * mark.depth) * (actor.scale ?? 1),
      '--figure-flip': facesLeft(actor.id, marks, speaker?.id ?? null) ? -1 : 1,
    } as CSSProperties;
    return (
      <div
        key={actor.id}
        className={`story-figure${actor.id === speaker?.id ? ' is-speaking' : ''}${mark.off ? ' is-off' : ''}${walking && !actor.uncanny ? ' is-walking' : ''}${actor.uncanny ? ' is-uncanny' : ''}`}
        style={style}
      >
        <HeroPortrait key={walking ? `walk-${step}` : 'still'} heroId={actor.artHeroId} className="story-figure-sprite" />
      </div>
    );
  };

  return (
    <div className={`story-screen story-scene${painting ? ' has-painting' : ''}`} onClick={advance} role="dialog" aria-live="polite">
      {backdrop && <div className="story-backdrop" style={{ backgroundImage: `url(${backdrop})` }} aria-hidden="true" />}
      <SkipButton onSkip={() => setSkipping(true)} />
      <div className="story-ground" aria-hidden="true">
        {cast.map(figure)}
      </div>
      <Painting id={painting ?? lastPainting.current} up={!!painting} />
      <div className={`story-line${speaker && !skipping ? '' : ' is-narration'}${line?.think ? ' is-thought' : ''}${face ? ` has-face is-${face.stands}` : ''}`}>
        {face && <Face actor={face} mood={line?.mood ?? 'neutral'} />}
        <div className="story-line-body">
          {speaker && !skipping && <span className="story-line-name">{speaker.name}</span>}
          <TypedText text={text} shown={typing.shown} />
        </div>
      </div>
    </div>
  );
}

/** Valor remembering (docs/stories.md §1): her lines over the place, faded like an old picture, in her voice. */
export function StoryMemory({
  locationId,
  lines,
  voice,
  descend = false,
  onDone,
}: {
  locationId: string;
  lines: readonly string[];
  voice?: StoryVoice;
  /** Come down out of the title's night sky onto the place before the first line types. */
  descend?: boolean;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const strip = descentUrl(locationId);
  const [descending, setDescending] = useState(descend && !!strip && !prefersReducedMotion());
  const backdrop = locationBackdrop(locationId);
  const text = lines[Math.min(step, lines.length - 1)] ?? '';
  const typing = useTypedLine(descending ? '' : text, voice);

  useEffect(() => {
    if (!descending) return;
    const timer = window.setTimeout(() => setDescending(false), DESCENT_MS);
    return () => window.clearTimeout(timer);
  }, [descending]);

  function advance() {
    if (descending) {
      setDescending(false);
      return;
    }
    if (!typing.done) {
      typing.finish();
      return;
    }
    if (step >= lines.length - 1) {
      playSfx('ui.confirm');
      onDone();
      return;
    }
    setStep((i) => i + 1);
  }

  return (
    <div className={`story-screen story-memory${descending ? ' is-descending' : ''}`} onClick={advance} role="dialog" aria-live="polite">
      {backdrop && <div className="story-backdrop story-memory-backdrop" style={{ backgroundImage: `url(${backdrop})` }} aria-hidden="true" />}
      {descending && (
        <>
          <div className="story-descent" style={{ backgroundImage: `url(${strip})` }} aria-hidden="true" />
          <div className="story-descent-stars" aria-hidden="true">
            <NightSky />
          </div>
        </>
      )}
      <SkipButton onSkip={onDone} />
      <div className="story-memory-text">
        {!descending && <TypedText text={text} shown={typing.shown} />}
      </div>
    </div>
  );
}

/** A chapter's last beat: its title, one closing line, back to the Story select. */
export function StoryEndCard({ title, number, line, onDone }: { title: string; number: number; line: string; onDone: () => void }) {
  return (
    <div
      className="story-screen story-end"
      onClick={() => {
        playSfx('ui.confirm');
        onDone();
      }}
      role="dialog"
    >
      <p className="story-end-line">{line}</p>
      <p className="story-end-number">Chapter {number}</p>
      <h1 className="story-end-title">{title}</h1>
    </div>
  );
}
