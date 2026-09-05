import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { asyncHandler, validate, requireAuth, requireAdmin } from '../middleware.js';
import {
  listClientsByOwner,
  listAllClients,
  getClientByRowId,
  createOAuthClient,
  updateOAuthClient,
  deleteOAuthClient,
  getUsersByIds,
} from '../supabase.js';

const router = Router();
router.use(requireAuth);

/* ------------------------------ helpers ------------------------------ */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => UUID_RE.test(String(s || ''));

const KNOWN_SCOPES = ['openid', 'profile', 'email'];
const splitScopes = (s) => String(s || '').split(/\s+/).filter(Boolean);

// Always keep openid; return scopes in a stable order as a space-joined string.
function normalizeScopes(scopes) {
  const set = new Set(scopes || []);
  set.add('openid');
  return KNOWN_SCOPES.filter((s) => set.has(s)).join(' ');
}

// The view of a client we are willing to send to the browser — never the hash.
function publicApp(c, ownerEmail) {
  return {
    id: c.id,
    clientId: c.client_id,
    name: c.name,
    redirectUris: Array.isArray(c.redirect_uris) ? c.redirect_uris : [],
    allowedScopes: c.allowed_scopes,
    scopes: splitScopes(c.allowed_scopes),
    isPublic: c.is_public,
    hasSecret: !!c.client_secret_hash,
    ownerUserId: c.owner_user_id,
    ...(ownerEmail !== undefined ? { ownerEmail } : {}),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

// Load a client by row id and confirm the caller may manage it (owner or admin).
// Writes the appropriate error response and returns null when not allowed.
async function loadForManage(req, res) {
  const { id } = req.params;
  if (!isUuid(id)) {
    res.status(404).json({ error: 'not_found', message: 'App not found' });
    return null;
  }
  const app = await getClientByRowId(id);
  if (!app) {
    res.status(404).json({ error: 'not_found', message: 'App not found' });
    return null;
  }
  if (app.owner_user_id !== req.user.id && !req.user.is_admin) {
    res.status(403).json({ error: 'forbidden', message: 'You do not have access to this app' });
    return null;
  }
  return app;
}

/* ------------------------------ schemas ------------------------------ */
const redirectUri = z
  .string()
  .trim()
  .max(400)
  .url('Each redirect URI must be a valid URL')
  .refine((u) => /^https?:\/\//i.test(u), 'Redirect URIs must start with http:// or https://');

const scopesField = z.array(z.enum(KNOWN_SCOPES)).max(3);

const createAppSchema = z.object({
  name: z.string().trim().min(1, 'App name is required').max(80),
  redirectUris: z.array(redirectUri).min(1, 'Add at least one redirect URI').max(20),
  isPublic: z.boolean().optional(),
  scopes: scopesField.optional(),
});

const updateAppSchema = z.object({
  name: z.string().trim().min(1, 'App name is required').max(80).optional(),
  redirectUris: z.array(redirectUri).min(1, 'Add at least one redirect URI').max(20).optional(),
  scopes: scopesField.optional(),
});

/* ----------------------- GET /api/apps/all (admin) --------------------
 * Declared before "/:id" so it isn't captured by the id param.
 */
router.get(
  '/all',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rows = await listAllClients();
    const ownerIds = [...new Set(rows.map((r) => r.owner_user_id).filter(Boolean))];
    const owners = await getUsersByIds(ownerIds);
    const emailById = Object.fromEntries(owners.map((o) => [o.id, o.email]));
    res.json({
      apps: rows.map((c) => publicApp(c, c.owner_user_id ? emailById[c.owner_user_id] || null : null)),
    });
  })
);

/* --------------------------- GET /api/apps ---------------------------- */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await listClientsByOwner(req.user.id);
    res.json({ apps: rows.map((c) => publicApp(c)) });
  })
);

/* --------------------------- POST /api/apps --------------------------- */
router.post(
  '/',
  validate(createAppSchema),
  asyncHandler(async (req, res) => {
    const { name, redirectUris, isPublic = true, scopes } = req.data;

    const clientId = 'app_' + crypto.randomBytes(6).toString('hex');
    let clientSecret = null;
    let clientSecretHash = null;
    if (!isPublic) {
      clientSecret = crypto.randomBytes(32).toString('base64url');
      clientSecretHash = await bcrypt.hash(clientSecret, 12);
    }

    const created = await createOAuthClient({
      client_id: clientId,
      name,
      redirect_uris: [...new Set(redirectUris)],
      is_public: isPublic,
      client_secret_hash: clientSecretHash,
      allowed_scopes: scopes ? normalizeScopes(scopes) : 'openid profile email',
      owner_user_id: req.user.id,
    });

    // clientSecret is returned exactly once, here — it is never stored in clear.
    res.status(201).json({ app: publicApp(created), clientSecret });
  })
);

/* ------------------------- GET /api/apps/:id -------------------------- */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const app = await loadForManage(req, res);
    if (!app) return;
    res.json({ app: publicApp(app) });
  })
);

/* ------------------------ PATCH /api/apps/:id ------------------------- */
router.patch(
  '/:id',
  validate(updateAppSchema),
  asyncHandler(async (req, res) => {
    const app = await loadForManage(req, res);
    if (!app) return;

    const patch = {};
    if (req.data.name !== undefined) patch.name = req.data.name;
    if (req.data.redirectUris !== undefined) patch.redirect_uris = [...new Set(req.data.redirectUris)];
    if (req.data.scopes !== undefined) patch.allowed_scopes = normalizeScopes(req.data.scopes);
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'invalid_request', message: 'No valid fields to update' });
    }

    const updated = await updateOAuthClient(app.id, patch);
    res.json({ app: publicApp(updated) });
  })
);

/* ------------------ POST /api/apps/:id/rotate-secret ------------------ */
router.post(
  '/:id/rotate-secret',
  asyncHandler(async (req, res) => {
    const app = await loadForManage(req, res);
    if (!app) return;
    if (app.is_public) {
      return res
        .status(400)
        .json({ error: 'invalid_request', message: 'Public clients do not use a secret' });
    }
    const clientSecret = crypto.randomBytes(32).toString('base64url');
    const updated = await updateOAuthClient(app.id, {
      client_secret_hash: await bcrypt.hash(clientSecret, 12),
    });
    res.json({ app: publicApp(updated), clientSecret });
  })
);

/* ------------------------ DELETE /api/apps/:id ------------------------ */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const app = await loadForManage(req, res);
    if (!app) return;
    await deleteOAuthClient(app.id);
    res.json({ ok: true });
  })
);

export default router;
