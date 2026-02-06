'use client'

/**
 * add-expense-drawer.tsx - Drawer for adding new expenses
 *
 * Purpose: Collect expense details (amount, title, split type) and submit
 * Responsibilities: Equal/custom split UI, validation, calls addExpense
 * Dependencies: app-context, balance-calculator, sonner
 */

import { useState, useMemo } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Calendar, IndianRupee, Users } from 'lucide-react'
import { useAppContext } from '@/context/app-context'
import { buildEqualSplits } from '@/lib/utils/balance-calculator'
import { toast } from 'sonner'

interface AddExpenseDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Other room members (excluding the user adding the expense) */
function otherMembers(room: { members: { id: string; name: string }[] } | null, currentUserId: string | undefined) {
  if (!room || !currentUserId) return []
  return room.members.filter((m) => m.id !== currentUserId)
}

export default function AddExpenseDrawer({ open, onOpenChange }: AddExpenseDrawerProps) {
  const [amount, setAmount] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date())
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  /** Custom split: userId -> amount input string */
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({})
  const { addExpense, user, room } = useAppContext()

  const numAmount = parseFloat(amount) || 0
  const others = useMemo(() => otherMembers(room, user?.id), [room, user?.id])

  /** Participants for equal split: all members in room (including payer) so share = amount / room size */
  const equalParticipantIds = useMemo(() => {
    if (!room) return []
    return room.members.map((m) => m.id)
  }, [room])

  /** Custom: others' amounts + rest for payer. Valid when rest >= 0 and at least one partner has amount > 0. */
  const customSplitsParsed = useMemo(() => {
    const othersSplits: { userId: string; amount: number }[] = []
    let sumOthers = 0
    others.forEach((member) => {
      const val = Math.max(0, parseFloat(customAmounts[member.id] || '0') || 0)
      othersSplits.push({ userId: member.id, amount: val })
      sumOthers += val
    })
    const rest = numAmount - sumOthers
    const restRounded = Math.round(rest * 100) / 100
    const totalsOk = numAmount > 0 && restRounded >= -0.01
    const atLeastOnePartnerFilled = sumOthers > 0
    const valid = totalsOk && atLeastOnePartnerFilled
    const splits: { userId: string; amount: number }[] = [
      ...othersSplits,
      ...(user?.id ? [{ userId: user.id, amount: Math.max(0, restRounded) }] : []),
    ]
    return { splits, sumOthers, rest: Math.max(0, restRounded), valid }
  }, [others, customAmounts, numAmount, user?.id])

  const titleValid = title.trim().length > 0
  const canSave =
    numAmount > 0 &&
    titleValid &&
    (splitMode === 'equal' || (splitMode === 'custom' && customSplitsParsed.valid))

  const handleAddExpense = async () => {
    if (!user || !room) return
    if (!title.trim()) {
      toast.error('What was it for? is required')
      return
    }
    if (splitMode === 'custom' && !customSplitsParsed.valid) {
      if (customSplitsParsed.sumOthers <= 0) {
        toast.error('Add amount for at least one partner in Specific Users')
      } else {
        toast.error('Partner amounts must equal total (rest is your share)')
      }
      return
    }

    const splits =
      splitMode === 'equal'
        ? buildEqualSplits(numAmount, equalParticipantIds)
        : customSplitsParsed.splits

    const result = await addExpense({
      title: title.trim(),
      amount: numAmount,
      paidBy: user,
      splitType: splitMode,
      splits,
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    setAmount('')
    setTitle('')
    setDate(new Date())
    setSplitMode('equal')
    setCustomAmounts({})
    onOpenChange(false)
  }

  const handleCustomAmountChange = (userId: string, value: string) => {
    setCustomAmounts((prev) => ({ ...prev, [userId]: value }))
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto max-h-[90vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0">
          <DrawerTitle>Add Expense</DrawerTitle>
        </DrawerHeader>

        {/* Scrollable body so full form is visible on mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
          <div className="space-y-4">
            <div>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-3xl sm:text-4xl border-none text-center focus-visible:ring-0 placeholder:text-slate-200 font-mono font-bold"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                What was it for? <span className="text-destructive">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Dinner, Groceries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={!titleValid && title.length > 0 ? 'border-destructive' : ''}
              />
            </div>

            <Button
              variant="outline"
              className="w-full justify-start bg-transparent"
              onClick={() => setDate(new Date())}
            >
              <Calendar className="h-4 w-4 mr-2" />
              {date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Button>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Split
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSplitMode('equal')}
                  className={`flex-1 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    splitMode === 'equal'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  Split Equally
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('custom')}
                  className={`flex-1 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    splitMode === 'custom'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  Specific Users
                </button>
              </div>
              {/* Inline split card when Specific Users selected - no popover so inputs don't close it */}
              {splitMode === 'custom' && numAmount > 0 && others.length > 0 && (
                <Card className="mt-3 p-4 border-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <h4 className="text-sm font-semibold">Split between partners</h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Total ₹{numAmount.toFixed(2)} — rest is your share
                  </p>
                  <div className="space-y-3">
                    {others.map((member) => (
                      <div key={member.id} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate">{member.name}</span>
                        <Input
                          type="number"
                          placeholder="0"
                          min={0}
                          step={0.01}
                          value={customAmounts[member.id] ?? ''}
                          onChange={(e) => handleCustomAmountChange(member.id, e.target.value)}
                          className="w-28 text-right font-mono shrink-0"
                        />
                      </div>
                    ))}
                    {user && (
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <span className="text-sm flex-1 truncate">You ({user.name})</span>
                        <span className="w-28 text-right font-mono text-sm text-muted-foreground shrink-0">
                          ₹{customSplitsParsed.rest.toFixed(2)}
                        </span>
                      </div>
                    )}
                    <p
                      className={`text-xs pt-1 ${
                        customSplitsParsed.valid
                          ? 'text-emerald-600 font-medium'
                          : customSplitsParsed.sumOthers > numAmount
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      Partners: ₹{customSplitsParsed.sumOthers.toFixed(2)} + You: ₹{customSplitsParsed.rest.toFixed(2)} = ₹{numAmount.toFixed(2)}
                      {!customSplitsParsed.valid && customSplitsParsed.sumOthers > numAmount && (
                        <span className="block">Partners total cannot exceed ₹{numAmount.toFixed(2)}</span>
                      )}
                      {!customSplitsParsed.valid && customSplitsParsed.sumOthers <= numAmount && customSplitsParsed.sumOthers === 0 && (
                        <span className="block text-amber-600">Add amount for at least one partner to save</span>
                      )}
                    </p>
                  </div>
                </Card>
              )}
              <p className="text-xs text-muted-foreground">
                {splitMode === 'equal'
                  ? 'Split equally among everyone in the room (including you)'
                  : 'Set amount per partner; the rest is your share'}
              </p>
            </div>
          </div>
        </div>

        <DrawerFooter className="flex-shrink-0 space-y-2 border-t pt-4">
          <Button
            onClick={handleAddExpense}
            disabled={!canSave}
            className="w-full"
          >
            <IndianRupee className="h-4 w-4 mr-1" />
            Add Expense
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full bg-transparent">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
