// The Guild Hall's sign: a plank hung on two chains, carrying the guild's crest. It swings a hair
// (styles.css `.guild-sign`) so the header reads as a place with weather in it, not a heading.

const SIGN_WIDTH = 200;
const SIGN_HEIGHT = 124;

export function GuildSign() {
  return (
    <svg className="guild-sign" viewBox={`0 0 ${SIGN_WIDTH} ${SIGN_HEIGHT}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="guild-plank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a2d18" />
          <stop offset="0.5" stopColor="#2c1a0e" />
          <stop offset="1" stopColor="#170d07" />
        </linearGradient>
        <linearGradient id="guild-crest" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd98a" />
          <stop offset="0.45" stopColor="#e8a34a" />
          <stop offset="1" stopColor="#a8561a" />
        </linearGradient>
        <linearGradient id="guild-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5a2c" />
          <stop offset="0.5" stopColor="#d9a35c" />
          <stop offset="1" stopColor="#6e4220" />
        </linearGradient>
      </defs>

      {/* The bracket bar and its two chains. */}
      <rect x="24" y="2" width="152" height="4" rx="2" fill="#3b3b44" />
      <g stroke="#8d8f9c" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="3.5 3.5" fill="none">
        <path d="M46 6v26" />
        <path d="M154 6v26" />
      </g>

      {/* The plank: a bevelled board with the grain scored across it. */}
      <rect x="30" y="32" width="140" height="86" rx="7" fill="url(#guild-plank)" stroke="url(#guild-rim)" strokeWidth="2" />
      <g stroke="#5c3a1f" strokeWidth="1" strokeLinecap="round" opacity="0.55" fill="none">
        <path d="M40 48c30 3 60 3 120 0" />
        <path d="M40 104c30-3 60-3 120 0" />
        <path d="M38 76c20-2 40-2 62 0" />
        <path d="M118 78c14 1 28 1 44-1" />
      </g>
      {/* Nails. */}
      <g fill="#9a9ca8">
        <circle cx="39" cy="41" r="2" />
        <circle cx="161" cy="41" r="2" />
        <circle cx="39" cy="109" r="2" />
        <circle cx="161" cy="109" r="2" />
      </g>

      {/* The crest: a shield with crossed blades under a star. */}
      <path
        d="M100 46c10 5 20 7 30 7v22c0 15-13 26-30 32-17-6-30-17-30-32V53c10 0 20-2 30-7Z"
        fill="url(#guild-crest)"
        stroke="#3a1f0c"
        strokeWidth="2"
      />
      <path
        d="M100 52c8 4 16 5.5 24 5.6v17.4c0 12-10.5 21-24 26-13.5-5-24-14-24-26V57.6c8-.1 16-1.6 24-5.6Z"
        fill="none"
        stroke="#fff1c8"
        strokeWidth="1"
        opacity="0.55"
      />
      <g stroke="#2a160a" strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M86 90 114 64" />
        <path d="M114 90 86 64" />
      </g>
      <g stroke="#fff1c8" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M88 88 112 66" />
        <path d="M112 88 88 66" />
      </g>
      <path d="m100 55 2.3 5 5.4.6-4 3.7 1.1 5.4-4.8-2.8-4.8 2.8 1.1-5.4-4-3.7 5.4-.6Z" fill="#2a160a" />
    </svg>
  );
}
