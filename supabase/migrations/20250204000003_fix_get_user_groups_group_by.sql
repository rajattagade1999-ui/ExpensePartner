-- Fix: get_user_groups() "column g.created_at must appear in the GROUP BY clause"
-- Build result from explicit columns only (id, name, code) so no extra table columns are referenced.
-- Run this in Supabase Dashboard → SQL Editor (copy the SQL below, not the file path).

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
      'id', grp.id::text,
      'name', grp.name,
      'code', grp.code,
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
      select g.id, g.name, g.code
      from public.groups g
      where g.id in (select group_id from public.group_members where user_id = v_user_id)
    ) grp
  ) sub;

  return v_result;
end;
$$;
