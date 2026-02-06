/**
 * profile.service.ts - User profile upsert for display in groups
 *
 * Purpose: Ensure current user has a profile row (name, email) for member display
 * Responsibilities: Upsert profile on login, fetch profile name
 * Dependencies: lib/supabase/client
 *
 * Call after auth session is established so profiles has display info for group members.
 */

import { supabase } from '@/lib/supabase/client'
import type { User } from '@/lib/types/expense.types'

/**
 * Upsert current user's profile (id, name, email)
 *
 * Called on login so profile exists when user creates/joins groups.
 * Includes retry logic to handle session sync timing after signup.
 *
 * @param user - Current auth user (domain User)
 * @returns { success: true } or { error: string }
 */
export async function upsertProfile(user: User): Promise<{ success: true } | { error: string }> {
  console.log('[profile.service] upsertProfile called with:', { id: user.id, name: user.name, email: user.email })
  
  // Retry logic for session sync timing issues
  const maxRetries = 3
  const retryDelay = 300 // ms
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Verify we have a valid session before attempting upsert
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('[profile.service] Session error:', sessionError)
      if (attempt < maxRetries - 1) {
        console.log(`[profile.service] Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      return { error: 'Session error. Please try signing up again.' }
    }
    
    if (!session) {
      console.warn('[profile.service] No session found')
      if (attempt < maxRetries - 1) {
        console.log(`[profile.service] Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      return { error: 'No valid session. Please try signing up again.' }
    }
    
    console.log('[profile.service] Session verified, user id:', session.user.id)
    
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        name: user.name,
        email: user.email ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    
    if (error) {
      // Log full error details for debugging
      console.error('[profile.service] upsertProfile error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        full: JSON.stringify(error),
      })
      
      // Retry on certain errors that might be timing-related
      if (attempt < maxRetries - 1 && (error.code === 'PGRST301' || error.code === '42501')) {
        console.log(`[profile.service] Retrying after RLS error... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      
      return { error: error.message || 'Failed to save profile' }
    }
    
    console.log('[profile.service] upsertProfile success')
    return { success: true }
  }
  
  return { error: 'Failed to save profile after multiple attempts' }
}

/**
 * Get profile name from database for a user
 * 
 * @param userId - User ID
 * @returns Profile name or null if not found
 */
export async function getProfileName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single()
  
  if (error) {
    // PGRST116 = no rows returned, which is expected for new users
    if (error.code !== 'PGRST116') {
      console.error('[profile.service] getProfileName error:', error)
    }
    return null
  }
  
  console.log('[profile.service] getProfileName result:', { userId, name: data?.name })
  return data?.name ?? null
}
