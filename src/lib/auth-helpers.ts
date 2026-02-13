import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "./prisma"

/**
 * Returns the real session user, ignoring any impersonation cookie.
 * Used by admin routes that must always operate as the real admin.
 */
export async function requireRealAuth() {
  const session = await auth()

  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  return session.user
}

/**
 * Returns the effective user. If the caller is an admin with an
 * `impersonate-uid` cookie, returns the impersonated user's data instead.
 */
export async function requireAuth() {
  const session = await auth()

  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  const cookieStore = await cookies()
  const impersonateUid = cookieStore.get('impersonate-uid')?.value

  if (impersonateUid) {
    // Verify the real caller is an admin
    const realUser = await prisma.user.findUnique({
      where: { id: session.user.id as string },
      select: { role: true },
    })

    if (realUser?.role !== 'ADMIN') {
      // Non-admin with impersonation cookie — ignore it
      return session.user
    }

    // Fetch the impersonated user
    const impersonatedUser = await prisma.user.findUnique({
      where: { id: impersonateUid },
      select: { id: true, name: true, email: true, image: true },
    })

    if (impersonatedUser) {
      return {
        id: impersonatedUser.id,
        name: impersonatedUser.name,
        email: impersonatedUser.email,
        image: impersonatedUser.image,
      }
    }
  }

  return session.user
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}
