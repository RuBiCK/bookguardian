/**
 * A stand-in for Google's OIDC endpoints, served from a fake `fetch`:
 * discovery document, JWKS and the token endpoint, plus the authorization
 * step a browser would perform. It signs real RS256 id_tokens with a key
 * generated per fixture, so the API's verification (signature, iss, aud,
 * exp, nonce) runs for real. Knobs let a test hand out a tampered token.
 */
import { createHash } from 'node:crypto';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';

export interface FakeGoogleUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

export interface FakeGoogleOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  issuer?: string;
}

export interface TokenTamper {
  /** Sign with a key Google does not publish. */
  wrongKey?: boolean;
  /** Override the `aud` claim. */
  audience?: string;
  /** Override the `iss` claim. */
  issuer?: string;
  /** Override the `nonce` claim (`null` drops it). */
  nonce?: string | null;
  /** Token already expired. */
  expired?: boolean;
}

export interface FakeGoogle {
  issuer: string;
  user: FakeGoogleUser;
  tamper: TokenTamper;
  calls: { discovery: number; jwks: number; token: number };
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  /**
   * The user consents on the authorization page: check the request the API
   * built and hand back the code Google would redirect with.
   */
  authorize(location: string): { code: string; state: string };
}

export async function fakeGoogle(options: FakeGoogleOptions): Promise<FakeGoogle> {
  const issuer = options.issuer ?? 'https://fake-google.test';
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const rogue = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'fake-1', alg: 'RS256', use: 'sig' };
  const codes = new Map<string, { challenge: string; nonce: string }>();
  let nextCode = 1;

  const google: FakeGoogle = {
    issuer,
    user: {
      sub: 'google-sub-1',
      email: 'Ana.Lector@Example.com',
      email_verified: true,
      name: 'Ana Lector',
      picture: 'https://lh3.googleusercontent.com/ana.png',
    },
    tamper: {},
    calls: { discovery: 0, jwks: 0, token: 0 },

    authorize(location) {
      const url = new URL(location);
      if (url.origin + url.pathname !== `${issuer}/authorize`)
        throw new Error(`not Google: ${location}`);
      const p = url.searchParams;
      if (p.get('client_id') !== options.clientId) throw new Error('client_id mismatch');
      if (p.get('redirect_uri') !== options.redirectUri) throw new Error('redirect_uri mismatch');
      if (p.get('response_type') !== 'code') throw new Error('response_type');
      if (p.get('code_challenge_method') !== 'S256') throw new Error('PKCE method');
      const scope = p.get('scope')?.split(' ') ?? [];
      for (const s of ['openid', 'email', 'profile']) {
        if (!scope.includes(s)) throw new Error(`scope ${s} missing`);
      }
      const challenge = p.get('code_challenge');
      const state = p.get('state');
      const nonce = p.get('nonce');
      if (!challenge || !state || !nonce) throw new Error('challenge/state/nonce missing');
      const code = `code-${nextCode++}`;
      codes.set(code, { challenge, nonce });
      return { code, state };
    },

    async fetch(input) {
      const request = input instanceof Request ? input : new Request(String(input));
      const url = new URL(request.url);
      if (url.origin !== issuer) return new Response('not found', { status: 404 });

      if (url.pathname === '/.well-known/openid-configuration') {
        google.calls.discovery += 1;
        return Response.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/jwks`,
        });
      }
      if (url.pathname === '/jwks') {
        google.calls.jwks += 1;
        return Response.json({ keys: [jwk] });
      }
      if (url.pathname === '/token' && request.method === 'POST') {
        google.calls.token += 1;
        const auth = request.headers.get('authorization') ?? '';
        const expected = `Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString('base64')}`;
        if (auth !== expected) return oauthError('invalid_client', 401);
        const body = new URLSearchParams(await request.text());
        if (body.get('grant_type') !== 'authorization_code')
          return oauthError('unsupported_grant_type');
        if (body.get('redirect_uri') !== options.redirectUri) return oauthError('invalid_grant');
        const issued = codes.get(body.get('code') ?? '');
        if (!issued) return oauthError('invalid_grant');
        codes.delete(body.get('code')!);
        const verifier = body.get('code_verifier') ?? '';
        if (createHash('sha256').update(verifier).digest('base64url') !== issued.challenge) {
          return oauthError('invalid_grant');
        }
        const idToken = await signIdToken(issued.nonce);
        return Response.json({
          access_token: 'ya29.fake',
          token_type: 'Bearer',
          expires_in: 3599,
          scope: 'openid email profile',
          id_token: idToken,
        });
      }
      return new Response('not found', { status: 404 });
    },
  };

  async function signIdToken(nonce: string): Promise<string> {
    const t = google.tamper;
    const now = Math.floor(Date.now() / 1000);
    const claims: Record<string, unknown> = { ...google.user };
    const tokenNonce = t.nonce === undefined ? nonce : t.nonce;
    if (tokenNonce !== null) claims.nonce = tokenNonce;
    const key: CryptoKey = t.wrongKey ? rogue.privateKey : privateKey;
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'fake-1' })
      .setIssuer(t.issuer ?? issuer)
      .setAudience(t.audience ?? options.clientId)
      .setIssuedAt(t.expired ? now - 7200 : now)
      .setExpirationTime(t.expired ? now - 3600 : now + 3600)
      .sign(key);
  }

  return google;
}

function oauthError(error: string, status = 400): Response {
  return Response.json({ error, error_description: `fake google: ${error}` }, { status });
}

/** Parse `Set-Cookie` headers into `{ name: { value, attrs } }`. */
export function parseSetCookies(res: Response) {
  const out: Record<string, { value: string; attrs: Record<string, string | true> }> = {};
  for (const header of res.headers.getSetCookie()) {
    const [pair = '', ...rest] = header.split(';').map((s) => s.trim());
    const eq = pair.indexOf('=');
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const attrs: Record<string, string | true> = {};
    for (const attr of rest) {
      const i = attr.indexOf('=');
      if (i === -1) attrs[attr.toLowerCase()] = true;
      else attrs[attr.slice(0, i).toLowerCase()] = attr.slice(i + 1);
    }
    out[name] = { value, attrs };
  }
  return out;
}
