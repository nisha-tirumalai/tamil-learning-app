-- Spec 003: talk to Laddu (voice).
--
-- 1. Three new columns on messages:
--    - tamil:  Laddu's reply in Tamil script, made with the reply, read only by
--              his voice. It is never sent to the screen.
--    - heard:  for a spoken message, what the hearing service heard (in Tanglish),
--              kept even after I fix the text, so we can see how often it mishears.
--    - spoken: true if I said it out loud, false if I typed it.
-- 2. A private log of every call to an outside service (Claude, ElevenLabs,
--    Azure): which service, which job, how long, how big, roughly how much it
--    cost, and any error. No chat text and no audio, ever. The app can add rows
--    for the signed-in person; only an admin can read them (the dashboard is phase 7).
--
-- To update the hosted project, paste this file into Supabase's SQL Editor and Run.

-- ─── Messages ───────────────────────────────────────────────────────────────
alter table public.messages
  add column tamil text check (char_length(tamil) <= 4000),
  add column heard text check (char_length(heard) <= 2000),
  add column spoken boolean not null default false;

-- ─── The call log ───────────────────────────────────────────────────────────
create table public.api_calls (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service text not null check (service in ('claude', 'elevenlabs', 'azure')),
  job text not null check (char_length(job) <= 40),     -- score, reply, opener, tanglish, hearing, voice…
  model text check (char_length(model) <= 100),         -- model or voice
  ms_first integer,                                     -- until the first piece arrived (streamed calls)
  ms_total integer,                                     -- until it finished
  input_tokens integer,
  output_tokens integer,
  characters integer,                                   -- text sent to a voice
  audio_seconds numeric(8, 2),                          -- audio sent to hearing
  cost_usd numeric(12, 6),                              -- estimate, from the prices in the config
  ok boolean not null,
  error text check (char_length(error) <= 300)
);
create index api_calls_created on public.api_calls (created_at desc);

alter table public.api_calls enable row level security;
revoke all on public.api_calls from anon;

create policy "add own rows" on public.api_calls for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "admins read" on public.api_calls for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin));
-- No update or delete policies: rows can't be changed once written.
