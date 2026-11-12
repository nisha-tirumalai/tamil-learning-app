// The face the girl and the guy share (Nisha, 2026-11-11): oval eyes with the
// white showing, the guy's nose and mouth, the same eyebrows. Drawn in the
// head's own coordinates (before the head is scaled up).
import { type Eyes, INK, type Mouth, STROKE } from "./style";

export const SKIN = "#f2c49a";   // the guy's skin, now used for both

export function Face({ eyes, mouth, look = 0 }: { eyes: Eyes; mouth: Mouth; look?: number }) {
  return (
    <g>
      <path d="M78 62 Q85 58 92 61 M108 61 Q115 58 122 62" fill="none" {...STROKE} strokeWidth={3.6} />
      <FaceEyes eyes={eyes} look={look} />
      <path d="M101 79 Q96 82 100 86" fill="none" {...STROKE} strokeWidth={2.2} />
      <FaceMouth mouth={mouth} />
    </g>
  );
}

function FaceEyes({ eyes, look }: { eyes: Eyes; look: number }) {
  if (eyes === "blink") return <g fill="none" {...STROKE} strokeWidth={2.6}><path d="M79.5 73 Q85 77 90.5 73" /><path d="M109.5 73 Q115 77 120.5 73" /></g>;
  if (eyes === "happy") return <g fill="none" {...STROKE} strokeWidth={2.6}><path d="M79.5 75 Q85 68 90.5 75" /><path d="M109.5 75 Q115 68 120.5 75" /></g>;
  const dx = look + (eyes === "up" ? 1 : 0), dy = eyes === "up" ? -2.5 : 0;
  return (
    <g>
      {[85, 115].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="73" rx="5.6" ry="7.6" fill="#fff" {...STROKE} strokeWidth={2.2} />
          <ellipse cx={x + dx} cy={74.2 + dy} rx="3.5" ry="4.7" fill={INK} />
          <circle cx={x + 1.2 + dx} cy={72.2 + dy} r="1.3" fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function FaceMouth({ mouth }: { mouth: Mouth }) {
  if (mouth === "closed") return <path d="M92 93 Q100 98 108 93" fill="none" {...STROKE} strokeWidth={2.4} />;
  // Talking: a smile with the mouth open (flat top, round bottom), like Laddu's.
  const d = mouth === "wide" ? "M91 92 Q100 95 109 92 Q107 104 100 104 Q93 104 91 92 Z" : "M92 92.5 Q100 95 108 92.5 Q106 100.5 100 100.5 Q94 100.5 92 92.5 Z";
  return <path d={d} fill="#7a2c22" {...STROKE} strokeWidth={2.2} />;
}
