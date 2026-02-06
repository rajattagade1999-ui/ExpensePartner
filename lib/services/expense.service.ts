/**
 * expense.service.ts - Supabase CRUD for expenses
 *
 * Purpose: Persist expenses to Supabase; load, create, delete
 * Responsibilities: Map domain Expense ↔ DB row; handle JSONB for paidBy/splits
 * Dependencies: lib/supabase/client, lib/types/expense.types
 *
 * Data flow: AppContext calls these functions → Supabase → AppContext updates state
 *
 * @example
 * ```ts
 * const expenses = await loadExpenses(roomId)
 * const ok = await createExpense(roomId, input)
 * await deleteExpense(id)
 * ```
 */

import { supabase } from '@/lib/supabase/client'
import type { Expense, CreateExpenseInput, User, Split } from '@/lib/types/expense.types'

/** DB row shape (snake_case) */
interface ExpenseRow {
  id: string
  group_id: string
  title: string
  amount: number
  paid_by: unknown
  split_type: string
  splits: unknown
  created_at: string
}

/** Round to 2 decimals to avoid float drift in splits (equal split, display, breakdown). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Maps DB row → domain Expense (paidBy/splits from JSONB). Normalizes split amounts to 2 decimals. */
function rowToExpense(row: ExpenseRow): Expense {
  const paidBy = row.paid_by as User
  const rawSplits = (row.splits as Split[]) ?? []
  const splits = rawSplits.map((s) => ({
    userId: s.userId,
    amount: round2(Number(s.amount)),
  }))
  return {
    id: row.id,
    title: row.title,
    amount: round2(Number(row.amount)),
    paidBy,
    splitType: row.split_type as 'equal' | 'custom',
    splits,
    createdAt: new Date(row.created_at),
  }
}

/**
 * Load all expenses for a group from Supabase
 *
 * Data flow: Supabase expenses table → rows → map to Expense[] → return to context
 *
 * @param groupId - Room/group ID to filter by
 * @returns Array of Expense, or [] on error
 */
export async function loadExpenses(groupId: string): Promise<Expense[]> {
  const { data } = await supabase
    .from('expenses')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .throwOnError()

  return (data ?? []).map((row) => rowToExpense(row as ExpenseRow))
}

/**
 * Create a new expense in Supabase
 *
 * Data flow: CreateExpenseInput → DB row (paidBy/splits as JSONB) → insert → return success
 *
 * @param groupId - Room/group ID
 * @param input - Expense input (validated by caller)
 * @returns Created Expense or null on error
 */
export async function createExpense(
  groupId: string,
  input: CreateExpenseInput
): Promise<Expense | null> {
  const row = {
    group_id: groupId,
    title: input.title,
    amount: input.amount,
    paid_by: input.paidBy,
    split_type: input.splitType,
    splits: input.splits,
  }

  const { data } = await supabase
    .from('expenses')
    .insert(row)
    .select()
    .single()
    .throwOnError()

  return rowToExpense(data as ExpenseRow)
}

/**
 * Delete an expense from Supabase
 *
 * @param id - Expense ID (UUID)
 * @returns true if deleted, false on error
 */
export async function deleteExpense(id: string): Promise<boolean> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)

  if (error) {
    console.error('[expense.service] deleteExpense error:', error)
    return false
  }

  return true
}
