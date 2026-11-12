"use client";
// Phones only let a page make sound after a tap (spec 003). The first tap
// anywhere in the app (e.g. "Laddu starts" on the home screen) unlocks
// Laddu's voice, so his opening line can play on its own in the chat.
import { useEffect } from "react";
import { voicePlayer } from "@/lib/voice/player";

// iPhones count the END of a tap (not the start) as permission for sound.
const EVENTS = ["touchend", "pointerup", "click", "keydown"] as const;

export function AudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      const player = voicePlayer();
      player.unlock();
      if (player.unlocked) remove();
    };
    const remove = () => EVENTS.forEach((e) => window.removeEventListener(e, unlock, true));
    EVENTS.forEach((e) => window.addEventListener(e, unlock, true));
    return remove;
  }, []);
  return null;
}
