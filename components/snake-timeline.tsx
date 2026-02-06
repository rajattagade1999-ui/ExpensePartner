'use client'

import { useState } from 'react'
import { useAppContext } from '@/context/app-context'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface SnakeNode {
  id: string
  title: string
  amount: number
  date: Date
  time: string
  description: string
  paidBy: { id: string; name: string }
  userColor: string
}

export default function SnakeTimeline() {
  const { expenses, room, user, removeExpense } = useAppContext()
  const [openNodeId, setOpenNodeId] = useState<string | null>(null)

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">🐍</div>
        <p className="font-mono font-medium">No moves yet</p>
        <p className="text-xs text-muted-foreground">
          Add your first expense to start the snake
        </p>
      </div>
    )
  }

  // Map users to consistent colors
  const userColorMap: Record<string, string> = {}
  room?.members.forEach((member, idx) => {
    if (member.id === user?.id) {
      userColorMap[member.id] = 'bg-violet-500'
    } else {
      userColorMap[member.id] = 'bg-emerald-500'
    }
  })

  // Sort by date (newest first for snake to flow down)
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const nodes: SnakeNode[] = sortedExpenses.map((expense) => {
    const expenseDate = new Date(expense.createdAt)
    return {
      id: expense.id,
      title: expense.title,
      amount: expense.amount,
      date: expenseDate,
      time: expenseDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      description: expense.title,
      paidBy: expense.paidBy,
      userColor: userColorMap[expense.paidBy.id] || 'bg-slate-400',
    }
  })

  return (
    <div className="relative w-full py-6 space-y-1">
      {/* Connected Snake Body */}
      {nodes.map((node, index) => {
        const bgColor = node.userColor
        const dateStr = node.date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
        })

        return (
          <Popover
            key={node.id}
            open={openNodeId === node.id}
            onOpenChange={(open) => setOpenNodeId(open ? node.id : null)}
          >
            <PopoverTrigger asChild>
              <button
                className={`w-full px-4 py-4 ${bgColor} text-white rounded-2xl border-4 border-white shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top duration-300`}
              >
                {/* Left: Avatar + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10 border-2 border-white/50 flex-shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-white/20">
                      {node.paidBy.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left min-w-0">
                    <p className="text-xs font-semibold line-clamp-1">
                      {node.paidBy.name}
                    </p>
                    <p className="text-xs opacity-80 line-clamp-1">{node.description}</p>
                  </div>
                </div>

                {/* Right: Price, Date, Time */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="text-xl font-bold font-mono">₹{node.amount.toFixed(0)}</p>
                  <div className="text-xs opacity-80 space-y-0">
                    <p className="font-mono">{dateStr}</p>
                    <p className="font-mono">{node.time}</p>
                  </div>
                </div>
              </button>
            </PopoverTrigger>

            <PopoverContent
              className="w-[calc(100vw-2rem)] max-w-md sm:w-80 rounded-2xl p-5"
              align="center"
              sideOffset={8}
            >
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
                    Expense Details
                  </p>
                  <p className="text-lg font-bold mt-1 break-words">{node.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-mono font-bold text-primary">
                      ₹{node.amount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="font-mono font-semibold">
                      {node.date.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid By</p>
                  <p className="font-medium break-words">{node.paidBy.name}</p>
                </div>
                {user?.id === node.paidBy.id && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      removeExpense(node.id)
                      setOpenNodeId(null)
                    }}
                    className="w-full mt-2"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Expense
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}
