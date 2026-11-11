-- Spec 003: choose your avatar (girl or guy).
--
-- Empty (null) means "not chosen yet": the home screen then shows
-- "Choose your avatar" first. You can change it later in Settings.
--
-- To update the hosted project, paste this file into Supabase's SQL Editor and Run.

alter table public.profiles
  add column avatar text check (avatar in ('girl', 'guy'));

-- Users may change their own avatar (row-level security still limits it to their own row).
grant update (avatar) on public.profiles to authenticated;
