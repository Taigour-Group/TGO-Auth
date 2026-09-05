// Grant (or revoke) admin rights for a TGO ID account, by email.
//
// Usage:
//   node scripts/make-admin.mjs someone@tgo.com
//   node scripts/make-admin.mjs someone@tgo.com --revoke
//
// Admins get the "Admin" section in the account dashboard, where they can see
// and manage every registered app. Regular users only see their own apps.

import { supabase } from '../src/supabase.js';

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const email = args.find((a) => !a.startsWith('--'));

if (!email) {
  console.error('Usage: node scripts/make-admin.mjs <email> [--revoke]');
  process.exit(1);
}

const { data, error } = await supabase
  .from('users')
  .update({ is_admin: !revoke, updated_at: new Date().toISOString() })
  .eq('email', email.toLowerCase())
  .select('id, email, is_admin')
  .maybeSingle();

if (error) {
  console.error('Failed:', error.message);
  process.exit(1);
}
if (!data) {
  console.error(`No account found for ${email}. Have them sign up first.`);
  process.exit(1);
}

console.log(`\n✓ ${data.email} is ${data.is_admin ? 'now an admin' : 'no longer an admin'}.\n`);
process.exit(0);
