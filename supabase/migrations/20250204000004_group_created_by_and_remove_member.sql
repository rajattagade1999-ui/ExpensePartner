-- Add createdBy to group responses; RPC for remove member / leave room.
-- Run each block separately in Supabase SQL Editor if one-shot run fails.
-- Use tagged $tag$ so multiple functions parse correctly.

-- 1) get_user_groups: include created_by as createdBy
create or replace function public.get_user_groups()
returns jsonb
language plpgsql
security definer
set search_path = public
as $get_user_groups$
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
      'id', grp.id::text,
      'name', grp.name,
      'code', grp.code,
      'createdBy', grp.created_by::text,
      'members', (
        select coalesce(jsonb_agg(
          jsonb_build_object('id', p.id::text, 'name', coalesce(p.name, 'User'), 'email', p.email)
        ), '[]'::jsonb)
        from public.group_members gm
        left join public.profiles p on p.id = gm.user_id
        where gm.group_id = grp.id
      )
    ) as g_with_members
    from (
      select g.id, g.name, g.code, g.created_by
      from public.groups g
      where g.id in (select group_id from public.group_members where user_id = v_user_id)
    ) grp
  ) sub;

  return v_result;
end;
$get_user_groups$;

-- 2) create_group: return createdBy in response
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
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

-- 3) join_group_by_code: return createdBy in response
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

-- 4) remove_member_from_group: creator can remove any member; any member can remove themselves (leave)
create or replace function public.remove_member_from_group(p_group_id uuid, p_member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $remove_member$
declare
  v_current uuid := auth.uid();
  v_creator uuid;
begin
  if v_current is null then
    raise exception 'Not authenticated';
  end if;

  select created_by into v_creator from public.groups where id = p_group_id;
  if v_creator is null then
    raise exception 'Group not found';
  end if;

  if v_current <> p_member_user_id and v_current <> v_creator then
    raise exception 'Only the room creator can remove other members';
  end if;

  delete from public.group_members
  where group_id = p_group_id and user_id = p_member_user_id;
end;
$remove_member$;
