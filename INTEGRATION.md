# Integrating "Sign in with TGO"

This guide shows how to let your app sign users in through TGO ID. The flow is standard **OpenID Connect / OAuth 2.0 Authorization Code with PKCE**, so any compliant client library works — but everything here is plain enough to implement by hand.

Throughout, the identity server is assumed to be at `http://localhost:4000`. In production, use its public HTTPS URL (the `ISSUER`).

---

## 1. Discovery

Everything a client library needs is published here:

```
GET http://localhost:4000/.well-known/openid-configuration
```

That document lists the endpoints below and points to the JWKS (`/.well-known/jwks.json`) used to verify token signatures. Most libraries only need the issuer URL:

```
http://localhost:4000
```

---

## 2. Register your app

The easiest way is the **developer console**: sign in to the account UI and open **Your apps** in the dashboard, then create an app — set its name, redirect URIs, scopes, and type. A confidential client's secret is shown once there. Or run the CLI from `server/`:

```bash
# SPA / mobile / any browser app — public client, uses PKCE, no secret:
node scripts/create-client.mjs "My App" http://localhost:3000/callback --public

# Traditional server-rendered app — confidential client, issued a secret:
node scripts/create-client.mjs "My Server App" https://myapp.com/callback
```

You get back a `client_id` (and, for confidential clients, a `client_secret` shown once). The `redirect_uri` you use later must **exactly match** one you registered.

Choose the type honestly:

- **Public** — code runs in a browser or on a device where a secret can't be kept. No secret; PKCE is required.
- **Confidential** — code runs on a server that can keep a secret. Authenticates to the token endpoint with the secret. PKCE still recommended.

---

## 3. The flow, step by step

### Step 1 — Send the user to `/authorize`

For a public (PKCE) client, first create a `code_verifier` and its `code_challenge`:

```js
// browser
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
const challenge = b64url(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
);
// keep `verifier` (e.g. sessionStorage) — you need it in step 3
```

Then redirect the browser (a top-level navigation, not fetch):

```
GET http://localhost:4000/oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=http://localhost:3000/callback
  &scope=openid%20profile%20email
  &state=RANDOM_STATE
  &nonce=RANDOM_NONCE
  &code_challenge=CHALLENGE
  &code_challenge_method=S256
```

| Parameter               | Required            | Notes                                            |
| ----------------------- | ------------------- | ------------------------------------------------ |
| `response_type`         | yes                 | Must be `code`.                                  |
| `client_id`             | yes                 | Your registered client.                          |
| `redirect_uri`          | yes                 | Must exactly match a registered URI.             |
| `scope`                 | yes                 | Space-separated; must include `openid`.          |
| `state`                 | recommended         | Opaque value; verify it on return (CSRF guard).  |
| `nonce`                 | recommended         | Echoed into the `id_token` for replay defense.   |
| `code_challenge`        | required for public | Base64url SHA-256 of your verifier.              |
| `code_challenge_method` | with challenge      | `S256` (recommended) or `plain`.                 |
| `prompt`                | optional            | `none` fails with `login_required` if no session.|

The user signs in (if needed) and approves your app on the consent screen.

### Step 2 — Receive the code at your redirect URI

The browser comes back to your `redirect_uri` with:

```
http://localhost:3000/callback?code=AUTH_CODE&state=RANDOM_STATE
```

Verify `state` matches what you sent. On denial or error you'll instead get `?error=access_denied&state=…`.

### Step 3 — Exchange the code for tokens

```
POST http://localhost:4000/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=http://localhost:3000/callback
&client_id=YOUR_CLIENT_ID
&code_verifier=YOUR_VERIFIER          # public clients (PKCE)
```

Confidential clients authenticate instead of sending `code_verifier` alone — either HTTP Basic (`Authorization: Basic base64(client_id:client_secret)`) or `client_id` + `client_secret` in the body. Using PKCE as well is encouraged.

Response:

```json
{
  "token_type": "Bearer",
  "access_token": "eyJ…",
  "id_token": "eyJ…",
  "refresh_token": "…",
  "expires_in": 900,
  "scope": "openid profile email"
}
```

- **`id_token`** — a signed JWT describing the user. Verify its signature against the JWKS, and check `iss`, `aud` (your `client_id`), `exp`, and `nonce`.
- **`access_token`** — use it as a Bearer token to call `/oauth/userinfo`.
- **`refresh_token`** — exchange later for a fresh set (see below).

Authorization codes are single-use and expire in ~60 seconds.

### Step 4 — Get the user's profile

```
GET http://localhost:4000/oauth/userinfo
Authorization: Bearer ACCESS_TOKEN
```

```json
{
  "sub": "b2c3…",
  "name": "Ada Lovelace",
  "given_name": "Ada",
  "family_name": "Lovelace",
  "email": "ada@example.com",
  "email_verified": false
}
```

`sub` is the stable user id — use it as the primary key for the account in your app.

---

## 4. Refreshing tokens

Access tokens are short-lived. Trade a refresh token for a new set:

```
POST http://localhost:4000/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=YOUR_REFRESH_TOKEN
&client_id=YOUR_CLIENT_ID
```

Refresh tokens **rotate**: each use revokes the old token and returns a new one, so always store the latest `refresh_token` from the response.

To revoke a refresh token (e.g. on logout):

```
POST http://localhost:4000/oauth/revoke
Content-Type: application/x-www-form-urlencoded

token=YOUR_REFRESH_TOKEN
&client_id=YOUR_CLIENT_ID
```

---

## 5. Scopes

| Scope     | Grants                                                        |
| --------- | ------------------------------------------------------------- |
| `openid`  | Required. Produces the `id_token` and the `sub` claim.        |
| `profile` | `name`, `given_name`, `family_name`.                          |
| `email`   | `email`, `email_verified`.                                    |

---

## 6. Using a standard library

Because discovery and JWKS are published, you can skip manual wiring. Point any OIDC client at the issuer:

```js
// Node, confidential client — using `openid-client`
import { Issuer } from 'openid-client';

const tgo = await Issuer.discover('http://localhost:4000');
const client = new tgo.Client({
  client_id: 'YOUR_CLIENT_ID',
  client_secret: 'YOUR_CLIENT_SECRET',
  redirect_uris: ['https://myapp.com/callback'],
  response_types: ['code'],
});
// client.authorizationUrl({ scope: 'openid profile email', ... })
// client.callback(...) / client.refresh(...) / client.userinfo(...)
```

Browser SPAs can use `oidc-client-ts`; the `examples/demo-client.html` file shows the same flow written by hand with the Web Crypto API.

---

## Endpoint reference

| Endpoint                             | Method     | Purpose                                  |
| ------------------------------------ | ---------- | ---------------------------------------- |
| `/.well-known/openid-configuration`  | GET        | Discovery document.                      |
| `/.well-known/jwks.json`             | GET        | Public keys for verifying token signatures. |
| `/oauth/authorize`                   | GET        | Start the flow; login + consent.         |
| `/oauth/token`                       | POST       | Code → tokens, and refresh.              |
| `/oauth/userinfo`                    | GET / POST | Profile claims for a Bearer access token.|
| `/oauth/revoke`                      | POST       | Revoke a refresh token.                  |

First-party endpoints used by the account UI (`/api/auth/*`, `/api/users/*`) are for the TGO ID web app itself, not for client integrations.
