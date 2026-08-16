import { heroArt } from './heroArt';

interface Props {
  heroId: string;
  className: string;
}

/** Renders a hero's pixel-art portrait if one exists in heroArt; renders nothing otherwise, so callers can place it unconditionally and let heroes without art simply take up no space. */
export function HeroPortrait({ heroId, className }: Props) {
  const src = heroArt[heroId];
  if (!src) return null;
  return <img className={className} src={src} alt="" />;
}
