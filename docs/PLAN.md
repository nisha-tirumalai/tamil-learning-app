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

## Where we are (2026-11-07)

- **Phase 2 (login): done.** Running in Codespaces; 18/18 tests pass there
  (`npm test` + `npm run test:db`); Nisha logged in on her phone through the
  forwarded port. Real Supabase project created (migration run, allowlist has
  nisha.tirumalai@gmail.com, Before User Created hook on, URL config set to the
  codespace address), keys in Codespaces secrets.
- **CI:** the type-check failed on `tests/rls.test.ts` (literal row types vs the
  untyped Supabase client); fixed 2026-11-07. Confirm the Actions run is green.
- **Next:** finish spec 001 (Chat v1): six open questions, then Nisha approves.
  Phase 3 also needs an Anthropic API key as a Codespaces secret (`ANTHROPIC_API_KEY`).
- **Small follow-ups:** switch login from a magic link to a 6-digit email code
  (links only work in the browser that asked for them, and an installed PWA on
  iPhone has its own storage, so links won't work there); explicit grants (below).
- **Codespace housekeeping:** stop it when not in use (free hours), and set port
  3000 back to Private when not testing on the phone. If the codespace is ever
  recreated, its address changes: update Supabase → Authentication → URL Configuration.

## Phases (mirrors SCOPING.md §10; SCOPING wins if they differ)

| Phase | What | Status | Spec |
|---|---|---|---|
| 0 | Goals + scoping doc | 🟨 | [SCOPING.md](SCOPING.md) |
| 1 | Lesson data pipeline | ✅ | (before specs) |
| 2 | Login + private per-user data | ✅ 2026-11-07 | (before specs) |
| 3 | **Chat v1:** welcome screen → "who starts?" → correction + score /10 + try again + continue | ⬜ spec drafted | [001](specs/001-chat-v1.md) |
| 4 | **Rubric + gold set + evals:** 40 scored messages, eval script, compare 2–3 models | ⬜ | |
| 5 | **Speak:** speech-to-text in, Tamil voice out, 🔊/🔇 toggle, switch Speak ↔ Chat | ⬜ | |
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

## Data stats (2026-11-04)

1,805 items from 11 lessons plus book Lesson 1 (35 items). 107 are `needs_review`;
382 are tagged `check-register`.
