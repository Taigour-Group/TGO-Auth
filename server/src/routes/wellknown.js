import { Router } from 'express';
import { env } from '../env.js';
import { jwks, signingAlg } from '../keys.js';

const router = Router();

router.get('/openid-configuration', (req, res) => {
  const base = env.issuer;
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    userinfo_endpoint: `${base}/oauth/userinfo`,
    jwks_uri: `${base}/.well-known/jwks.json`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [signingAlg],
    token_endpoint_auth_methods_supported: [
      'client_secret_basic',
      'client_secret_post',
      'none',
    ],
    scopes_supported: ['openid', 'profile', 'email'],
    claims_supported: [
      'sub',
      'name',
      'given_name',
      'family_name',
      'email',
      'email_verified',
    ],
    code_challenge_methods_supported: ['S256', 'plain'],
  });
});

router.get('/jwks.json', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json(jwks);
});

export default router;
