import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { importPKCS8, exportJWK, calculateJwkThumbprint } from 'jose';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = path.join(__dirname, '..', '.keys');
const KEY_FILE = path.join(KEYS_DIR, 'private.pem');

export const signingAlg = 'RS256';

function loadPrivatePem() {
  // 1) explicit env key (production). Support single-line PEMs with escaped newlines.
  if (env.oidcPrivateKey && env.oidcPrivateKey.includes('BEGIN')) {
    return env.oidcPrivateKey.replace(/\\n/g, '\n');
  }
  // 2) previously generated dev key
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, 'utf8');
  }
  // 3) generate a dev key and persist it so JWKS stays stable across restarts
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(KEY_FILE, privateKey, { mode: 0o600 });
  console.warn(
    '[keys] OIDC_PRIVATE_KEY not set — generated a development key at server/.keys/private.pem'
  );
  return privateKey;
}

const pem = loadPrivatePem();

// Private key used for signing (jose KeyLike).
export const privateKey = await importPKCS8(pem, signingAlg);

// Derive the matching public JWK for the JWKS endpoint.
const publicKeyObject = crypto.createPublicKey(pem);
const publicJwk = await exportJWK(publicKeyObject);
publicJwk.alg = signingAlg;
publicJwk.use = 'sig';
export const kid = await calculateJwkThumbprint(publicJwk);
publicJwk.kid = kid;

export const jwks = { keys: [publicJwk] };
