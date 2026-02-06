'use client'

import { Card } from '@/components/ui/card'

interface BalanceHeroProps {
  balance: number
}

export default function BalanceHero({ balance }: BalanceHeroProps) {
  const isPositive = balance > 0
  const isNeutral = balance === 0

  const balanceColor = isNeutral ? 'text-slate-900' : isPositive ? 'text-emerald-600' : 'text-rose-600'
  const bgColor = isNeutral ? 'bg-slate-50' : isPositive ? 'bg-emerald-50' : 'bg-rose-50'

  return (
    <Card className={`p-8 text-center ${bgColor} border-0`}>
      <p className="text-sm font-medium text-muted-foreground mb-2">Your Balance</p>
      <p className={`text-4xl font-mono font-bold ${balanceColor}`}>
        {isNeutral ? 'Settled' : `${isPositive ? '+' : '-'}₹${Math.abs(balance).toFixed(2)}`}
      </p>
      <p className="text-xs text-muted-foreground mt-3">
        {isNeutral
          ? 'All settled up!'
          : isPositive
            ? `You are owed ₹${balance.toFixed(2)} total`
            : `You owe ₹${Math.abs(balance).toFixed(2)}`}
      </p>
    </Card>
  )
}
