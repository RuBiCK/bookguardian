import { z } from 'zod';
import { idSchema, isoDateTimeSchema } from '../schemas/common';

/** `GET /api/auth/me`: the signed-in user as the SPA needs it. */
export const authMeResponseSchema = z.object({
  id: idSchema,
  displayName: z.string(),
  /** Null only for the legacy local user before its first Google sign-in claims it. */
  email: z.email().nullable(),
  avatarUrl: z.url().nullable(),
  /**
   * When the first-session tour was finished or skipped; `null` = still
   * pending, which is what makes the SPA open it. Part of the session
   * payload on purpose: the app shell already awaits this request behind the
   * splash, so the tour never flashes for someone who has seen it.
   */
  onboardingCompletedAt: isoDateTimeSchema.nullable(),
});
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

/**
 * `PATCH /api/auth/me`: the one write the SPA makes about the signed-in
 * user. `onboardingCompleted` is a one-way flag — finishing and skipping the
 * tour both send it, repeating it keeps the first timestamp, and nothing
 * clears it (re-opening the tour from Settings is a local action).
 */
export const updateMeInputSchema = z.object({
  onboardingCompleted: z.literal(true),
});
export type UpdateMeInput = z.infer<typeof updateMeInputSchema>;

/**
 * `DELETE /api/auth/me`: the account's own email, typed by the user, so a
 * stray request cannot wipe a library. Compared case-insensitively.
 */
export const deleteAccountInputSchema = z.object({
  confirmEmail: z.string().trim().min(1).max(254),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

/** `POST /api/auth/test-login` (NODE_ENV=test only): sign in as any email without Google. */
export const testLoginInputSchema = z.object({
  email: z.email().max(254),
  name: z.string().trim().min(1).max(120).optional(),
});
export type TestLoginInput = z.infer<typeof testLoginInputSchema>;

/** Error codes the auth endpoints reply with (shared so the SPA can key its copy on them). */
export const AUTH_ERROR_CODES = [
  'unauthenticated',
  'auth_not_configured',
  'invalid_state',
  'email_not_verified',
  'not_allowed',
  'oauth_error',
  'confirm_email_mismatch',
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
