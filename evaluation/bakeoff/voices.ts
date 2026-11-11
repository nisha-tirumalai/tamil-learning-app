// Voice test (spec 003, step 1): the same 5 Laddu lines in several Tamil voices
// per service, so Nisha (and amma) can pick the one that sounds most like a
// friendly little boy.
//
//   npm run bakeoff:voices                       every service that has its keys
//   npm run bakeoff:voices -- --only elevenlabs  just one
//
// Writes one MP3 per voice (all 5 lines) to private/bakeoff/voices/, plus
// index.html to listen. ~5,000 characters per service: inside the free tiers.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureDir, env, googleAccessToken, hasFfmpeg, ok, OUT, readyServices, RESULTS, SERVICES, type ServiceId, today,
} from "./common.ts";
import { LADDU_LINES } from "./lines.ts";

type Voice = { service: ServiceId; label: string; note: string; say: (text: string) => Promise<Buffer> };
type Sample = { service: ServiceId; label: string; note: string; file: string; msPerLine: number[]; error?: string };

// ─── ElevenLabs ────────────────────────────────────────────────────────────

const XI = () => ({ "xi-api-key": env("ELEVEN_LABS_API_KEY") });
type SharedVoice = { voice_id: string; public_owner_id: string; name: string; gender?: string; age?: string; accent?: string; preview_url?: string; description?: string };
let elevenShared: SharedVoice[] = [];

async function elevenVoices(): Promise<Voice[]> {
  const models = env("ELEVENLABS_TTS_MODELS", "eleven_multilingual_v2,eleven_flash_v2_5").split(",");
  const picks: { id: string; label: string; note: string }[] = [];

  const chosen = process.env.ELEVENLABS_VOICE_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  if (chosen?.length) for (const id of chosen) picks.push({ id, label: id, note: "chosen by Nisha" });
  else {
    // Tamil voices from the ElevenLabs voice library: young male first.
    const res = await ok(await fetch("https://api.elevenlabs.io/v1/shared-voices?language=ta&page_size=50", { headers: XI() }), "ElevenLabs voice library");
    elevenShared = ((await res.json()) as { voices: SharedVoice[] }).voices ?? [];
    const rank = (v: SharedVoice) => (v.age === "young" ? 0 : 2) + (v.gender === "male" ? 0 : 1);
    for (const v of [...elevenShared].sort((a, b) => rank(a) - rank(b)).slice(0, 3)) {
      // A library voice has to be added to "My voices" before the API can use it.
      try {
        const add = await ok(await fetch(`https://api.elevenlabs.io/v1/voices/add/${v.public_owner_id}/${v.voice_id}`, {
          method: "POST", headers: { ...XI(), "content-type": "application/json" }, body: JSON.stringify({ new_name: `Laddu test: ${v.name}`.slice(0, 50) }),
        }), "add voice");
        const { voice_id } = await add.json() as { voice_id: string };
        picks.push({ id: voice_id, label: v.name, note: [v.gender, v.age, v.accent].filter(Boolean).join(", ") });
      } catch (e) { console.warn(`  couldn't add library voice ${v.name}: ${(e as Error).message}`); }
    }
    // Plus one young male voice from ElevenLabs' own set.
    const mine = await ok(await fetch("https://api.elevenlabs.io/v1/voices", { headers: XI() }), "ElevenLabs voices");
    const own = ((await mine.json()) as { voices: { voice_id: string; name: string; category?: string; labels?: Record<string, string> }[] }).voices;
    const young = own.find((v) => v.category === "premade" && v.labels?.age === "young" && v.labels?.gender === "male");
    if (young) picks.push({ id: young.voice_id, label: young.name, note: "ElevenLabs default voice, young male" });
  }

  return picks.flatMap((p) => models.map((model) => ({
    service: "elevenlabs" as const, label: `${p.label} · ${model}`, note: p.note,
    say: async (text: string) => {
      const res = await ok(await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${p.id}?output_format=mp3_44100_128`, {
        method: "POST", headers: { ...XI(), "content-type": "application/json" }, body: JSON.stringify({ text, model_id: model }),
      }), "ElevenLabs voice");
      return Buffer.from(await res.arrayBuffer());
    },
  })));
}

// ─── Azure ─────────────────────────────────────────────────────────────────

async function azureVoices(): Promise<Voice[]> {
  const region = env("AZURE_SPEECH_REGION"), key = env("AZURE_SPEECH_KEY");
  const res = await ok(await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
    headers: { "Ocp-Apim-Subscription-Key": key },
  }), "Azure voice list");
  const tamil = ((await res.json()) as { ShortName: string; Locale: string; Gender: string; LocalName?: string }[])
    .filter((v) => v.Locale.startsWith("ta-"));
  const voices: Voice[] = [];
  for (const v of tamil) {
    // Male voices get a second, higher-pitched take: closer to a little boy.
    const pitches = v.Gender === "Male" ? ["+0%", "+15%"] : ["+0%"];
    for (const pitch of pitches) voices.push({
      service: "azure", label: `${v.ShortName}${pitch === "+0%" ? "" : ` (pitch ${pitch})`}`, note: `${v.Gender}, ${v.Locale}`,
      say: async (text) => {
        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.Locale}"><voice name="${v.ShortName}"><prosody pitch="${pitch}">${text}</prosody></voice></speak>`;
        const r = await ok(await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3", "User-Agent": "laddu-bakeoff" },
          body: ssml,
        }), "Azure voice");
        return Buffer.from(await r.arrayBuffer());
      },
    });
  }
  return voices;
}

