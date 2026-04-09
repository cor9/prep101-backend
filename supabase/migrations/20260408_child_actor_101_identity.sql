create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  role text check (role in ('actor', 'parent', 'both')),
  default_view text check (default_view in ('actor', 'parent')),
  active_actor_id uuid,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.actor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_name text not null,
  age_range text,
  is_child boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_active_actor_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_active_actor_id_fkey
      foreign key (active_actor_id)
      references public.actor_profiles(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_actor_profiles_user_id
  on public.actor_profiles (user_id, sort_order, created_at);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_profiles_updated_at'
  ) then
    create trigger set_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.set_current_timestamp_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'set_actor_profiles_updated_at'
  ) then
    create trigger set_actor_profiles_updated_at
    before update on public.actor_profiles
    for each row
    execute function public.set_current_timestamp_updated_at();
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.actor_profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own"
    on public.profiles
    for select
    using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
    on public.profiles
    for insert
    with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_profiles' and policyname = 'actor_profiles_select_own'
  ) then
    create policy "actor_profiles_select_own"
    on public.actor_profiles
    for select
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_profiles' and policyname = 'actor_profiles_insert_own'
  ) then
    create policy "actor_profiles_insert_own"
    on public.actor_profiles
    for insert
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_profiles' and policyname = 'actor_profiles_update_own'
  ) then
    create policy "actor_profiles_update_own"
    on public.actor_profiles
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'actor_profiles' and policyname = 'actor_profiles_delete_own'
  ) then
    create policy "actor_profiles_delete_own"
    on public.actor_profiles
    for delete
    using (auth.uid() = user_id);
  end if;
end;
$$;
