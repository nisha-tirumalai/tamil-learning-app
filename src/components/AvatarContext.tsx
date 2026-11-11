"use client";
// Lets any bubble draw *your* avatar without passing it through every screen.
// The root layout reads it from your profile and provides it here.
import { createContext, useContext } from "react";
import type { Avatar } from "@/lib/avatar";

const AvatarContext = createContext<Avatar>("girl");

export function AvatarProvider({ avatar, children }: { avatar: Avatar; children: React.ReactNode }) {
  return <AvatarContext.Provider value={avatar}>{children}</AvatarContext.Provider>;
}

export function useAvatar(): Avatar {
  return useContext(AvatarContext);
}
