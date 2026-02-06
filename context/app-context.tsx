'use client'

/**
 * app-context.tsx - Global app state for auth, groups, expenses, balances
 *
 * Purpose: Auth session, groups, room selection (persisted), expenses
 * Responsibilities: Auth init; load groups; persist last room; load expenses
 * Dependencies: lib/types, lib/utils, lib/services (auth, group, expense, profile)
 *
 * Data flow:
 *   Login → getSession → setUser → upsertProfile → loadUserGroups
 *   Room selection → setRoom → persist to localStorage → loadExpenses
 *   Refresh → getSession → setUser → loadUserGroups → restore last room from localStorage
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import type { User, Group, Expense, CreateExpenseInput } from '@/lib/types/expense.types'
import { calculateBalances } from '@/lib/utils/balance-calculator'
import { validateExpenseInput } from '@/lib/utils/expense-validation'
import { loadExpenses, createExpense, deleteExpense } from '@/lib/services/expense.service'
import { getSession, onAuthStateChange } from '@/lib/services/auth.service'
import { loadUserGroups } from '@/lib/services/group.service'
import { upsertProfile } from '@/lib/services/profile.service'
import { supabase } from '@/lib/supabase/client'

const LAST_GROUP_ID_KEY = 'expense_partner_last_group_id'

/** Room is the runtime alias for Group */
type Room = Group

interface AppContextType {
  user: User | null
  room: Room | null
  groups: Group[]
  expenses: Expense[]
  balances: Record<string, number>
  authLoading: boolean
  groupsLoading: boolean
  groupsError: string | null
  expensesLoading: boolean
  expensesError: string | null
  // Profile setup state (persists across component remounts)
  pendingProfileSetup: { user: User; showDialog: boolean } | null
  setPendingProfileSetup: (setup: { user: User; showDialog: boolean } | null) => void
  // Whether the user needs to complete profile setup (checked on session restore)
  needsProfileSetup: boolean
  setNeedsProfileSetup: (needs: boolean) => void
  // Flag to indicate signup is in progress (prevents race with onAuthStateChange)
  signupInProgress: boolean
  setSignupInProgress: (inProgress: boolean) => void
  setUser: (user: User | null) => void
  setRoom: (room: Room | null) => void
  refreshGroups: () => Promise<Group[]>
  refreshExpenses: () => Promise<void>
  addExpense: (input: CreateExpenseInput) => Promise<{ success: boolean; error?: string }>
  removeExpense: (id: string) => Promise<void>
  calculateBalances: () => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [room, setRoomState] = useState<Room | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [authLoading, setAuthLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [expensesError, setExpensesError] = useState<string | null>(null)
  // Profile setup state - persists across AuthScreen remounts
  const [pendingProfileSetup, setPendingProfileSetup] = useState<{ user: User; showDialog: boolean } | null>(null)
  // Track if user needs profile setup (detected on session restore)
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)
  // Flag to indicate signup is in progress - prevents race between signUp and onAuthStateChange
  const [signupInProgress, setSignupInProgress] = useState(false)
  // Track if profile has been verified (used to skip redundant DB checks on TOKEN_REFRESHED)
  const [profileVerified, setProfileVerified] = useState(false)

  const setRoom = useCallback((r: Room | null) => {
    setRoomState(r)
    if (r) {
      try {
        localStorage.setItem(LAST_GROUP_ID_KEY, r.id)
      } catch {
        // ignore
      }
    } else {
      try {
        localStorage.removeItem(LAST_GROUP_ID_KEY)
      } catch {
        // ignore
      }
    }
  }, [])

  const recalculateBalances = useCallback(() => {
    if (!room) return
    const memberIds = room.members.map((m) => m.id)
    setBalances(calculateBalances(expenses, memberIds))
  }, [expenses, room])

