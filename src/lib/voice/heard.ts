// From a recording to the Tanglish bubble (spec 003):
//  1. checkRecording(): too short, silent, too long or too big → rejected
//     before any paid call, and it doesn't count against the daily cap.
//  2. toTanglish(): what the hearing service wrote (usually Tamil script) →
//     Tanglish, word for word, mistakes kept. If that fails, a plain letter-by-
//     letter conversion is used, so Tamil script never reaches the screen.
import type { ChatModel } from "@/lib/chat/model";
import { loadPrompt } from "@/lib/chat/model";
import { CHAT_CONFIG } from "@/lib/chat/config";
import { hasTamilScript } from "@/lib/chat/tamil";
import { VOICE_CONFIG } from "./config";
import { transliterate } from "./letters";

export type RecordingProblem = "too_short" | "too_long" | "silent" | "missing";

export function checkRecording(r: { bytes: number; ms: number; peak: number }): RecordingProblem | null {
  const limits = VOICE_CONFIG.recording;
  if (!r.bytes || !Number.isFinite(r.ms)) return "missing";
  if (r.ms > limits.maxMs || r.bytes > limits.maxBytes) return "too_long";
  if (r.ms < limits.minMs || r.bytes < limits.minBytes) return "too_short";
  if (!(r.peak >= limits.minPeak)) return "silent";
  return null;
}

/** Tidies a Tanglish line: one line, single spaces, capital first letter, no quotes. */
function tidy(text: string): string {
  const one = text.split("\n").map((l) => l.trim()).filter(Boolean).join(" ")
    .replace(/^["“'`]+|["”'`]+$/g, "").replace(/\s+/g, " ").trim();
  return one ? one[0].toUpperCase() + one.slice(1) : "";
}

export async function toTanglish(model: ChatModel, heard: string): Promise<string> {
  const text = heard.trim();
  if (!text) return "";
  if (!hasTamilScript(text)) return tidy(text);
  try {
    const out = tidy(await model.tanglish({ system: loadPrompt(CHAT_CONFIG.prompts.tanglish, {}), text }));
    if (out && !hasTamilScript(out)) return out;
    console.warn("Tanglish rewrite unusable; using plain letters");
  } catch (e) {
    console.warn("Tanglish rewrite failed; using plain letters:", (e as Error).message);
  }
  return tidy(transliterate(text).replace(/[஀-௿]/g, ""));
}
