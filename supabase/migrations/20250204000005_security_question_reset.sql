-- Security question for password reset (no email needed).
-- Profiles: add secret_question + secret_answer_hash.
-- RPCs: set_security_qa (store), get_security_question (fetch by email).

create extension if not exists pgcrypto;

-- Add columns to profiles (run after profiles table exists)
alter table public.profiles
  add column if not exists secret_question text,
  add column if not exists secret_answer_hash text;

-- RPC: set security question and hashed answer for current user
create or replace function public.set_security_qa(p_question text, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $set_qa$
declare
  v_user_id uuid := auth.uid();
  v_hash text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_question is null or trim(p_question) = '' or p_answer is null or trim(p_answer) = '' then
    raise exception 'Question and answer are required';
  end if;

  -- Hash answer (lowercase, trimmed) with SHA-256
  v_hash := encode(digest(lower(trim(p_answer)), 'sha256'), 'hex');

  update public.profiles
  set secret_question = trim(p_question),
      secret_answer_hash = v_hash,
      updated_at = now()
  where id = v_user_id;
end;
$set_qa$;

-- RPC: get security question for an email (for password recovery flow)
create or replace function public.get_security_question(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $get_q$
declare
  v_user_id uuid;
  v_question text;
begin
  if p_email is null or trim(p_email) = '' then
    return null;
  end if;

  select id into v_user_id
  from auth.users
  where lower(trim(email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  select secret_question into v_question
  from public.profiles
  where id = v_user_id;

  return v_question;
end;
$get_q$;

-- RPC: verify security answer and return user id (for server-side password update)
-- Called only from backend with service role; not exposed to client.
create or replace function public.verify_security_answer(p_email text, p_answer text)
returns uuid
language plpgsql
security definer
set search_path = public
as $verify$
declare
  v_user_id uuid;
  v_hash text;
  v_stored_hash text;
begin
  if p_email is null or trim(p_email) = '' or p_answer is null then
    return null;
  end if;

  select u.id, p.secret_answer_hash into v_user_id, v_stored_hash
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(trim(u.email)) = lower(trim(p_email))
  limit 1;

  if v_user_id is null or v_stored_hash is null then
    return null;
  end if;

  v_hash := encode(digest(lower(trim(p_answer)), 'sha256'), 'hex');
  if v_hash <> v_stored_hash then
    return null;
  end if;

  return v_user_id;
end;
$verify$;
