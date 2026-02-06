/**
 * group.service.ts - Supabase groups CRUD and membership
 *
 * Purpose: Load user's groups, create group, join by code
 * Responsibilities: Call RPCs; map DB response to domain Group
 * Dependencies: lib/supabase/client, lib/types/expense.types
 *
 * Data flow: AuthScreen/Context → group.service → Supabase RPC → Group[]
 *
 * @example
 * ```ts
 * const groups = await loadUserGroups()
 * const group = await createGroup('My Room')
 * const group = await joinGroupByCode('ABC123')
 * ```
 */

import { supabase } from '@/lib/supabase/client'
import type { Group, User } from '@/lib/types/expense.types'

/** Raw member shape from RPC JSON */
interface RawMember {
  id?: string
  name?: string
  email?: string
}

/** Maps RPC member row to User */
function toUser(m: RawMember): User {
  return {
    id: m.id ?? '',
    name: m.name ?? 'User',
    email: m.email,
  }
}

/** Maps RPC group object to Group */
function toGroup(g: { id: string; name: string; code: string; createdBy?: string; members?: unknown }): Group {
  const raw = Array.isArray(g.members) ? g.members : []
  const members = raw.map((m) => toUser(m as RawMember))
  return {
    id: String(g.id),
    name: g.name,
    code: g.code,
    createdBy: g.createdBy ? String(g.createdBy) : undefined,
    members,
  }
}

/**
 * Load all groups the current user belongs to
 *
 * Calls get_user_groups() RPC when authenticated.
 * Returns [] when not signed in, when user has no groups, or on error.
 *
 * @returns Group[] — empty on error, no session, or when user has no groups
 */
export async function loadUserGroups(): Promise<Group[]> {
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session?.user) {
    return []
  }

  const { data, error } = await supabase.rpc('get_user_groups')
  if (error) {
    console.error(
      '[group.service] loadUserGroups error:',
      error.message ?? error.code ?? JSON.stringify(error)
    )
    if (error.details) console.error('[group.service] details:', error.details)
    return []
  }
  // RPC returns [] when user has no groups, or null; normalize to array
  const arr = Array.isArray(data) ? data : data != null ? [data] : []
  return arr.map((g: { id: string; name: string; code: string; createdBy?: string; members?: unknown[] }) => toGroup(g))
}

/**
 * Create a new group and add the current user as first member
 *
 * Calls create_group(name) RPC; returns the created group with members.
 *
 * @param name - Group display name
 * @returns Group or null on error
 */
export async function createGroup(name: string): Promise<Group | null> {
  const { data, error } = await supabase.rpc('create_group', { p_name: name })
  if (error) {
    console.error('[group.service] createGroup error:', error)
    throw new Error(error.message ?? 'Failed to create room')
  }
  return data ? toGroup(data) : null
}

/**
 * Join a group by invite code
 *
 * Calls join_group_by_code(code) RPC; adds current user to group_members.
 *
 * @param code - Invite code (case-insensitive)
 * @returns Group or null on error / invalid code
 */
export async function joinGroupByCode(code: string): Promise<Group | null> {
  const { data, error } = await supabase.rpc('join_group_by_code', { p_code: code.trim() })
  if (error) {
    console.error('[group.service] joinGroupByCode error:', error)
    throw new Error(error.message ?? 'Invalid invite code')
  }
  return data ? toGroup(data) : null
}

/**
 * Remove a member from a group. Caller must be the room creator (admin) or the member themselves (leave).
 *
 * @param groupId - Group id
 * @param memberUserId - User id to remove (must be self or caller must be creator)
 * @returns true if removed, false on error
 */
export async function removeMemberFromRoom(
  groupId: string,
  memberUserId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('remove_member_from_group', {
    p_group_id: groupId,
    p_member_user_id: memberUserId,
  })
  if (error) {
    console.error('[group.service] removeMemberFromRoom error:', error)
    return false
  }
  return true
}

/**
 * Leave the current room (remove current user from group).
 *
 * @param groupId - Group id
 * @returns true if left, false on error
 */
export async function leaveRoom(groupId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession()
  const userId = session?.session?.user?.id
  if (!userId) return false
  return removeMemberFromRoom(groupId, userId)
}
