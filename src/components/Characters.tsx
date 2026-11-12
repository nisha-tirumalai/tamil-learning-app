"use client";
// The characters everywhere in the app (spec 003, drawings approved by Nisha
// 2026-11-12). The art itself is in ./characters/; these wrappers pick the
// right one. Small places (past chats, the welcome screen) use a crop; the
// conversation scene uses the full body with moving mouth and eyes.
import type { Avatar } from "@/lib/avatar";
import { useAvatar } from "./AvatarContext";
import { GirlArt } from "./characters/Girl";
import { GuyArt } from "./characters/Guy";
import { LadduArt } from "./characters/Laddu";
import type { ArtProps } from "./characters/style";

/** Laddu 🧸. Head crop unless told otherwise. */
export function Laddu({ size = 48, crop = "head", ...pose }: ArtProps) {
  return <LadduArt size={size} crop={crop} {...pose} />;
}

/** Me: the avatar I chose (girl or guy). */
export function Me({ size = 40, crop = "head", label = "You", ...pose }: ArtProps) {
  return <Character avatar={useAvatar()} size={size} crop={crop} label={label} {...pose} />;
}

/** A given avatar, e.g. on the "Choose your avatar" screen. */
export function Character({ avatar, crop = "head", label, ...rest }: ArtProps & { avatar: Avatar }) {
  return avatar === "guy"
    ? <GuyArt crop={crop} label={label ?? "Guy"} {...rest} />
    : <GirlArt crop={crop} label={label ?? "Girl"} {...rest} />;
}
