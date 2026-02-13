import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-helpers'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

const COOKIE_NAME = 'impersonate-uid'
const MAX_AGE = 60 * 60 // 1 hour

/**
 * POST — Start impersonating a user.
 * Body: { userId: string }
 */
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin()

    const rl = rateLimit(`impersonate:${admin.id}`, { limit: 10, windowMs: 60_000 })
    if (!rl.success) return rateLimitResponse(rl.resetTime)

    const { userId } = await request.json()

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    if (userId === admin.id) {
      return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, targetUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: MAX_AGE,
      path: '/',
    })

    return NextResponse.json({
      impersonating: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Impersonate POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE — End impersonation. Clears the cookie.
 */
export async function DELETE() {
  try {
    await requireAdmin()

    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0,
      path: '/',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Impersonate DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET — Check current impersonation status.
 */
export async function GET() {
  try {
    const admin = await requireAdmin()

    const rl = rateLimit(`impersonate-status:${admin.id}`, { limit: 60, windowMs: 60_000 })
    if (!rl.success) return rateLimitResponse(rl.resetTime)

    const cookieStore = await cookies()
    const impersonateUid = cookieStore.get(COOKIE_NAME)?.value

    if (!impersonateUid) {
      return NextResponse.json({ impersonating: null })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: impersonateUid },
      select: { id: true, email: true, name: true },
    })

    if (!targetUser) {
      // Cookie references a deleted user — clear it
      cookieStore.set(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/',
      })
      return NextResponse.json({ impersonating: null })
    }

    return NextResponse.json({
      impersonating: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
      },
    })
  } catch {
    // Non-admins and unauthenticated users: not impersonating
    return NextResponse.json({ impersonating: null })
  }
}
