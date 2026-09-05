# TGO ID

A self-hosted identity provider — your own "Sign in with TGO," built on **OpenID Connect** and **OAuth 2.0**. It lets people create one TGO account and use it to sign in to any number of your apps, the same way "Sign in with Google" works.

It has three parts:

| Folder      | What it is                                          | Dev URL                 |
| ----------- | --------------------------------------------------- | ----------------------- |
| `server/`   | The identity provider (Node + Express, Supabase DB) | `http://localhost:4000` |
| `web/`      | The account UI (Vite + React + Tailwind)            | `http://localhost:5173` |
| `examples/` | A sample "Sign in with TGO" client app              | `http://localhost:5500` |

The account UI is where people sign up, sign in, review the consent screen, and manage their profile and password. The server issues the tokens. The example shows another app logging a user in through TGO.

---

## What it does

- **Accounts** — sign up, sign in, sign out, edit profile, change password. Passwords are hashed with bcrypt; the sign-in session is a signed, httpOnly cookie.
- **A real OIDC provider** — authorization code flow with PKCE, ID tokens + access tokens (RS256), refresh tokens with rotation, a userinfo endpoint, token revocation, and standard discovery + JWKS documents.
- **Consent** — apps ask for scopes (`openid`, `profile`, `email`); the user approves on a consent screen before any code is issued.
- **Developer console** — a built-in web UI inside the account dashboard for registering and managing OAuth client apps: a self-service developer portal where anyone manages their own apps, plus an admin view over every app.
- **One compulsory email domain** — every account is `name@tgo.com`. The domain is a fixed, non-editable suffix at sign-up (like Gmail forcing `@gmail.com`) and is enforced on the server.
- **Storage** — everything lives in your Supabase (Postgres) project.

---

## Prerequisites

- **Node.js 20 LTS** (or 18.11+). The server uses ESM and `node --watch`.
- A **Supabase** project (free tier is fine).

---

## Setup

### Quick start (from the project root)

