# Admin Dashboard Testing Guide

## Current Status
- ✅ Development server running on http://localhost:3003
- ✅ PostgreSQL database running
- ✅ All admin backend APIs implemented
- ✅ Admin dashboard UI completed
- ✅ Navigation link added for admin users
- ⚠️ Database is empty (no users yet)

## Testing Steps

### 1. Create Initial User Account
1. Open http://localhost:3003 in your browser
2. Click "Sign up" or navigate to registration
3. Create a new account with your email/password
4. Complete the signup process

### 2. Set First User as Admin
After creating your account, run the backfill script to set yourself as admin:

```bash
docker exec book-guardian-db psql -U library_user -d personal_library -f /scripts/backfill-usage-quotas.sql
```

Or run it directly:
```bash
docker exec -i book-guardian-db psql -U library_user -d personal_library << 'EOF'
-- Update all users with default quotas
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

-- Set first user as ADMIN with unlimited quota
UPDATE "User"
SET
  role = 'ADMIN',
  tier = 'UNLIMITED',
  "monthlyTokenQuota" = 999999999,
  "monthlyCallQuota" = 999999
WHERE id = (SELECT id FROM "User" ORDER BY "createdAt" LIMIT 1);

SELECT email, role, tier FROM "User";
EOF
```

**Alternative: Set a specific user as admin by email:**
```bash
docker exec -i book-guardian-db psql -U library_user -d personal_library << 'EOF'
UPDATE "User"
SET
  role = 'ADMIN',
  tier = 'UNLIMITED',
  "monthlyTokenQuota" = 999999999,
  "monthlyCallQuota" = 999999
WHERE email = 'your-email@example.com';

SELECT email, role, tier, "monthlyTokenQuota", "monthlyCallQuota" FROM "User" WHERE email = 'your-email@example.com';
EOF
```

**Or to grant admin access without unlimited quota:**
```bash
docker exec -i book-guardian-db psql -U library_user -d personal_library << 'EOF'
UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'your-email@example.com';

SELECT email, role, tier FROM "User" WHERE email = 'your-email@example.com';
EOF
```

### 3. Access Admin Dashboard
1. Refresh the page (or logout and login again)
2. Click on your profile picture/name in the top-right corner
3. You should now see "Admin Dashboard" option in the dropdown menu
4. Click "Admin Dashboard" to access the admin page at `/admin`

### 4. Verify Admin Dashboard Features

**Stats Cards (top section):**
- [ ] Total Users count displays correctly
- [ ] Total Tokens shows 0 (no AI calls yet)
- [ ] API Calls shows 0
- [ ] Last 24h activity shows 0

**User Management Table:**
- [ ] Your user account is listed
- [ ] Email and name display correctly
- [ ] Role shows "ADMIN" badge (purple)
- [ ] Tier shows "Unlimited"
- [ ] Token usage shows "0 / 999999999"
- [ ] Calls usage shows "0 / 999999"
- [ ] Libraries count shows your library count

**Tier Management:**
- [ ] Click the tier dropdown for your user
- [ ] Try changing tier to "Free" or "Pro"
- [ ] Verify the quota values update in the table
- [ ] Change back to "Unlimited"

### 5. Test Quota System with AI Call
1. Go to "Add Book" page
2. Upload a book cover image
3. Wait for AI analysis to complete
4. Check the admin dashboard again:
   - [ ] Tokens Used should have increased
   - [ ] Calls Used should show 1
   - [ ] Recent Activity section should show the operation

### 6. Test Non-Admin Access
1. Create a second user account (different email)
2. Login as the second user
3. Verify:
   - [ ] No "Admin Dashboard" link appears in the profile dropdown
   - [ ] Accessing `/admin` directly shows "Admin access required" message

### 7. Test Quota Enforcement
1. As admin, change second user's tier to "FREE"
2. Login as second user
3. Go to Settings page (verify usage card displays)
4. Make 20 AI calls (add books/scan shelves)
5. Try making the 21st call:
   - [ ] Should be blocked with quota exceeded error
   - [ ] Modal should show quota information and upgrade option

## Expected Behavior

### Admin User (Unlimited Tier)
- ✅ Can access `/admin` dashboard
- ✅ Can view all users and their usage
- ✅ Can change user tiers
- ✅ No quota limits on AI calls
- ✅ Usage is tracked but never blocked

### Regular User (Free Tier - 50k tokens, 20 calls)
- ✅ Cannot access admin dashboard
- ✅ Can view own usage in Settings page
- ✅ Gets blocked when quota exceeded
- ✅ Monthly quota resets automatically

### Regular User (Pro Tier - 500k tokens, 200 calls)
- ✅ Higher limits than Free
- ✅ Still gets blocked at limit
- ✅ Cannot access admin features

## Database Verification

Check user quotas:
```bash
docker exec book-guardian-db psql -U library_user -d personal_library -c "SELECT email, role, tier, \"tokensUsed\", \"callsUsed\", \"monthlyCallQuota\" FROM \"User\";"
```

Check usage logs:
```bash
docker exec book-guardian-db psql -U library_user -d personal_library -c "SELECT * FROM \"UsageLog\" ORDER BY \"createdAt\" DESC LIMIT 10;"
```

## Troubleshooting

### Admin link doesn't appear
- Check browser console for errors
- Verify `/api/user/me` returns `{ role: "ADMIN" }`
- Try hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

### "Admin access required" error
- Run the backfill SQL script again
- Verify user role: `docker exec book-guardian-db psql -U library_user -d personal_library -c "SELECT email, role FROM \"User\";"`

### Quota not enforced
- Check server console for errors
- Verify `analyze-book.ts` and `analyze-shelf.ts` have `checkQuota()` calls
- Restart dev server

## Implementation Summary

**Backend:**
- `/api/admin/users` - List all users
- `/api/admin/users/[id]` - Update user tier
- `/api/admin/stats` - Platform statistics
- `/api/user/me` - Current user info
- `/api/user/usage` - User quota status

**Frontend:**
- `/admin` - Admin dashboard page
- `Navigation.tsx` - Admin link (conditional)
- Stats cards with usage metrics
- User management table
- Tier selection dropdown

**Core Logic:**
- `quota-helpers.ts` - Quota enforcement and logging
- `quota-config.ts` - Tier definitions
- `openai-provider.ts` - Token usage capture
- Server actions - Quota checks before AI calls
