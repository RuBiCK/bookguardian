import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function requireAuth() {
  const session = await auth()

  if (!session || !session.user) {
    throw new Error('Unauthorized')
  }

  return session.user
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}
