'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

const REDIRECT_DELAY_MS = 3000
const SESSION_WAIT_TIMEOUT_MS = 10000

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const redirectRef = useRef<NodeJS.Timeout | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (cancelled) return

        if (sessionError) {
          setError('Invalid or expired reset link.')
          redirectRef.current = setTimeout(() => router.push('/'), REDIRECT_DELAY_MS)
          return
        }

        if (session) {
          setReady(true)
          return
        }

        // No session: wait for auth state change (e.g. recovery link) or timeout
        timeoutRef.current = setTimeout(() => {
          if (cancelled) return
          setError('Reset link expired or invalid. Redirecting...')
          redirectRef.current = setTimeout(() => router.push('/'), REDIRECT_DELAY_MS)
        }, SESSION_WAIT_TIMEOUT_MS)

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (newSession && !cancelled) {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current)
              timeoutRef.current = null
            }
            setReady(true)
          }
        })
        unsubscribeRef.current = () => subscription.unsubscribe()
      } catch (err) {
        if (!cancelled) {
          setError('Something went wrong. Redirecting...')
          redirectRef.current = setTimeout(() => router.push('/'), REDIRECT_DELAY_MS)
        }
      }
    }

    check()

    return () => {
      cancelled = true
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      if (redirectRef.current) {
        clearTimeout(redirectRef.current)
        redirectRef.current = null
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      toast.error(updateError.message)
      return
    }
    toast.success('Password updated. Sign in with your new password.')
    router.push('/')
    router.refresh()
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to home page...</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-xl font-semibold">Set new password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your new password below.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 px-3"
            minLength={6}
            required
          />
          <Input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-10 px-3"
            minLength={6}
            required
          />
          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
