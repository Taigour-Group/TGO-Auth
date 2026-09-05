import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Server-side admin client. Uses the service-role key, so it bypasses RLS.
// This must NEVER be exposed to the browser.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ----------------------------- Users ----------------------------- */
export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserById(id) {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createUser(row) {
  const { data, error } = await supabase.from('users').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateUser(id, patch) {
  const { data, error } = await supabase
    .from('users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* -------------------------- OAuth clients ------------------------- */
export async function getClient(clientId) {
  const { data, error } = await supabase
    .from('oauth_clients')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Look up a client by its internal row id (uuid) — used by the app console.
export async function getClientByRowId(id) {
  const { data, error } = await supabase
    .from('oauth_clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listClientsByOwner(userId) {
  const { data, error } = await supabase
    .from('oauth_clients')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listAllClients() {
  const { data, error } = await supabase
    .from('oauth_clients')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createOAuthClient(row) {
  const { data, error } = await supabase.from('oauth_clients').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateOAuthClient(id, patch) {
  const { data, error } = await supabase
    .from('oauth_clients')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteOAuthClient(id) {
  const { error } = await supabase.from('oauth_clients').delete().eq('id', id);
  if (error) throw error;
}

// Fetch id+email for a set of user ids (admin app list shows owner emails).
export async function getUsersByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('users').select('id, email').in('id', ids);
  if (error) throw error;
  return data || [];
}

/* ----------------------- Authorization codes ---------------------- */
export async function saveAuthCode(row) {
  const { error } = await supabase.from('authorization_codes').insert(row);
  if (error) throw error;
}

// Atomically mark a code consumed and return it — but only if it had not been
// used yet. Returns null when the code is missing or was already consumed,
// which prevents authorization-code replay even under concurrent requests.
export async function consumeAuthCode(codeHash) {
  const { data, error } = await supabase
    .from('authorization_codes')
    .update({ consumed: true })
    .eq('code_hash', codeHash)
    .eq('consumed', false)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* -------------------------- Refresh tokens ------------------------ */
export async function saveRefreshToken(row) {
  const { error } = await supabase.from('refresh_tokens').insert(row);
  if (error) throw error;
}
export async function getRefreshToken(tokenHash) {
  const { data, error } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function revokeRefreshToken(tokenHash) {
  const { error } = await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('token_hash', tokenHash);
  if (error) throw error;
}

/* ------------------------- SSO sessions --------------------------- */
export async function createSession(row) {
  const { error } = await supabase.from('sessions').insert(row);
  if (error) throw error;
}
export async function getSession(id) {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}
