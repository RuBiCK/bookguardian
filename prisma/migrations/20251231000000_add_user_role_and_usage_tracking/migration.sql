-- AlterTable - Add usage tracking and role columns to User (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'role') THEN
        ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'tier') THEN
        ALTER TABLE "User" ADD COLUMN "tier" TEXT NOT NULL DEFAULT 'FREE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'monthlyTokenQuota') THEN
        ALTER TABLE "User" ADD COLUMN "monthlyTokenQuota" INTEGER NOT NULL DEFAULT 50000;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'monthlyCallQuota') THEN
        ALTER TABLE "User" ADD COLUMN "monthlyCallQuota" INTEGER NOT NULL DEFAULT 20;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'tokensUsed') THEN
        ALTER TABLE "User" ADD COLUMN "tokensUsed" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'callsUsed') THEN
        ALTER TABLE "User" ADD COLUMN "callsUsed" INTEGER NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'quotaResetDate') THEN
        ALTER TABLE "User" ADD COLUMN "quotaResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- AlterTable - Add metadataSource to Book (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Book' AND column_name = 'metadataSource') THEN
        ALTER TABLE "Book" ADD COLUMN "metadataSource" TEXT DEFAULT 'manual';
    END IF;
END $$;

-- CreateTable - UsageLog (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "UsageLog" (
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

-- CreateIndex (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UsageLog_userId_createdAt_idx') THEN
        CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UsageLog_createdAt_idx') THEN
        CREATE INDEX "UsageLog_createdAt_idx" ON "UsageLog"("createdAt");
    END IF;
END $$;

-- AddForeignKey (IF NOT EXISTS)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'UsageLog_userId_fkey' AND table_name = 'UsageLog'
    ) THEN
        ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
