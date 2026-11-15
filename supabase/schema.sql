-- NutriMe cloud sync. Paste this into Supabase > SQL Editor and press Run (once).
-- One row per list or setting (meals, check-ins, health, Move, Mind, to-dos, targets...).
create table if not exists public.user_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null check (char_length(key) <= 64),
  value jsonb,
  updated_at bigint not null,
  primary key (user_id, key)
);

-- Row-level security: every account can only see and change its own rows.
alter table public.user_data enable row level security;

drop policy if exists "read own data" on public.user_data;
drop policy if exists "add own data" on public.user_data;
drop policy if exists "change own data" on public.user_data;
drop policy if exists "delete own data" on public.user_data;
create policy "read own data"   on public.user_data for select to authenticated using (auth.uid() = user_id);
create policy "add own data"    on public.user_data for insert to authenticated with check (auth.uid() = user_id);
create policy "change own data" on public.user_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own data" on public.user_data for delete to authenticated using (auth.uid() = user_id);

-- Nobody signed out can touch the table at all.
revoke all on public.user_data from anon;
grant select, insert, update, delete on public.user_data to authenticated;
