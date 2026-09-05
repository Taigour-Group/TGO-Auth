import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { attachUser, errorHandler, notFound, authLimiter } from './middleware.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import appRoutes from './routes/apps.js';
import oauthRoutes from './routes/oauth.js';
import wellKnownRoutes from './routes/wellknown.js';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(origin, cb) {
      // No Origin header = same-origin, curl, or server-to-server → allow.
      if (!origin) return cb(null, true);
      return cb(null, env.corsOrigins.includes(origin));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(env.sessionSecret));
app.use(attachUser);

app.get('/health', (req, res) =>
  res.json({ ok: true, service: 'tgo-id', issuer: env.issuer })
);

app.use('/.well-known', wellKnownRoutes);
app.use('/oauth', oauthRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/apps', appRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  /* eslint-disable no-console */
  console.log('\n  ┌───────────────────────────────────────────────┐');
  console.log('  │   TGO ID — OpenID Connect identity provider     │');
  console.log('  └───────────────────────────────────────────────┘');
  console.log(`  Issuer:     ${env.issuer}`);
  console.log(`  Web app:    ${env.webAppUrl}`);
  console.log(`  Discovery:  ${env.issuer}/.well-known/openid-configuration`);
  console.log(`  Listening on port ${env.port}\n`);
});
