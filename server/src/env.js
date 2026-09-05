import 'dotenv/config';

function required(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var: ${name}. Copy server/.env.example to server/.env and fill it in.`
    );
  }
  return v;
}

const num = (name, def) => (process.env[name] ? Number(process.env[name]) : def);
const list = (name) =>
  (process.env[name] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: num('PORT', 4000),
  issuer: (process.env.ISSUER || 'http://localhost:4000').replace(/\/+$/, ''),
  webAppUrl: (process.env.WEB_APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  corsOrigins: list('CORS_ORIGINS').length ? list('CORS_ORIGINS') : ['http://localhost:5173'],
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-session-secret-change-me',
  oidcPrivateKey: process.env.OIDC_PRIVATE_KEY || '',
  allowedEmailDomains: list('ALLOWED_EMAIL_DOMAINS').map((d) => d.toLowerCase()),
  // Every account must use this email domain (like Gmail forcing @gmail.com).
  // The signup UI shows it as a fixed, non-editable suffix.
  emailDomain: (process.env.SIGNUP_EMAIL_DOMAIN || 'tgo.com')
    .toLowerCase()
    .replace(/^@+/, '')
    .trim(),
  ttl: {
    access: num('ACCESS_TOKEN_TTL', 900),
    id: num('ID_TOKEN_TTL', 900),
    refresh: num('REFRESH_TOKEN_TTL', 2592000),
    code: num('AUTH_CODE_TTL', 60),
    session: num('SESSION_TTL', 1209600),
  },
};
