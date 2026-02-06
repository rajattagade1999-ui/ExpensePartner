/**
 * POST /api/auth/reset-password-by-question
 * Body: { email: string, answer: string, newPassword: string }
 * Verifies security answer via RPC, then updates user password with service role.
 * Requires SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, answer, newPassword } = body as {
      email?: string
      answer?: string
      newPassword?: string
    }

    if (!email || typeof email !== 'string' || !answer || typeof answer !== 'string' || !newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'Email, answer, and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    const { data: userId, error: rpcError } = await admin.rpc('verify_security_answer', {
      p_email: email.trim(),
      p_answer: answer,
    })

    if (rpcError) {
      console.error('[reset-password-by-question] RPC error:', rpcError)
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid email or security answer' },
        { status: 401 }
      )
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId as string, {
      password: newPassword,
    })

    if (updateError) {
      console.error('[reset-password-by-question] updateUser error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password. Try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[reset-password-by-question]', e)
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    )
  }
}
