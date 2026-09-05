import { Link } from 'react-router-dom';
import { Logo } from '../components/ui.jsx';

const ISSUER = 'https://tgo-auth2-0.onrender.com';

function Code({ children }) {
  return <pre className="overflow-x-auto rounded-xl2 bg-ink p-4 text-xs leading-6 text-white">{children}</pre>;
}

function Section({ number, title, children }) {
  return (
    <section className="border-t border-line pt-8">
      <div className="flex gap-4">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-accent text-sm font-semibold text-white">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl">{title}</h2>
          <div className="mt-3 flex flex-col gap-4 text-sm leading-6 text-ink-muted">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function Guide() {
  return (
    <div className="min-h-full bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo />
          <Link to="/" className="text-sm font-medium text-ink-muted hover:text-ink hover:no-underline">
            Back to TGO ID
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent">Developer guide</p>
          <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">Add Sign in with TGO</h1>
          <p className="mt-5 text-lg leading-8 text-ink-muted">
            TGO uses standard OpenID Connect Authorization Code flow with PKCE. Your app sends the user to TGO,
            receives a one-time code, exchanges it for tokens, and reads the account profile from userinfo.
          </p>
        </div>

        <div className="mt-12 max-w-3xl space-y-10">
          <Section number="1" title="Register your app">
            <p>Open the TGO dashboard, choose <b>Your apps</b>, and create a public client for a browser or mobile app, or a confidential client for a server application.</p>
            <p>Your callback URL must exactly match the registered redirect URI.</p>
            <Code>{`# Public browser/mobile client
node server/scripts/create-client.mjs "My App" http://localhost:3000/callback --public

# Confidential server client
node server/scripts/create-client.mjs "My Server App" https://myapp.com/callback`}</Code>
          </Section>

          <Section number="2" title="Discover the endpoints">
            <p>Use discovery instead of hard-coding endpoint details in a client library:</p>
            <Code>{`${ISSUER}/.well-known/openid-configuration`}</Code>
            <p>The issuer is <b>{ISSUER}</b>. The main endpoints are <b>/oauth/authorize</b>, <b>/oauth/token</b>, and <b>/oauth/userinfo</b>.</p>
          </Section>

          <Section number="3" title="Start login with PKCE">
            <p>Generate a random verifier, hash it with SHA-256, and keep the verifier in session storage until the callback.</p>
            <Code>{`const verifier = crypto.randomUUID() + crypto.randomUUID();
const digest = await crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(verifier)
);
const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
  .replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
const state = crypto.randomUUID();

sessionStorage.setItem('tgo_verifier', verifier);
sessionStorage.setItem('tgo_state', state);

const params = new URLSearchParams({
  response_type: 'code',
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: 'http://localhost:3000/callback',
  scope: 'openid profile email',
  state,
  code_challenge: challenge,
  code_challenge_method: 'S256',
});
window.location.href = '${ISSUER}/oauth/authorize?' + params;`}</Code>
          </Section>

          <Section number="4" title="Exchange the callback code">
            <p>At your callback route, verify <b>state</b> before exchanging the code. Authorization codes are single-use and expire quickly.</p>
            <Code>{`const url = new URL(window.location.href);
if (url.searchParams.get('state') !== sessionStorage.getItem('tgo_state')) {
  throw new Error('Invalid OAuth state');
}

const body = new URLSearchParams({
  grant_type: 'authorization_code',
  code: url.searchParams.get('code'),
  client_id: 'YOUR_CLIENT_ID',
  redirect_uri: 'http://localhost:3000/callback',
  code_verifier: sessionStorage.getItem('tgo_verifier'),
});
const response = await fetch('${ISSUER}/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});
const tokens = await response.json();`}</Code>
          </Section>

          <Section number="5" title="Read the signed-in user">
            <Code>{`const response = await fetch('${ISSUER}/oauth/userinfo', {
  headers: { Authorization: 'Bearer ' + tokens.access_token },
});
const user = await response.json();
// user.sub is the stable TGO account id.
// user.email_verified tells you the verification status.`}</Code>
            <p>For server applications, validate the ID token signature using the JWKS URL from discovery and check its issuer, audience, expiry, and nonce.</p>
          </Section>

          <Section number="6" title="Refresh and sign out">
            <Code>{`const body = new URLSearchParams({
  grant_type: 'refresh_token',
  refresh_token: tokens.refresh_token,
  client_id: 'YOUR_CLIENT_ID',
});
const response = await fetch('${ISSUER}/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body,
});
const nextTokens = await response.json();
// Always replace the old refresh token; TGO rotates them.`}</Code>
            <p>On logout, revoke the latest refresh token at <b>{ISSUER}/oauth/revoke</b> and clear your app session.</p>
          </Section>

          <Section number="7" title="Email verification">
            <p>TGO sends new-account verification codes automatically. Your app does not need to create or validate those codes.</p>
            <p>Unverified users can sign in to TGO and access TMail to read their code, but TGO will not issue tokens to your app until the account is verified. After verification, restart the login flow.</p>
            <p>For a complete working browser example, open <b>examples/demo-client.html</b> in this repository.</p>
          </Section>

          <div className="border-t border-line pt-6 text-sm text-ink-muted">
            Need the full endpoint reference? Read <b>INTEGRATION.md</b> in the repository.
          </div>
        </div>
      </main>
    </div>
  );
}