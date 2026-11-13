// Chat settings in one place (spec 001): model, daily cap, prompt versions,
// praise lines and Laddu's situations. Nisha can edit these freely.

export const CHAT_CONFIG = {
  /** Claude Haiku (latest): fast and cheap. Phase 4 compares models. */
  model: "claude-haiku-5-5",
  /** How hard the model thinks. "low" keeps the card under ~3 s. */
  scorerEffort: "low",
  tutorEffort: "low",
  /** Messages per person per day before "See you tomorrow". */
  dailyCap: 60,
  /** Give up on a model call after this long and show the friendly error. */
  timeoutMs: 15_000,
  prompts: {
    /** v3: like v2 (spelling and short forms never mistakes, keeps time words, lists mistakes then scores), plus: a meaning Nisha types herself wins over her words. v1 and v2 kept for comparison. */
    corrector: "corrector_scorer_v3",
    /** v4 (spec 003, after the phone test): like v3, but the hidden Tamil-script line comes FIRST, so his voice can start sooner. v1–v3 kept. */
    tutor: "tutor_system_v4",
    /** Spec 003: turns what the hearing service wrote (often Tamil script) into Tanglish, word for word. */
    tanglish: "hearing_to_tanglish_v1",
    /** Spec 003: Tamil script for a Tanglish line, only when Laddu forgot to write it (so the voice never reads Tanglish). */
    tamilScript: "tanglish_to_tamil_v1",
  },
  /** Rough list prices in US dollars per million tokens, for the call log's cost estimate (spec 003). */
  pricePerMillion: { input: 0.10, output: 0.50 },
} as const;

/** The only mistake types the scorer may use (SCOPING §1a). */
export const MISTAKE_TYPES = [
  "verb tense",
  "verb ending",
  "missing case ending",
  "word order",
  "wrong word",
  "missing word",
  "too formal",
  "too literal",
] as const;
export type MistakeType = (typeof MISTAKE_TYPES)[number];

/** Shown instead of a correction when a message scores 10/10. Never the same twice in a row. */
export const PRAISE_LINES: { tanglish: string; english: string }[] = [
  { tanglish: "Semma, Nisha! 🔥", english: "Awesome, Nisha!" },
  { tanglish: "Super-aa sonna! 🌟", english: "You said that perfectly!" },
  { tanglish: "Arumai! 🎉", english: "Excellent!" },
  { tanglish: "Pakka Tamil ponnu! 😎", english: "A proper Tamil girl!" },
  { tanglish: "Ayyo, sooper! 🤩", english: "Oh wow, super!" },
  { tanglish: "Kalakkita, Nisha! 💃", english: "You nailed it, Nisha!" },
  { tanglish: "Romba correct-aa irukku! ✅", english: "That's totally right!" },
  { tanglish: "Thool! 💥", english: "Brilliant!" },
  { tanglish: "Amma kettaa proud aayiduvaanga! 🥹", english: "Amma would be proud if she heard that!" },
  { tanglish: "Native speaker maadhiriye pesura! 🗣️", english: "You talk just like a native speaker!" },
  { tanglish: "Ennaala kooda ivlo nalla solla mudiyaadhu! 🧸", english: "Even I couldn't say it that well!" },
  { tanglish: "Perfect-aa irukku! 💯", english: "It's perfect!" },
  { tanglish: "Vera level! 🚀", english: "Next level!" },
  { tanglish: "Mass-aa sonna! 🕶️", english: "You said that like a boss!" },
  { tanglish: "Sema smooth! 🍯", english: "So smooth!" },
  { tanglish: "Oru mistake kooda illa! 🙌", english: "Not a single mistake!" },
  { tanglish: "Nee dhaan champion! 🏆", english: "You're the champion!" },
  { tanglish: "Chumma pinnura, Nisha! ✨", english: "You're just killing it, Nisha!" },
  { tanglish: "Idhu dhaan correct way! 👌", english: "That's exactly the right way!" },
  { tanglish: "Laddu romba happy! 🧸💛", english: "Laddu is very happy!" },
];

/**
 * Laddu starts: one of these, picked at random (never the same as last time).
 * `role` is who Laddu plays; `polite` means Nisha should use neenga with them.
 */
export const SITUATIONS: { key: string; title: string; role: string; polite: boolean }[] = [
  { key: "tea-shop", title: "At the tea shop", role: "the tea-shop owner (chai and coffee)", polite: true },
  { key: "auto-ride", title: "Auto ride", role: "the auto driver", polite: true },
  { key: "my-day", title: "Telling a friend about my day", role: "Nisha's close friend asking about her day", polite: false },
  { key: "grocery", title: "At the grocery shop", role: "the grocery shop owner", polite: true },
  { key: "restaurant", title: "Ordering food", role: "the waiter at a restaurant", polite: true },
  { key: "directions", title: "Asking for directions", role: "a passer-by on the street", polite: true },
  { key: "weekend", title: "Weekend plans", role: "Nisha's close friend making weekend plans", polite: false },
  { key: "doctor", title: "At the doctor's", role: "the doctor", polite: true },
  { key: "relative-call", title: "Phone call with a relative", role: "Nisha's aunt (chithi) calling on the phone", polite: true },
  { key: "clothes", title: "Shopping for clothes", role: "the shop assistant at a clothes shop", polite: true },
];

/**
 * Laddu introduces himself on the welcome screen, before "Choose your avatar"
 * (spec 003). The Tamil-script version for his voice is in
 * src/lib/voice/intro.ts (server only, never sent to the screen).
 */
export const INTRO = { tanglish: "Vanakkam! Naan Laddu. Tamil-la pesalaam!", english: "Hi, I'm Laddu. Let's talk in Tamil!" };
/** What the phone asks for to hear the intro: /api/speech/intro */
export const INTRO_VOICE_REF = "intro";
/** The 💡 hint near my bubble appears when my score is below this (spec 003). */
export const HINT_BELOW = 7;

export const WELCOME = { tanglish: (name: string) => `Vaanga, ${name}!`, english: (name: string) => `Come on in, ${name}!` };

export const ERROR_TEXT = "Aiyo! Something broke on my side 😅 Your message is safe, tap to try again.";
/** The small chip under each of my messages (spec 002). */
export const CHIP_TEXT = {
  allEnglish: "Try it in Tanglish",
  failed: "Score didn't load · tap to retry",
};
/** Shown when a chat was left with Laddu not having answered yet. */
export const NUDGE_TEXT = "🧸 Tap here and Laddu will answer.";
export const CAP_TEXT = "See you tomorrow! 🧸 You've practised a lot today.";
