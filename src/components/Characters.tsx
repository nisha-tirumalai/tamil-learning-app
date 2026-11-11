// v1 characters: simple drawings made in code (no image service). Swap these
// for nicer art later; everything else only uses <Laddu /> and <Me />.

/** Laddu 🧸, a cute teddy bear. */
export function Laddu({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Laddu the teddy bear" className="avatar">
      <circle cx="22" cy="24" r="15" fill="#b9773f" />
      <circle cx="78" cy="24" r="15" fill="#b9773f" />
      <circle cx="22" cy="24" r="8" fill="#e8b98a" />
      <circle cx="78" cy="24" r="8" fill="#e8b98a" />
      <circle cx="50" cy="54" r="38" fill="#c98a4b" />
      <ellipse cx="50" cy="68" rx="20" ry="15" fill="#f1d2ad" />
      <circle cx="36" cy="48" r="5" fill="#2b1a10" />
      <circle cx="64" cy="48" r="5" fill="#2b1a10" />
      <circle cx="37.5" cy="46.5" r="1.6" fill="#fff" />
      <circle cx="65.5" cy="46.5" r="1.6" fill="#fff" />
      <ellipse cx="50" cy="61" rx="6" ry="4.5" fill="#2b1a10" />
      <path d="M43 70 Q50 77 57 70" stroke="#2b1a10" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="27" cy="62" r="5" fill="#f08a8a" opacity="0.55" />
      <circle cx="73" cy="62" r="5" fill="#f08a8a" opacity="0.55" />
    </svg>
  );
}

/** Me: one fixed cartoon girl. */
export function Me({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="You" className="avatar">
      <circle cx="50" cy="20" r="13" fill="#1d1410" />
      <path d="M14 58 Q12 18 50 16 Q88 18 86 58 L86 84 Q76 90 70 80 L30 80 Q24 90 14 84 Z" fill="#1d1410" />
      <circle cx="50" cy="54" r="28" fill="#a8704a" />
      <path d="M22 50 Q30 26 50 28 Q72 26 78 50 Q62 36 50 40 Q36 34 22 50 Z" fill="#1d1410" />
      <circle cx="50" cy="42" r="2.2" fill="#c0262d" />
      <circle cx="40" cy="56" r="3.6" fill="#1d1410" />
      <circle cx="60" cy="56" r="3.6" fill="#1d1410" />
      <circle cx="41" cy="55" r="1.1" fill="#fff" />
      <circle cx="61" cy="55" r="1.1" fill="#fff" />
      <path d="M42 66 Q50 73 58 66" stroke="#5a2a1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="64" r="4" fill="#e07a6a" opacity="0.45" />
      <circle cx="67" cy="64" r="4" fill="#e07a6a" opacity="0.45" />
    </svg>
  );
}
