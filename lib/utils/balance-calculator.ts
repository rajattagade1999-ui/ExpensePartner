/**
 * balance-calculator.ts - Net balance calculation (PRD Rule 2)
 *
 * Purpose: Compute who owes whom from expenses
 * Responsibilities: Equal split, custom split, correct payer handling
 * Dependencies: lib/types/expense.types
 *
 * PRD Rule 2: "Balances are calculated as total paid minus total owed per user"
 *
 * Math:
 * - totalPaid[userId] = sum of expense.amount where expense.paidBy.id === userId
 * - totalOwed[userId] = sum of split.amount where split.userId === userId
 * - balance[userId] = totalPaid[userId] - totalOwed[userId]
 * - Positive balance = user is owed money (paid more than share)
 * - Negative balance = user owes money
 *
 * @example
 * ```ts
 * const balances = calculateBalances(expenses, memberIds)
 * // { 'user-1': 50, 'user-2': -50 }
 * ```
 */

import type { Expense, Balances, Split } from '@/lib/types/expense.types'

/** Round to 2 decimals so breakdown and balances match display (avoids float drift from equal split). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Builds equal splits for an expense (equal split mode)
 *
 * Each participant owes the same share. Uses integer cents and distributes
 * remainder so sum(splits) equals amount exactly (no floating-point drift).
 *
 * @param amount - Total expense amount
 * @param participantIds - User IDs who share the expense
 * @returns Array of Split; sum of amounts equals total
 */
export function buildEqualSplits(amount: number, participantIds: string[]): Split[] {
  const n = participantIds.length
  if (n === 0) return []
  const totalCents = Math.round(amount * 100)
  const shareCents = Math.floor(totalCents / n)
  const remainder = totalCents - shareCents * n
  return participantIds.map((userId, i) => {
    const cents = shareCents + (i < remainder ? 1 : 0)
    return { userId, amount: cents / 100 }
  })
}

/**
 * Calculates net balances for all group members (PRD Rule 2)
 *
 * For each user:
 * - totalPaid = sum of amounts they paid (expense.paidBy.id === userId)
 * - totalOwed = sum of their split amounts across all expenses
 * - balance = totalPaid - totalOwed
 *
 * Equal split: splits define equal shares per participant
 * Custom split: splits define explicit amounts per participant
 * Payer handling: payer's totalPaid includes full amount; payer's totalOwed
 *   includes their share from splits (if they appear in splits)
 *
 * @param expenses - All expenses in the group
 * @param memberIds - IDs of all group members (to ensure zero balance for non-participants)
 * @returns Record of userId -> net balance (positive = owed, negative = owes)
 */
export function calculateBalances(
  expenses: Expense[],
  memberIds: string[]
): Balances {
  const balances: Balances = {}

  // Initialize all members to zero
  memberIds.forEach((id) => {
    balances[id] = 0
  })

  expenses.forEach((expense) => {
    const payerId = expense.paidBy?.id
    if (!payerId) return
    const amount = round2(expense.amount)

    // Step 1: Payer paid the full amount → increases their balance
    balances[payerId] = round2((balances[payerId] ?? 0) + amount)

    // Step 2: Each person in splits owes their amount → decreases their balance
    expense.splits.forEach((split) => {
      const oweAmount = round2(split.amount)
      balances[split.userId] = round2((balances[split.userId] ?? 0) - oweAmount)
    })
  })

  return balances
}

/**
 * Per-person settlement breakdown for one user (for "You give" / "You get").
 * - youGive[otherUserId] = how much current user owes that person (expenses they paid where current user had a split).
 * - youGet[otherUserId] = how much that person owes current user (expenses current user paid where they had a split).
 * Uses round2 so equal-split and stored amounts show consistently in the breakdown.
 */
export function getSettlementBreakdown(
  expenses: Expense[],
  currentUserId: string
): {
  totalOwed: number
  totalPaid: number
  getBack: number
  youGive: Array<{ userId: string; amount: number }>
  youGet: Array<{ userId: string; amount: number }>
} {
  let totalOwed = 0
  let totalPaid = 0
  const giveMap: Record<string, number> = {}
  const getMap: Record<string, number> = {}

  expenses.forEach((expense) => {
    const payerId = expense.paidBy?.id
    if (!payerId) return
    expense.splits.forEach((split) => {
      const amt = round2(split.amount)
      if (split.userId === currentUserId) {
        totalOwed += amt
        if (payerId !== currentUserId) {
          giveMap[payerId] = round2((giveMap[payerId] ?? 0) + amt)
        }
      }
      if (payerId === currentUserId && split.userId !== currentUserId) {
        getMap[split.userId] = round2((getMap[split.userId] ?? 0) + amt)
      }
    })
    if (payerId === currentUserId) totalPaid += round2(expense.amount)
  })

  const youGive = Object.entries(giveMap)
    .filter(([, amt]) => amt > 0)
    .map(([userId, amount]) => ({ userId, amount: round2(amount) }))
  const youGet = Object.entries(getMap)
    .filter(([, amt]) => amt > 0)
    .map(([userId, amount]) => ({ userId, amount: round2(amount) }))

  totalOwed = round2(totalOwed)
  totalPaid = round2(totalPaid)
  const getBack = round2(Math.max(0, totalPaid - totalOwed))

  return { totalOwed, totalPaid, getBack, youGive, youGet }
}
