'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppContext } from '@/context/app-context'

export default function ExpenseFeed() {
  const { expenses, user } = useAppContext()

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-5xl mb-4">✨</div>
        <p className="font-medium text-slate-900">No expenses yet</p>
        <p className="text-sm text-muted-foreground">Tap the + button to add one</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 divide-y divide-slate-100">
      {expenses.map((expense) => (
        <div key={expense.id} className="flex items-center gap-4 py-4 px-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm font-semibold">
              {expense.paidBy.name[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{expense.title}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(expense.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
          <p className="font-mono font-semibold text-sm">₹{expense.amount.toFixed(2)}</p>
        </div>
      ))}
    </div>
  )
}
