import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import {
  Alert,
  Button,
  Field,
  Spinner,
  TextInput,
  IconPlus,
  IconCopy,
  IconKey,
  IconTrash,
} from './ui.jsx';

/* ----------------------------- constants ---------------------------- */
const SCOPES = [
  {
    id: 'openid',
    label: 'openid',
    desc: 'Confirms identity and issues an ID token. Always required.',
    locked: true,
  },
  { id: 'profile', label: 'profile', desc: 'Name, birthday, gender, country and picture.' },
  { id: 'email', label: 'email', desc: 'Email address and its verification status.' },
];

/* ------------------------------ helpers ----------------------------- */
function parseUris(text) {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isValidUri(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/* ---------------------------- copy button --------------------------- */
function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium
        text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
    >
      <IconCopy width={15} height={15} />
      {copied ? 'Copied' : label}
    </button>
  );
}

/* ------------------------------ badges ------------------------------ */
function TypeBadge({ isPublic }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ' +
        (isPublic ? 'bg-surface-2 text-ink-muted' : 'bg-ink/5 text-ink')
      }
    >
      {isPublic ? 'Public (PKCE)' : 'Confidential'}
    </span>
  );
}

function ScopeChips({ scopes }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {scopes.map((s) => (
        <span
          key={s}
          className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12px] text-ink-muted"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

/* ------------------------- one-time secret -------------------------- */
function SecretReveal({ clientId, secret, onDismiss }) {
  return (
    <div className="rounded-[12px] border border-accent/40 bg-accent/[0.06] p-4">
      <div className="mb-2 flex items-center gap-2 text-ink">
        <IconKey width={18} height={18} />
        <span className="font-semibold">Client secret created</span>
      </div>
      <p className="mb-3 text-[13px] text-ink-muted">
        Copy this now and store it somewhere safe — for security, it won&apos;t be shown again. If
        you lose it, rotate the secret to generate a new one.
      </p>
      <div className="mb-1 text-[12px] font-medium text-ink-muted">Client ID</div>
      <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <code className="truncate font-mono text-[13px] text-ink">{clientId}</code>
        <CopyButton value={clientId} />
      </div>
      <div className="mb-1 text-[12px] font-medium text-ink-muted">Client secret</div>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <code className="truncate font-mono text-[13px] text-ink">{secret}</code>
        <CopyButton value={secret} />
      </div>
      <div className="mt-3 text-right">
        <Button variant="secondary" size="sm" onClick={onDismiss}>
          I&apos;ve saved it
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------- scope list --------------------------- */
function ScopePicker({ selected, onToggle }) {
  return (
    <div className="flex flex-col gap-2">
      {SCOPES.map((s) => {
        const checked = selected.includes(s.id);
        return (
          <label
            key={s.id}
            className={
              'flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors ' +
              (checked ? 'border-line-strong bg-surface-2' : 'border-line bg-surface hover:bg-surface-2') +
              (s.locked ? ' cursor-not-allowed opacity-90' : '')
            }
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-ink"
              checked={checked}
              disabled={s.locked}
              onChange={() => onToggle(s.id)}
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <code className="font-mono text-[13px] font-medium text-ink">{s.label}</code>
                {s.locked && <span className="text-[12px] text-ink-subtle">required</span>}
              </span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">{s.desc}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ---------------------------- create form --------------------------- */
function CreateForm({ onCancel, onCreated }) {
  const [name, setName] = useState('');
  const [redirects, setRedirects] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [scopes, setScopes] = useState(['openid', 'profile', 'email']);
  const [errs, setErrs] = useState({});
  const [serverError, setServerError] = useState(null);
  const [busy, setBusy] = useState(false);

  const toggleScope = (id) => {
    if (id === 'openid') return;
    setScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  async function submit(e) {
    e.preventDefault();
    const uris = parseUris(redirects);
    const found = {};
    if (!name.trim()) found.name = 'Give your app a name';
    if (uris.length === 0) found.redirects = 'Add at least one redirect URI';
    else {
      const bad = uris.find((u) => !isValidUri(u));
      if (bad) found.redirects = `Not a valid http(s) URL: ${bad}`;
    }
    setErrs(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    setServerError(null);
    try {
      const res = await api.post('/api/apps', {
        name: name.trim(),
        redirectUris: uris,
        isPublic,
        scopes,
      });
      onCreated(res);
    } catch (err) {
      setBusy(false);
      setServerError(err.message || 'Could not create the application.');
    }
  }

  return (
    <div className="panel p-6">
      <div className="mb-5">
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] font-medium text-ink-muted hover:text-ink"
        >
          ← Back to apps
        </button>
        <h3 className="mt-2 text-lg font-semibold text-ink">Register a new application</h3>
        <p className="text-[13px] text-ink-muted">
          These details tell TGO how to talk to your app during sign-in.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {serverError && <Alert kind="error">{serverError}</Alert>}

        <Field label="Application name" htmlFor="app-name" error={errs.name} hint="Shown to users on the consent screen.">
          <TextInput
            id="app-name"
            autoFocus
            placeholder="My Web App"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!errs.name}
            maxLength={80}
          />
        </Field>

        <Field
          label="Redirect URIs"
          htmlFor="app-redirects"
          error={errs.redirects}
          hint="Where users return after authorizing. One per line — exact match required."
        >
          <textarea
            id="app-redirects"
            className={'textarea font-mono text-[13px]' + (errs.redirects ? ' input-invalid' : '')}
            rows={3}
            placeholder={'https://example.com/callback\nhttp://localhost:5173/callback'}
            value={redirects}
            onChange={(e) => setRedirects(e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="field-label">Application type</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={
                'rounded-[10px] border p-3 text-left transition-colors ' +
                (!isPublic ? 'border-ink bg-surface-2' : 'border-line hover:bg-surface-2')
              }
            >
              <span className="block font-medium text-ink">Confidential</span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">
                Server-side app that can keep a secret.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={
                'rounded-[10px] border p-3 text-left transition-colors ' +
                (isPublic ? 'border-ink bg-surface-2' : 'border-line hover:bg-surface-2')
              }
            >
              <span className="block font-medium text-ink">Public (PKCE)</span>
              <span className="mt-0.5 block text-[13px] text-ink-muted">
                SPA or mobile app. No secret; uses PKCE.
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="field-label">Scopes</span>
          <ScopePicker selected={scopes} onToggle={toggleScope} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" block loading={busy}>
            Create application
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ----------------------------- app detail --------------------------- */
function AppDetail({ app, admin, secret, onBack, onChanged, onDeleted, onSecret, onDismissSecret }) {
  const [name, setName] = useState(app.name);
  const [redirects, setRedirects] = useState(app.redirectUris.join('\n'));
  const [scopes, setScopes] = useState(app.scopes);
  const [errs, setErrs] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-sync the form when a different app is selected or the record refreshes.
  useEffect(() => {
    setName(app.name);
    setRedirects(app.redirectUris.join('\n'));
    setScopes(app.scopes);
    setErrs({});
    setServerError(null);
    setConfirmDelete(false);
  }, [app.id, app.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => {
    const uris = parseUris(redirects);
    return (
      name.trim() !== app.name ||
      uris.join('\n') !== app.redirectUris.join('\n') ||
      scopes.slice().sort().join(',') !== app.scopes.slice().sort().join(',')
    );
  }, [name, redirects, scopes, app]);

  const toggleScope = (id) => {
    if (id === 'openid') return;
    setScopes((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  async function save(e) {
    e.preventDefault();
    const uris = parseUris(redirects);
    const found = {};
    if (!name.trim()) found.name = 'Give your app a name';
    if (uris.length === 0) found.redirects = 'Add at least one redirect URI';
    else {
      const bad = uris.find((u) => !isValidUri(u));
      if (bad) found.redirects = `Not a valid http(s) URL: ${bad}`;
    }
    setErrs(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setServerError(null);
    try {
      await api.patch(`/api/apps/${app.id}`, {
        name: name.trim(),
        redirectUris: uris,
        scopes,
      });
      await onChanged();
    } catch (err) {
      setServerError(err.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function rotate() {
    setRotating(true);
    setServerError(null);
    try {
      const res = await api.post(`/api/apps/${app.id}/rotate-secret`);
      onSecret(app.id, res.clientSecret);
      await onChanged();
    } catch (err) {
      setServerError(err.message || 'Could not rotate the secret.');
    } finally {
      setRotating(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setServerError(null);
    try {
      await api.del(`/api/apps/${app.id}`);
      onDeleted();
    } catch (err) {
      setServerError(err.message || 'Could not delete the application.');
      setDeleting(false);
    }
  }

  return (
    <div className="panel p-6">
      <button
        type="button"
        onClick={onBack}
        className="text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        ← Back to apps
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-ink">{app.name}</h3>
        <TypeBadge isPublic={app.isPublic} />
        {admin && (
          <span className="text-[13px] text-ink-muted">
            Owner: {app.ownerEmail || 'Unowned'}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-ink-subtle">Created {fmtDate(app.createdAt)}</p>

      {secret && (
        <div className="mt-4">
          <SecretReveal clientId={app.clientId} secret={secret} onDismiss={onDismissSecret} />
        </div>
      )}

      {/* credentials */}
      <div className="mt-5">
        <div className="mb-1 text-[12px] font-medium text-ink-muted">Client ID</div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <code className="truncate font-mono text-[13px] text-ink">{app.clientId}</code>
          <CopyButton value={app.clientId} />
        </div>
        {!app.isPublic && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] text-ink-muted">
              Client secret is {app.hasSecret ? 'set' : 'not set'} and never shown after creation.
            </div>
            <Button variant="secondary" size="sm" onClick={rotate} loading={rotating}>
              <IconKey width={15} height={15} />
              Rotate secret
            </Button>
          </div>
        )}
      </div>

      <hr className="my-6 border-line" />

      {/* editable settings */}
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        {serverError && <Alert kind="error">{serverError}</Alert>}

        <Field label="Application name" htmlFor="edit-name" error={errs.name}>
          <TextInput
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!errs.name}
            maxLength={80}
          />
        </Field>

        <Field
          label="Redirect URIs"
          htmlFor="edit-redirects"
          error={errs.redirects}
          hint="One per line — exact match required."
        >
          <textarea
            id="edit-redirects"
            className={'textarea font-mono text-[13px]' + (errs.redirects ? ' input-invalid' : '')}
            rows={3}
            value={redirects}
            onChange={(e) => setRedirects(e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span className="field-label">Scopes</span>
          <ScopePicker selected={scopes} onToggle={toggleScope} />
        </div>

        <div>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </form>

      <hr className="my-6 border-line" />

      {/* danger zone */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">Delete this application</div>
          <div className="text-[13px] text-ink-muted">
            Users will no longer be able to sign in with it. This cannot be undone.
          </div>
        </div>
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={remove} loading={deleting}>
              <IconTrash width={15} height={15} />
              Confirm delete
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <IconTrash width={15} height={15} />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- list card ---------------------------- */
function AppCard({ app, admin, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="panel w-full p-4 text-left transition-colors hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{app.name}</div>
          <code className="mt-0.5 block truncate font-mono text-[12px] text-ink-subtle">
            {app.clientId}
          </code>
        </div>
        <TypeBadge isPublic={app.isPublic} />
      </div>
      <div className="mt-3">
        <ScopeChips scopes={app.scopes} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[12px] text-ink-subtle">
        <span>{app.redirectUris.length} redirect URI{app.redirectUris.length === 1 ? '' : 's'}</span>
        <span>·</span>
        <span>Created {fmtDate(app.createdAt)}</span>
        {admin && (
          <>
            <span>·</span>
            <span className="truncate">{app.ownerEmail || 'Unowned'}</span>
          </>
        )}
      </div>
    </button>
  );
}

/* --------------------------- main component -------------------------- */
export default function AppsManager({ admin = false }) {
  const [apps, setApps] = useState(null); // null while loading
  const [error, setError] = useState(null);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'detail'
  const [selectedId, setSelectedId] = useState(null);
  const [secret, setSecret] = useState(null); // { id, value } shown once

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get(admin ? '/api/apps/all' : '/api/apps');
      setApps(data.apps || []);
    } catch (err) {
      setError(err.message || 'Could not load applications.');
      setApps([]);
    }
  }, [admin]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedApp = useMemo(
    () => (apps || []).find((a) => a.id === selectedId) || null,
    [apps, selectedId]
  );

  // If the selected app vanished (deleted elsewhere), fall back to the list.
  useEffect(() => {
    if (view === 'detail' && apps && !selectedApp) {
      setView('list');
      setSelectedId(null);
    }
  }, [view, apps, selectedApp]);

  function openApp(id) {
    setSelectedId(id);
    setView('detail');
  }

  function backToList() {
    setView('list');
    setSelectedId(null);
    setSecret(null);
  }

  // ---- loading / error ----
  if (apps === null) {
    return (
      <div className="flex items-center gap-3 py-10 text-ink-muted">
        <Spinner /> Loading applications…
      </div>
    );
  }

  // ---- create ----
  if (view === 'create' && !admin) {
    return (
      <CreateForm
        onCancel={backToList}
        onCreated={async (res) => {
          await load();
          setSelectedId(res.app.id);
          setSecret(res.clientSecret ? { id: res.app.id, value: res.clientSecret } : null);
          setView('detail');
        }}
      />
    );
  }

  // ---- detail ----
  if (view === 'detail' && selectedApp) {
    return (
      <AppDetail
        app={selectedApp}
        admin={admin}
        secret={secret && secret.id === selectedApp.id ? secret.value : null}
        onBack={backToList}
        onChanged={load}
        onDeleted={backToList}
        onSecret={(id, value) => setSecret({ id, value })}
        onDismissSecret={() => setSecret(null)}
      />
    );
  }

  // ---- list ----
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            {admin ? 'All applications' : 'Your applications'}
          </h2>
          <p className="text-[13px] text-ink-muted">
            {admin
              ? 'Every OAuth client registered with TGO ID.'
              : 'OAuth clients you’ve registered for “Sign in with TGO”.'}
          </p>
        </div>
        {!admin && (
          <Button variant="primary" onClick={() => setView('create')}>
            <IconPlus width={16} height={16} />
            New app
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="panel flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="text-ink-muted">
            {admin ? 'No applications have been registered yet.' : 'You haven’t registered any apps yet.'}
          </div>
          {!admin && (
            <Button variant="secondary" size="sm" onClick={() => setView('create')}>
              <IconPlus width={16} height={16} />
              Register your first app
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} admin={admin} onOpen={() => openApp(app.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
