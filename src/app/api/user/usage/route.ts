import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { getUserQuotaStatus } from '@/lib/quota-helpers'

export async function GET() {
  try {
    const user = await requireAuth()
    const quotaStatus = await getUserQuotaStatus(user.id as string)

    return NextResponse.json(quotaStatus)
  } catch (error) {
    console.error('Error fetching user usage:', error)
    return NextResponse.json(
      { error: 'Unauthorized or failed to fetch usage' },
      { status: 401 }
    )
  }
}
