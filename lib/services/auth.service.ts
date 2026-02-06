/**
 * auth.service.ts - Supabase Auth (email + password)
 *
 * Purpose: Sign in, sign up, sign out; session persistence via Supabase
 * Responsibilities: Map Supabase User → domain User; expose session/getSession
 * Dependencies: lib/supabase/client, lib/types/expense.types
 *
 * Session persistence: Supabase stores session in localStorage; survives refresh.
 *
 * @example
 * ```ts
 * const { user, error } = await signIn(email, password)
 * const session = await getSession()
 * signOut()
 * ```
 */

import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types/expense.types'
import { getProfileName } from './profile.service'

/** Maps Supabase Auth user to domain User */
function mapSupabaseUser(sbUser: { id: string; email?: string; user_metadata?: { full_name?: string } }): User {
  const name = sbUser.user_metadata?.full_name ?? sbUser.email?.split('@')[0] ?? 'User'
  return {
    id: sbUser.id,
    name,
    email: sbUser.email,
  }
}

/** Map known Supabase auth errors to user-friendly messages */
function authErrorMessage(error: { message?: string }): string {
  const msg = (error?.message ?? '').toLowerCase()
  if (msg.includes('email rate limit') || msg.includes('rate limit exceeded')) {
    return 'Too many attempts. Please wait a moment.'
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid email or password')) {
    return 'Invalid email or password. Please try again or create an account.'
  }
  if (msg.includes('user not found') || msg.includes('no user')) {
    return 'No account found. Please create an account first.'
  }
  if (msg.includes('email not confirmed')) {
    // Old users with unconfirmed emails - let them through, they can reset password
    return 'Invalid email or password. Please try again or create an account.'
  }
  return error?.message ?? 'Something went wrong. Please try again.'
}

/**
 * Sign in with email and password
 *
 * @param email - User email
 * @param password - User password
 * @returns User on success, or { error } on failure
 */
export async function signIn(
  email: string,
  password: string
): Promise<{ user: User } | { error: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('[auth.service] signIn error:', {
      message: error.message,
      status: error.status,
      name: error.name,
    })
    return { error: authErrorMessage(error) }
  }
  if (!data.user) return { error: 'Sign in failed' }
  
  // Get profile name from database (in case user set it during signup)
  const profileName = await getProfileName(data.user.id)
  console.log('[auth.service] signIn - profileName from DB:', profileName)
  
  const user = mapSupabaseUser(data.user)
  console.log('[auth.service] signIn - mapped user name:', user.name)
  
  // Use profile name if available, otherwise fall back to mapped name
  if (profileName) {
    user.name = profileName
  }
  
  console.log('[auth.service] signIn - final user name:', user.name)
  return { user }
}

/**
 * Sign up with email and password
 *
 * Uses server API route (/api/auth/signup) to create user with auto-confirmation.
 * No email is sent; user can immediately proceed to security question → create/join room.
 *
 * @param email - User email
 * @param password - User password
 * @returns User on success, or { error } on failure
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ user: User } | { error: string }> {
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error('[auth.service] signUp error:', data)
      return { error: data?.error ?? 'Failed to create account' }
    }

    // If we got a session, set it in Supabase client so subsequent calls work
    if (data.session?.access_token && data.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    }

    if (!data.user) {
      return { error: 'Sign up failed' }
    }

    return {
      user: {
        id: data.user.id,
        name: data.user.name ?? data.user.email?.split('@')[0] ?? 'User',
        email: data.user.email,
      },
    }
  } catch (err) {
    console.error('[auth.service] signUp exception:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}

/**
 * Sign out and clear session.
 * Safe to call even when no session exists (e.g. during signup flow); avoids
 * POST /auth/v1/logout when there is nothing to log out, preventing 403 Forbidden.
 */
export async function signOut(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.auth.signOut()
  } catch {
    // Ignore errors (e.g. 403 when session not fully established) so signup/logout flow isn't broken
  }
}

/**
 * Get security question for an email (for password reset by question).
 *
 * @param email - User email
 * @returns The question text or null if not set / user not found
 */
export async function getSecurityQuestion(email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_security_question', {
    p_email: email.trim(),
  })
  if (error) {
    console.error('[auth.service] getSecurityQuestion error:', error)
    return null
  }
  return data && typeof data === 'string' ? data : null
}

/**
 * Set security question and answer for the current user (call after sign up).
 *
 * @param question - Security question text
 * @param answer - Answer (stored hashed)
 * @returns { success: true } or { error: string }
 */
