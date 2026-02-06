'use client'

import { useState } from 'react'
import StickyHUD from '@/components/sticky-hud'
import SnakeTimeline from '@/components/snake-timeline'
import AddExpenseDrawer from '@/components/add-expense-drawer'
import SettingsSheet from '@/components/settings-sheet'
import SettlementDrawer from '@/components/settlement-drawer'
import { Plus, IndianRupee } from 'lucide-react'
import { useAppContext } from '@/context/app-context'

interface DashboardScreenProps {
  onLogout: () => void
}

export default function DashboardScreen({ onLogout }: DashboardScreenProps) {
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const { room, expensesLoading, expensesError, refreshExpenses } = useAppContext()

  return (
    <div className="max-w-md mx-auto min-h-screen border-x border-slate-100 bg-background flex flex-col relative overflow-hidden">
      {/* Grid Background Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-5 z-0"
        style={{
          backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent)',
          backgroundSize: '50px 50px',
        }}
      />

      {/* Sticky HUD */}
      <StickyHUD
        onMenuClick={() => setShowSettings(true)}
        onStatsClick={() => setShowSettlement(true)}
      />

      {/* Content Area with padding for sticky header */}
      <div className="flex-1 overflow-y-auto pb-24 relative z-10 pt-28">
        <div className="px-4 py-6 space-y-4">
          {expensesError && (
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
              <p className="text-sm text-destructive mb-2">{expensesError}</p>
              <button
                type="button"
                onClick={() => refreshExpenses()}
                className="text-sm font-medium text-destructive underline underline-offset-2 hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          {expensesLoading && !expensesError ? (
            <p className="text-muted-foreground text-sm py-2">Loading expenses...</p>
          ) : null}
          <SnakeTimeline />
        </div>
      </div>

      {/* Gamified FAB with Plus + Rupee Icons */}
      <button
        onClick={() => setShowAddExpense(true)}
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.5)] hover:shadow-[0_0_30px_rgba(124,58,237,0.7)] active:scale-90 z-50 flex items-center justify-center transition-all duration-200 hover:scale-110 flex-shrink-0"
      >
        <div className="relative flex items-center justify-center">
          <Plus className="h-6 w-6 stroke-[2.5] absolute" />
          <IndianRupee className="h-3 w-3 absolute -bottom-1 -right-1" />
        </div>
      </button>

      <AddExpenseDrawer
        open={showAddExpense}
        onOpenChange={setShowAddExpense}
      />

      <SettingsSheet
        open={showSettings}
        onOpenChange={setShowSettings}
        onLogout={onLogout}
      />

      <SettlementDrawer
        open={showSettlement}
        onOpenChange={setShowSettlement}
      />
    </div>
  )
}
