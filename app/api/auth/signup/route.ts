/**
 * POST /api/auth/signup
 * Creates a new user with auto-confirmation (no email required).
 * Uses Supabase Admin API to create user and then signs them in.
 * Requires SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Email validation for dummy/test emails
const DUMMY_EMAIL_PATTERNS = [
  /^(abc|test|demo|fake|temp|dummy|example|sample|user|admin|asdf|qwerty|hello|name|email|mail)@/i,
  /^[a-z]{1,2}@/i,
  /^[a-z]\d@/i,
  /^(aaa|bbb|ccc|ddd|xxx|yyy|zzz)@/i,
  /^123|^111|^000/i,
]

const DISPOSABLE_DOMAINS = [
  'example.com', 'test.com', 'mailinator.com', 'tempmail.com', 'throwaway.com',
  'guerrillamail.com', 'sharklasers.com', 'fakeinbox.com', 'temp-mail.org',
  'yopmail.com', 'trashmail.com', 'getnada.com', '10minutemail.com'
]

function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmedEmail = email.trim().toLowerCase()
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Please enter a valid email address' }
  }

  const localPart = trimmedEmail.split('@')[0]
  if (localPart.length < 3) {
    return { valid: false, error: 'Please use a valid email address' }
  }

  for (const pattern of DUMMY_EMAIL_PATTERNS) {
    if (pattern.test(trimmedEmail)) {
      return { valid: false, error: 'Please use a valid email address, not a test/dummy email' }
    }
  }

  const domain = trimmedEmail.split('@')[1]
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { valid: false, error: 'Please use a valid email address, not a disposable email' }
  }

  if (/^(.)\1+$/.test(localPart)) {
    return { valid: false, error: 'Please use a valid email address' }
  }

  return { valid: true }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password } = body as { email?: string; password?: string }

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Validate email for dummy/test patterns
    const emailValidation = validateEmail(email)
    if (!emailValidation.valid) {
      return NextResponse.json({ error: emailValidation.error }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Create user with admin API (auto-confirmed, no email sent)
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm, no email sent
    })

    if (createError) {
      console.error('[signup] createUser error:', createError)
      // Handle "User already registered" case
      if (createError.message?.toLowerCase().includes('already') || createError.message?.toLowerCase().includes('exists')) {
        return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: createError.message ?? 'Failed to create account' }, { status: 400 })
    }

    if (!createData.user) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
    }

    // Sign in the user to get a session (using a fresh client with anon key)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (signInError || !signInData.session) {
      console.error('[signup] signIn error:', signInError)
      // User was created but sign-in failed; they can still log in manually
      return NextResponse.json({
        user: {
          id: createData.user.id,
          email: createData.user.email,
          name: createData.user.email?.split('@')[0] ?? 'User',
        },
        session: null,
        message: 'Account created. Please sign in.',
      })
    }

    return NextResponse.json({
      user: {
        id: createData.user.id,
        email: createData.user.email,
        name: createData.user.email?.split('@')[0] ?? 'User',
      },
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_at: signInData.session.expires_at,
      },
    })
  } catch (e) {
    console.error('[signup]', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
