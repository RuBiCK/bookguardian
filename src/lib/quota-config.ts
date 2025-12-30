export const QUOTA_TIERS = {
  FREE: {
    monthlyTokens: 50000, // ~20 book scans or ~6 shelf scans
    monthlyCalls: 20,
    name: 'Free',
    features: ['Basic shelf scanning', 'Book analysis'],
  },
  PRO: {
    monthlyTokens: 500000, // ~200 book scans or ~60 shelf scans
    monthlyCalls: 200,
    name: 'Pro',
    features: ['Unlimited shelf scanning', 'Priority support', 'Advanced analytics'],
  },
  UNLIMITED: {
    monthlyTokens: 999999999,
    monthlyCalls: 999999,
    name: 'Unlimited',
    features: ['Unlimited everything', 'Admin access'],
  },
} as const

export type TierType = keyof typeof QUOTA_TIERS

// Cost estimation (OpenAI GPT-4o pricing as of Dec 2024)
export const PRICING = {
  INPUT_TOKENS_PER_MILLION: 2.5, // $2.50 per 1M input tokens
  OUTPUT_TOKENS_PER_MILLION: 10.0, // $10.00 per 1M output tokens
}

export function estimateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * PRICING.INPUT_TOKENS_PER_MILLION
  const outputCost = (completionTokens / 1_000_000) * PRICING.OUTPUT_TOKENS_PER_MILLION
  return inputCost + outputCost
}
