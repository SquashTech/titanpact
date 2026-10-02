/**
 * An Evolution form's own sprites, keyed by path id: drop `art/evolutions/<pathId>.png`
 * (`cinderKnight-explosive.png`) and every surface that passes a `pathId` to HeroPortrait draws
 * it; `<pathId>attack.png` and `<pathId>damaged.png` beside it are its pose frames, as a hero's are
 * (heroArt.ts). Anything missing falls back to the hero's own sprite, so art can land a type and a
 * frame at a time. Its own folder, not `art/heroes/`, whose glob claims every file there for a hero.
 */
const files = import.meta.glob<string>('../../../art/evolutions/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

type FormPose = 'attack' | 'hurt';
const POSE_SUFFIXES: readonly [string, FormPose][] = [
  ['attack', 'attack'],
  ['damaged', 'hurt'],
];

export const evolutionArt: Record<string, string> = {};
export const evolutionPoses: Record<string, Partial<Record<FormPose, string>>> = {};

for (const [path, url] of Object.entries(files)) {
  const name = path.slice(path.lastIndexOf('/') + 1, -'.png'.length);
  const pose = POSE_SUFFIXES.find(([suffix]) => name.endsWith(suffix));
  if (pose) (evolutionPoses[name.slice(0, -pose[0].length)] ??= {})[pose[1]] = url;
  else evolutionArt[name] = url;
}