export async function setSecurityQuestion(
  question: string,
  answer: string
): Promise<{ success: true } | { error: string }> {
  const { error } = await supabase.rpc('set_security_qa', {
    p_question: question.trim(),
    p_answer: answer.trim(),
  })
  if (error) {
    console.error('[auth.service] setSecurityQuestion error:', error)
    return { error: error.message }
  }
  return { success: true }
}

/**
 * Reset password using security question (no email sent).
 * Calls API that verifies answer and sets new password.
 *
 * @param email - User email
 * @param answer - Security answer
 * @param newPassword - New password
 * @returns { success: true } or { error: string }
 */
export async function resetPasswordByQuestion(
  email: string,
  answer: string,
  newPassword: string
): Promise<{ success: true } | { error: string }> {
  const res = await fetch('/api/auth/reset-password-by-question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      answer: answer.trim(),
      newPassword,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: (data?.error as string) || 'Failed to reset password' }
  }
  return { success: true }
}

/**
 * Send password reset email to the given address.
 * User must open the link in the email and set a new password on /reset-password.
 *
 * Redirect URL must be allowlisted in Supabase: Auth → URL Configuration → Redirect URLs
 * Add: http://localhost:3000/reset-password and your production URL (e.g. https://yourapp.com/reset-password).
 *
 * @param email - User email
 * @returns { success: true } or { error: string }
 */
export async function resetPassword(email: string): Promise<{ success: true } | { error: string }> {
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    ...(redirectTo && { redirectTo }),
  })

  if (error) {
    console.error('[auth.service] resetPassword error:', error.message, error.status)
    const msg = (error?.message ?? '').toLowerCase()
    if (msg.includes('redirect') || msg.includes('url') || error.status === 400) {
      return {
        error:
          'Password reset failed. Add this URL in Supabase: Dashboard → Auth → URL Configuration → Redirect URLs: ' +
          (redirectTo || 'your-site.com/reset-password'),
      }
    }
    return { error: authErrorMessage(error) }
  }
  return { success: true }
}

/**
 * Delete the current user's account (Supabase Auth + data). Signs out after.
 * Uses the server API route because Supabase's public auth API does not support
 * DELETE /auth/v1/user (returns 405 Method Not Allowed); deletion is done via
 * the Admin API with the service role on the server.
 *
 * @returns { success: true } or { error: string }
 */
export async function deleteAccount(): Promise<{ success: true } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { error: 'Not signed in' }
  }

  const res = await fetch('/api/auth/delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  const data = await res.json().catch(() => ({}))
  await signOut()

  if (!res.ok) {
    const msg = (data?.error as string) ?? res.statusText ?? 'Failed to delete account'
    return { error: typeof msg === 'string' ? msg : 'Failed to delete account' }
  }

  return { success: true }
}

/**
 * Default/placeholder names that should NOT be considered a "complete" profile.
 * If the DB trigger inserts one of these by default, we must still show the setup screen.
 */
const INVALID_PROFILE_NAMES = [
  'user',
  'anonymous',
  'guest',
  'new user',
  'newuser',
  'unnamed',
  'unknown',
  '',
]

/**
 * Check if a profile name is valid (not a default/placeholder value)
 */
function isValidProfileName(name: string | null | undefined): boolean {
  if (!name) return false
  
  const trimmed = name.trim().toLowerCase()
  
  // Empty after trimming
  if (trimmed.length === 0) return false
  
  // Matches a known default/placeholder name
  if (INVALID_PROFILE_NAMES.includes(trimmed)) {
    console.log('[auth.service] Profile name is a default/placeholder:', name)
    return false
  }
  
  return true
}

/**
 * Helper to check if profile is complete (has required fields like name)
 * Uses retry logic to handle race conditions (e.g., Postgres trigger creating profile row)
 * 
 * STRICT: Rejects empty names AND common default values like 'User', 'Anonymous', etc.
 * 
 * @param userId - User ID to check
 * @param retries - Number of retries (default 2)
 * @param delayMs - Delay between retries in ms (default 150)
 * @returns Profile name if complete, null if incomplete or error
 */
async function checkProfileWithRetry(userId: string, retries = 2, delayMs = 150): Promise<string | null> {
  try {
    let profileName = await getProfileName(userId)
    
    // If no profile found, retry a couple times in case of DB propagation delay
    let attempt = 0
    while (!profileName && attempt < retries) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
      try {
        profileName = await getProfileName(userId)
      } catch (retryErr) {
        console.warn('[auth.service] checkProfileWithRetry retry error:', retryErr)
        // Continue retrying
      }
      attempt++
    }
    
    // STRICT: Profile is "complete" only if name is valid
    // Rejects: null, empty string, whitespace-only, and default/placeholder names
    if (isValidProfileName(profileName)) {
      return profileName
    }
    
    console.log('[auth.service] Profile incomplete - name is invalid:', profileName || '(null/empty)')
    return null
  } catch (err) {
    // Handle 403, 404, network errors gracefully - don't leave app hanging
    console.error('[auth.service] checkProfileWithRetry error:', err)
    return null
  }
}

