-- Only the expense payer (paid_by) can delete that expense. Other room members cannot delete each other's expenses.

drop policy if exists "Members can delete expenses from their groups" on public.expenses;

create policy "Only payer can delete own expense"
  on public.expenses for delete
  using (
    (paid_by->>'id') = auth.uid()::text
  );