The root `package.json` wires both apps together with [`concurrently`](https://www.npmjs.com/package/concurrently), so you can install, build, and run everything with one set of commands:

```bash
npm install     # installs root + server + web in one go (postinstall cascades)
npm run dev     # runs server (:4000) and web (:5173) together, both hot-reloading
```

For a production-style local run: `npm run build` then `npm start` (builds the web app and serves the built assets via Vite preview alongside the server). Per-side scripts also exist — `npm run dev:server`, `npm run dev:web`, `npm run start:server`, `npm run start:web`.

Two one-time prerequisites still apply before either works: create the database tables and set the server's `.env` (steps 1–2 below). The remaining per-folder `npm install` calls are optional once the root install has run.

### 1. Create the database tables

In the Supabase dashboard, open **SQL Editor → New query**, paste the contents of [`server/db/schema.sql`](server/db/schema.sql), and run it. This creates the `users`, `oauth_clients`, `authorization_codes`, `refresh_tokens`, and `sessions` tables and seeds a `demo-app` client used by the example.

### 2. Run the identity server

```bash
cd server
cp .env.example .env
```

Edit `.env` and set at least:

- `SUPABASE_URL` — your project URL (`https://<ref>.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` — **Project Settings → API → service_role key** (server-side only — never ship this to a browser)
- `SESSION_SECRET` — a long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

Then install and start:

```bash
npm install
npm run dev
```

The server runs at `http://localhost:4000`. On first boot it generates an RS256 signing key and stores it in `server/.keys/` (git-ignored). Check discovery at `http://localhost:4000/.well-known/openid-configuration`.

### 3. Run the account UI

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api`, `/oauth`, and `/.well-known` to the server on `:4000`, so cookies stay first-party.

### 4. Try the demo client (optional)

Serve the `examples/` folder on port **5500** (the redirect URI the seed client is registered for):

```bash
npx serve examples -l 5500
# or:  python -m http.server 5500 --directory examples
```

Open `http://localhost:5500/demo-client.html` and click **Sign in with TGO**. You'll be sent to the account UI to sign in and approve, then bounced back with tokens and your profile.

---

## How sign-in works

TGO ID keeps the token logic on the server and renders login/consent in the React app:

1. A client app sends the browser to `GET /oauth/authorize` on the server (`:4000`).
2. The server validates the request. If there's no session yet, it redirects to the account UI's `/login`; after login it redirects to `/consent`.
3. On the consent screen the user approves, and the app posts the decision back. The server issues a one-time **authorization code** and redirects to the client's `redirect_uri`.
4. The client exchanges that code (plus its PKCE verifier) at `POST /oauth/token` for an `id_token`, `access_token`, and `refresh_token`.

To add sign-in to your own app, see **[INTEGRATION.md](INTEGRATION.md)**.

---

## Registering a client app

Every app that signs in through TGO needs a `client_id` and one or more registered redirect URIs. There are two ways to register one.

### Developer console (recommended)

Sign in to the account UI and open **Your apps** in the dashboard. Anyone can register and manage their own apps there: set the name, redirect URIs, and scopes, choose **Confidential** or **Public (PKCE)**, rotate the client secret, and delete apps. A confidential app's secret is shown **once** — at creation or after a rotate — so copy it then.

Users flagged as admins also get an **Admin** tab that lists and manages *every* app across all users. Grant or revoke admin from the `server/` folder:

```bash
node scripts/make-admin.mjs someone@tgo.com          # grant
node scripts/make-admin.mjs someone@tgo.com --revoke # revoke
```

### CLI (optional)

You can also register clients from the `server/` folder without signing in:

```bash
# Public client (SPA / mobile — uses PKCE, gets no secret):
node scripts/create-client.mjs "My SPA" http://localhost:3000/callback --public

# Confidential client (traditional server app — gets a secret, shown once):
node scripts/create-client.mjs "My Server App" https://myapp.com/callback
```

Apps created from the CLI have no owner, so they appear only in the admin view — not in any individual user's **Your apps** list.

---

## Going to production

- Serve everything over **HTTPS** and set `NODE_ENV=production` so the session cookie is marked `Secure`.
- Set `ISSUER` to the server's public HTTPS URL, `WEB_APP_URL` to the account UI's URL, and list every browser origin that calls the API in `CORS_ORIGINS`.
- Provide `OIDC_PRIVATE_KEY` from your secret manager instead of relying on the auto-generated `server/.keys/` file, so tokens stay valid across restarts and instances.
- Keep the **service-role key** on the server only. If it is ever exposed, rotate it in Supabase immediately.
- Every account uses one compulsory email domain, `tgo.com` by default. To change it, set `SIGNUP_EMAIL_DOMAIN` in the server's `.env` **and** update `EMAIL_DOMAIN` in `web/src/lib/config.js` to match (the sign-up/sign-in forms render it as a fixed suffix). `ALLOWED_EMAIL_DOMAINS` remains available as an optional extra allow-list.

---

## Project layout

```
tgo-id/
├─ server/            OIDC provider (Express)
│  ├─ src/
│  │  ├─ index.js         app bootstrap + middleware
│  │  ├─ env.js           configuration
│  │  ├─ keys.js          RS256 signing key + JWKS
│  │  ├─ crypto.js        hashing, PKCE, tokens helpers
│  │  ├─ tokens.js        ID / access token signing
│  │  ├─ supabase.js      data access
│  │  ├─ middleware.js    auth, admin, validation, rate limit
│  │  └─ routes/          auth, users, oauth, wellknown, apps
│  ├─ db/schema.sql       Postgres schema (run in Supabase)
│  ├─ scripts/            client registration + make-admin CLI
│  └─ .env.example
├─ web/               Account UI (Vite + React + Tailwind)
│  └─ src/
│     ├─ pages/           Landing, SignUp, Login, Consent, Dashboard
│     ├─ components/      UI primitives, layout, route guard, AppsManager
│     └─ lib/             API client, auth context, config
└─ examples/
   └─ demo-client.html    sample "Sign in with TGO" app
```
# TGO-Auth
