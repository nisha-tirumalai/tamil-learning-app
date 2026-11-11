// Hearing test (spec 003, step 1): each service transcribes Nisha's 15
// recordings; we score how close each one got to what she actually said.
//
//   npm run bakeoff:hearing                  every service that has its keys
//   npm run bakeoff:hearing -- --only azure  just one (others' results are kept)
//
// Cost: ~2–3 minutes of audio per service (pennies, or inside the free tiers),
// plus ~1 cent of Claude for the grader if ANTHROPIC_API_KEY is set.
// Private details → private/bakeoff/hearing.md; summary → evaluation/results/.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  ensureDir, env, googleAccessToken, googleProject, hasFfmpeg, ok, OUT, prepareRecordings, readyServices,
  type Recording, RESULTS, seconds, SERVICES, type ServiceId, today,
} from "./common.ts";
import { hasTamil, soundAlikeErrorRate, wordCount } from "./score.ts";

// ─── The three hearing services ────────────────────────────────────────────

type Heard = { text: string; model: string };

async function elevenlabs(rec: Recording): Promise<Heard> {
  const model = env("ELEVENLABS_STT_MODEL", "scribe_v2");
  const form = new FormData();
  form.append("model_id", model);
  form.append("language_code", "ta");
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([readFileSync(rec.m4a)], { type: "audio/mp4" }), "recording.m4a");
  const res = await ok(await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": env("ELEVEN_LABS_API_KEY") }, body: form,
  }), "ElevenLabs");
  return { text: ((await res.json()) as { text: string }).text.trim(), model };
}

async function azure(rec: Recording): Promise<Heard> {
  const version = env("AZURE_STT_API_VERSION", "2024-11-15");
  const form = new FormData();
  form.append("audio", new Blob([readFileSync(rec.wav)], { type: "audio/wav" }), "recording.wav");
  form.append("definition", JSON.stringify({ locales: ["ta-IN"] }));
  const url = `https://${env("AZURE_SPEECH_REGION")}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=${version}`;
  const res = await ok(await fetch(url, {
    method: "POST", headers: { "Ocp-Apim-Subscription-Key": env("AZURE_SPEECH_KEY") }, body: form,
  }), "Azure");
  const data = await res.json() as { combinedPhrases?: { text: string }[] };
  return { text: (data.combinedPhrases ?? []).map((p) => p.text).join(" ").trim(), model: `fast transcription ${version}` };
}

