import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler, requireAuth } from '../middleware.js';
import { env } from '../env.js';
import { randomToken, sha256, verifyPkce } from '../crypto.js';
import {
  getClient,
  saveAuthCode,
  consumeAuthCode,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  getUserById,
} from '../supabase.js';
import { signIdToken, signAccessToken, verifyAccessToken } from '../tokens.js';

const router = Router();

/* ------------------------------ helpers ------------------------------ */
const splitScopes = (scope) =>
  String(scope || '')
    .split(/\s+/)
    .filter(Boolean);

const registeredRedirects = (client) =>
  Array.isArray(client.redirect_uris) ? client.redirect_uris : [];

const isRegisteredRedirect = (client, uri) => registeredRedirects(client).includes(uri);

function claimsForScopes(user, scope) {
  const scopes = splitScopes(scope);
  const c = {};
  if (scopes.includes('profile')) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
    if (name) c.name = name;
    if (user.first_name) c.given_name = user.first_name;
    if (user.last_name) c.family_name = user.last_name;
  }
  if (scopes.includes('email')) {
    c.email = user.email;
    c.email_verified = !!user.email_verified;
  }
  return c;
}

function isTmailClient(client) {
  return client.client_id === env.tmailClientId;
}

function redirectWith(base, params) {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  return url.toString();
}

