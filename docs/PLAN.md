# Tamil speaking app: plan and progress

**For a new session:** read this file first. It has the goal, the rules, the
decisions made so far, and where work stopped. Update it at the end of every
milestone (status table, "Where we are", and any new decisions).

## Where we are

- **Milestone 1 (lesson data):** done. Greetings (*namaskāram*, *nandri*) added.
- **Milestone 2 (login + per-user data, flags, CI):** code written and committed,
  but **not yet run**. Claude's session can't install packages (see blocker), so
  the app, type-check and tests haven't been executed. Only the lesson-data logic
  was checked with plain Node.
- **Next:** Nisha follows [SUPABASE_SETUP.md](SUPABASE_SETUP.md): creates the
  project, runs the migration, adds herself to the allowlist, turns on the hook,
  fills `.env.local`, runs `npm install` + `npm run dev`, tries login and flagging,
  then commits `package-lock.json` and pushes. Then: fix whatever the first real run
  and the first GitHub Actions run turn up, and mark milestone 2 done.
- **Blocker:** npm can't download packages from Claude's session (TLS handshake
  failure to registry.npmjs.org, even outside the sandbox). Nisha runs `npm install`
  in her own terminal; if that fails too, a VPN, antivirus "HTTPS scanning", or a
  work/school network is the likely cause.
- **Pushing:** Claude's session has no GitHub login, so Nisha pushes (`git push`
  or **Sync Changes** in VS Code).

### Milestone 2: what was built
- `supabase/migrations/20261104000000_init.sql`: allowlist + Before User Created
  hook, profiles (auto-created on sign-up; `is_admin` not user-editable),
  card_state, review_log, daily_activity, flags (own rows only), usage_daily
  (read-only to users).
- App (Next.js 15, `src/`): magic-link login (`/login`, `/auth/callback`,
  `/auth/signout`), middleware sending signed-out visitors to /login, lesson list
  (`/`), lesson pages with cards (`/lessons/[key]`, e.g. `1` or `book-1`), and
  **My flags** (`/flags`: mark sorted / reopen / delete).
- **"Looks wrong?"** on every card: optional note, saved via a server action that
  snapshots English/Tanglish from `data/lessons.json`. `flags.source` already
  allows `'chat'` for the tutor (milestone 7).
- Tests: `tests/lessons.test.ts` and `tests/rls.test.ts`, explained in
  [TESTS.md](TESTS.md). CI: `.github/workflows/test.yml` (npm ci → typecheck →
  local Supabase from the migration → vitest).
- Google sign-in isn't built yet: magic link only (see the open question below).
- `scripts/` is left out of `npm run typecheck` for now (never type-checked
  before); add it back once its errors, if any, are fixed.

## The goal (from the original brief)

A Tamil **speaking** practice app, built as a portfolio project, for Nisha, her
sister and a few friends. The users are beginners who can't read Tamil script and
don't want to learn it, and who practice a few minutes a day on their phones.
Nisha is a beginner programmer, so explain choices briefly as you go.

**Source content:** the teacher's lesson files in `lessons/` (LESSON_1–12 .docx;
there is no Lesson 6) plus Adi's Book (PDF, *Common Spoken Tamil Made Easy*). They
contain English / Tanglish (romanized) / Tamil script sentences, vocab, dialogues,
songs and Thirukkural, in both formal and colloquial Tamil.

### Rules
- **Never show Tamil script in the UI.** Store it, because text-to-speech needs it.
- Default to spoken (colloquial) Tamil, accept formal forms, and label which is which.
- **API keys stay server-side only.** Keys live in `.env.local`, which is gitignored
  and must never be committed.
- **Invite-only:** only emails on an allowlist Nisha controls can sign up.
- **Easy login:** magic link or Google sign-in, no passwords.
- **Shared vs personal data:** lesson content is shared. Each person's progress,
  review schedule, missed words, streak, chat memory and flags are private, and
  **the database rules (RLS) enforce this, not just the UI.**
- **Cost protection:** a daily cap per user on chat messages and speech-to-text,
  with a friendly "come back tomorrow" message, plus an admin usage view for Nisha.
- **Social features are opt-in:** friends' streaks, nudges, maybe a weekly
  mini-leaderboard. Nothing that shows anyone's mistakes.
- Each user picks a tutor voice (male/female) and a pace (slow/normal).
- Working style: commit after each working step.

## Milestones

| # | Milestone | Status |
|---|-----------|--------|
| 1 | Lesson data: parse lessons + book into `data/lessons.json` | ✅ Done |
| 2 | Supabase login (magic link or Google), invite allowlist, per-user tables with RLS, a test that one user can't read another's data. Plus: "this looks wrong" button + "My flags" page, and GitHub Actions running tests on every push | 🔧 Code written, not yet run |
| 3 | Flashcards with spaced repetition (FSRS via ts-fsrs), plus a "words to review" list | |
| 4 | 5-minute daily session and streak | |
| 5 | "Finish the sentence" drills | |
| 6 | Audio: phone voices first, then Azure Tamil voices (shared audio cache, listen and repeat) | |
| 7 | Chat tutor (Claude) with memory, daily limits, and Nisha's admin usage page. The "this looks wrong" button goes on tutor replies too | |
| 8 | Friends' streaks and nudges (opt-in) | |
| 9 | One game: Sentence Builder, Speed Match, or Say It to Win | |

