/**
 * expense.types.ts - Domain types for expense tracking (PRD-aligned)
 *
 * Purpose: Define Expense, Split, User, Group, and Balance types per PRD Section 5
 * Responsibilities: Type safety, PRD data model compliance
 * Dependencies: None (pure types)
 *
 * @example
 * ```ts
 * const expense: Expense = {
 *   id: '1',
 *   title: 'Groceries',
 *   amount: 100,
 *   paidBy: 'user-1',
 *   splitType: 'equal',
 *   splits: [{ userId: 'user-2', amount: 50 }],
 *   createdAt: new Date()
 * }
 * ```
 */

/** PRD Model 1: User - id, name, createdAt */
export interface User {
  id: string
  name: string
  email?: string
  createdAt?: Date
}

/** PRD Model 3: Group - id, name, members, createdBy (admin) */
export interface Group {
  id: string
  name: string
  code: string
  members: User[]
  /** User id of the room creator (admin). Only admin can remove members. */
  createdBy?: string
}

/**
 * Split - One person's share of an expense.
 * PRD: "splits (array of userId + amount)"
 *
 * Each split means: this userId owes this amount toward the expense.
 * Sum of all split amounts must equal expense.amount.
 */
export interface Split {
  userId: string
  amount: number
}

/**
 * SplitType - How the expense is divided.
 * PRD enum: equal | custom
 */
export type SplitType = 'equal' | 'custom'

/**
 * Expense - PRD Model 2
 *
 * Fields:
 * - id, title, amount, paidBy (userId), splitType, splits, createdAt
 *
 * Balance semantics:
 * - paidBy paid the full amount
 * - splits define who owes what (each split.userId owes split.amount)
 * - Sum(splits[].amount) must equal amount
 */
export interface Expense {
  id: string
  title: string
  amount: number
  paidBy: User
  splitType: SplitType
  splits: Split[]
  createdAt: Date
}

/**
 * Balance - Net amount per user (PRD Rule 2)
 *
 * balance[userId] = totalPaid - totalOwed
 * - Positive: user is owed money (they paid more than their share)
 * - Negative: user owes money
 * - Zero: settled
 */
export type Balances = Record<string, number>

/** Input for creating an expense (id and createdAt are generated) */
export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt'>
