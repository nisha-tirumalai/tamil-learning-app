# Tamil speaking tutor: engineering plan and progress

**For a new session:** read [SCOPING.md](SCOPING.md) first. It is the **source of
truth** for *what* we build, *why*, and *in what order* (§10). This file is the
engineering log: where work stopped, how things are built, and technical
decisions. Update it at the end of every phase.

## How we work

1. **Spec first.** Before building any feature, write `docs/specs/NNN-feature-name.md`
   (template: [specs/000-template.md](specs/000-template.md)) with the user story,
   acceptance criteria, out of scope, and tests/evals. **Wait for Nisha's approval
   before writing code.** Infrastructure fixes (making existing code run, CI,
   devcontainer) don't need a spec.
2. **Explain in plain English.** Nisha is new to programming and git.
3. **Commit after each working step and push.**
4. **Secrets only in GitHub Codespaces secrets**, never in files. The repo is public.
   `.env*` stays gitignored anyway, as a safety net.

## Where we are (2026-11-11)

- **2026-11-11: Phase 3b (spec 002, Laddu v1.1) built, waiting for Nisha's on-phone check.**
  All 72 tests pass (`npm run test:db`). Needs Nisha:
  1. With her OK, run the smoke eval (`npm run eval:smoke`, ~$0.05), then fill in the **In role?** column for Laddu's 6 scene replies, and look at the *samikiren* watch row.
  2. "Done when": 10 messages on her phone; Laddu answers quickly, the screen feels calm, the ⭐ chips are useful, and he keeps the scene going.
  Next after that: spec 003 (voice; its draft is in progress).
- **2026-11-10, first real use:** Laddu works on Nisha's phone (migration run, key added). Feedback: too many words on screen; waiting for the score is slow; Laddu doesn't stay in the scene or keep the chat going; voice is essential; wants Laddu big and talking. → Spec 002 (v1.1) approved 2026-11-10. **Next: build spec 002 in the codespace**, then spec 003 (voice), then go live on Vercel, then the gold set. One scorer miss to flag: "samikiren" (meant *samaikkiren*, cooking) was read as "worship", and the meaning was changed to buying.
- **Phase 3 (chat v1 with Laddu): built, waiting for Nisha's on-phone check.**
  All 52 tests pass (`npm run test:db`), using a fake model (no key, no cost).
  Not yet done, and needs Nisha:
  1. Run the new migration on the real Supabase project: paste
     `supabase/migrations/20261111000000_chat_v1.sql` into the SQL Editor and Run.
  2. Add an Anthropic API key as the Codespaces secret `ANTHROPIC_API_KEY`
     (console.anthropic.com → API keys; set a small monthly spend limit there),
     then reload the codespace. Without it, Laddu says "isn't set up yet".
  3. With her OK, run the smoke eval (`npm run eval:smoke`, about $0.05) and look at the table.
  4. Approve (or ask to change) the v1 drawings of Laddu and the girl, and check the praise lines' Tanglish with her teacher.
  5. "Done when": 10 real messages on her phone feel right.
- **Phase 2 (login): done** 2026-11-07. CI green.
- **Building happens in Claude Code** (her Claude subscription). The **app** calls Claude
  through the API key above; that's separate and billed per use (cents a day at the cap).
