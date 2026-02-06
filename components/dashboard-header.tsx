'use client'

import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

interface DashboardHeaderProps {
  roomName: string
  onSettingsClick: () => void
}

export default function DashboardHeader({ roomName, onSettingsClick }: DashboardHeaderProps) {
  return (
    <div className="h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background">
      <h1 className="text-lg font-bold">{roomName}</h1>
      <Button
        variant="ghost"
        size="icon"
        onClick={onSettingsClick}
      >
        <Settings className="h-5 w-5" />
      </Button>
    </div>
  )
}
