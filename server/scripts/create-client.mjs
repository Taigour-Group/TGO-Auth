// Register a new OAuth client (an app allowed to "Sign in with TGO").
//
// Usage:
//   node scripts/create-client.mjs "My App" http://localhost:3000/callback
//   node scripts/create-client.mjs "My SPA" http://localhost:3000/callback --public
//
// Public clients (SPAs, mobile) use PKCE and get NO secret.
// Confidential clients (traditional server apps) get a secret shown ONCE.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { supabase } from '../src/supabase.js';

const args = process.argv.slice(2);
const isPublic = args.includes('--public');
const positional = args.filter((a) => !a.startsWith('--'));
const name = positional[0];
const redirectUris = positional.slice(1);

if (!name || redirectUris.length === 0) {
  console.error(
    'Usage: node scripts/create-client.mjs "App Name" <redirect_uri> [more_uris...] [--public]'
  );
  process.exit(1);
}

const clientId = 'app_' + crypto.randomBytes(6).toString('hex');
let clientSecret = null;
let clientSecretHash = null;
if (!isPublic) {
  clientSecret = crypto.randomBytes(32).toString('base64url');
  clientSecretHash = await bcrypt.hash(clientSecret, 12);
}

const { error } = await supabase.from('oauth_clients').insert({
  client_id: clientId,
  name,
  redirect_uris: redirectUris,
  is_public: isPublic,
  client_secret_hash: clientSecretHash,
  allowed_scopes: 'openid profile email',
});

if (error) {
  console.error('Failed to create client:', error.message);
  process.exit(1);
}

console.log('\n✓ Client created\n');
console.log('  client_id:     ' + clientId);
if (clientSecret) console.log('  client_secret: ' + clientSecret + '   ← store now, not shown again');
console.log('  type:          ' + (isPublic ? 'public (PKCE, no secret)' : 'confidential'));
console.log('  redirect_uris: ' + redirectUris.join(', '));
console.log('');
process.exit(0);
