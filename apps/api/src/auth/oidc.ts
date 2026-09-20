/**
 * OpenID Connect client for Google: authorization code + PKCE, handled by the
 * server. `arctic` builds the authorization URL and exchanges the code;
 * `jose` verifies the `id_token` against Google's JWKS. The discovery
 * document and the key set are cached in memory.
 */
import {
  ArcticFetchError,
  CodeChallengeMethod,
  OAuth2Client,
  OAuth2RequestError,
  UnexpectedErrorResponseBodyError,
  UnexpectedResponseError,
} from 'arctic';
import { createRemoteJWKSet, customFetch, errors as joseErrors, jwtVerify } from 'jose';
import { z } from 'zod';

export const GOOGLE_ISSUER = 'https://accounts.google.com';
export const OIDC_SCOPES = ['openid', 'email', 'profile'];

export interface OidcClaims {
  /** `sub`: the provider's stable id for this account. */
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export interface AuthorizationRequest {
  state: string;
  codeVerifier: string;
  nonce: string;
}

export interface CodeExchange {
  code: string;
  codeVerifier: string;
  /** The nonce sent with the authorization request; must come back in the id_token. */
  nonce: string;
}

export interface OidcClient {
  createAuthorizationUrl(request: AuthorizationRequest): Promise<URL>;
  /** Exchange the code, verify the id_token (signature, iss, aud, exp, nonce) and return its claims. */
  exchangeCode(exchange: CodeExchange): Promise<OidcClaims>;
}

/** A failed or invalid provider round-trip. `status` is what the API should answer. */
export class OidcError extends Error {
  constructor(
    public readonly status: 400 | 503,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'OidcError';
  }
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface GoogleOidcOptions {
  clientId: string;
  clientSecret: string;
  /** `${AUTH_BASE_URL}/api/auth/google/callback`, registered in Google Cloud. */
  redirectUri: string;
  /** Override for tests pointing at a stub (the discovery URL is derived from it). */
  issuer?: string;
  /** Used for discovery and the JWKS; the token exchange goes through `arctic` (global fetch). */
  fetch?: FetchLike;
  /** How long the discovery document is reused. */
  discoveryTtlMs?: number;
  now?: () => Date;
}

const discoverySchema = z.object({
  issuer: z.string().min(1),
  authorization_endpoint: z.url(),
  token_endpoint: z.url(),
  jwks_uri: z.url(),
});
type Discovery = z.infer<typeof discoverySchema>;

const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(3),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
  nonce: z.string().optional(),
});

const HOUR_MS = 60 * 60 * 1000;

export function createGoogleOidcClient(options: GoogleOidcOptions): OidcClient {
  const issuer = (options.issuer ?? GOOGLE_ISSUER).replace(/\/$/, '');
  const fetchImpl: FetchLike = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const ttlMs = options.discoveryTtlMs ?? 24 * HOUR_MS;
  const now = options.now ?? (() => new Date());
  const client = new OAuth2Client(options.clientId, options.clientSecret, options.redirectUri);

  let cached:
    { discovery: Discovery; jwks: ReturnType<typeof createRemoteJWKSet>; at: number } | undefined;

  async function discover() {
    if (cached && now().getTime() - cached.at < ttlMs) return cached;
    try {
      const res = await fetchImpl(`${issuer}/.well-known/openid-configuration`);
      if (!res.ok) throw new Error(`discovery responded ${res.status}`);
      const discovery = discoverySchema.parse(await res.json());
      const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri), { [customFetch]: fetchImpl });
      cached = { discovery, jwks, at: now().getTime() };
      return cached;
    } catch (error) {
      throw new OidcError(503, 'Could not reach the identity provider', { cause: error });
    }
  }

  return {
    async createAuthorizationUrl({ state, codeVerifier, nonce }) {
      const { discovery } = await discover();
      const url = client.createAuthorizationURLWithPKCE(
        discovery.authorization_endpoint,
        state,
        CodeChallengeMethod.S256,
        codeVerifier,
        OIDC_SCOPES,
      );
      url.searchParams.set('nonce', nonce);
      return url;
    },

    async exchangeCode({ code, codeVerifier, nonce }) {
      const { discovery, jwks } = await discover();
      let idToken: string;
      try {
        const tokens = await client.validateAuthorizationCode(
          discovery.token_endpoint,
          code,
          codeVerifier,
        );
        idToken = tokens.idToken();
      } catch (error) {
        if (error instanceof ArcticFetchError) {
          throw new OidcError(503, 'Could not reach the identity provider', { cause: error });
        }
        if (
          error instanceof OAuth2RequestError ||
          error instanceof UnexpectedResponseError ||
          error instanceof UnexpectedErrorResponseBodyError
        ) {
          throw new OidcError(400, `Authorization code exchange failed: ${error.message}`, {
            cause: error,
          });
        }
        throw new OidcError(400, 'The identity provider returned no id_token', { cause: error });
      }

      let payload: unknown;
      try {
        ({ payload } = await jwtVerify(idToken, jwks, {
          // Google signs with either form of its issuer.
          issuer: [discovery.issuer, GOOGLE_ISSUER, 'accounts.google.com'],
          audience: options.clientId,
          currentDate: now(),
        }));
      } catch (error) {
        if (error instanceof joseErrors.JOSEError) {
          throw new OidcError(400, `id_token rejected: ${error.code}`, { cause: error });
        }
        throw error;
      }
      const parsed = claimsSchema.safeParse(payload);
      if (!parsed.success) throw new OidcError(400, 'id_token is missing required claims');
      if (parsed.data.nonce !== nonce) throw new OidcError(400, 'id_token nonce mismatch');
      return {
        subject: parsed.data.sub,
        email: parsed.data.email,
        emailVerified: parsed.data.email_verified === true,
        name: parsed.data.name ?? null,
        picture: parsed.data.picture ?? null,
      };
    },
  };
}
