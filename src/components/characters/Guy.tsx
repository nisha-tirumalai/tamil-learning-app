// The guy avatar: Boy 2's look (messy black hair, simple face, yellow tee,
// jeans) with Boy 1's lighter skin, and the face he shares with the girl.
import { Face, SKIN } from "./Face";
import { type ArtProps, BLUSH, heightFor, STROKE, turn } from "./style";

const SKIN_SHADE = "#e3a97c";
const HAIR = "#1f1a1a";
const SHIRT = "#f4b731";
const JEANS = "#3f78ad";
const VIEW = { full: "0 -16 200 296", bust: "16 -16 168 196", head: "36 -14 128 128" };

export function GuyArt({ mouth = "closed", eyes = "open", size = 120, crop = "full", facing = "front", label = "Guy", className = "avatar" }: ArtProps) {
  const t = turn(facing);
  return (
    <svg width={size} height={heightFor(size, VIEW[crop])} viewBox={VIEW[crop]} role="img" aria-label={label} className={className}>
      {/* legs + shoes */}
      <g {...STROKE}>
        <path d="M70 204 L72 262 L98 262 L100 214 L102 262 L128 262 L130 204 Z" fill={JEANS} />
        <ellipse cx="84" cy="266" rx="17" ry="7" fill="#33302e" />
        <ellipse cx="116" cy="266" rx="17" ry="7" fill="#33302e" />
      </g>
      {/* arms */}
      <g {...STROKE} fill={SKIN}>
        <rect x="45" y="150" width="17" height="70" rx="8.5" transform="rotate(5 53 150)" />
        <rect x="138" y="150" width="17" height="70" rx="8.5" transform="rotate(-5 147 150)" />
      </g>
      {/* neck + shirt */}
      <rect x="90" y="104" width="20" height="26" fill={SKIN} {...STROKE} />
      <path d="M64 126 Q100 116 136 126 L156 166 L138 174 L134 212 L66 212 L62 174 L44 166 Z" fill={SHIRT} {...STROKE} />
      <path d="M86 122 Q100 134 114 122" fill="none" {...STROKE} strokeWidth={2.5} />
      <g transform={`rotate(${t.tilt} 100 112) translate(100 112) scale(1.24) translate(-100 -112)`}>
        <g {...STROKE} fill={SKIN}>
          <circle cx="66" cy="74" r="9" />
          <circle cx="134" cy="74" r="9" />
          <ellipse cx="100" cy="70" rx="35" ry="38" />
        </g>
        <path d="M64 74 Q67 70 69 76" fill="none" stroke={SKIN_SHADE} strokeWidth={2} />
        <path d="M136 74 Q133 70 131 76" fill="none" stroke={SKIN_SHADE} strokeWidth={2} />
        {/* messy hair */}
        <path
          d="M64 74 Q56 44 72 32 Q84 20 102 22 Q124 20 134 34 Q142 48 136 74
             Q133 62 128 55 Q121 62 112 55 Q112 63 103 65 Q100 55 91 52 Q82 61 73 59 Q68 64 64 74 Z"
          fill={HAIR} {...STROKE} />
        <path d="M90 25 Q92 13 104 18 Q110 12 114 22" fill={HAIR} {...STROKE} />
        <g transform={`translate(${t.face} 0)`}>
          <ellipse cx="74" cy="86" rx="7" ry="4" fill={BLUSH} opacity="0.35" />
          <ellipse cx="126" cy="86" rx="7" ry="4" fill={BLUSH} opacity="0.35" />
          <Face eyes={eyes} mouth={mouth} look={t.look} />
        </g>
      </g>
    </svg>
  );
}
