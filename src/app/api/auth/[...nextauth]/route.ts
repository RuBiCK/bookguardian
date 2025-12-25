import { handlers } from "@/auth"

export const { GET, POST } = handlers

// Force Node.js runtime (required for Prisma)
export const runtime = 'nodejs'
