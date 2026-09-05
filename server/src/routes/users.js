import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate, requireAuth } from '../middleware.js';
import { updateUser, getUserById } from '../supabase.js';
import { verifyPassword, hashPassword } from '../crypto.js';
import { publicUser } from './auth.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  country: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
});

const COLUMN = { firstName: 'first_name', lastName: 'last_name', country: 'country', phone: 'phone' };

router.patch(
  '/me',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const patch = {};
    for (const [key, value] of Object.entries(req.data)) {
      if (value !== undefined && COLUMN[key]) patch[COLUMN[key]] = value;
    }
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'invalid_request', message: 'No valid fields to update' });
    }
    const updated = await updateUser(req.user.id, patch);
    res.json({ user: publicUser(updated) });
  })
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
});

router.post(
  '/me/password',
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.data;
    const fresh = await getUserById(req.user.id);
    const ok = await verifyPassword(currentPassword, fresh.password_hash);
    if (!ok) {
      return res
        .status(401)
        .json({ error: 'invalid_credentials', message: 'Current password is incorrect' });
    }
    await updateUser(req.user.id, { password_hash: await hashPassword(newPassword) });
    res.json({ ok: true });
  })
);

export default router;
