import { z } from 'zod';
import { idSchema } from '../schemas/common';

/** `GET /api/auth/me`: the signed-in user as the SPA needs it. */
export const authMeResponseSchema = z.object({
  id: idSchema,
  displayName: z.string(),
  /** Null only for the legacy local user before its first Google sign-in claims it. */
  email: z.email().nullable(),
  avatarUrl: z.url().nullable(),
});
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

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
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
