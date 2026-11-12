// Hearing (speech → text) and Laddu's voice (text → speech), spec 003.
// Each service sits behind a tiny interface so tests can use fakes (no key, no
// cost), and every real call is written to the call log. Server-only: keys
// never reach the browser, and recordings go phone → our server → service.
import { type CallLog, errorText, noLog, stopwatch } from "@/lib/calls";
import { type HearingId, VOICE_CONFIG, type VoiceId } from "./config";

export interface Recording {
  audio: Blob;
  /** Length as measured on the phone, in milliseconds. */
  ms: number;
}

export interface HearingService {
  id: HearingId;
  model: string;
  /** What was said, as the service wrote it (often Tamil script). */
  hear(rec: Recording): Promise<string>;
}

export interface VoiceService {
  id: VoiceId;
  model: string;
  /** MP3 audio of the text. */
  speak(text: string): Promise<ArrayBuffer>;
}

export class ServiceNotConfigured extends Error {}

function key(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new ServiceNotConfigured(`Missing the ${name} Codespaces secret.`);
  return v;
}

async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    const e = new Error(`${what}: ${(await res.text().catch(() => "")).slice(0, 200)}`) as Error & { status: number };
    e.status = res.status;
    throw e;
  }
  return res;
}

const timeout = () => AbortSignal.timeout(VOICE_CONFIG.timeoutMs);

function extensionFor(type: string): string {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("mpeg")) return "mp3";
  return "webm";
}

// ─── ElevenLabs ────────────────────────────────────────────────────────────

export function elevenlabsHearing(): HearingService {
  const model = VOICE_CONFIG.elevenlabs.hearingModel;
  return {
    id: "elevenlabs", model,
    async hear({ audio }) {
      const form = new FormData();
      form.append("model_id", model);
      form.append("language_code", "ta");
      form.append("tag_audio_events", "false");
      form.append("file", audio, `recording.${extensionFor(audio.type)}`);
      const res = await ok(await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST", headers: { "xi-api-key": key("ELEVEN_LABS_API_KEY") }, body: form, signal: timeout(),
      }), "ElevenLabs hearing");
      return (((await res.json()) as { text?: string }).text ?? "").trim();
    },
  };
}

export function elevenlabsVoice(): VoiceService {
  const { voiceId, voiceName, voiceModel, voiceLanguage } = VOICE_CONFIG.elevenlabs;
  return {
    id: "elevenlabs", model: `${voiceName} · ${voiceModel}`,
    async speak(text) {
      const res = await ok(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
        method: "POST",
        headers: { "xi-api-key": key("ELEVEN_LABS_API_KEY"), "content-type": "application/json" },
        body: JSON.stringify({ text, model_id: voiceModel, language_code: voiceLanguage }),
        signal: timeout(),
      }), "ElevenLabs voice");
      return res.arrayBuffer();
    },
  };
}

// ─── Azure (backup) ────────────────────────────────────────────────────────

export function azureHearing(): HearingService {
  const version = VOICE_CONFIG.azure.hearingApiVersion;
  return {
    id: "azure", model: `fast transcription ${version}`,
    async hear({ audio }) {
      const form = new FormData();
      form.append("audio", audio, `recording.${extensionFor(audio.type)}`);
      form.append("definition", JSON.stringify({ locales: ["ta-IN"] }));
      const url = `https://${key("AZURE_SPEECH_REGION")}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=${version}`;
      const res = await ok(await fetch(url, {
        method: "POST", headers: { "Ocp-Apim-Subscription-Key": key("AZURE_SPEECH_KEY") }, body: form, signal: timeout(),
      }), "Azure hearing");
      const data = await res.json() as { combinedPhrases?: { text: string }[] };
      return (data.combinedPhrases ?? []).map((p) => p.text).join(" ").trim();
    },
  };
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function azureVoice(): VoiceService {
  const voice = VOICE_CONFIG.azure.voice;
  return {
    id: "azure", model: voice,
    async speak(text) {
      const region = key("AZURE_SPEECH_REGION");
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ta-IN"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
      const res = await ok(await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key("AZURE_SPEECH_KEY"), "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "laddu-app",
        },
        body: ssml,
        signal: timeout(),
      }), "Azure voice");
      return res.arrayBuffer();
    },
  };
}

