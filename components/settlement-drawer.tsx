'use client'

import { useAppContext } from '@/context/app-context'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { getSettlementBreakdown } from '@/lib/utils/balance-calculator'

interface SettlementDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getName(room: { members: { id: string; name: string }[] }, userId: string): string {
  return room.members.find((m) => m.id === userId)?.name ?? 'Unknown'
}

export default function SettlementDrawer({
  open,
  onOpenChange,
}: SettlementDrawerProps) {
  const { user, room, expenses } = useAppContext()

  if (!user || !room) return null

  const { totalPaid, getBack, youGive, youGet } = getSettlementBreakdown(
    expenses,
    user.id
  )

  const hasGive = youGive.length > 0
  const hasGet = youGet.length > 0

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto max-h-[90vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0">
          <DrawerTitle>Settlement Breakdown</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 space-y-4 pb-4">
          {/* Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total spend</span>
              <span className="font-mono font-bold">₹{totalPaid.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total you get</span>
              <span className="font-mono font-bold text-emerald-600">
                ₹{getBack.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Two tabs */}
          <Tabs defaultValue="give" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="give" className="gap-1.5">
                <ArrowUpFromLine className="h-3.5 w-3.5" />
                You give
                {hasGive && (
                  <span className="text-xs opacity-80">({youGive.length})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="get" className="gap-1.5">
                <ArrowDownToLine className="h-3.5 w-3.5" />
                You get
                {hasGet && (
                  <span className="text-xs opacity-80">({youGet.length})</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="give" className="mt-3 space-y-2">
              {!hasGive ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    You don&apos;t owe anyone
                  </p>
                </div>
              ) : (
                youGive.map(({ userId, amount }) => (
                  <Card
                    key={userId}
                    className="p-3 border-2 border-destructive/20 bg-destructive/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getName(room, userId)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {getName(room, userId)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-destructive shrink-0">
                        ₹{amount.toFixed(2)}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="get" className="mt-3 space-y-2">
              {!hasGet ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No one owes you
                  </p>
                </div>
              ) : (
                youGet.map(({ userId, amount }) => (
                  <Card
                    key={userId}
                    className="p-3 border-2 border-emerald-500/20 bg-emerald-500/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {getName(room, userId)[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">
                          {getName(room, userId)}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-600 shrink-0">
                        ₹{amount.toFixed(2)}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DrawerFooter className="flex-shrink-0 border-t pt-4">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full bg-transparent">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
