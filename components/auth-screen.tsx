'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAppContext } from '@/context/app-context'
import { signIn, signUp, getSecurityQuestion, resetPasswordByQuestion } from '@/lib/services/auth.service'
import { createGroup, joinGroupByCode } from '@/lib/services/group.service'
import { Users, Plus } from 'lucide-react'
import { toast } from 'sonner'

// Email validation utilities
const DUMMY_EMAIL_PATTERNS = [
  /^(abc|test|demo|fake|temp|dummy|example|sample|user|admin|asdf|qwerty|hello|name|email|mail)@/i,
  /^[a-z]{1,2}@/i, // Single or double letter like a@, ab@
  /^[a-z]\d@/i, // Letter + digit like a1@
  /^(aaa|bbb|ccc|ddd|xxx|yyy|zzz)@/i, // Repeated letters
  /^123|^111|^000/i, // Starting with repeated numbers
]

const DISPOSABLE_DOMAINS = [
  'example.com', 'test.com', 'mailinator.com', 'tempmail.com', 'throwaway.com',
  'guerrillamail.com', 'sharklasers.com', 'fakeinbox.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'getnada.com', '10minutemail.com'
]

function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmedEmail = email.trim().toLowerCase()
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Please enter a valid email address' }
  }

  // Check local part length (before @)
  const localPart = trimmedEmail.split('@')[0]
  if (localPart.length < 3) {
    return { valid: false, error: 'Please use a valid email address' }
  }

  // Check for dummy email patterns
  for (const pattern of DUMMY_EMAIL_PATTERNS) {
    if (pattern.test(trimmedEmail)) {
      return { valid: false, error: 'Please use a valid email address, not a test/dummy email' }
    }
  }

  // Check for disposable domains
  const domain = trimmedEmail.split('@')[1]
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { valid: false, error: 'Please use a valid email address, not a disposable email' }
  }

  // Check for all same characters in local part (like aaa@gmail.com, bbb@gmail.com)
  if (/^(.)\1+$/.test(localPart)) {
    return { valid: false, error: 'Please use a valid email address' }
  }

  return { valid: true }
}

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStep, setForgotStep] = useState<1 | 2>(1)
  const [forgotQuestion, setForgotQuestion] = useState<string | null>(null)
  const [forgotAnswer, setForgotAnswer] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const { user, setRoom, groups, groupsError, refreshGroups, setSignupInProgress, setPendingProfileSetup, setNeedsProfileSetup } = useAppContext()

  const handleAuth = async () => {
    if (!email || !password) return
    
    // Validate email for signup
    if (activeTab === 'signup') {
      const validation = validateEmail(email)
      if (!validation.valid) {
        setEmailError(validation.error || 'Please enter a valid email')
        toast.error(validation.error || 'Please enter a valid email')
        return
      }
    }
    setEmailError(null)
    
    setIsLoading(true)
    
    // For signup, set flag BEFORE calling signUp to prevent race condition
    // This ensures onAuthStateChange knows a signup is in progress
    if (activeTab === 'signup') {
      setSignupInProgress(true)
    }
    
    try {
      const result = activeTab === 'login'
        ? await signIn(email, password)
        : await signUp(email, password)

      if ('error' in result) {
        toast.error(result.error)
        // Clear signup flag on error
        if (activeTab === 'signup') {
          setSignupInProgress(false)
        }
        return
      }
      
      // SIGNUP: Immediately force UI to profile setup screen
      // Don't wait for onAuthStateChange - that causes infinite loading
      if (activeTab === 'signup') {
        console.log('[auth-screen] Signup successful - immediately showing profile setup')
        // Set profile setup state BEFORE the listener can interfere
        setNeedsProfileSetup(true)
        setPendingProfileSetup({ user: result.user, showDialog: true })
        // Clear signup flag - we've handled the transition
        setSignupInProgress(false)
        return
      }
      
      // LOGIN: Let onAuthStateChange handle profile verification
      // It will check if profile is complete and redirect accordingly
    } catch (err) {
      console.error('[auth-screen] handleAuth error:', err)
      toast.error('Something went wrong. Please try again.')
      // Clear signup flag on error
      if (activeTab === 'signup') {
        setSignupInProgress(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotEmailNext = async () => {
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    const q = await getSecurityQuestion(forgotEmail)
    setForgotLoading(false)
    if (!q) {
      toast.error('No account or no security question set for this email.')
      return
    }
    setForgotQuestion(q)
    setForgotStep(2)
    setForgotAnswer('')
    setForgotNewPassword('')
  }

  const handleForgotPasswordSubmit = async () => {
    if (!forgotAnswer.trim() || !forgotNewPassword.trim()) return
    if (forgotNewPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setForgotLoading(true)
    const result = await resetPasswordByQuestion(forgotEmail, forgotAnswer, forgotNewPassword)
    setForgotLoading(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Password updated. Sign in with your new password.')
    setShowForgotPassword(false)
    setForgotStep(1)
    setForgotQuestion(null)
    setForgotEmail('')
    setForgotAnswer('')
    setForgotNewPassword('')
  }

  const handleCreateRoom = async () => {
    if (!user) return
    setCreateLoading(true)
    try {
      const group = await createGroup('My Expense')
      if (group) {
        await refreshGroups()
        setRoom(group)
        toast.success('Room created! Share the code: ' + group.code)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create room')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!roomCode.trim()) return
    setJoinLoading(true)
    try {
      const group = await joinGroupByCode(roomCode)
      if (group) {
        await refreshGroups()
        setRoom(group)
        setShowJoinDialog(false)
        setRoomCode('')
        toast.success('Joined room!')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid invite code')
    } finally {
      setJoinLoading(false)
    }
  }

  const handleSelectGroup = (group: { id: string; name: string; code: string; members: { id: string; name: string; email?: string }[] }) => {
    setRoom(group)
  }

  if (user) {
    const hasRoom = groups.length > 0
    return (
      <>
        <div className="flex flex-col min-h-screen">
          {/* Sticky logo header - stays on scroll */}
          <div className="sticky top-0 z-10 flex flex-col items-center text-center px-6 pt-6 pb-4 bg-background border-b border-border/40">
            <Image
              src="/ExPartner%20Logo.png"
              alt="ExpensePartner"
              width={200}
              height={60}
              className="mb-2 w-40 sm:w-52 h-auto object-contain"
            />
            <p className="text-muted-foreground text-sm">
              {hasRoom ? 'Your room' : 'Create a room or join with an invite code'}
            </p>
          </div>

          {/* Scrollable cards area - only this scrolls */}
          <div className="flex-1 overflow-y-auto px-6 py-6 pb-8">
            <div className="w-full max-w-md mx-auto space-y-6">
              {groupsError && (
                <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
                  <p className="text-sm text-destructive mb-2">{groupsError}</p>
                  <button
                    type="button"
                    onClick={() => refreshGroups()}
                    className="text-sm font-medium text-destructive underline underline-offset-2 hover:no-underline"
                  >
                    Retry
                  </button>
                </div>
              )}
              {/* User already has one room: show only that room */}
              {hasRoom && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Your Room
                  </p>
                  {groups.map((g) => (
                    <Card
                      key={g.id}
                      className="p-4 cursor-pointer hover:border-primary transition-colors active:scale-[0.99]"
                      onClick={() => handleSelectGroup(g)}
                    >
                      <p className="font-semibold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">Code: {g.code}</p>
                    </Card>
                  ))}
                </div>
              )}

              {/* No room yet: only create OR join (one choice) */}
              {!hasRoom && (
                <>
                  <div className="space-y-3">
                    <Card
                      className="p-6 cursor-pointer hover:border-primary transition-colors active:scale-95"
                      onClick={createLoading ? undefined : handleCreateRoom}
                    >
                      <Plus className="h-8 w-8 mb-3 text-primary" />
                      <p className="font-semibold mb-1">Create a room</p>
                      <p className="text-sm text-muted-foreground">I&apos;m the first one here</p>
                    </Card>
                  </div>
                  <div className="space-y-3">
                    <Card
                      className="p-6 cursor-pointer hover:border-primary transition-colors active:scale-95"
                      onClick={() => setShowJoinDialog(true)}
                    >
                      <Users className="h-8 w-8 mb-3 text-primary" />
                      <p className="font-semibold mb-1">I have an invite code</p>
                      <p className="text-sm text-muted-foreground">Join an existing room</p>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent className="w-full max-w-md">
            <DialogHeader>
              <DialogTitle>Join a Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                type="text"
                placeholder="Enter invite code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="text-center tracking-widest text-lg"
                autoFocus
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowJoinDialog(false)
                  setRoomCode('')
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleJoinRoom}
                className="flex-1"
                disabled={!roomCode.trim() || joinLoading}
              >
                {joinLoading ? 'Joining...' : 'Join Room'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden px-6">
      <div className="flex-1 flex items-center justify-center min-h-0 py-4">
        <div className="w-full max-w-md space-y-5">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/ExPartner%20Logo.png"
              alt="ExpensePartner"
              width={240}
              height={72}
              className="mb-2 w-40 sm:w-52 h-auto object-contain"
              priority
            />
            <p className="text-muted-foreground text-sm leading-6">Student Expense Tracker</p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => {
            setActiveTab(v as 'login' | 'signup')
            setEmailError(null) // Clear error when switching tabs
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <Card className="p-5 space-y-3">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="student@college.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 px-3"
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 px-3"
                  />
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <Button
                    onClick={handleAuth}
                    disabled={isLoading || !email || !password}
                    className="w-full h-10"
                  >
                    {isLoading ? 'Signing in...' : "Let's Go"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <Card className="p-5 space-y-3">
                <div className="space-y-2">
                  <div>
                    <Input
                      type="email"
                      placeholder="student@college.edu"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (emailError) setEmailError(null)
                      }}
                      className={`h-10 px-3 ${emailError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    />
                    {emailError && (
                      <p className="text-xs text-destructive mt-1">{emailError}</p>
                    )}
                  </div>
                  <Input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 px-3"
                  />
                </div>
                <div className="space-y-1.5 pt-0.5">
                  <Button
                    onClick={handleAuth}
                    disabled={isLoading || !email || !password}
                    className="w-full h-10"
                  >
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Footer: line + Developed by RT1999 */}
      <div className="flex-shrink-0 py-3 border-t border-border">
        <p className="text-center text-xs">
          Developed by <span className="text-[#2d2d2d] font-medium">RT</span>
          <span className="text-emerald-500 font-medium">1999</span>
        </p>
      </div>

      {/* Forgot password (security question) dialog */}
      <Dialog
        open={showForgotPassword}
        onOpenChange={(open) => {
          if (!open) {
            setShowForgotPassword(false)
            setForgotStep(1)
            setForgotQuestion(null)
            setForgotAnswer('')
            setForgotNewPassword('')
          }
          setShowForgotPassword(open)
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm mx-auto sm:w-full rounded-xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Forgot password</DialogTitle>
          </DialogHeader>
          {forgotStep === 1 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Enter your email. We&apos;ll show your security question so you can set a new password.
              </p>
              <Input
                type="email"
                placeholder="student@college.edu"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                className="h-10 px-3 mt-2"
              />
              <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                <Button variant="outline" onClick={() => setShowForgotPassword(false)} disabled={forgotLoading}>
                  Cancel
                </Button>
                <Button onClick={handleForgotEmailNext} disabled={forgotLoading || !forgotEmail.trim()}>
                  {forgotLoading ? 'Checking...' : 'Next'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <p className="text-sm font-medium mt-1">{forgotQuestion}</p>
              <Input
                type="text"
                placeholder="Your answer"
                value={forgotAnswer}
                onChange={(e) => setForgotAnswer(e.target.value)}
                className="h-10 px-3 mt-2"
                autoComplete="off"
              />
              <Input
                type="password"
                placeholder="New password (min 6 characters)"
                value={forgotNewPassword}
                onChange={(e) => setForgotNewPassword(e.target.value)}
                className="h-10 px-3 mt-2"
                minLength={6}
              />
              <DialogFooter className="flex gap-2 sm:gap-0 mt-4">
                <Button variant="outline" onClick={() => setForgotStep(1)} disabled={forgotLoading}>
                  Back
                </Button>
                <Button
                  onClick={handleForgotPasswordSubmit}
                  disabled={forgotLoading || !forgotAnswer.trim() || forgotNewPassword.length < 6}
                >
                  {forgotLoading ? 'Updating...' : 'Reset password'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
