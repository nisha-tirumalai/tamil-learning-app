// Voice settings in one place (spec 003). Nisha can edit these freely.
//
// Hearing and voice are each ONE setting: change "elevenlabs" to "azure" and
// restart the app, no code changes. ElevenLabs' free plan has 10,000 credits a
// month, shared by hearing and voice. If they run low, switch `hearing` to
// "azure" first (Azure's free tier) and keep ElevenLabs for Laddu's voice.

export type HearingId = "elevenlabs" | "azure";
export type VoiceId = "elevenlabs" | "azure";

export const VOICE_CONFIG = {
  /** Who listens to me (speech → text). Bake-off winner: ElevenLabs Scribe. */
  hearing: "elevenlabs" as HearingId,
  /** If the main hearing service fails (e.g. out of credits), try this one once. null = no fallback. */
  hearingFallback: "azure" as HearingId | null,
  /** Who speaks as Laddu (text → speech). Bake-off winner: ElevenLabs "Charlie". */
  voice: "elevenlabs" as VoiceId,

  elevenlabs: {
    hearingModel: "scribe_v2",
    /** "Charlie - Deep, Confident, Energetic", one of ElevenLabs' own voices (free plan). */
    voiceId: "IKne3meq5aSn9XLyUdCD",
    voiceName: "Charlie",
    voiceModel: "eleven_multilingual_v2",
  },
  azure: {
    hearingApiVersion: "2024-11-15",
    /** The best Azure voice in the bake-off, kept as a backup. */
    voice: "ta-IN-Valluvar:DragonLatestNeural",
  },

  /** Give up on a hearing or voice call after this long. */
  timeoutMs: 15_000,

  /** Limits on a recording, checked before any paid call (spec 003). */
  recording: {
    minMs: 600,            // shorter = a tap, not speech
    maxMs: 30_500,         // the phone stops recording at 30 s; a little slack for timing
    minBytes: 1_500,
    maxBytes: 4_000_000,
    /** Loudest moment, 0–1, measured on the phone. Below this it's silence. */
    minPeak: 0.02,
  },

  /** 🐢 Slow plays Laddu's voice at this speed (no new call, no cost). */
  slowRate: 0.75,

  /**
   * Rough list prices in US dollars, for the call log's cost estimate only.
   * On the free plans the real cost is $0 until the free allowance runs out.
   * Check the price pages now and then and update these.
   */
  prices: {
    elevenlabs: { hearingPerHour: 0.40, voicePer1kChars: 0.22 },
    azure: { hearingPerHour: 1.00, voicePer1kChars: 0.015 },
  },
};

/** What Laddu says when hearing fails (spec 003). */
export const HEARING_ERROR_TEXT = "Aiyo, I couldn't hear that 😅 Try again or type it.";
export const TOO_LONG_TEXT = "That was a long one! Keep it under 30 seconds 😅 Try again or type it.";
export const TOO_SHORT_TEXT = "Hold the 🎤 button down while you talk, then let go.";
