# Voice bake-off: setting up the services (spec 003, step 1)

The bake-off runs with **whichever services you've set up**, so you can do one,
run it, and add the others later. Each key goes in **GitHub Codespaces secrets**,
never in a file (the repo is public).

**Adding a Codespaces secret:** github.com → your picture → **Settings** →
**Codespaces** → **New secret**. Type the name exactly as below, paste the value,
and under "Repository access" pick `tamil-learning-app`. Then **restart the
codespace** (VS Code shows a "reload" prompt, or stop and start it), because a
running codespace doesn't see new secrets.

Check what's ready any time (free, no calls to any service):

```
npm run bakeoff:check
```

## 1. ElevenLabs

1. Sign in at elevenlabs.io (the free plan is enough).
2. **Developers** (or your profile menu) → **API Keys** → **Create API key**.
   If it asks for permissions, allow **Speech to Text**, **Text to Speech** and
   **Voices** (read and write: the bake-off adds 2–3 Tamil voices from the voice
   library to "My voices" so it can use them).
3. Secret: **`ELEVEN_LABS_API_KEY`** = the key.

## 2. Azure Speech

1. portal.azure.com → **Create a resource** → search **Speech** (Azure AI
   Speech) → Create.
2. Region: **East US** (has every feature we test). Pricing tier: **Free F0**.
3. Open the resource → **Keys and Endpoint**.
4. Secrets:
   - **`AZURE_SPEECH_KEY`** = KEY 1
   - **`AZURE_SPEECH_REGION`** = the region code shown there, e.g. `eastus`
     (lowercase, no spaces)

## 3. Google Cloud

Google needs a "service account" (a robot login for the app) instead of a simple key.

1. console.cloud.google.com → create a project (e.g. `laddu-voice`). Google asks
   for billing to be set up; the free credit covers the bake-off many times over.
2. **APIs & Services → Library**: enable **Cloud Speech-to-Text API** and
   **Cloud Text-to-Speech API**.
3. **IAM & Admin → Service Accounts → Create service account**: name it
   `laddu-bakeoff`, give it the role **Cloud Speech Client**, Done.
4. Open it → **Keys → Add key → Create new key → JSON**. A `.json` file downloads.
5. Open that file in a text editor, copy **everything** (from `{` to `}`).
   Secret: **`GOOGLE_SERVICE_ACCOUNT_JSON`** = the whole file.
6. Delete the downloaded file afterwards (never put it in the project folder).

## Optional: the AI grader

If **`ANTHROPIC_API_KEY`** is visible in the codespace (the same key the app
uses), the hearing test also asks Claude to count words wrong, English words kept,
and mistakes the service "fixed" (about 1 cent in all). Without it you still get
the free "sound-alike" score.

## Running it

```
npm run bakeoff:hearing          # all services with keys
npm run bakeoff:voices
npm run bakeoff:hearing -- --only azure   # just one; earlier results are kept
```

- Hearing results: `evaluation/results/bakeoff-hearing.md` (summary, goes in the
  repo) and `private/bakeoff/hearing.md` (every transcript, stays private).
- Voices: `private/bakeoff/voices/`. Click an `.mp3` in VS Code's file list to
  play it. Write your pick in `evaluation/results/bakeoff-voices.md`.

**Settings you can change without touching code** (also as Codespaces secrets,
all optional): `ELEVENLABS_STT_MODEL` (default `scribe_v2`),
`ELEVENLABS_TTS_MODELS` (default `eleven_multilingual_v2,eleven_flash_v2_5`),
`ELEVENLABS_VOICE_IDS` (comma-separated voice ids to try instead of the
automatic picks), `AZURE_STT_API_VERSION` (default `2024-11-15`),
`GOOGLE_STT_MODEL` (default `chirp_3`), `GOOGLE_STT_LOCATION` (default `us`).
