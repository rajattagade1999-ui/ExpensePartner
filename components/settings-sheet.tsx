'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Copy, LogOut, Trash2, UserMinus } from 'lucide-react'
import { useAppContext } from '@/context/app-context'
import { deleteAccount } from '@/lib/services/auth.service'
import { removeMemberFromRoom, leaveRoom } from '@/lib/services/group.service'
import { toast } from 'sonner'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogout: () => void
}

export default function SettingsSheet({ open, onOpenChange, onLogout }: SettingsSheetProps) {
  const { room, user, refreshGroups, setRoom } = useAppContext()
  const [copied, setCopied] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null)
  const [removeLoading, setRemoveLoading] = useState(false)

  const isAdmin = Boolean(room && user && room.createdBy === user.id)

  // Refresh room data when settings opens to get latest member names
  useEffect(() => {
    if (open && room) {
      refreshGroups().then((groups) => {
        const updated = groups.find((g) => g.id === room.id)
        if (updated) {
          setRoom(updated)
        }
      })
    }
  }, [open, room?.id, refreshGroups, setRoom])

  const handleCopyCode = () => {
    if (room?.code) {
      navigator.clipboard.writeText(room.code)
      setCopied(true)
      toast.success('Invite code copied!')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    const result = await deleteAccount()
    setDeleteLoading(false)
    setShowDeleteConfirm(false)
    onOpenChange(false)
    if (result && 'error' in result) {
      toast.error(result.error)
      return
    }
    onLogout()
    toast.success('Account deleted.')
  }

  const handleLeaveRoom = async () => {
    if (!room) return
    setLeaveLoading(true)
    const ok = await leaveRoom(room.id)
    setLeaveLoading(false)
    setShowLeaveConfirm(false)
    onOpenChange(false)
    if (!ok) {
      toast.error('Failed to leave room')
      return
    }
    await refreshGroups()
    setRoom(null)
    toast.success('Left room.')
  }

  const handleRemoveMember = async () => {
    if (!room || !memberToRemove) return
    setRemoveLoading(true)
    const ok = await removeMemberFromRoom(room.id, memberToRemove.id)
    setRemoveLoading(false)
    setMemberToRemove(null)
    if (!ok) {
      toast.error('Failed to remove member')
      return
    }
    const list = await refreshGroups()
    const updated = list.find((g: { id: string }) => g.id === room.id)
    setRoom(updated ?? room)
    toast.success(`${memberToRemove.name} removed from room.`)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="px-6 space-y-6 flex-1 overflow-y-auto">
          {/* Members List (First) */}
          <div>
            <h3 className="font-semibold mb-3 text-sm">Members</h3>
            <div className="space-y-2">
              {room?.members.map((member) => {
                const memberIsAdmin = room?.createdBy === member.id
                return (
                <div key={member.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-bold">
                      {member.name[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {member.name}
                      {memberIsAdmin && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </p>
                  </div>
                  {isAdmin && member.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setMemberToRemove({ id: member.id, name: member.name })}
                    >
                      <UserMinus className="h-4 w-4" />
                      <span className="sr-only">Remove {member.name}</span>
                    </Button>
                  )}
                </div>
              )
              })}
            </div>
          </div>

          {/* Invite Code - compact */}
          <div>
            <h3 className="font-semibold mb-2 text-sm">Invite Partner</h3>
            <Card className="p-3 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Share this code
              </p>
              <p className="text-lg font-mono font-bold tracking-widest">
                {room?.code || 'N/A'}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="w-full h-8 text-xs"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {copied ? 'Copied!' : 'Copy Code'}
              </Button>
            </Card>
          </div>

          {/* Member only: Remove from room */}
          {!isAdmin && room && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10"
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Remove from room
              </Button>
            </div>
          )}

          {/* Delete my account - only room creator (admin) can delete account; joined users can only leave room */}
          {isAdmin && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete my account
              </Button>
            </div>
          )}
        </div>

        {/* Leave room confirmation */}
        <Dialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto sm:w-full rounded-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Leave this room?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              You will be removed from the room. You can rejoin later with the invite code.
            </p>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowLeaveConfirm(false)} disabled={leaveLoading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleLeaveRoom} disabled={leaveLoading}>
                {leaveLoading ? 'Leaving...' : 'Yes, leave room'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove member confirmation (admin) */}
        <Dialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove member?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {memberToRemove && (
                <>Remove <strong>{memberToRemove.name}</strong> from this room? They can rejoin with the invite code.</>
              )}
            </p>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setMemberToRemove(null)} disabled={removeLoading}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemoveMember} disabled={removeLoading}>
                {removeLoading ? 'Removing...' : 'Yes, remove'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete account confirmation */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto sm:w-full rounded-xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Are you sure?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, delete my account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sign Out + credit (Fixed at Bottom) */}
        <div className="px-6 pb-6 pt-4 border-t flex-shrink-0 space-y-3">
          <Button
            variant="destructive"
            onClick={() => {
              onOpenChange(false)
              onLogout()
            }}
            className="w-full"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
          <p className="text-center text-xs">
            Developed by <span className="text-[#2d2d2d] font-medium">RT</span>
            <span className="text-emerald-500 font-medium">1999</span>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
