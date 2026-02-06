-- Migration: Groups, group_members, profiles (Phase 4)
-- Run manually via Supabase SQL Editor.
--
-- Enables: persist groups, membership, join by code; RLS for group-scoped access.

-- Profiles: user display info (populated on login)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'User',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can upsert own profile"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Groups: id, name, code (for join), created_by
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_groups_code on public.groups (code);

alter table public.groups enable row level security;

create policy "Members can read groups they belong to"
  on public.groups for select
  using (
    id in (select group_id from public.group_members where user_id = auth.uid())
    or created_by = auth.uid()
  );

create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

-- group_members: many-to-many
create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, user_id)
);

alter table public.group_members enable row level security;

create policy "Members can read group_members of their groups"
  on public.group_members for select
  using (
    group_id in (select group_id from public.group_members where user_id = auth.uid())
  );

-- All group_members inserts go through create_group / join_group_by_code RPCs (SECURITY DEFINER)
create policy "Group creator can add members"
  on public.group_members for insert
  with check (
    exists (select 1 from public.groups where id = group_id and created_by = auth.uid())
  );

-- Drop existing RPCs so we can recreate with correct return type (jsonb); avoids 42P13 on re-run
drop function if exists public.create_group(text);
drop function if exists public.join_group_by_code(text);
drop function if exists public.get_user_groups();

-- RPC: create_group(name) - creates group, adds creator to group_members, returns group with members
create or replace function public.create_group(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_group_id uuid;
  v_user_id uuid := auth.uid();
  v_user_record record;
  v_members jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Generate unique 6-char code
  v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.groups (name, code, created_by)
  values (p_name, v_code, v_user_id)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id);

  -- Upsert creator into profiles for member display
  insert into public.profiles (id, name)
  select v_user_id, coalesce(
    (select name from public.profiles where id = v_user_id),
    coalesce(
      nullif(split_part((select email from auth.users where id = v_user_id), '@', 1), ''),
      'User'
    )
  )
  on conflict (id) do update set updated_at = now();

  -- Build members array from profiles
  select jsonb_agg(
    jsonb_build_object('id', p.id::text, 'name', p.name, 'email', p.email)
  ) into v_members
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  where gm.group_id = v_group_id;

  return jsonb_build_object(
    'id', v_group_id,
    'name', p_name,
    'code', v_code,
    'members', coalesce(v_members, '[]'::jsonb)
  );
end;
$$;

-- RPC: join_group_by_code(p_code text) - adds user to group, returns group with members
create or replace function public.join_group_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_user_id uuid := auth.uid();
  v_members jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_group_id
  from public.groups
  where upper(trim(code)) = upper(trim(p_code))
  limit 1;

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  -- Upsert joiner into profiles
  insert into public.profiles (id, name)
  select v_user_id, coalesce(
    (select name from public.profiles where id = v_user_id),
    coalesce(
      nullif(split_part((select email from auth.users where id = v_user_id), '@', 1), ''),
      'User'
    )
  )
  on conflict (id) do update set updated_at = now();

  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'code', g.code,
    'members', (
      select coalesce(jsonb_agg(
        jsonb_build_object('id', p.id::text, 'name', p.name, 'email', p.email)
      ), '[]'::jsonb)
      from public.group_members gm
      join public.profiles p on p.id = gm.user_id
      where gm.group_id = g.id
    )
  ) into v_members
  from public.groups g
  where g.id = v_group_id;

  return v_members;
end;
$$;

-- Update expenses RLS: access only via group membership
drop policy if exists "Allow all for MVP (no auth)" on public.expenses;
drop policy if exists "Members can read expenses of their groups" on public.expenses;
drop policy if exists "Members can insert expenses into their groups" on public.expenses;
drop policy if exists "Members can delete expenses from their groups" on public.expenses;

create policy "Members can read expenses of their groups"
  on public.expenses for select
  using (
    group_id::uuid in (select group_id from public.group_members where user_id = auth.uid())
  );

create policy "Members can insert expenses into their groups"
  on public.expenses for insert
  with check (
    group_id::uuid in (select group_id from public.group_members where user_id = auth.uid())
  );

create policy "Members can delete expenses from their groups"
  on public.expenses for delete
  using (
    group_id::uuid in (select group_id from public.group_members where user_id = auth.uid())
  );

-- RPC: get_user_groups() - returns all groups the current user belongs to, with members
create or replace function public.get_user_groups()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(g_with_members), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', g.id::text,
      'name', g.name,
      'code', g.code,
      'members', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id', p.id::text, 'name', coalesce(p.name, 'User'), 'email', p.email)
        ), '[]'::jsonb)
        from public.group_members gm
        left join public.profiles p on p.id = gm.user_id
        where gm.group_id = g.id
      )
    ) as g_with_members
    from public.groups g
    where g.id in (select group_id from public.group_members where user_id = v_user_id)
  ) sub;

  return v_result;
end;
$$;