async function google(rec: Recording): Promise<Heard> {
  const model = env("GOOGLE_STT_MODEL", "chirp_3");
  const location = env("GOOGLE_STT_LOCATION", "us");
  const url = `https://${location}-speech.googleapis.com/v2/projects/${googleProject()}/locations/${location}/recognizers/_:recognize`;
  const res = await ok(await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${await googleAccessToken()}`, "content-type": "application/json" },
    body: JSON.stringify({
      config: { autoDecodingConfig: {}, languageCodes: ["ta-IN"], model },
      content: readFileSync(rec.wav).toString("base64"),
    }),
  }), "Google");
  const data = await res.json() as { results?: { alternatives?: { transcript: string }[] }[] };
  return { text: (data.results ?? []).map((r) => r.alternatives?.[0]?.transcript ?? "").join(" ").trim(), model: `${model} (${location})` };
}

const HEAR: Record<ServiceId, (rec: Recording) => Promise<Heard>> = { elevenlabs, azure, google };

// ─── The AI grader (optional) ──────────────────────────────────────────────

const Grade = z.object({
  tanglish: z.string().describe("The transcript rewritten in Tanglish (Latin letters), exactly as heard, with no corrections"),
  words_wrong: z.number().int().describe("How many of her words the transcript got wrong: missing, extra, or a different word"),
  wrong: z.array(z.object({ said: z.string(), heard: z.string() })),
  english_said: z.number().int().describe("How many English words she said"),
  english_kept: z.number().int().describe("How many of those the transcript kept as the same English word (any script)"),
  fixed: z.array(z.object({ said: z.string(), heard: z.string() }))
    .describe("Places where the transcript replaced her non-standard or incorrect Tamil with a more standard or 'correct' form"),
});
type Grade = z.infer<typeof Grade>;

const GRADER_PROMPT = `You compare a speech-to-text transcript with what a Tamil learner says she said.
Her version is in Tanglish (Tamil in English letters, English words mixed in). The transcript may be in Tamil script, Latin letters, or both.

Rules:
- Spelling and script never count. "veetukku", "veettukku" and "வீட்டுக்கு" are the same word. An English word written in Tamil script ("ஆபீஸ்" for office) is kept.
- A word is wrong if it's missing, extra, or a different word (a different verb ending or tense counts as different).
- Short spoken forms vs long written forms: if she said the spoken form ("panren") and the transcript wrote the formal one ("பண்ணுகிறேன்"), that is a different word AND goes in "fixed".
- "fixed" is only for changes that make her Tamil more standard or correct than what she said. Plain mishearings are just "wrong".
- She typed her version from memory, so it may differ slightly from her recording; judge against her version anyway.`;

let anthropic: Anthropic | null = null;

async function grade(said: string, heard: string): Promise<Grade | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  anthropic ??= new Anthropic({ maxRetries: 2 });
  const res = await anthropic.messages.parse({
    model: "claude-haiku-5-5",
    max_tokens: 2000,
    system: GRADER_PROMPT,
    messages: [{ role: "user", content: `What she said: ${said}\nTranscript: ${heard || "(empty)"}` }],
    output_config: { effort: "low", format: zodOutputFormat(Grade) },
  });
  return res.parsed_output ?? null;
}

// ─── Running it ────────────────────────────────────────────────────────────

type Row = { n: number; said: string; heard: string; error?: string; ms: number; cer: number | null; grade: Grade | null };
type ServiceResult = { date: string; model: string; audioSeconds: number; rows: Row[] };
type AllResults = Partial<Record<ServiceId, ServiceResult>>;

const RAW = join(OUT, "hearing.json");

async function main() {
  const services = readyServices();
  if (!hasFfmpeg()) throw new Error("ffmpeg is missing. Run: sudo apt-get install -y ffmpeg");
  if (services.length === 0) {
    console.log("No service has its keys yet. Run `npm run bakeoff:check` to see what's missing.");
    return;
  }
  ensureDir(OUT);
  const recs = prepareRecordings();
  if (recs.length === 0) throw new Error("No recordings found in private/ (expected tamilrecording15.zip).");
  const missingText = recs.filter((r) => !r.said).map((r) => r.n);
  if (missingText.length) console.warn(`No sentence in private/sentences.txt for recording(s) ${missingText.join(", ")}.`);
  const audioSeconds = recs.reduce((s, r) => s + seconds(r.m4a), 0);
  if (!process.env.ANTHROPIC_API_KEY) console.log("(No ANTHROPIC_API_KEY: skipping the AI grader; the sound-alike score still runs.)");

  const all: AllResults = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : {};
  for (const id of services) {
    console.log(`\n${SERVICES[id].name}: ${recs.length} recordings`);
    const rows: Row[] = [];
    let model = "";
    for (const rec of recs) {
      const start = Date.now();
      let heard = "", error: string | undefined;
      try {
        const r = await HEAR[id](rec);
        heard = r.text; model = r.model;
      } catch (e) { error = (e as Error).message; }
      const ms = Date.now() - start;
      const g = heard && rec.said ? await grade(rec.said, heard).catch((e) => { console.warn(`  grader failed: ${e.message}`); return null; }) : null;
      const cer = heard && rec.said ? soundAlikeErrorRate(rec.said, heard) : null;
      rows.push({ n: rec.n, said: rec.said, heard, error, ms, cer, grade: g });
      console.log(`  #${rec.n} ${error ? `✗ ${error}` : `${(ms / 1000).toFixed(1)} s, sound-alike error ${cer === null ? "-" : pct(cer)}`}`);
      // Stop early if the very first call fails the same way (wrong key, wrong region...).
      if (error && rows.length === 1) { console.log("  Stopping this service: the first call failed. Check its keys."); break; }
    }
    all[id] = { date: today(), model, audioSeconds, rows };
  }
  writeFileSync(RAW, JSON.stringify(all, null, 2));
  writeFileSync(join(OUT, "hearing.md"), detailReport(all));
  ensureDir(RESULTS);
  const summaryFile = join(RESULTS, "bakeoff-hearing.md");
  writeFileSync(summaryFile, summaryReport(all, audioSeconds));
  console.log(`\n${summaryReport(all, audioSeconds)}`);
  console.log(`Details with every transcript (private): private/bakeoff/hearing.md\nSummary for the repo: evaluation/results/bakeoff-hearing.md`);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function summaryReport(all: AllResults, audioSeconds: number): string {
  const lines = [
    "# Voice bake-off: hearing test",
    "",
    `Nisha's ${Object.values(all)[0]?.rows.length ?? 0} recordings (${Math.round(audioSeconds)} s of audio in all), each transcribed once per service.`,
    "Recordings and transcripts are private; this table is the summary only.",
    "",
    "- **Sound-alike error**: how far the transcript is from what she said, letter by letter, after ignoring spelling and script (0% = perfect). No AI involved.",
    "- **Words wrong / English kept / Mistakes fixed**: from the AI grader (Claude Haiku). \"Fixed\" = the service quietly turned what she said into more standard Tamil (bad for scoring).",
    "",
    "| Service | Model | Done | Sound-alike error | Words wrong | English kept | Mistakes fixed | Median time | Writes in | Tested |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const [id, r] of Object.entries(all) as [ServiceId, ServiceResult][]) {
    const okRows = r.rows.filter((x) => x.heard);
    const cers = okRows.map((x) => x.cer).filter((x): x is number => x !== null);
    const graded = okRows.filter((x) => x.grade);
    const saidWords = graded.reduce((s, x) => s + wordCount(x.said), 0);
    const wrong = graded.reduce((s, x) => s + x.grade!.words_wrong, 0);
    const engSaid = graded.reduce((s, x) => s + x.grade!.english_said, 0);
    const engKept = graded.reduce((s, x) => s + x.grade!.english_kept, 0);
    const fixed = graded.reduce((s, x) => s + x.grade!.fixed.length, 0);
    const tamil = okRows.filter((x) => hasTamil(x.heard)).length;
    const script = okRows.length === 0 ? "-" : tamil === okRows.length ? "Tamil script" : tamil === 0 ? "Latin letters" : "mixed";
    lines.push(`| ${SERVICES[id].name} | ${r.model || "-"} | ${okRows.length}/${r.rows.length} | ${cers.length ? pct(cers.reduce((a, b) => a + b, 0) / cers.length) : "-"} | ${graded.length ? `${wrong}/${saidWords} (${pct(wrong / saidWords)})` : "-"} | ${graded.length ? `${engKept}/${engSaid}` : "-"} | ${graded.length ? fixed : "-"} | ${okRows.length ? `${(median(okRows.map((x) => x.ms)) / 1000).toFixed(1)} s` : "-"} | ${script} | ${r.date} |`);
  }
  lines.push("", "Cost: about " + (audioSeconds / 60).toFixed(1) + " minutes of audio per service; check each price page (or the free tier) for the rate.", "");
  return lines.join("\n");
}

function detailReport(all: AllResults): string {
  const lines = ["# Hearing test: every transcript (PRIVATE, don't commit)", ""];
  for (const [id, r] of Object.entries(all) as [ServiceId, ServiceResult][]) {
    lines.push(`## ${SERVICES[id].name} (${r.model}, ${r.date})`, "", "| # | What I said | What it heard | As Tanglish (grader) | Sound-alike error | Wrong | Fixed | Time |", "|---|---|---|---|---|---|---|---|");
    for (const x of r.rows) {
      const g = x.grade;
      lines.push(`| ${x.n} | ${x.said} | ${x.error ? `✗ ${x.error.replace(/\|/g, "/")}` : x.heard} | ${g?.tanglish ?? ""} | ${x.cer === null ? "-" : pct(x.cer)} | ${g ? g.wrong.map((w) => `${w.said} → ${w.heard}`).join("; ") || "none" : ""} | ${g ? g.fixed.map((w) => `${w.said} → ${w.heard}`).join("; ") || "none" : ""} | ${(x.ms / 1000).toFixed(1)} s |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