  const refreshGroups = useCallback(async (): Promise<Group[]> => {
    setGroupsLoading(true)
    setGroupsError(null)
    try {
      const list = await loadUserGroups()
      setGroups(list)
      return list
    } catch (err) {
      console.error('[app-context] refreshGroups error:', err)
      setGroupsError('Failed to load rooms. Please try again.')
      setGroups([])
      return []
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  const refreshExpenses = useCallback(async () => {
    if (!room?.id) return
    setExpensesLoading(true)
    setExpensesError(null)
    try {
      const fetched = await loadExpenses(room.id)
      setExpenses(fetched)
    } catch (err) {
      console.error('[app-context] refreshExpenses error:', err)
      setExpensesError('Failed to load expenses')
      setExpenses([])
    } finally {
      setExpensesLoading(false)
    }
  }, [room?.id])

  // Restore auth session on mount and check if profile setup is needed
  // STRICT: Profile is only "complete" if user has a non-empty name in the database
  useEffect(() => {
    let isMounted = true
    
    const restoreSession = async () => {
      try {
        const { user: sessionUser, hasProfile } = await getSession()
        
        if (!isMounted) return
        
        if (sessionUser) {
          // STRICT REFRESH GUARD: Always verify profile is complete
          // hasProfile is true ONLY if the profile name exists and is non-empty
          if (!hasProfile) {
            console.log('[app-context] Session restored but profile incomplete - forcing setup')
            setNeedsProfileSetup(true)
            setPendingProfileSetup({ user: sessionUser, showDialog: true })
            setProfileVerified(false)
          } else {
            // Profile is complete, clear any stale setup flags
            console.log('[app-context] Session restored with complete profile')
            setNeedsProfileSetup(false)
            setPendingProfileSetup(null)
            setProfileVerified(true) // Mark as verified to skip TOKEN_REFRESHED checks
          }
          setUser(sessionUser)
        } else {
          // No session - clear everything
          setUser(null)
          setNeedsProfileSetup(false)
          setPendingProfileSetup(null)
          setProfileVerified(false)
        }
      } catch (err) {
        console.error('[app-context] Error restoring session:', err)
        // On error, clear auth state to allow fresh login
        if (isMounted) {
          setUser(null)
          setNeedsProfileSetup(false)
          setPendingProfileSetup(null)
          setProfileVerified(false)
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false)
        }
      }
    }
    
    restoreSession()
    
    return () => {
      isMounted = false
    }
  }, [])

  // Auth state listener - also check for profile setup on auth changes
  // This handles SIGNED_IN events from both login and signup
  useEffect(() => {
    const unsubscribe = onAuthStateChange((authUser, hasProfile) => {
      if (!authUser) {
        setUser(null)
        setProfileVerified(false)
        // Don't clear needsProfileSetup here - let SIGNED_OUT handler do it
        return
      }
      
      console.log('[app-context] Auth change - user:', authUser.email, 'hasProfile:', hasProfile, 'signupInProgress:', signupInProgress)
      
      // SIGNUP SHORTCUT: If signup is in progress, handleAuth is managing the transition
      // DON'T set user here - it would trigger groupsLoading which causes a loading race condition
      // Let handleAuth control everything for signup
      if (signupInProgress) {
        console.log('[app-context] Auth change: Signup in progress - ignoring, handleAuth will handle everything')
        return
      }
      
      // STRICT: Check if user has completed profile setup BEFORE setting the user
      // Profile is "complete" only if hasProfile is true (name exists and non-empty)
      if (!hasProfile) {
        // User exists but hasn't completed profile setup
        console.log('[app-context] Auth change: User needs profile setup - setting flags')
        setNeedsProfileSetup(true)
        setPendingProfileSetup({ user: authUser, showDialog: true })
        setProfileVerified(false)
      } else {
        // Profile is complete - clear setup flags and mark as verified
        console.log('[app-context] Auth change: Profile is complete')
        setNeedsProfileSetup(false)
        setPendingProfileSetup(null)
        setProfileVerified(true) // Mark profile as verified to skip future TOKEN_REFRESHED checks
      }
      
      // Set user AFTER setting profile setup state to avoid race condition
      setUser(authUser)
    }, {
      // Pass functions to optimize auth state handling
      getCurrentProfileStatus: () => profileVerified && !needsProfileSetup,
      isSignupInProgress: () => signupInProgress,
    })
    return unsubscribe
  }, [signupInProgress, profileVerified, needsProfileSetup])

  // Session expiry: handle sign out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setRoom(null)
        setNeedsProfileSetup(false)
        setPendingProfileSetup(null)
        setProfileVerified(false) // Reset profile verification on sign out
      }
      // Handle session expiry - if token refresh happens but session is null
      if (event === 'TOKEN_REFRESHED' && !session) {
        setUser(null)
        setRoom(null)
        setNeedsProfileSetup(false)
        setPendingProfileSetup(null)
        setProfileVerified(false)
        toast.error('Session expired. Please log in again.')
      }
    })
    return () => subscription.unsubscribe()
  }, [setRoom])

  // When user is set: load groups, restore last room
  // Note: Don't upsert profile here - it's done during signup in ProfileSetupScreen
  // and the profile name is loaded during signIn/getSession
  useEffect(() => {
    if (!user) {
      setGroups([])
      setRoomState(null)
      setGroupsError(null)
      // Don't reset profile setup flags here - they may be intentionally set during signup
      return
    }
    setGroupsLoading(true)
    setGroupsError(null)
    loadUserGroups()
      .then((list) => {
        setGroups(list)
        const lastId = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_GROUP_ID_KEY) : null
        if (lastId) {
          const found = list.find((g) => g.id === lastId)
          if (found) {
            setRoomState(found)
          } else {
            try {
              localStorage.removeItem(LAST_GROUP_ID_KEY)
            } catch {
              // ignore
            }
          }
        }
      })
      .catch((err) => {
        console.error('[app-context] Failed to load groups:', err)
        setGroupsError('Failed to load rooms. Please try again.')
        setGroups([])
      })
      .finally(() => setGroupsLoading(false))
  }, [user?.id])

  // Load expenses when room is set (with cancellation to avoid race when switching rooms)
  useEffect(() => {
    if (!room) {
      setExpenses([])
      setExpensesLoading(false)
      setExpensesError(null)
      return
    }
    let cancelled = false
    setExpensesLoading(true)
    setExpensesError(null)
    loadExpenses(room.id)
      .then((fetched) => {
        if (!cancelled) setExpenses(fetched)
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[app-context] Failed to load expenses:', err)
          setExpensesError('Failed to load expenses')
          setExpenses([])
        }
      })
      .finally(() => {
        if (!cancelled) setExpensesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [room?.id])

  useEffect(() => {
    recalculateBalances()
  }, [recalculateBalances])

  const addExpense = useCallback(
    async (input: CreateExpenseInput): Promise<{ success: boolean; error?: string }> => {
      const validation = validateExpenseInput({
        amount: input.amount,
        splitType: input.splitType,
        splits: input.splits,
      })
      if (!validation.valid) return { success: false, error: validation.error }
      if (!room) return { success: false, error: 'No room selected' }

      const created = await createExpense(room.id, input)
      if (!created) return { success: false, error: 'Failed to save expense' }

      setExpenses((prev) => [created, ...prev])
      return { success: true }
    },
    [room]
  )

  const removeExpense = useCallback(async (id: string) => {
    const ok = await deleteExpense(id)
    if (!ok) {
      toast.error('Failed to remove expense')
      return
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return (
    <AppContext.Provider
      value={{
        user,
        room,
        groups,
        expenses,
        balances,
        authLoading,
        groupsLoading,
        groupsError,
        expensesLoading,
        expensesError,
        pendingProfileSetup,
        setPendingProfileSetup,
        needsProfileSetup,
        setNeedsProfileSetup,
        signupInProgress,
        setSignupInProgress,
        setUser,
        setRoom,
        refreshGroups,
        refreshExpenses,
        addExpense,
        removeExpense,
        calculateBalances: recalculateBalances,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppContext must be used within AppProvider')
  return context
}
