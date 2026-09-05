import rateLimit from 'express-rate-limit';
import { env } from './env.js';
import { sha256 } from './crypto.js';
import { getSession, getUserById, deleteSession } from './supabase.js';

// Wrap async route handlers so thrown errors reach the error handler.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: env.isProd,
    path: '/',
    ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
  };
}

// Reads the signed SSO cookie, loads the session + user, attaches to req.user.
export async function attachUser(req, res, next) {
  try {
    const raw = req.signedCookies?.tgo_sid;
    if (!raw) return next();
    const session = await getSession(sha256(raw));
    if (!session) return next();
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await deleteSession(session.id);
      res.clearCookie('tgo_sid', cookieOptions());
      return next();
    }
    const user = await getUserById(session.user_id);
    if (user) {
      req.user = user;
      req.sessionId = session.id;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'forbidden', message: 'Admin access is required' });
  }
  next();
}

// zod validation middleware → puts parsed result on req.data
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join('; ');
    return res.status(400).json({ error: 'invalid_request', message });
  }
  req.data = result.data;
  next();
};

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests', message: 'Too many attempts — please wait and try again' },
});

export function notFound(req, res) {
  res.status(404).json({ error: 'not_found', message: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[error]', err?.message || err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: err.code || 'server_error',
    message: env.isProd ? 'Something went wrong' : String(err?.message || err),
  });
}
