-- Fix: infinite recursion in group_members RLS policy
-- The previous policy referenced group_members in its own USING clause, causing recursion.
-- Users only need to read their own membership rows (user_id = auth.uid()).

drop policy if exists "Members can read group_members of their groups" on public.group_members;

create policy "Users can read own memberships"
  on public.group_members for select
  using (user_id = auth.uid());
