"use client";
// v1 characters: simple drawings made in code (no image service). Swap these
// for nicer art later; everything else only uses <Laddu />, <Me /> and <Character />.
import type { Avatar } from "@/lib/avatar";
import { useAvatar } from "./AvatarContext";

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

/** Me: the avatar I chose (girl or guy). */
export function Me({ size = 40 }: { size?: number }) {
  return <Character avatar={useAvatar()} size={size} label="You" />;
}

/** A given avatar, e.g. on the "Choose your avatar" screen. */
export function Character({ avatar, size = 40, label }: { avatar: Avatar; size?: number; label?: string }) {
  return avatar === "guy" ? <Guy size={size} label={label ?? "Guy"} /> : <Girl size={size} label={label ?? "Girl"} />;
}

function Girl({ size, label }: { size: number; label: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label} className="avatar">
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

/** Temporary v1 guy (short hair, yellow shirt); replaced by the approved drawing. */
function Guy({ size, label }: { size: number; label: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label} className="avatar">
      <path d="M18 100 Q20 80 50 78 Q80 80 82 100 Z" fill="#f2c230" />
      <rect x="43" y="72" width="14" height="10" fill="#9a6440" />
      <circle cx="50" cy="50" r="27" fill="#9a6440" />
      <path d="M22 48 Q20 20 50 20 Q80 20 78 48 Q72 32 50 33 Q30 32 22 48 Z" fill="#1d1410" />
      <circle cx="40" cy="52" r="3.4" fill="#1d1410" />
      <circle cx="60" cy="52" r="3.4" fill="#1d1410" />
      <circle cx="41" cy="51" r="1" fill="#fff" />
      <circle cx="61" cy="51" r="1" fill="#fff" />
      <path d="M43 62 Q50 68 57 62" stroke="#4a2414" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
