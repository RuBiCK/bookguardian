-- AlterTable - Add usage tracking and role columns to User
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN "monthlyTokenQuota" INTEGER NOT NULL DEFAULT 50000,
ADD COLUMN "monthlyCallQuota" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "tokensUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "callsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "quotaResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable - Add metadataSource to Book
ALTER TABLE "Book" ADD COLUMN "metadataSource" TEXT DEFAULT 'manual';

-- CreateTable - UsageLog
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL,
    "completionTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