// ─── Picking from the config, with logging ─────────────────────────────────

const HEARING: Record<HearingId, () => HearingService> = { elevenlabs: elevenlabsHearing, azure: azureHearing };
const VOICES: Record<VoiceId, () => VoiceService> = { elevenlabs: elevenlabsVoice, azure: azureVoice };

/** The hearing services to try, in order: the configured one, then the fallback. */
export function configuredHearing(): HearingService[] {
  const ids = [VOICE_CONFIG.hearing, VOICE_CONFIG.hearingFallback].filter((id, i, all): id is HearingId => !!id && all.indexOf(id) === i);
  return ids.map((id) => HEARING[id]());
}

export function configuredVoice(): VoiceService {
  return VOICES[VOICE_CONFIG.voice]();
}

/**
 * Hears a recording: the first service, then (if it fails) the fallback.
 * Each attempt is logged. Throws if every service fails.
 */
export async function hear(services: HearingService[], rec: Recording, log: CallLog = noLog): Promise<{ text: string; service: HearingId }> {
  let last: unknown = new Error("No hearing service configured");
  for (const s of services) {
    const watch = stopwatch();
    const seconds = rec.ms / 1000;
    const cost = (VOICE_CONFIG.prices[s.id].hearingPerHour * seconds) / 3600;
    try {
      const text = await s.hear(rec);
      log.add({ service: s.id, job: "hearing", model: s.model, ms_total: watch.elapsed(), audio_seconds: seconds, cost_usd: cost, ok: true });
      return { text, service: s.id };
    } catch (e) {
      last = e;
      // A missing key for the fallback isn't worth a log row: it simply isn't set up.
      if (!(e instanceof ServiceNotConfigured) || s === services[0]) {
        log.add({ service: s.id, job: "hearing", model: s.model, ms_total: watch.elapsed(), audio_seconds: seconds, cost_usd: null, ok: false, error: errorText(e) });
      }
      console.warn(`hearing (${s.id}) failed:`, errorText(e));
    }
  }
  throw last;
}

/** Laddu's voice for one line, logged. */
export async function speak(service: VoiceService, text: string, log: CallLog = noLog): Promise<ArrayBuffer> {
  const watch = stopwatch();
  const characters = [...text].length;
  try {
    const audio = await service.speak(text);
    log.add({
      service: service.id, job: "voice", model: service.model, ms_total: watch.elapsed(), characters,
      cost_usd: (VOICE_CONFIG.prices[service.id].voicePer1kChars * characters) / 1000, ok: true,
    });
    return audio;
  } catch (e) {
    log.add({ service: service.id, job: "voice", model: service.model, ms_total: watch.elapsed(), characters, ok: false, error: errorText(e) });
    throw e;
  }
}

// ─── Fakes for tests ───────────────────────────────────────────────────────

export class FakeHearing implements HearingService {
  calls: Recording[] = [];
  constructor(public answers: (string | Error)[] = [], public id: HearingId = "elevenlabs", public model = "fake-hearing") {}
  async hear(rec: Recording) {
    this.calls.push(rec);
    const next = this.answers.shift();
    if (next === undefined) throw new Error("FakeHearing: no answer queued");
    if (next instanceof Error) throw next;
    return next;
  }
}

export class FakeVoice implements VoiceService {
  calls: string[] = [];
  constructor(public fail = false, public id: VoiceId = "elevenlabs", public model = "fake-voice") {}
  async speak(text: string) {
    this.calls.push(text);
    if (this.fail) throw new Error("FakeVoice: broken");
    return new TextEncoder().encode(`mp3:${text}`).buffer as ArrayBuffer;
  }
}
