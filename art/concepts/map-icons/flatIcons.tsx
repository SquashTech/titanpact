import type { ReactNode } from 'react';

// Direction B: flat drawn icons, ink-rimmed like the buttons around them. 48 viewBox.
const INK = '#2b2340';
const line = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%">
      {children}
    </svg>
  );
}

export const FLAT_ICONS: Record<string, () => ReactNode> = {
  manaWell: () => (
    <Svg>
      <circle cx="24" cy="9" r="4.5" fill="#7fc4ff" {...line} />
      <path d="M8 22 L8 34 Q8 41 15 41 L33 41 Q40 41 40 34 L40 22 Z" fill="#b8b0cc" {...line} />
      <path d="M8 30 H40 M17 22 V41 M31 22 V41" fill="none" stroke={INK} strokeWidth="1.6" opacity="0.35" />
      <ellipse cx="24" cy="22" rx="16" ry="6" fill="#ddd7ea" {...line} />
      <ellipse cx="24" cy="22" rx="11" ry="3.4" fill="#3d8bff" stroke={INK} strokeWidth="1.8" />
      <ellipse cx="21" cy="21" rx="4" ry="1.1" fill="#bfe2ff" />
    </Svg>
  ),
  recruit: () => (
    <Svg>
      <rect x="11" y="9" width="24" height="30" rx="3" fill="#fff2cf" {...line} />
      <rect x="8" y="6" width="30" height="6" rx="3" fill="#f3d9a0" {...line} />
      <path d="M16 18 H30 M16 23 H30 M16 28 H24" stroke="#c9a96b" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M38 6 Q44 14 34 26 L32 24 Q38 14 38 6 Z" fill="#fffaf0" {...line} />
      <circle cx="31" cy="35" r="6.5" fill="#e8554a" {...line} />
      <circle cx="31" cy="35" r="2.6" fill="#ff8a80" />
    </Svg>
  ),
  gems: () => (
    <Svg>
      <polygon points="24,43 6,18 13,8 35,8 42,18" fill="#ff4f6a" {...line} />
      <polygon points="13,8 35,8 42,18 6,18" fill="#ff8a9a" {...line} />
      <polygon points="17,18 24,8 31,18 24,43" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" opacity="0.5" />
      <path d="M15 12 L19 12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </Svg>
  ),
  rest: () => (
    <Svg>
      <rect x="8" y="34" width="32" height="7" rx="3.5" transform="rotate(-14 24 37)" fill="#b8743a" {...line} />
      <rect x="8" y="34" width="32" height="7" rx="3.5" transform="rotate(14 24 37)" fill="#c98a4a" {...line} />
      <path d="M24 6 C31 14 35 19 35 26 C35 32 30 35 24 35 C18 35 13 32 13 26 C13 21 17 18 18 13 C20 17 21 18 22 18 C22 13 22 10 24 6 Z" fill="#ff8a3d" {...line} />
      <path d="M24 18 C28 23 30 26 30 29 C30 32 27 34 24 34 C21 34 18 32 18 29 C18 26 21 24 24 18 Z" fill="#ffd34d" />
    </Svg>
  ),
  item: () => (
    <Svg>
      <path d="M8 20 Q8 10 18 10 H30 Q40 10 40 20 Z" fill="#d68a45" {...line} />
      <rect x="8" y="20" width="32" height="20" rx="3" fill="#c07535" {...line} />
      <path d="M21 10 V40 M27 10 V40" stroke={INK} strokeWidth="1.6" opacity="0.3" />
      <rect x="6.5" y="18" width="35" height="5" rx="2" fill="#ffcf3d" {...line} />
      <rect x="20" y="22" width="8" height="9" rx="2" fill="#ffcf3d" {...line} />
      <circle cx="24" cy="26.5" r="1.5" fill={INK} />
    </Svg>
  ),
  boon: () => (
    <Svg>
      <path d="M17 6 Q24 0 31 6" fill="none" stroke="#a0734a" strokeWidth="2.6" strokeLinecap="round" />
      <polygon points="24,9 29,19.5 40.5,20.5 31.8,28 34.5,39.5 24,33.5 13.5,39.5 16.2,28 7.5,20.5 19,19.5" fill="#ffcf3d" {...line} />
      <polygon points="24,15 27,21.5 22,23" fill="#fff3b0" />
    </Svg>
  ),
  elite: () => (
    <Svg>
      <path d="M12 22 C6 20 4 13 7 7 C9 13 12 15 15 15 Z" fill="#fff2cf" {...line} />
      <path d="M36 22 C42 20 44 13 41 7 C39 13 36 15 33 15 Z" fill="#fff2cf" {...line} />
      <path d="M11 40 V26 C11 17 17 12 24 12 C31 12 37 17 37 26 V40 Z" fill="#9aa6c8" {...line} />
      <path d="M15 28 H33" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M24 13 V40" stroke={INK} strokeWidth="1.6" opacity="0.35" />
      <path d="M17 10 L19 4 L22 8 L24 3 L26 8 L29 4 L31 10 Z" fill="#ffcf3d" {...line} />
    </Svg>
  ),
  skirmish: () => (
    <Svg>
      {[-45, 45].map((deg) => (
        <g key={deg} transform={`rotate(${deg} 24 24)`}>
          <path d="M21 4 H27 V30 H21 Z" fill="#e4e9f5" {...line} />
          <path d="M21 4 L24 1 L27 4" fill="#e4e9f5" {...line} />
          <rect x="15" y="29" width="18" height="5" rx="2.5" fill="#ffcf3d" {...line} />
          <rect x="21.5" y="34" width="5" height="9" rx="2" fill="#a0603a" {...line} />
        </g>
      ))}
    </Svg>
  ),
  event: () => (
    <Svg>
      <text x="24" y="40" textAnchor="middle" fontFamily="Fredoka, sans-serif" fontWeight="700" fontSize="40" fill="#9b6bff" stroke={INK} strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">
        ?
      </text>
      <path d="M38 8 L39.5 11.5 L43 13 L39.5 14.5 L38 18 L36.5 14.5 L33 13 L36.5 11.5 Z" fill="#ffcf3d" />
    </Svg>
  ),
  roster: () => (
    <Svg>
      <circle cx="12" cy="17" r="6" fill="#fffaf0" {...line} />
      <path d="M3 40 C3 30 7 26 12 26 C17 26 21 30 21 40 Z" fill="#fffaf0" {...line} />
      <circle cx="36" cy="17" r="6" fill="#fffaf0" {...line} />
      <path d="M27 40 C27 30 31 26 36 26 C41 26 45 30 45 40 Z" fill="#fffaf0" {...line} />
      <circle cx="24" cy="14" r="7.5" fill="#ffe08a" {...line} />
      <path d="M13 42 C13 30 18 25 24 25 C30 25 35 30 35 42 Z" fill="#ffe08a" {...line} />
    </Svg>
  ),
};
