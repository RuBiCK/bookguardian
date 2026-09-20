import { createFileRoute, redirect } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ensureSession, googleSignInUrl, safeRedirect } from '../api/auth';
import { AppMark } from '../components/AppMark';
import { GoogleSignInButton } from '../components/GoogleSignInButton';

const searchSchema = z.object({
  /** Where to go after signing in (only relative SPA paths are honoured). */
  redirect: z.string().optional().catch(undefined),
  /** Error code the API sent us back with (`?error=` on the return URL). */
  error: z.string().optional().catch(undefined),
});

/** Error codes with their own copy; anything else gets the generic message. */
const KNOWN_ERRORS = ['not_allowed', 'email_not_verified', 'auth_not_configured'] as const;
type KnownError = (typeof KNOWN_ERRORS)[number];
const isKnownError = (code: string): code is KnownError =>
  (KNOWN_ERRORS as readonly string[]).includes(code);

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const session = await ensureSession(context.queryClient);
    if (session) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- TanStack Router's redirect is thrown by design
      throw redirect({ to: safeRedirect(search.redirect) ?? '/', replace: true });
    }
  },
  component: LoginScreen,
});

function LoginScreen() {
  const { t } = useTranslation();
  const { redirect: back, error } = Route.useSearch();
  const returnTo = safeRedirect(back);
  const href = googleSignInUrl(returnTo);

  return (
    <main className="login" data-testid="login">
      <div className="login__brand">
        <AppMark className="app-mark app-mark--login" />
        <h1 className="login__title">{t('app.name')}</h1>
        <p className="login__tagline">{t('auth.tagline')}</p>
      </div>

      {error ? (
        <div className="login__error" role="alert" data-testid="login-error">
          <strong>{t('auth.error.title')}</strong>
          <p>{isKnownError(error) ? t(`auth.error.${error}`) : t('auth.error.generic')}</p>
        </div>
      ) : null}

      <div className="login__actions">
        <GoogleSignInButton href={href} label={t('auth.google')} />
        <p className="login__hint">{t('auth.hint')}</p>
      </div>
    </main>
  );
}
