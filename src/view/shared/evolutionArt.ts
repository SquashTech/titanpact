/**
 * An Evolution form's own idle sprite, keyed by path id: drop `art/evolutions/<pathId>.png`
 * (`cinderKnight-explosive.png`) and every surface that passes a `pathId` to HeroPortrait draws
 * it. A path with no file falls back to the hero's own sprite, so art can land one type at a time.
 * Its own folder, not `art/heroes/`, whose glob claims every file there for a hero.
 */
const files = import.meta.glob<string>('../../../art/evolutions/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const evolutionArt: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.png'.length), url])
);