- **Small follow-ups:** switch login from a magic link to a 6-digit email code
  (links only work in the browser that asked for them, and an installed PWA on
  iPhone has its own storage, so links won't work there); explicit grants (below).
- **Codespace housekeeping:** stop it when not in use (free hours), and set port
  3000 back to Private when not testing on the phone. If the codespace is ever
  recreated, its address changes: update Supabase → Authentication → URL Configuration.

## Phases (mirrors SCOPING.md §10; SCOPING wins if they differ)

**Order changed 2026-11-10:** 3 → **3b** (Laddu v1.1) → **5** (voice) → **going live on Vercel** (moved up from phase 8) → **4** (gold set) → 6 → 7 → 8 (two weeks of daily use + weekly reviews) → 9. The numbers stay the same so older docs still make sense.

| Phase | What | Status | Spec |
|---|---|---|---|
| 0 | Goals + scoping doc | 🟨 | [SCOPING.md](SCOPING.md) |
| 1 | Lesson data pipeline | ✅ | (before specs) |
| 2 | Login + private per-user data | ✅ 2026-11-07 | (before specs) |
| 3 | **Chat v1 with Laddu:** welcome → I start / Laddu starts → correction + score /10 + try again + continue | 🟨 built 2026-11-11, needs key + phone check | [001](specs/001-chat-v1.md) |
| 3b | **Laddu v1.1:** fewer words, instant reply with tap-to-open score, stays in the scene, stretch questions | 🟨 built 2026-11-11, needs phone check + smoke eval | [002](specs/002-laddu-v1-1.md) |
| 5 | **Talk to Laddu (voice), moved up:** speak in, Tamil voice out, mute, call-style screen with Laddu talking | 🟨 spec approved 2026-11-11 | [003](specs/003-talk-to-laddu.md) |
| (8 →) | **Go live on Vercel (moved up):** always-on address, home-screen install, keys in Vercel settings, Supabase URL config | ⬜ | setup walkthrough, no spec |
| 4 | **Rubric + gold set + evals:** 20→40 scored messages, eval script, compare 2–3 models, one model per job | ⬜ | |
| 6 | **Memory + progress:** weak-spots list steers conversations; weekly progress screen | ⬜ | |
| 7 | Logging + Project HQ dashboard | ⬜ | |
| 8 | Deploy → MVP live on Nisha's phone; daily use for 2 weeks; weekly error review | ⬜ | |
| 9 | Portfolio polish: README, eval results, demo video, write-up | ⬜ | |
| 10+ | Later Ideas (SCOPING.md) | ⬜ | |

**Superseded:** the old 9-milestone order (flashcards, daily session, drills, audio,
chat tutor, friends, game). Flashcards, games and friends are now Later Ideas.
The MVP is single-user.

## Phase 2: what's built
- `supabase/migrations/20261104000000_init.sql`: allowlist + Before User Created
  hook, `profiles` (auto-created on sign-up; `is_admin` not user-editable),
  `card_state`, `review_log`, `daily_activity`, `flags` (own rows only),
  `usage_daily` (read-only to users). `card_state`, `review_log` and
  `daily_activity` were made for flashcards and streaks, which are now Later
  Ideas. They're harmless; leave them unless a phase needs the change.
- App (Next.js 15, `src/`): magic-link login (`/login`, `/auth/callback`,
  `/auth/signout`), middleware sending signed-out visitors to /login, lesson
  browser (`/`, `/lessons/[key]`) with "Looks wrong?" on every card, and My flags
  (`/flags`). Phase 3 replaces `/` with the welcome screen; the lesson browser can stay
  as a secondary page.
- Tests: `tests/lessons.test.ts`, `tests/rls.test.ts` ([TESTS.md](TESTS.md)).
  CI: `.github/workflows/test.yml`. Locally: `npm test` (no database) and
  `npm run test:db` (starts a local Supabase in Docker, then runs everything).
- Magic link only, no Google sign-in. Fine for a single user.
- `scripts/` is left out of `npm run typecheck` for now (never type-checked).

## Phase 3: what's built
- `supabase/migrations/20261111000000_chat_v1.sql`: `conversations` → `messages` →
  `scores` (all RLS; a message can only go in your own conversation, a score only on
  your own message; deleting a conversation cascades). `scores` has grammar 0–6,
  spoken 0–4, total = sum (checked by the database), mistake types, the whole card as
  JSON, prompt version and model. A try-again is a message with `retry_of` → the first
  message. `bump_chat_usage(cap)` counts against `usage_daily` in the user's timezone
  (security definer, own row only). `flags.message_id` links chat flags.
  The column is `spoken`, not "natural" (`natural` is a reserved word in SQL).
- `src/lib/chat/`: `config.ts` (model, cap, prompt versions, praise lines, situations),
  `scorer.ts` (answer shape + strict check), `tamil.ts` (guard), `model.ts` (Anthropic
  + `FakeModel`), `turn.ts` (the whole turn: send, retry, "not what I meant", reply
  stream, past chats, flag, delete). Prompts in `prompts/`.
- Screens: `/` welcome, `/chat/[id]` live chat, `/chats` past chats (+ delete with
  confirm), `/chats/[id]` read-only, `/lessons` lesson browser. Laddu's reply streams
  from `/api/chat/[id]/reply` (one JSON event per line).
- What counts toward the cap: each scored message (send, try again, "not what I
  meant", tap-to-retry) and Laddu's opener. Continue replies don't.
- Sending a new message instead of tapping Continue moves on without Laddu's reply.

## Phase 3b: what's built (spec 002)
- **One request per message:** `/api/chat/[id]/send` → `sendTurn()` in `turn.ts`. It counts the
  cap once, saves my message (`saved` event), then runs the scorer and Laddu's reply **at the same
  time** and streams both back as they arrive (`delta`/`done` for the reply, `score`/`score_error`
  for the score). A failure in one never stops the other. Shared streaming code: `src/lib/chat/stream.ts`.
- `/api/chat/[id]/reply` is still there for Laddu's opener and "tap to try again" after a failed
  reply (free, as before). Try again, "That's not what I meant" and "Score didn't load · tap to
  retry" are still server actions (each counts, as in v1). Laddu doesn't reply to a Try again.
- **Laddu reads my own words** (`tutorTurns()`), not the scorer's `understood`; only a meaning I
  typed myself is passed on. Two of my messages in a row (after a failed reply) are joined into one turn.
- `prompts/tutor_system_v2.md` (config points at it; v1 kept): stays in role, 1–2 sentences, ends
  with a question or invitation, asks for details, stretches now and then. It handles **safety by
  itself** (one line in simple English), since it no longer waits for the scorer. The scene text
  is built by `sceneText()`.
- **Screen:** `src/components/Turns.tsx` (Laddu's bubble: English on tap; mine: the ⭐ chip, tap to
  open the card). What the chip says: `chipFor()` in `src/lib/chat/chip.ts`. No Continue button.
  If a chat is reopened with my message unanswered, "🧸 Tap here and Laddu will answer." A safety
  message gets no chip; its score row is still saved (kind = safety) for the record.
- `FakeModel.scoreDelayMs` makes scoring slow in tests. Screen tests (`tests/screen.test.tsx`)
  render to HTML with `react-dom/server`, no browser library needed.

## Architecture

```
Phone (PWA) ──► Next.js server routes ──► Claude API / Azure Speech
     │                │  checks login + daily cap first
     └──► Supabase (auth, Postgres + RLS, audio storage)
```

- Next.js (App Router, TypeScript) PWA, deployed on Vercel later (phase 8); for now
  `npm run dev` in Codespaces, opened on the phone through a forwarded port.
- Supabase free tier: auth, Postgres with row-level security. Free projects pause
  after 7 days without activity.
- Keys stay on the server. The browser never calls Claude or Azure directly.
- Speech-to-text goes through the server so every attempt counts against the cap.

## Data

**Lesson content:** `data/lessons.json` (from `npm run ingest`), bundled with the
app, not stored in the database. Item fields: id, lesson, type, section, english,
tanglish, tamil, register (colloquial / formal / neutral), needs_review, tags, and
optional source ("book"), speaker, meaning, formal, alternates, pair_id. **Tamil
script is never sent to the browser** (`toCard()` in `src/lib/lessons.ts`).

**Per-user tables:** see the migration. Every one has RLS ("you only see rows
where `user_id` is you"), tested in `tests/rls.test.ts`.

## Technical decisions

(Product decisions live in SCOPING.md's Decision Log.)
- **2026-11-04: Lesson content is bundled, not in the database.** It's public anyway,
  so there's no `items` table to keep in sync.
- **2026-11-04: Tests use a throwaway local Supabase** started from
  `supabase/migrations/`, so CI needs no secrets and never touches real data.
- **2026-11-04: Corrections** live in `lessons/overrides.json`, keyed by item id,
  applied on every ingest run; anything changed there is `needs_review`. Keep
  `needs_review` in the data, but no prominent "not checked" label in the UI.
- **2026-11-04: Adi's Book** has no Tamil script; Claude writes it (for TTS), marked
  `needs_review`. Only book Lesson 1 is ingested (`BOOK_LESSONS` in
  `scripts/ingest/ingest.ts`). *namaskāram* and *nandri* are repaired in
  `scripts/ingest/book.ts` because the PDF garbles them.
- **2026-11-07: Codespaces setup.** `.devcontainer/` gives Node 24 and Docker
  (for `supabase start`). Keys are Codespaces secrets (environment variables in the
  codespace), so no `.env.local` is needed. Redirects and server actions use the
  forwarded `*.app.github.dev` address, not `localhost`.
- **2026-11-07: Hosted project settings.** Created with Data API on, "Automatically expose new tables" on (the migration relies on Supabase's default table grants), and automatic RLS on (safety net). **Follow-up:** add explicit `grant`s to a migration so "expose new tables" can be turned off, as Supabase recommends.
- **2026-11-07: Stay a PWA** (installable website), not an App Store app. Confirmed by Nisha after seeing it in the browser. Home-screen install comes with deployment (phase 8).
- **Open: email beyond Nisha.** Supabase's built-in email only sends to members
  of the Supabase organization, a few per hour. Fine for single-user MVP; needs
  Google sign-in or SMTP (e.g. Resend) before anyone else joins.

- **2026-11-11: Model settings.** `claude-haiku-5-5` with effort "low" for both calls (speed target 3 s);
  structured outputs for the scorer, plus our own stricter check (ranges, sum, list, Tamil).
  No automatic SDK retries (`maxRetries: 0`, 15 s timeout); the person taps to retry.
  One extra try only when an answer is unusable (e.g. Tamil script). Phase 4 tunes all this.
- **2026-11-11: Tamil guard while streaming.** Each streamed piece is checked before it's
  sent; on Tamil letters the server sends "reset", retries once, then the friendly error.

## Data stats (2026-11-04)

1,805 items from 11 lessons plus book Lesson 1 (35 items). 107 are `needs_review`;
382 are tagged `check-register`.
