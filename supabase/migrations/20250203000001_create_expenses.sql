-- Migration: Create expenses table (aligned with Expense + Split types)
-- Run via Supabase Dashboard SQL editor or: supabase db push
--
-- Schema matches lib/types/expense.types.ts:
--   Expense: id, title, amount, paidBy, splitType, splits, createdAt
--   paidBy stored as JSONB (User object: id, name, email?)
--   splits stored as JSONB (Split[]: [{ userId, amount }])

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  title text not null,
  amount numeric not null check (amount > 0),
  paid_by jsonb not null,
  split_type text not null check (split_type in ('equal', 'custom')),
  splits jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_group_id on public.expenses (group_id);
create index if not exists idx_expenses_created_at on public.expenses (created_at desc);

-- Allow anonymous read/write for MVP (no auth yet)
-- Phase 2: temporary open access; RLS can be added later with auth
alter table public.expenses enable row level security;

create policy "Allow all for MVP (no auth)"
  on public.expenses
  for all
  using (true)
  with check (true);
