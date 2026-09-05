import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// ---- Passwords ----
export async function hashPassword(pw) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw, hash) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

// ---- Random tokens & hashing ----
export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
export function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

// ---- PKCE (RFC 7636) ----
// Returns true when the verifier matches the stored challenge.
export function verifyPkce(codeVerifier, codeChallenge, method = 'S256') {
  if (!codeChallenge) return true; // client did not use PKCE
  if (!codeVerifier) return false;
  if (method === 'plain') {
    return timingSafeEqualStr(codeVerifier, codeChallenge);
  }
  const hashed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return timingSafeEqualStr(hashed, codeChallenge);
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
