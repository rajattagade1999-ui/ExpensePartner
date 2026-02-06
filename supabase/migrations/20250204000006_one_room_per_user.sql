-- One room per user: a user can only create one room OR join one room (not both, not multiple).
-- Enforced by: unique index on group_members(user_id) + checks in create_group and join_group_by_code.

-- 1) Ensure each user can be in at most one group
create unique index if not exists idx_group_members_one_group_per_user
  on public.group_members (user_id);

-- 2) create_group: reject if user is already in a group
create or replace function public.create_group(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $create_group$
declare
  v_code text;
  v_group_id uuid;
  v_user_id uuid := auth.uid();
  v_members jsonb := '[]'::jsonb;
  v_existing_group_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select group_id into v_existing_group_id
  from public.group_members
  where user_id = v_user_id
  limit 1;

  if v_existing_group_id is not null then
    raise exception 'You can only be in one room. Leave your current room first to create a new one.';
  end if;

  v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));

  insert into public.groups (name, code, created_by)
  values (p_name, v_code, v_user_id)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, v_user_id);

  insert into public.profiles (id, name)
  select v_user_id, coalesce(
    (select name from public.profiles where id = v_user_id),
    coalesce(
      nullif(split_part((select email from auth.users where id = v_user_id), '@', 1), ''),
      'User'
    )
  )
  on conflict (id) do update set updated_at = now();

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
    'createdBy', v_user_id::text,
    'members', coalesce(v_members, '[]'::jsonb)
  );
end;
$create_group$;

-- 3) join_group_by_code: reject if user is already in a group
create or replace function public.join_group_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $join_group$
declare
  v_group_id uuid;
  v_user_id uuid := auth.uid();
  v_members jsonb;
  v_existing_group_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select group_id into v_existing_group_id
  from public.group_members
  where user_id = v_user_id
  limit 1;

  if v_existing_group_id is not null then
    raise exception 'You can only be in one room. Leave your current room first to join another.';
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
    'createdBy', g.created_by::text,
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
$join_group$;
