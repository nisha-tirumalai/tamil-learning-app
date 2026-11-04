-- Milestone 2: invite allowlist, per-user tables, and row-level security (RLS).
--
-- RLS in one sentence: Postgres checks every row a user tries to read or write
-- against the table's policies, so even if the app has a bug (or someone calls
-- the API directly with their login), they only ever touch their own rows.
--
-- To set up the hosted project, paste this whole file into Supabase's SQL Editor
-- and click Run (see docs/SUPABASE_SETUP.md).

-- ─── Allowlist ──────────────────────────────────────────────────────────────
-- Emails allowed to sign up. RLS is on with no policies, so no signed-in user
-- can read or change it; Nisha edits it in the Table Editor (which bypasses RLS).
create table public.allowlist (
  email text primary key check (email = lower(email)),
  note text,
  added_at timestamptz not null default now()
);
alter table public.allowlist enable row level security;

-- Supabase Auth calls this before creating any user ("Before User Created" hook).
-- Returning an error object blocks the sign-up.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer          -- runs with the owner's rights so it can read the allowlist
set search_path = ''
as $$
declare
  user_email text := lower(event -> 'user' ->> 'email');
begin
  if user_email is not null
     and exists (select 1 from public.allowlist where email = user_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This app is invite-only. Ask Nisha to add your email.'));
end;
$$;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ─── Profiles ───────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  voice text not null default 'female' check (voice in ('female', 'male')),
  pace text not null default 'normal' check (pace in ('slow', 'normal')),
  timezone text not null default 'UTC',
  share_streak boolean not null default false,   -- social features are opt-in
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- Users may change their settings, but not is_admin.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, voice, pace, timezone, share_streak) on public.profiles to authenticated;

-- Make a profile automatically when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Per-user tables ────────────────────────────────────────────────────────
-- Each has user_id defaulting to the signed-in user, and the same rule:
-- you can only see and change rows where user_id is you.

-- Spaced-repetition state per card (milestone 3).
create table public.card_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null,
  state jsonb not null,           -- the FSRS card (due date, stability, difficulty, ...)
  due timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Every answer given (milestone 3). Drives the "words to review" list.
create table public.review_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null,
  rating smallint not null check (rating between 1 and 4),   -- again / hard / good / easy
  reviewed_at timestamptz not null default now()
);

-- One row per day practiced (milestone 4). Drives the streak.
create table public.daily_activity (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  minutes smallint not null default 0,
  primary key (user_id, day)
);

-- "This looks wrong" reports. english/tanglish are a snapshot, so the flag
-- still makes sense if the lesson data changes later.
create table public.flags (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null,
  english text not null,
  tanglish text not null,
  note text check (char_length(note) <= 1000),
  source text not null default 'card' check (source in ('card', 'chat')),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['card_state', 'review_log', 'daily_activity', 'flags'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
                     using (user_id = (select auth.uid()))
                     with check (user_id = (select auth.uid()))$p$, t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
create index flags_user_created on public.flags (user_id, created_at desc);
create index card_state_due on public.card_state (user_id, due);

-- Chat and speech-to-text counts for the daily cap (milestone 7). Users can read
-- their own counts; only the server (with the secret key) can write them.
create table public.usage_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  chat_messages integer not null default 0,
  stt_seconds integer not null default 0,
  primary key (user_id, day)
);
alter table public.usage_daily enable row level security;
create policy "read own usage" on public.usage_daily
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.usage_daily from anon, authenticated;