// Standalone error page (used only when we cannot safely redirect to the client).
function renderError(res, status, error, description) {
  res
    .status(status)
    .type('html')
    .send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sign-in error</title></head>
<body style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;background:#f6f7f9;color:#1a1a1a;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="background:#fff;border:1px solid #e6e6e6;border-radius:14px;padding:32px 36px;max-width:440px;box-shadow:0 8px 30px rgba(0,0,0,.06)">
<h2 style="margin:0 0 8px">Can't complete sign-in</h2>
<p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#d00;font-weight:600;margin:0 0 12px">${error}</p>
<p style="color:#555;margin:0">${description}</p></div></body></html>`);
}

/* ------------------------- GET /oauth/authorize -----------------------
 * Validates the request, then hands off to the web app for login/consent.
 */
router.get(
  '/authorize',
  asyncHandler(async (req, res) => {
    const {
      response_type,
      client_id,
      redirect_uri,
      scope = 'openid',
      state,
      code_challenge,
      code_challenge_method = 'S256',
      prompt,
    } = req.query;

    if (!client_id) return renderError(res, 400, 'invalid_request', 'Missing client_id.');
    const client = await getClient(String(client_id));
    if (!client) return renderError(res, 400, 'invalid_client', 'Unknown client_id.');

    // redirect_uri MUST be pre-registered — never redirect to an unknown URI.
    if (!redirect_uri || !isRegisteredRedirect(client, String(redirect_uri))) {
      return renderError(
        res,
        400,
        'invalid_request',
        'The redirect_uri is not registered for this client.'
      );
    }

    // From here it is safe to report errors back to the client via redirect.
    if (response_type !== 'code') {
      return res.redirect(
        redirectWith(redirect_uri, { error: 'unsupported_response_type', state })
      );
    }
    if (!splitScopes(scope).includes('openid')) {
      return res.redirect(
        redirectWith(redirect_uri, {
          error: 'invalid_scope',
          error_description: 'The openid scope is required',
          state,
        })
      );
    }
    if (client.is_public && !code_challenge) {
      return res.redirect(
        redirectWith(redirect_uri, {
          error: 'invalid_request',
          error_description: 'PKCE code_challenge is required for this client',
          state,
        })
      );
    }
    if (code_challenge && !['S256', 'plain'].includes(String(code_challenge_method))) {
      return res.redirect(
        redirectWith(redirect_uri, {
          error: 'invalid_request',
          error_description: 'Unsupported code_challenge_method',
          state,
        })
      );
    }

    const qs = req.originalUrl.split('?')[1] || '';

    if (!req.user) {
      if (prompt === 'none') {
        return res.redirect(redirectWith(redirect_uri, { error: 'login_required', state }));
      }
      const returnTo = encodeURIComponent(`${env.issuer}/oauth/authorize?${qs}`);
      return res.redirect(`${env.webAppUrl}/login?return_to=${returnTo}`);
    }

    if (!req.user.email_verified && !isTmailClient(client)) {
      const returnTo = encodeURIComponent(`${env.issuer}/oauth/authorize?${qs}`);
      return res.redirect(
        `${env.webAppUrl}/verify-email?email=${encodeURIComponent(req.user.email)}&returnTo=${returnTo}`
      );
    }

    // Signed in → show the consent screen (rendered by the web app).
    return res.redirect(`${env.webAppUrl}/consent?${qs}`);
  })
);

/* --------------------- GET /oauth/client-info -------------------------
 * Public metadata the consent screen needs to render.
 */
router.get(
  '/client-info',
  asyncHandler(async (req, res) => {
    const { client_id, redirect_uri, scope } = req.query;
    const client = await getClient(String(client_id || ''));
    if (!client) return res.status(404).json({ error: 'invalid_client' });
    res.json({
      clientId: client.client_id,
      name: client.name,
      scopes: splitScopes(scope || client.allowed_scopes),
      redirectValid: redirect_uri ? isRegisteredRedirect(client, String(redirect_uri)) : true,
    });
  })
);

/* ----------------------- POST /oauth/decision -------------------------
 * The signed-in user approves or denies. Issues the authorization code.
 */
router.post(
  '/decision',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      approve,
      client_id,
      redirect_uri,
      scope = 'openid',
      state,
      code_challenge,
      code_challenge_method = 'S256',
      nonce,
    } = req.body;

    const client = await getClient(String(client_id || ''));
    if (!client) return res.status(400).json({ error: 'invalid_client' });
    if (!req.user.email_verified && !isTmailClient(client)) {
      return res.status(403).json({
        error: 'email_not_verified',
        message: 'Verify your email before approving an application.',
      });
    }
    if (!isRegisteredRedirect(client, String(redirect_uri))) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: 'redirect_uri not registered' });
    }

    if (!approve) {
      return res.json({ redirect: redirectWith(redirect_uri, { error: 'access_denied', state }) });
    }

    const code = randomToken(32);
    await saveAuthCode({
      code_hash: sha256(code),
      client_id: client.client_id,
      user_id: req.user.id,
      redirect_uri,
      scope,
      code_challenge: code_challenge || null,
      code_challenge_method: code_challenge ? code_challenge_method : null,
      nonce: nonce || null,
      expires_at: new Date(Date.now() + env.ttl.code * 1000).toISOString(),
      consumed: false,
    });

    res.json({ redirect: redirectWith(redirect_uri, { code, state }) });
  })
);

/* ---------------------------- client auth ----------------------------- */
async function authenticateClient(req) {
  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;

  const authz = req.headers.authorization;
  if (authz && authz.startsWith('Basic ')) {
    const decoded = Buffer.from(authz.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    clientId = decodeURIComponent(decoded.slice(0, idx));
    clientSecret = decodeURIComponent(decoded.slice(idx + 1));
  }

  if (!clientId) return { error: 'invalid_client' };
  const client = await getClient(String(clientId));
  if (!client) return { error: 'invalid_client' };

  if (!client.is_public) {
    if (!clientSecret || !client.client_secret_hash) return { error: 'invalid_client' };
    const ok = await bcrypt.compare(clientSecret, client.client_secret_hash);
    if (!ok) return { error: 'invalid_client' };
  }
  return { client };
}

/* --------------------------- POST /oauth/token ------------------------ */
router.post(
  '/token',
  asyncHandler(async (req, res) => {
    const grant = req.body.grant_type;
    if (grant === 'authorization_code') return tokenFromCode(req, res);
    if (grant === 'refresh_token') return tokenFromRefresh(req, res);
    return res.status(400).json({ error: 'unsupported_grant_type' });
  })
);

async function issueTokens(res, { user, client, scope, nonce }) {
  if (!user.email_verified && !isTmailClient(client)) {
    return res.status(403).json({
      error: 'email_not_verified',
      error_description: 'Email verification is required.',
    });
  }
  const idToken = await signIdToken({
    sub: user.id,
    aud: client.client_id,
    nonce,
    claims: claimsForScopes(user, scope),
    ttl: env.ttl.id,
  });
  const accessToken = await signAccessToken({
    sub: user.id,
    aud: env.issuer,
    scope,
    ttl: env.ttl.access,
  });
  const refresh = randomToken(48);
  await saveRefreshToken({
    token_hash: sha256(refresh),
    client_id: client.client_id,
    user_id: user.id,
    scope,
    expires_at: new Date(Date.now() + env.ttl.refresh * 1000).toISOString(),
    revoked: false,
  });

  res.set('Cache-Control', 'no-store');
  res.json({
    token_type: 'Bearer',
    access_token: accessToken,
    id_token: idToken,
    refresh_token: refresh,
    expires_in: env.ttl.access,
    scope,
  });
}

async function tokenFromCode(req, res) {
  const auth = await authenticateClient(req);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const { client } = auth;

  const { code, redirect_uri, code_verifier } = req.body;
  if (!code) return res.status(400).json({ error: 'invalid_request', error_description: 'missing code' });

  const row = await consumeAuthCode(sha256(code));
  if (!row) {
    return res
      .status(400)
      .json({ error: 'invalid_grant', error_description: 'code is invalid or already used' });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'code expired' });
  }
  if (row.client_id !== client.client_id) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'client mismatch' });
  }
  if (row.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
  }
  if (!verifyPkce(code_verifier, row.code_challenge, row.code_challenge_method || 'S256')) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
  }

  const user = await getUserById(row.user_id);
  if (!user) return res.status(400).json({ error: 'invalid_grant' });

  return issueTokens(res, { user, client, scope: row.scope, nonce: row.nonce });
}

async function tokenFromRefresh(req, res) {
  const auth = await authenticateClient(req);
  if (auth.error) return res.status(401).json({ error: auth.error });
  const { client } = auth;

  const provided = req.body.refresh_token;
  if (!provided) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'missing refresh_token' });
  }
  const row = await getRefreshToken(sha256(provided));
  if (!row || row.revoked) return res.status(400).json({ error: 'invalid_grant' });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return res.status(400).json({ error: 'invalid_grant', error_description: 'refresh token expired' });
  }
  if (row.client_id !== client.client_id) return res.status(400).json({ error: 'invalid_grant' });

  const user = await getUserById(row.user_id);
  if (!user) return res.status(400).json({ error: 'invalid_grant' });

  // Rotate: revoke the presented token, issue a fresh set.
  await revokeRefreshToken(row.token_hash);
  return issueTokens(res, { user, client, scope: req.body.scope || row.scope, nonce: null });
}

/* -------------------------- /oauth/userinfo --------------------------- */
async function userinfo(req, res) {
  const authz = req.headers.authorization || '';
  if (!authz.startsWith('Bearer ')) {
    return res.status(401).set('WWW-Authenticate', 'Bearer').json({ error: 'invalid_token' });
  }
  let payload;
  try {
    payload = await verifyAccessToken(authz.slice(7));
  } catch {
    return res
      .status(401)
      .set('WWW-Authenticate', 'Bearer error="invalid_token"')
      .json({ error: 'invalid_token' });
  }
  const user = await getUserById(payload.sub);
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ sub: user.id, ...claimsForScopes(user, payload.scope) });
}
router.get('/userinfo', asyncHandler(userinfo));
router.post('/userinfo', asyncHandler(userinfo));

/* --------------------------- POST /oauth/revoke ----------------------- */
router.post(
  '/revoke',
  asyncHandler(async (req, res) => {
    const auth = await authenticateClient(req);
    if (auth.error) return res.status(401).json({ error: auth.error });
    const token = req.body.token;
    if (token) {
      const row = await getRefreshToken(sha256(token));
      if (row && row.client_id === auth.client.client_id) {
        await revokeRefreshToken(row.token_hash);
      }
    }
    res.json({ ok: true }); // RFC 7009 — always 200
  })
);

export default router;
