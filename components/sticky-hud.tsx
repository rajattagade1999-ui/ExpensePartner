'use client'

import { useAppContext } from '@/context/app-context'
import { ChevronDown } from 'lucide-react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StickyHUDProps {
  onMenuClick: () => void
  onStatsClick: () => void
}

export default function StickyHUD({ onMenuClick, onStatsClick }: StickyHUDProps) {
  const { user, balances, room } = useAppContext()
  const userBalance = user ? balances[user.id] || 0 : 0
  const isDebt = userBalance < 0
  const absBalance = Math.abs(userBalance)

  return (
    <div className="fixed top-0 left-0 right-0 z-40 w-full max-w-md mx-auto">
      {/* Main HUD Container */}
      <div className="relative backdrop-blur-xl bg-background/60 border-b border-black/5">
        {/* Top Row: Room Name & Menu */}
        <div className="flex items-center justify-between px-6 py-3 relative">
          <div className="flex-1" />
          <h1 className="text-sm font-mono font-bold text-center text-foreground">
            {room?.name || 'Room'}
          </h1>
          <div className="flex-1 flex justify-end">
            <Button
              onClick={onMenuClick}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-primary/10"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bottom Row: Stats Bar (Clickable) */}
        <button
          onClick={onStatsClick}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-primary/5 transition-colors active:bg-primary/10"
        >
          <div className="text-left">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
              {isDebt ? 'You owe' : 'You get back'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p
              className={`text-lg font-mono font-bold ${
                isDebt ? 'text-destructive' : 'text-emerald-600'
              }`}
            >
              ₹{absBalance.toFixed(0)}
            </p>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </div>
    </div>
  )
}
