-- Phase 3 (spec 001): chat with Laddu.
--
-- Three new private tables (conversations → messages → scores), a database
-- function that counts messages against the daily cap, and a link from flags to
-- the chat message they're about. Deleting a conversation deletes its messages
-- and scores too ("on delete cascade").
--
-- To update the hosted project, paste this file into Supabase's SQL Editor and Run.

-- ─── Conversations ──────────────────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_by text not null check (started_by in ('me', 'laddu')),
  situation text,                      -- key from the situations list when Laddu starts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_updated on public.conversations (user_id, updated_at desc);

-- ─── Messages ───────────────────────────────────────────────────────────────
-- role 'me' = what I typed; role 'laddu' = Laddu's reply (Tanglish + English).
-- A "try again" attempt is a 'me' message whose retry_of points at the original.
create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('me', 'laddu')),
  text text not null check (char_length(text) between 1 and 2000),
  english text check (char_length(english) <= 2000),
  meant text check (char_length(meant) <= 2000),       -- "That's not what I meant"
  retry_of bigint references public.messages (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index messages_conversation on public.messages (conversation_id, id);

-- ─── Scores (one correction card per 'me' message) ──────────────────────────
-- grammar/spoken/total are null for all-English or safety messages (no score).
create table public.scores (
  id bigint generated always as identity primary key,
  message_id bigint not null unique references public.messages (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  grammar smallint check (grammar between 0 and 6),
  spoken smallint check (spoken between 0 and 4),
  total smallint check (total between 0 and 10),
  mistake_types text[] not null default '{}',
  card jsonb not null,                 -- everything the card shows (no Tamil script)
  prompt_version text not null,
  model text not null,
  created_at timestamptz not null default now(),
  check ((grammar is null and spoken is null and total is null)
      or (grammar is not null and spoken is not null and total = grammar + spoken))
);

-- ─── Privacy rules ──────────────────────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.scores enable row level security;
revoke all on public.conversations, public.messages, public.scores from anon;

create policy "own rows" on public.conversations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Also checks the conversation is yours, so nobody can slip a message into
-- someone else's chat.
create policy "own rows" on public.messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())));

create policy "own rows" on public.scores for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.messages m
    where m.id = message_id and m.user_id = (select auth.uid())));

-- ─── Daily cap ──────────────────────────────────────────────────────────────
-- Adds one to today's chat count for the signed-in user (today in their own
-- timezone) and returns the new count, or -1 if they've already reached p_cap
-- (nothing is added then). Runs with the owner's rights because users can't
-- write usage_daily directly; it only ever touches the caller's own row.
create function public.bump_chat_usage(p_cap integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date;
  n integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select (now() at time zone coalesce(p.timezone, 'UTC'))::date into today
    from public.profiles p where p.id = uid;
  today := coalesce(today, (now() at time zone 'UTC')::date);

  insert into public.usage_daily (user_id, day, chat_messages)
    values (uid, today, 0)
    on conflict (user_id, day) do nothing;
  update public.usage_daily set chat_messages = chat_messages + 1
    where user_id = uid and day = today and chat_messages < p_cap
    returning chat_messages into n;
  return coalesce(n, -1);
end;
$$;
revoke execute on function public.bump_chat_usage(integer) from public, anon;
grant execute on function public.bump_chat_usage(integer) to authenticated;

-- ─── Flags from chat ────────────────────────────────────────────────────────
-- For a chat flag: tanglish = the better way, english = what I typed, and
-- message_id links to the card (its score is in scores).
alter table public.flags
  add column message_id bigint references public.messages (id) on delete set null;
