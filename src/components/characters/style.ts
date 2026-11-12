// Shared look for all three characters (spec 003): flat colours, one dark
// outline, the same blush. Each character can swap mouth and eyes, so the code
// can animate them (talking, blinking) without videos.

export const INK = "#2b1d16";
export const STROKE = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
export const BLUSH = "#f39a86";

export type Mouth = "closed" | "open" | "wide";
export type Eyes = "open" | "blink" | "happy" | "up";
export type Pose = { mouth?: Mouth; eyes?: Eyes };

/** "full" = the whole body (the scene); "bust" = head and shoulders (the picker); "head" = a close crop (small lists). */
export type Crop = "full" | "bust" | "head";

/** Which way the character turns: in the scene Laddu (left) faces right, I (right) face left. */
export type Facing = "front" | "left" | "right";

export type ArtProps = Pose & { size?: number; crop?: Crop; facing?: Facing; label?: string; className?: string };

/** How far the face features shift, the pupils look, and the head tilts, for each facing. */
export function turn(facing: Facing = "front") {
  const s = facing === "left" ? -1 : facing === "right" ? 1 : 0;
  return { face: 3 * s, look: 1.6 * s, tilt: 4 * s };
}

/** width/height of an SVG for a viewBox string, so every crop keeps its shape. */
export function heightFor(size: number, viewBox: string): number {
  const [, , w, h] = viewBox.split(" ").map(Number);
  return (size * h) / w;
}