### Build order agreed on 2026-11-04
1. Commit `lessons/`, `overrides.json` and `data/` (teacher approved), check for secrets, push. ✅
2. Add *namaskāram* and *nandri* as greeting items. ✅
3. Save this plan to `docs/PLAN.md`. ✅
4. Milestone 2: Supabase login, allowlist, per-user tables with RLS, a cross-user
   test, and a step-by-step Supabase setup guide for a first-time user.
5. "This looks wrong" button on every card (and later in the chat tutor) that
   saves the item and an optional note to Supabase, plus a page listing my flags.
6. GitHub Actions running the tests on every push, with each test explained in plain English.

## Architecture

```
Phone (PWA) ──► Next.js server routes (Vercel) ──► Claude API / Azure Speech
     │                │  checks login + daily cap first
     └──► Supabase (auth, Postgres + RLS, audio storage)
```

- **Stack:** Next.js (App Router, TypeScript) as an installable PWA on Vercel's
  free tier; Supabase free tier (auth, Postgres with row-level security, storage);
  Azure Speech free tier (ta-IN voices, speech-to-text); Claude Haiku for the tutor.
  TypeScript everywhere, including the ingest scripts.
- **Keys stay on the server.** The browser never calls Claude or Azure directly. It
  goes through a server route that checks login and the daily cap first.
- Speech-to-text goes through the server so every attempt counts against the cap.
- Text-to-speech is generated once per sentence, voice and pace, then cached for everyone.
- Supabase free projects pause after 7 days without activity.

## Data model

**Shared lesson content:** `data/lessons.json`, generated by `npm run ingest` and
bundled with the app. Each item has: id, lesson, type (sentence / vocab / dialogue
/ story / grammar / kural / song), section, english, tanglish, tamil, register
(colloquial / formal / neutral), needs_review, tags, plus optional source ("book"),
speaker, meaning, formal, alternates, pair_id. The Tamil script is never sent to
the browser.

**Per-user tables (RLS: you only see rows where `user_id` is you)** are created in
`supabase/migrations/`:
- `profiles`: display name, voice, pace, timezone, `share_streak`, `is_admin`
  (users can't change `is_admin`)
- `card_state` and `review_log`: spaced-repetition schedule and every answer (milestone 3)
- `daily_activity`: one row per practice day, for the streak (milestone 4)
- `usage_daily`: chat and speech-to-text counts. Users can read their own; only the
  server writes them (milestone 7)
- `flags`: "this looks wrong" reports (item id, a snapshot of the English and
  Tanglish, an optional note, where it was flagged: card or chat)

**Admin:** `allowlist` (emails allowed to sign up). No user can read it. A
"Before User Created" auth hook rejects emails not on the list, so the database
enforces it. Nisha edits the allowlist in Supabase's Table Editor.

**Later:** `chat_messages` and `tutor_memory` (milestone 7); `friendships`,
`nudges`, and a function returning only name + streak for opted-in friends (milestone 8).

## Decisions so far

- **2026-11-01: Stack.** Next.js PWA + Supabase + Vercel, as above.
- **2026-11-04: Content is public.** The teacher approved putting her lesson files
  and Adi's Book on GitHub, so `lessons/` (including `overrides.json`) and `data/` are
  committed to the public repo. The app itself stays invite-only. Secrets
  (`.env*`, keys) are always gitignored.
- **Adi's Book:** it has no Tamil script, only romanized spoken Tamil. Claude writes
  the Tamil script (for text-to-speech), marked `needs_review`. Only book Lesson 1 is
  ingested so far (a pilot); add more lessons a few at a time (`BOOK_LESSONS` in
  `scripts/ingest/ingest.ts`).
- **Corrections** live in `lessons/overrides.json`, keyed by item id. The ingest
  script applies them on every run and keeps the teacher's formal Tamil as `formal`.
  Anything changed there is `needs_review`.
- **2026-11-04: No teacher review up front.** Nisha uses the app first and asks the
  teacher about anything that looks wrong (via the flags page). So: no reviewer page
  and no reviewer role for now. Keep `needs_review` in the data, but don't show a
  prominent "not checked" label in the UI.
- **2026-11-04: Greetings.** *namaskāram* and *nandri* (Adi's Book Lesson 1) are
  greeting items. The PDF garbles those two lines, so `scripts/ingest/book.ts`
  repairs them.
- **2026-11-04: Lesson content is bundled, not stored in the database.** Since the
  content is public anyway, the app reads `data/lessons.json` directly. There's no
  `items` table to keep in sync.
- **2026-11-04: Tests run in GitHub Actions against a throwaway local Supabase**
  started from `supabase/migrations/`, so CI needs no secrets and never touches
  real users' data.
- **Open question: email for friends.** Supabase's built-in email only sends magic
  links to members of your Supabase team, a few per hour. That's fine for Nisha's
  own testing, but before inviting friends, add Google sign-in or a free SMTP
  provider (e.g. Resend).

## Data stats (2026-11-04)

1,805 items from 11 lessons plus book Lesson 1 (35 items). 107 are `needs_review`;
382 are tagged `check-register`, meaning the spoken/formal guess is unsure.
