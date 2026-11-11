// Voice bake-off (spec 003, step 1): shared helpers.
// Everything personal (recordings, transcripts, voice samples) is written to
// private/bakeoff/, which git ignores. Only summary tables go in the repo.
import { execFileSync } from "node:child_process";
import { createSign } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dirname, "..", "..");
export const PRIVATE = join(ROOT, "private");
export const OUT = join(PRIVATE, "bakeoff");
export const RESULTS = join(ROOT, "evaluation", "results");

export type ServiceId = "elevenlabs" | "azure" | "google";

/** Which Codespaces secrets each service needs. */
export const SERVICES: Record<ServiceId, { name: string; keys: string[] }> = {
  elevenlabs: { name: "ElevenLabs", keys: ["ELEVENLABS_API_KEY"] },
  azure: { name: "Azure Speech", keys: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"] },
  google: { name: "Google Cloud", keys: ["GOOGLE_SERVICE_ACCOUNT_JSON"] },
};

export function missingKeys(id: ServiceId): string[] {
  return SERVICES[id].keys.filter((k) => !process.env[k]?.trim());
}

/** The services that have all their keys, optionally limited by `--only a,b`. */
export function readyServices(argv = process.argv): ServiceId[] {
  const i = argv.indexOf("--only");
  const only = i >= 0 ? argv[i + 1]?.split(",") : null;
  return (Object.keys(SERVICES) as ServiceId[])
    .filter((id) => !only || only.includes(id))
    .filter((id) => missingKeys(id).length === 0);
}

export function env(name: string, fallback?: string): string {
  const v = process.env[name]?.trim();
  if (v) return v;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing ${name}`);
}

export function hasFfmpeg(): boolean {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; }
}

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Nisha's recordings and what she said ──────────────────────────────────

export type Recording = { n: number; said: string; m4a: string; wav: string };

/** Lines like: Tamil recording 3: "Appa, neenga ..." */
export function readSentences(): Map<number, string> {
  const file = join(PRIVATE, "sentences.txt");
  const said = new Map<number, string>();
  if (!existsSync(file)) return said;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/recording\s*(\d+)\s*:\s*(.+)$/i);
    if (m) said.set(Number(m[1]), m[2].trim().replace(/^["“]+|["”]+$/g, "").trim());
  }
  return said;
}

/**
 * Unzips the recordings (once) and makes a 16 kHz mono WAV copy of each,
 * because Azure and Google are fussy about Apple's .m4a files.
 */
export function prepareRecordings(): Recording[] {
  const audio = ensureDir(join(OUT, "audio"));
  const zip = join(PRIVATE, "tamilrecording15.zip");
  if (!readdirSync(audio).some((f) => f.endsWith(".m4a")) && existsSync(zip)) {
    execFileSync("unzip", ["-o", "-j", "-q", zip, "*.m4a", "-d", audio]);
  }
  for (const f of readdirSync(PRIVATE)) if (f.endsWith(".m4a") && !existsSync(join(audio, f))) {
    execFileSync("cp", [join(PRIVATE, f), audio]);   // loose .m4a files in private/ work too
  }
  const said = readSentences();
  const recs: Recording[] = [];
  for (const f of readdirSync(audio)) {
    const m = f.match(/(\d+)\.m4a$/);
    if (!m) continue;
    const n = Number(m[1]);
    const m4a = join(audio, f);
    const wav = join(audio, `recording-${n}.wav`);
    if (!existsSync(wav)) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", m4a, "-ar", "16000", "-ac", "1", wav]);
    recs.push({ n, said: said.get(n) ?? "", m4a, wav });
  }
  return recs.sort((a, b) => a.n - b.n);
}

export function seconds(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString();
  return Number(out.trim()) || 0;
}

// ─── Google sign-in (service account → short-lived access token) ───────────

let googleToken: { token: string; until: number } | null = null;

export function googleProject(): string {
  return JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON")).project_id;
}

export async function googleAccessToken(): Promise<string> {
  if (googleToken && googleToken.until > Date.now() + 60_000) return googleToken.token;
  const sa = JSON.parse(env("GOOGLE_SERVICE_ACCOUNT_JSON"));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  googleToken = { token: data.access_token, until: Date.now() + data.expires_in * 1000 };
  return googleToken.token;
}

export async function ok(res: Response, what: string): Promise<Response> {
  if (!res.ok) throw new Error(`${what}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