// ─── Google ────────────────────────────────────────────────────────────────

async function googleVoices(): Promise<Voice[]> {
  const auth = async () => ({ authorization: `Bearer ${await googleAccessToken()}`, "content-type": "application/json" });
  const res = await ok(await fetch("https://texttospeech.googleapis.com/v1/voices?languageCode=ta-IN", { headers: await auth() }), "Google voice list");
  const all = ((await res.json()) as { voices: { name: string; ssmlGender: string }[] }).voices ?? [];
  const male = (v: { ssmlGender: string }) => v.ssmlGender === "MALE";
  const chirp = all.filter((v) => v.name.includes("Chirp3-HD"));
  const picks = [
    ...chirp.filter(male).slice(0, 3).map((v) => ({ v, pitch: 0 })),
    ...chirp.filter((v) => !male(v)).slice(0, 1).map((v) => ({ v, pitch: 0 })),
    // Older voices can change pitch: one male Wavenet, raised, for a younger sound.
    ...all.filter((v) => v.name.includes("Wavenet") && male(v)).slice(0, 1).flatMap((v) => [{ v, pitch: 0 }, { v, pitch: 4 }]),
  ];
  return picks.map(({ v, pitch }) => ({
    service: "google" as const, label: `${v.name}${pitch ? ` (pitch +${pitch})` : ""}`, note: v.ssmlGender.toLowerCase(),
    say: async (text: string) => {
      const r = await ok(await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
        method: "POST", headers: await auth(),
        body: JSON.stringify({ input: { text }, voice: { languageCode: "ta-IN", name: v.name }, audioConfig: { audioEncoding: "MP3", ...(pitch ? { pitch } : {}) } }),
      }), "Google voice");
      return Buffer.from(((await r.json()) as { audioContent: string }).audioContent, "base64");
    },
  }));
}

const VOICES: Record<ServiceId, () => Promise<Voice[]>> = { elevenlabs: elevenVoices, azure: azureVoices, google: googleVoices };

// ─── Running it ────────────────────────────────────────────────────────────

