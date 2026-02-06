/**
 * POST /api/auth/delete-account
 * Deletes the current user's account. Requires Authorization: Bearer <access_token>.
 * Uses Supabase Admin API (service role) to delete the user. Supabase's public
 * auth API does not support DELETE /auth/v1/user (405 Method Not Allowed).
 * Requires SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json(
        { error: 'Not signed in' },
        { status: 401 }
      )
    }

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Validate token and get current user id via GoTrue (GET /user is supported)
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    })

    if (!userRes.ok) {
      const errBody = await userRes.json().catch(() => ({}))
      const msg = errBody?.msg ?? errBody?.message ?? 'Invalid or expired session'
      return NextResponse.json(
        { error: typeof msg === 'string' ? msg : 'Invalid or expired session' },
        { status: 401 }
      )
    }

    const userData = await userRes.json()
    const userId = userData?.id

    if (!userId) {
      return NextResponse.json(
        { error: 'Could not identify user' },
        { status: 401 }
      )
    }

    const admin = getSupabaseAdmin()
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('[delete-account] admin.deleteUser error:', deleteError)
      return NextResponse.json(
        { error: deleteError.message ?? 'Failed to delete account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[delete-account]', e)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
