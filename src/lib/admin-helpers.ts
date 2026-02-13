import { requireRealAuth } from './auth-helpers'
import { prisma } from './prisma'

/**
 * Require admin access - throws error if not admin.
 * Always uses the real session identity (ignores impersonation).
 */
export async function requireAdmin() {
  const user = await requireRealAuth()

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id as string },
    select: { role: true },
  })

  if (dbUser?.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }

  return user
}

/**
 * Check if current user is admin (non-throwing)
 */
export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin()
    return true
  } catch {
    return false
  }
}
