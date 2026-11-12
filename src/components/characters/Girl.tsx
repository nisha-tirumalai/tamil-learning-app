// The girl avatar: Girl 1's orange top and dark bottoms; long, full hair with
// curtain bangs and strands falling in front; the same face and skin as the guy.
import { Face, SKIN } from "./Face";
import { type ArtProps, BLUSH, heightFor, STROKE, turn } from "./style";

const HAIR = "#2e2320";
const HAIR_SHINE = "#4d3d36";
const TOP = "#e2683c";
const BOTTOM = "#3a3a40";
const VIEW = { full: "0 -16 200 296", bust: "16 -16 168 196", head: "34 -12 132 132" };

export function GirlArt({ mouth = "closed", eyes = "open", size = 120, crop = "full", facing = "front", label = "Girl", className = "avatar" }: ArtProps) {
  const t = turn(facing);
  const head = `rotate(${t.tilt} 100 112) translate(100 112) scale(1.24) translate(-100 -112)`;
  return (
    <svg width={size} height={heightFor(size, VIEW[crop])} viewBox={VIEW[crop]} role="img" aria-label={label} className={className}>
      {/* hair, back layer: full and wide */}
      <g transform={head}>
        <path d="M58 74 Q46 18 100 18 Q154 18 142 74 Q150 106 148 136 Q144 150 132 146 Q118 154 100 146 Q82 154 68 146 Q56 150 52 136 Q50 106 58 74 Z" fill={HAIR} {...STROKE} />
      </g>
      {/* legs + shoes */}
      <g {...STROKE}>
        <path d="M72 204 L74 262 L98 262 L100 216 L102 262 L126 262 L128 204 Z" fill={BOTTOM} />
        <ellipse cx="86" cy="266" rx="15" ry="6.5" fill="#6b3a2a" />
        <ellipse cx="114" cy="266" rx="15" ry="6.5" fill="#6b3a2a" />
      </g>
      {/* arms */}
      <g {...STROKE} fill={SKIN}>
        <rect x="49" y="150" width="15" height="68" rx="7.5" transform="rotate(5 56 150)" />
        <rect x="136" y="150" width="15" height="68" rx="7.5" transform="rotate(-5 143 150)" />
      </g>
      {/* neck + top */}
      <rect x="91" y="102" width="18" height="28" fill={SKIN} {...STROKE} />
      <path d="M68 128 Q100 118 132 128 L150 164 L134 172 L131 210 L69 210 L66 172 L50 164 Z" fill={TOP} {...STROKE} />
      <path d="M88 123 Q100 134 112 123" fill="none" {...STROKE} strokeWidth={2.5} />
      <g transform={head}>
        <ellipse cx="100" cy="72" rx="32" ry="36" fill={SKIN} {...STROKE} />
        <g transform={`translate(${t.face} 0)`}>
          <ellipse cx="76" cy="86" rx="7" ry="4" fill={BLUSH} opacity="0.4" />
          <ellipse cx="124" cy="86" rx="7" ry="4" fill={BLUSH} opacity="0.4" />
          <Face eyes={eyes} mouth={mouth} look={t.look} />
        </g>
        {/* top of the hair with curtain bangs: parted in the middle, sweeping out to each side */}
        <path d="M63 88 Q52 22 100 22 Q148 22 137 88 Q134 70 124 62 Q110 54 102 42 L98 42 Q90 54 76 62 Q66 70 63 88 Z" fill={HAIR} {...STROKE} />
        <path d="M99 44 Q92 56 80 62 M101 44 Q108 56 120 62" fill="none" stroke={HAIR_SHINE} strokeWidth={2.2} strokeLinecap="round" />
        {/* strands falling in front, over the shoulders */}
        <path d="M66 74 Q60 104 63 128 Q66 144 60 154 Q76 152 77 132 Q78 108 72 88 Z" fill={HAIR} {...STROKE} />
        <path d="M134 74 Q140 104 137 128 Q134 144 140 154 Q124 152 123 132 Q122 108 128 88 Z" fill={HAIR} {...STROKE} />
        <path d="M76 32 Q88 26 96 28 M104 28 Q114 26 124 32" fill="none" stroke={HAIR_SHINE} strokeWidth={3} strokeLinecap="round" />
      </g>
    </svg>
  );
}
