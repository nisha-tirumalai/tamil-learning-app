// `npm run bakeoff:check`: what's ready for the bake-off. Free: no paid calls.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasFfmpeg, missingKeys, PRIVATE, readSentences, SERVICES, type ServiceId } from "./common.ts";

const tick = (b: boolean) => (b ? "✅" : "⬜");
console.log("Voice bake-off: what's ready\n");
for (const id of Object.keys(SERVICES) as ServiceId[]) {
  const missing = missingKeys(id);
  console.log(`${tick(missing.length === 0)} ${SERVICES[id].name}${missing.length ? `: add Codespaces secret(s) ${missing.join(", ")}` : ""}`);
}
const google = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (google) {
  try { const j = JSON.parse(google); if (!j.private_key || !j.client_email) throw new Error(); }
  catch { console.log("   ⚠️  GOOGLE_SERVICE_ACCOUNT_JSON doesn't look like a service-account key file (paste the whole .json file)."); }
}
console.log(`${tick(Boolean(process.env.ANTHROPIC_API_KEY))} AI grader (optional): ANTHROPIC_API_KEY`);
console.log(`${tick(hasFfmpeg())} ffmpeg (audio converter)`);
console.log(`${tick(existsSync(join(PRIVATE, "tamilrecording15.zip")))} recordings: private/tamilrecording15.zip`);
console.log(`${tick(readSentences().size > 0)} sentences: ${readSentences().size} in private/sentences.txt`);
console.log("\nThen: npm run bakeoff:hearing   and   npm run bakeoff:voices");
