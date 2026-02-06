'use client'

import { Button } from '@/components/ui/button'
import { Menu } from 'lucide-react'

interface GameHeaderProps {
  roomName: string
  onMenuClick: () => void
}

export default function GameHeader({ roomName, onMenuClick }: GameHeaderProps) {
  return (
    <>
      {/* Level Title - Center Top */}
      <div className="text-center pt-4 pb-2">
        <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
          Level: {roomName}
        </p>
      </div>

      {/* Menu Button - Floating Ghost */}
      <Button
        onClick={onMenuClick}
        variant="ghost"
        size="icon"
        className="absolute top-6 right-6 z-50 rounded-full bg-white/50 backdrop-blur-md hover:bg-white/70 transition-colors"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </>
  )
}