const DIR = join(OUT, "voices");
const RAW = join(DIR, "voices.json");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const services = readyServices();
  if (!hasFfmpeg()) throw new Error("ffmpeg is missing. Run: sudo apt-get install -y ffmpeg");
  if (services.length === 0) { console.log("No service has its keys yet. Run `npm run bakeoff:check` to see what's missing."); return; }
  ensureDir(DIR);
  let samples: Sample[] = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : [];

  for (const id of services) {
    console.log(`\n${SERVICES[id].name}`);
    samples = samples.filter((s) => s.service !== id);   // a re-run replaces this service's samples
    let voices: Voice[];
    try { voices = await VOICES[id](); } catch (e) { console.log(`  ✗ ${(e as Error).message}`); continue; }
    if (voices.length === 0) console.log("  No Tamil voices found.");
    for (const voice of voices) {
      const parts: string[] = [], msPerLine: number[] = [];
      const name = `${id}__${slug(voice.label)}`;
      try {
        for (const [i, line] of LADDU_LINES.entries()) {
          const start = Date.now();
          const audio = await voice.say(line.tamil);
          msPerLine.push(Date.now() - start);
          const part = join(ensureDir(join(DIR, "parts")), `${name}-${i + 1}.mp3`);
          writeFileSync(part, audio);
          parts.push(part);
        }
        // Join the 5 lines into one file, with a short pause between them.
        const inputs = parts.flatMap((p) => ["-i", p]);
        const filter = parts.map((_, i) => `[${i}:a]aresample=44100,apad=pad_dur=0.8[a${i}]`).join(";") + ";" + parts.map((_, i) => `[a${i}]`).join("") + `concat=n=${parts.length}:v=0:a=1[out]`;
        execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...inputs, "-filter_complex", filter, "-map", "[out]", join(DIR, `${name}.mp3`)]);
        samples.push({ service: id, label: voice.label, note: voice.note, file: `${name}.mp3`, msPerLine });
        console.log(`  ✓ ${voice.label} (${Math.round(msPerLine.reduce((a, b) => a + b, 0) / msPerLine.length)} ms a line)`);
      } catch (e) {
        samples.push({ service: id, label: voice.label, note: voice.note, file: "", msPerLine, error: (e as Error).message });
        console.log(`  ✗ ${voice.label}: ${(e as Error).message}`);
      }
    }
  }
  writeFileSync(RAW, JSON.stringify(samples, null, 2));
  writeFileSync(join(DIR, "index.html"), listeningPage(samples));
  ensureDir(RESULTS);
  writeFileSync(join(RESULTS, "bakeoff-voices.md"), summary(samples));
  console.log(`\nListen: open private/bakeoff/voices/ in the file explorer and click an .mp3 (or index.html).`);
  console.log("Summary for the repo: evaluation/results/bakeoff-voices.md");
}

function avg(xs: number[]) { return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0; }

function summary(samples: Sample[]): string {
  const rows = samples.map((s) => `| ${SERVICES[s.service].name} | ${s.label} | ${s.note} | ${s.error ? "✗ failed" : `${avg(s.msPerLine)} ms`} |  |`);
  return [
    "# Voice bake-off: voice test", "",
    `The same ${LADDU_LINES.length} Laddu lines in each voice (${today()}). Fill in **Nisha's pick** with ⭐ (best), ✅ (fine) or ❌.`,
    "Time = how long the service took to make one line (all at once, not streamed).", "",
    "| Service | Voice | About | Time per line | Nisha's pick |", "|---|---|---|---|---|", ...rows, "",
  ].join("\n");
}

function listeningPage(samples: Sample[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const lines = LADDU_LINES.map((l, i) => `<li>${i + 1}. ${esc(l.tanglish)} <span>(${esc(l.english)})</span></li>`).join("");
  const players = samples.filter((s) => s.file).map((s) => `<div class="v"><b>${esc(SERVICES[s.service].name)}</b> · ${esc(s.label)} <span>${esc(s.note)}</span><audio controls preload="none" src="${s.file}"></audio></div>`).join("");
  const library = elevenShared.length ? `<h2>More Tamil voices in the ElevenLabs library (free previews)</h2>${elevenShared.filter((v) => v.preview_url).map((v) => `<div class="v">${esc(v.name)} <span>${esc([v.gender, v.age, v.accent].filter(Boolean).join(", "))} · id ${v.voice_id}</span><audio controls preload="none" src="${v.preview_url}"></audio></div>`).join("")}` : "";
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Laddu voice test</title>
<style>body{font:16px system-ui;max-width:720px;margin:2rem auto;padding:0 1rem}span{color:#777}.v{margin:1rem 0}audio{display:block;width:100%;margin-top:.3rem}ol{list-style:none;padding:0}</style>
<h1>Which voice is Laddu?</h1><p>Each player has these ${LADDU_LINES.length} lines:</p><ol>${lines}</ol>${players}${library}`;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
