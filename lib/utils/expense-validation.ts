/**
 * expense-validation.ts - Validation for expense creation (PRD edge cases)
 *
 * Purpose: Enforce PRD edge case handling (Section 7)
 * Responsibilities: Validate amounts, empty expense, split totals
 * Dependencies: lib/types/expense.types
 *
 * Edge cases handled:
 * - Empty expense (no amount)
 * - Negative amounts
 * - Custom split mismatch (sum !== total)
 *
 * @example
 * ```ts
 * const result = validateExpenseInput({ amount: 100, splits: [...] })
 * if (!result.valid) {
 *   toast.error(result.error)
 *   return
 * }
 * ```
 */

import type { Split } from '@/lib/types/expense.types'

/** Tolerance for float comparison (split sum vs amount) */
const FLOAT_EPSILON = 0.01

/**
 * Validates expense amount (PRD: prevent negative values)
 *
 * @param amount - Raw amount value
 * @returns Object with valid flag and optional error message
 */
export function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' }
  }
  if (!Number.isFinite(amount)) {
    return { valid: false, error: 'Amount must be a valid number' }
  }
  return { valid: true }
}

/**
 * Validates expense is not empty (PRD Edge Case 2)
 *
 * @param amount - Expense amount (0 or empty = invalid)
 * @param title - Expense title (optional, empty string allowed for "Expense" default)
 * @returns Object with valid flag and optional error message
 */
export function validateNotEmpty(
  amount: number,
  title?: string
): { valid: boolean; error?: string } {
  if (amount === 0 || amount === undefined || amount === null) {
    return { valid: false, error: 'Please enter an amount' }
  }
  return { valid: true }
}

/**
 * Validates custom split totals (PRD Edge Case 1)
 *
 * Splits must sum to the total amount (within float tolerance).
 * Prevents save when custom split doesn't equal total.
 *
 * @param amount - Total expense amount
 * @param splits - Array of { userId, amount }
 * @returns Object with valid flag and optional error message
 */
export function validateSplitTotals(
  amount: number,
  splits: Split[]
): { valid: boolean; error?: string } {
  const sum = splits.reduce((acc, s) => acc + s.amount, 0)
  const diff = Math.abs(sum - amount)

  if (diff > FLOAT_EPSILON) {
    return {
      valid: false,
      error: `Split total (₹${sum.toFixed(2)}) must equal expense amount (₹${amount.toFixed(2)})`,
    }
  }

  // Each split amount must be non-negative
  const hasNegative = splits.some((s) => s.amount < 0)
  if (hasNegative) {
    return { valid: false, error: 'Split amounts cannot be negative' }
  }

  return { valid: true }
}

/**
 * Combined validation for expense creation
 *
 * Runs all validations in order:
 * 1. Not empty
 * 2. Positive amount
 * 3. Split totals (for custom split)
 *
 * @param params - Expense input params
 * @returns Object with valid flag and first error message if invalid
 */
export function validateExpenseInput(params: {
  amount: number
  splitType: 'equal' | 'custom'
  splits: Split[]
}): { valid: boolean; error?: string } {
  const { amount, splitType, splits } = params

  const notEmpty = validateNotEmpty(amount)
  if (!notEmpty.valid) return notEmpty

  const amountOk = validateAmount(amount)
  if (!amountOk.valid) return amountOk

  if (splitType === 'custom') {
    const splitsOk = validateSplitTotals(amount, splits)
    if (!splitsOk.valid) return splitsOk
  }

  return { valid: true }
}
