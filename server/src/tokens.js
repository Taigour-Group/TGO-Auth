import { SignJWT, jwtVerify, importJWK } from 'jose';
import { privateKey, jwks, kid, signingAlg } from './keys.js';
import { env } from './env.js';

let _publicKey;
async function publicKey() {
  if (!_publicKey) _publicKey = await importJWK(jwks.keys[0], signingAlg);
  return _publicKey;
}

// ---- ID token: identifies the user to the client app ----
export async function signIdToken({ sub, aud, nonce, claims = {}, ttl }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...claims, ...(nonce ? { nonce } : {}) })
    .setProtectedHeader({ alg: signingAlg, kid, typ: 'JWT' })
    .setIssuer(env.issuer)
    .setSubject(sub)
    .setAudience(aud)
    .setIssuedAt(now)
    .setExpirationTime(now + (ttl ?? env.ttl.id))
    .sign(privateKey);
}

// ---- Access token: presented to resource servers / userinfo ----
export async function signAccessToken({ sub, aud, scope, ttl }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ scope, token_use: 'access' })
    .setProtectedHeader({ alg: signingAlg, kid, typ: 'at+jwt' })
    .setIssuer(env.issuer)
    .setSubject(sub)
    .setAudience(aud ?? env.issuer)
    .setIssuedAt(now)
    .setExpirationTime(now + (ttl ?? env.ttl.access))
    .sign(privateKey);
}

export async function verifyAccessToken(token) {
  const key = await publicKey();
  const { payload } = await jwtVerify(token, key, { issuer: env.issuer });
  return payload;
}
