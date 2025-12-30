import { prisma } from './prisma'
import { QUOTA_TIERS, TierType, estimateCost } from './quota-config'

export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public quotaType: 'tokens' | 'calls',
    public used: number,
    public limit: number,
    public resetDate: Date
  ) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

/**
 * Check if user has quota available before making an AI call
 */
export async function checkQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tier: true,
      monthlyCallQuota: true,
      callsUsed: true,
      quotaResetDate: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Check if quota needs reset (monthly)
  const now = new Date()
  if (now >= user.quotaResetDate) {
    await resetUserQuota(userId)
    return // After reset, user has full quota
  }

  // Check call quota
  if (user.callsUsed >= user.monthlyCallQuota) {
    throw new QuotaExceededError(
      'Monthly API call limit exceeded',
      'calls',
      user.callsUsed,
      user.monthlyCallQuota,
      user.quotaResetDate
    )
  }

  // Token quota will be checked after the call (we don't know token count before making the call)
}

/**
 * Log usage after a successful AI call and increment counters
 */
export async function logUsage(
  userId: string,
  model: string,
  operation: string,
  promptTokens: number,
  completionTokens: number
): Promise<void> {
  const totalTokens = promptTokens + completionTokens
  const cost = estimateCost(promptTokens, completionTokens)

  // Create usage log
  await prisma.usageLog.create({
    data: {
      userId,
      model,
      operation,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    },
  })

  // Update user's usage counters
  await prisma.user.update({
    where: { id: userId },
    data: {
      tokensUsed: { increment: totalTokens },
      callsUsed: { increment: 1 },
    },
  })

  console.log(`[Usage] User ${userId}: +${totalTokens} tokens, +1 call (${operation})`)
}

/**
 * Reset user's monthly quota
 */
export async function resetUserQuota(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tier: true },
  })

  if (!user) return

  const tier = QUOTA_TIERS[user.tier as TierType]
  const nextResetDate = new Date()
  nextResetDate.setMonth(nextResetDate.getMonth() + 1)

  await prisma.user.update({
    where: { id: userId },
    data: {
      tokensUsed: 0,
      callsUsed: 0,
      quotaResetDate: nextResetDate,
      monthlyTokenQuota: tier.monthlyTokens,
      monthlyCallQuota: tier.monthlyCalls,
    },
  })

  console.log(`[Quota] Reset quota for user ${userId} to tier ${user.tier}`)
}

/**
 * Get user's current quota status
 */
export async function getUserQuotaStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tier: true,
      monthlyTokenQuota: true,
      monthlyCallQuota: true,
      tokensUsed: true,
      callsUsed: true,
      quotaResetDate: true,
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const tierConfig = QUOTA_TIERS[user.tier as TierType]

  return {
    tier: user.tier,
    tierName: tierConfig.name,
    tokens: {
      used: user.tokensUsed,
      limit: user.monthlyTokenQuota,
      remaining: user.monthlyTokenQuota - user.tokensUsed,
      percentage: Math.min(100, (user.tokensUsed / user.monthlyTokenQuota) * 100),
    },
    calls: {
      used: user.callsUsed,
      limit: user.monthlyCallQuota,
      remaining: user.monthlyCallQuota - user.callsUsed,
      percentage: Math.min(100, (user.callsUsed / user.monthlyCallQuota) * 100),
    },
    resetDate: user.quotaResetDate,
  }
}
