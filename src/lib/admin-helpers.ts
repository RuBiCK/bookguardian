import { auth } from '@/auth'
import { prisma } from './prisma'

/**
 * Require admin access - throws error if not admin
 */
export async function requireAdmin() {
  const session = await auth()

  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { role: true },
  })

  if (user?.role !== 'ADMIN') {
    throw new Error('Admin access required')
  }

  return session.user
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