/**
 * Get current session and map to domain User
 *
 * Used on app load to restore auth state after refresh.
 * Profile is considered "complete" only if the name field exists and is non-empty.
 *
 * @returns { user, hasProfile } - user if session exists, hasProfile indicates if profile setup is complete
 */
export async function getSession(): Promise<{ user: User | null; hasProfile: boolean }> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('[auth.service] getSession error:', sessionError)
      return { user: null, hasProfile: false }
    }
    
    if (!session?.user) return { user: null, hasProfile: false }
    
    const user = mapSupabaseUser(session.user)
    
    // Get profile name from database with retry logic for race conditions
    // Profile is only "complete" if name exists and is non-empty
    const profileName = await checkProfileWithRetry(session.user.id)
    const hasProfile = !!profileName && profileName.trim().length > 0
    
    if (hasProfile) {
      user.name = profileName
    }
    
    console.log('[auth.service] getSession - hasProfile:', hasProfile, 'name:', profileName || '(empty)')
    return { user, hasProfile }
  } catch (err) {
    // Catch any unexpected errors to prevent app from hanging
    console.error('[auth.service] getSession unexpected error:', err)
    return { user: null, hasProfile: false }
  }
}

/**
 * Subscribe to auth state changes (sign in, sign out, token refresh)
 *
 * @param callback - Called with User when signed in, null when signed out
 *                   hasProfile indicates if user has completed profile setup (name exists and non-empty)
 * @param options - Optional configuration:
 *                  - getCurrentProfileStatus: function to check if profile is already verified (skips TOKEN_REFRESHED checks)
 *                  - isSignupInProgress: function to check if signup is in progress (skips slow profile checks)
 * @returns Unsubscribe function
 */
export function onAuthStateChange(
  callback: (user: User | null, hasProfile: boolean) => void,
  options?: {
    getCurrentProfileStatus?: () => boolean
    isSignupInProgress?: () => boolean
  }
): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[auth.service] onAuthStateChange event:', event)
    
    if (!session?.user) {
      callback(null, false)
      return
    }
    
    try {
      const user = mapSupabaseUser(session.user)
      
      // SIGNUP SHORTCUT: Skip slow profile check if signup is in progress
      // handleAuth in auth-screen.tsx will manage the profile setup state directly
      // This prevents the loading hang caused by checkProfileWithRetry delays
      if (options?.isSignupInProgress?.()) {
        console.log('[auth.service] Signup in progress - skipping profile check, returning immediately')
        callback(user, false) // Return false to indicate profile needs setup
        return
      }
      
      // OPTIMIZATION: Skip profile check on TOKEN_REFRESHED if we already know profile is complete
      // This prevents unnecessary DB calls every few minutes during token refresh cycles
      if (event === 'TOKEN_REFRESHED' && options?.getCurrentProfileStatus?.()) {
        console.log('[auth.service] TOKEN_REFRESHED with verified profile - skipping DB check')
        // Get cached name from user metadata since we already verified profile
        const cachedName = session.user.user_metadata?.full_name
        if (cachedName) {
          user.name = cachedName
        }
        callback(user, true)
        return
      }
      
      // For SIGNED_IN event (login/signup), use retry logic to handle race conditions
      // where profile might not be immediately available due to DB propagation
      // For other events (like INITIAL_SESSION), also use retry to be safe
      const useRetry = event === 'SIGNED_IN' || event === 'INITIAL_SESSION'
      
      let profileName: string | null = null
      try {
        profileName = useRetry 
          ? await checkProfileWithRetry(session.user.id)
          : await getProfileName(session.user.id)
      } catch (profileErr) {
        console.error('[auth.service] onAuthStateChange profile check error:', profileErr)
        // Continue with hasProfile = false to show profile setup screen
      }
      
      // Profile is "complete" only if name exists and is non-empty
      const hasProfile = !!profileName && profileName.trim().length > 0
      
      if (hasProfile && profileName) {
        user.name = profileName
      }
      
      console.log('[auth.service] onAuthStateChange - event:', event, 'hasProfile:', hasProfile)
      callback(user, hasProfile)
    } catch (err) {
      // Catch any unexpected errors - call back with user but no profile to allow recovery
      console.error('[auth.service] onAuthStateChange unexpected error:', err)
      const user = mapSupabaseUser(session.user)
      callback(user, false)
    }
  })
  return () => subscription.unsubscribe()
}
