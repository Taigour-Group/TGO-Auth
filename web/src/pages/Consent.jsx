import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Button, Alert, Spinner, IconCheck } from '../components/ui.jsx';

// Plain-language descriptions of the scopes an app can request.
const SCOPE_COPY = {
  openid: { title: 'Verify your identity', desc: 'Confirm who you are with TGO.' },
  profile: { title: 'See your basic profile', desc: 'Your name.' },
  email: { title: 'See your email address', desc: 'Your email address and whether it is verified.' },
};

function initials(user) {
  const a = (user.firstName || '').trim();
  const b = (user.lastName || '').trim();
  if (a || b) return ((a[0] || '') + (b[0] || '')).toUpperCase();
  return (user.email || '?')[0].toUpperCase();
}

export default function Consent() {
  const { user, loading } = useAuth();
  const [sp] = useSearchParams();
  const params = useMemo(() => Object.fromEntries(sp.entries()), [sp]);

  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [error, setError] = useState(null);
  const [deciding, setDeciding] = useState(null); // 'approve' | 'deny' | null

  // Not signed in? Hand back to the server, which will route us through login
  // and then return here once a session exists.
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/oauth/authorize?' + sp.toString();
    }
  }, [loading, user, sp]);

  // Load the app's public metadata for the consent screen.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const qs = new URLSearchParams();
        if (params.client_id) qs.set('client_id', params.client_id);
        if (params.redirect_uri) qs.set('redirect_uri', params.redirect_uri);
        if (params.scope) qs.set('scope', params.scope);
        const data = await api.get('/oauth/client-info?' + qs.toString());
        if (alive) setInfo(data);
      } catch (err) {
        if (alive) setError(err.message || 'Could not load this app.');
      } finally {
        if (alive) setLoadingInfo(false);
      }
    })();
  }, [params.client_id, params.redirect_uri, params.scope]);

  async function decide(approve) {
    setDeciding(approve ? 'approve' : 'deny');
    setError(null);
    try {
      const { redirect } = await api.post('/oauth/decision', {
        approve,
        client_id: params.client_id,
        redirect_uri: params.redirect_uri,
        scope: params.scope || 'openid',
        state: params.state,
        code_challenge: params.code_challenge,
        code_challenge_method: params.code_challenge_method,
        nonce: params.nonce,
      });
      window.location.href = redirect;
    } catch (err) {
      setDeciding(null);
      setError(err.message || 'Something went wrong. Try again.');
    }
  }

  // ---- loading + guard states ----
  if (loading || !user || loadingInfo) {
    return (
      <AuthLayout>
        <div className="grid place-items-center py-6">
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  if (error && !info) {
    return (
      <AuthLayout title="Can’t continue" subtitle="We couldn’t start this sign-in">
        <Alert kind="error">{error}</Alert>
        <Button variant="secondary" block className="mt-5" onClick={() => (window.location.href = '/')}>
          Back to home
        </Button>
      </AuthLayout>
    );
  }

  if (info && info.redirectValid === false) {
    return (
      <AuthLayout title="Can’t continue" subtitle="This app isn’t set up correctly">
        <Alert kind="error">
          The address this app asked to return to isn’t registered with TGO ID. For your security,
          we stopped here.
        </Alert>
      </AuthLayout>
    );
  }

  const scopes = info?.scopes?.length ? info.scopes : ['openid'];

  return (
    <AuthLayout
      title={`Continue to ${info.name}`}
      subtitle="This app wants to use your TGO account"
    >
      <div className="mb-5 flex items-center justify-center gap-2.5 text-sm text-ink-muted">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">
          {initials(user)}
        </span>
        Signed in as {user.email}
      </div>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <p className="mb-3 text-[15px] text-ink">
        <span className="font-medium">{info.name}</span> will be able to:
      </p>

      <ul className="overflow-hidden rounded-[10px] border border-line">
        {scopes.map((s) => {
          const c = SCOPE_COPY[s] || { title: s, desc: '' };
          return (
            <li
              key={s}
              className="flex items-start gap-3 px-4 py-3 [&+li]:border-t [&+li]:border-line"
            >
              <span className="mt-0.5 flex-none text-success">
                <IconCheck />
              </span>
              <div>
                <div className="text-[15px] font-medium">{c.title}</div>
                {c.desc && <div className="text-[13px] text-ink-muted">{c.desc}</div>}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex gap-3">
        <Button
          variant="secondary"
          block
          onClick={() => decide(false)}
          loading={deciding === 'deny'}
          disabled={!!deciding}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          block
          onClick={() => decide(true)}
          loading={deciding === 'approve'}
          disabled={!!deciding}
        >
          Allow access
        </Button>
      </div>

      <p className="mt-4 text-center text-[13px] text-ink-subtle">
        Only continue if you trust this app. You can sign out anytime from your account.
      </p>
    </AuthLayout>
  );
}
