import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validate, cookieOptions } from '../middleware.js';
import { env } from '../env.js';
import { hashPassword, verifyPassword, randomToken, sha256 } from '../crypto.js';
import { getUserByEmail, createUser, createSession, deleteSession } from '../supabase.js';

const router = Router();

const emailField = z.string().trim().toLowerCase().email('A valid email is required');
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password is too long');

const signupSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: emailField,
  password: passwordField,
  dob: z.string().trim().max(40).optional().nullable(),
  gender: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

// Shape the user object we are willing to send to the browser (never the hash).
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    dob: u.dob,
    gender: u.gender,
    country: u.country,
    phone: u.phone,
    emailVerified: u.email_verified,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
  };
}

function emailAllowed(email) {
  if (!env.allowedEmailDomains.length) return true;
  const domain = String(email).split('@')[1]?.toLowerCase();
  return env.allowedEmailDomains.includes(domain);
}

// The one compulsory domain every account must use (e.g. @tgo.com).
function hasRequiredDomain(email) {
  return String(email).toLowerCase().endsWith('@' + env.emailDomain);
}

async function startSession(res, req, userId) {
  const raw = randomToken(32);
  const id = sha256(raw);
  await createSession({
    id,
    user_id: userId,
    expires_at: new Date(Date.now() + env.ttl.session * 1000).toISOString(),
    user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: req.ip || null,
  });
  res.cookie('tgo_sid', raw, cookieOptions(env.ttl.session * 1000));
}

router.post(
  '/signup',
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const d = req.data;
    if (!hasRequiredDomain(d.email)) {
      return res.status(400).json({
        error: 'invalid_email_domain',
        message: `Email must be a @${env.emailDomain} address`,
      });
    }
    if (!emailAllowed(d.email)) {
      const allowed = env.allowedEmailDomains.join(', ');
      return res
        .status(400)
        .json({ error: 'invalid_request', message: `Email must be one of: ${allowed}` });
    }
    if (await getUserByEmail(d.email)) {
      return res
        .status(409)
        .json({ error: 'email_taken', message: 'An account with that email already exists' });
    }
    const user = await createUser({
      email: d.email,
      password_hash: await hashPassword(d.password),
      first_name: d.firstName,
      last_name: d.lastName,
      dob: d.dob || null,
      gender: d.gender || null,
      country: d.country || null,
      phone: d.phone || null,
    });
    await startSession(res, req, user.id);
    res.status(201).json({ user: publicUser(user) });
  })
);

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.data;
    const user = await getUserByEmail(email);
    const ok = user && (await verifyPassword(password, user.password_hash));
    if (!ok) {
      return res
        .status(401)
        .json({ error: 'invalid_credentials', message: 'Incorrect email or password' });
    }
    await startSession(res, req, user.id);
    res.json({ user: publicUser(user) });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const raw = req.signedCookies?.tgo_sid;
    if (raw) await deleteSession(sha256(raw));
    res.clearCookie('tgo_sid', cookieOptions());
    res.json({ ok: true });
  })
);

// Returns { user } when signed in, { user: null } otherwise.
router.get(
  '/session',
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  })
);

export default router;
