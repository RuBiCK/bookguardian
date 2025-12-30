-- Backfill script to add usage tracking fields to existing users
-- Run this AFTER the Prisma migration

-- 1. Update all existing users with default FREE tier settings
UPDATE "User"
SET
  role = 'USER',
  tier = 'FREE',
  "monthlyTokenQuota" = 50000,
  "monthlyCallQuota" = 20,
  "tokensUsed" = 0,
  "callsUsed" = 0,
  "quotaResetDate" = NOW() + INTERVAL '1 month'
WHERE role IS NULL OR role = '';

-- 2. Set the first user (by creation date) as ADMIN with UNLIMITED tier
-- This assumes the first user is the owner/admin
UPDATE "User"
SET
  role = 'ADMIN',
  tier = 'UNLIMITED',
  "monthlyTokenQuota" = 999999999,
  "monthlyCallQuota" = 999999
WHERE id = (
  SELECT id
  FROM "User"
  ORDER BY "createdAt" ASC
  LIMIT 1
);

-- 3. Show the results
SELECT
  id,
  email,
  name,
  role,
  tier,
  "monthlyTokenQuota",
  "monthlyCallQuota",
  "tokensUsed",
  "callsUsed",
  "quotaResetDate"
FROM "User"
ORDER BY "createdAt" ASC;
