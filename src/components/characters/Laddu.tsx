// Laddu 🧸: golden-tan teddy (colours from Nisha's "Laddu 3"), chubby full body.
import { type ArtProps, BLUSH, heightFor, STROKE, turn } from "./style";

const FUR = "#c99a62";
const FUR_DARK = "#a0743f";
const SNOUT = "#ecd2a8";
const NOSE = "#4b3428";
const VIEW = { full: "0 -12 200 292", bust: "18 4 164 180", head: "20 12 160 160" };

export function LadduArt({ mouth = "closed", eyes = "open", size = 120, crop = "full", facing = "front", label = "Laddu the teddy bear", className = "avatar" }: ArtProps) {
  const t = turn(facing);
  return (
    <svg width={size} height={heightFor(size, VIEW[crop])} viewBox={VIEW[crop]} role="img" aria-label={label} className={className}>
      {/* feet */}
      <g {...STROKE}>
        <ellipse cx="70" cy="252" rx="25" ry="17" fill={FUR} />
        <ellipse cx="130" cy="252" rx="25" ry="17" fill={FUR} />
      </g>
      <ellipse cx="70" cy="254" rx="13" ry="9" fill={SNOUT} />
      <ellipse cx="130" cy="254" rx="13" ry="9" fill={SNOUT} />
      {/* body + belly */}
      <ellipse cx="100" cy="192" rx="56" ry="60" fill={FUR} {...STROKE} />
      <ellipse cx="100" cy="202" rx="35" ry="38" fill={SNOUT} />
      {/* arms */}
      <g {...STROKE} fill={FUR}>
        <ellipse cx="47" cy="186" rx="16" ry="31" transform="rotate(24 47 186)" />
        <ellipse cx="153" cy="186" rx="16" ry="31" transform="rotate(-24 153 186)" />
      </g>
      <ellipse cx="37" cy="208" rx="8" ry="7" fill={SNOUT} />
      <ellipse cx="163" cy="208" rx="8" ry="7" fill={SNOUT} />
      <g transform={`rotate(${t.tilt} 100 150)`}>
      {/* ears */}
      <g {...STROKE} fill={FUR}>
        <circle cx="52" cy="50" r="22" />
        <circle cx="148" cy="50" r="22" />
      </g>
      <circle cx="53" cy="52" r="12" fill={FUR_DARK} />
      <circle cx="147" cy="52" r="12" fill={FUR_DARK} />
      {/* head + tuft */}
      <ellipse cx="100" cy="96" rx="64" ry="57" fill={FUR} {...STROKE} />
      <path d="M90 42 Q94 30 100 38 Q104 28 110 41" fill={FUR} {...STROKE} />
      <g transform={`translate(${t.face * 1.4} 0)`}>
      {/* blush + snout */}
      <ellipse cx="62" cy="118" rx="11" ry="6.5" fill={BLUSH} opacity="0.5" />
      <ellipse cx="138" cy="118" rx="11" ry="6.5" fill={BLUSH} opacity="0.5" />
      <ellipse cx="100" cy="120" rx="27" ry="21" fill={SNOUT} />
      {/* brows */}
      <path d="M69 79 Q77 74 85 78" fill="none" {...STROKE} stroke={FUR_DARK} strokeWidth={3.5} />
      <path d="M115 78 Q123 74 131 79" fill="none" {...STROKE} stroke={FUR_DARK} strokeWidth={3.5} />
      <LadduEyes eyes={eyes} look={t.look * 1.4} />
      <ellipse cx="100" cy="111" rx="10" ry="7" fill={NOSE} />
      <ellipse cx="97" cy="108.5" rx="3" ry="1.6" fill="#fff" opacity="0.5" />
      <LadduMouth mouth={mouth} />
      </g>
      </g>
    </svg>
  );
}

function LadduEyes({ eyes, look }: { eyes: string; look: number }) {
  if (eyes === "blink") {
    return <g fill="none" {...STROKE} strokeWidth={3.5}><path d="M70 96 Q78 101 86 96" /><path d="M114 96 Q122 101 130 96" /></g>;
  }
  if (eyes === "happy") {
    return <g fill="none" {...STROKE} strokeWidth={3.5}><path d="M70 99 Q78 89 86 99" /><path d="M114 99 Q122 89 130 99" /></g>;
  }
  const dx = look + (eyes === "up" ? 2 : 0), dy = eyes === "up" ? -3 : 0;
  return (
    <g>
      {[78, 122].map((x) => (
        <g key={x}>
          <circle cx={x} cy="95" r="9" fill="#6b3f1e" />
          <circle cx={x + dx} cy={95 + dy} r="6.5" fill="#1c120c" />
          <circle cx={x + 2.5 + dx} cy={92 + dy} r="2.6" fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function LadduMouth({ mouth }: { mouth: string }) {
  if (mouth === "closed") {
    return <path d="M100 118 V123 M89 121 Q94 128 100 123 Q106 128 111 121" fill="none" {...STROKE} />;
  }
  // Talking mouths are smiles (Nisha, 2026-11-11): a flat top, a round bottom,
  // and corners that curl up.
  const d = mouth === "wide"
    ? "M87 120 Q100 124 113 120 Q111 140 100 140 Q89 140 87 120 Z"
    : "M89 121 Q100 124 111 121 Q109 133 100 133 Q91 133 89 121 Z";
  const tongue = mouth === "wide" ? { cy: 134, rx: 7, ry: 4 } : { cy: 129, rx: 5.5, ry: 2.8 };
  return (
    <g>
      <path d="M100 118 V122" {...STROKE} />
      <path d={d} fill="#7a2c22" {...STROKE} />
      <ellipse cx="100" cy={tongue.cy} rx={tongue.rx} ry={tongue.ry} fill="#e8848a" />
      <path d="M85 117 Q86 121 89 121 M115 117 Q114 121 111 121" fill="none" {...STROKE} strokeWidth={2.4} />
    </g>
  );
}
