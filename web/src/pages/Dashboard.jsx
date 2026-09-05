import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { api } from '../lib/api.js';
import {
  Logo,
  Button,
  Field,
  TextInput,
  PasswordInput,
  Alert,
  IconGrid,
  IconUser,
  IconLock,
  IconKey,
  IconShield,
} from '../components/ui.jsx';
import AppsManager from '../components/AppsManager.jsx';

const BASE_NAV = [
  { id: 'overview', label: 'Overview', icon: IconGrid },
  { id: 'personal', label: 'Personal info', icon: IconUser },
  { id: 'security', label: 'Security', icon: IconLock },
  { id: 'apps', label: 'Your apps', icon: IconKey },
];

function initials(user) {
  const a = (user.firstName || '').trim();
  const b = (user.lastName || '').trim();
  if (a || b) return ((a[0] || '') + (b[0] || '')).toUpperCase();
  return (user.email || '?')[0].toUpperCase();
}

function Avatar({ user, xl = false }) {
  return (
    <span
      className={
        'grid flex-none place-items-center rounded-full bg-ink font-semibold text-white ' +
        (xl ? 'h-16 w-16 text-2xl' : 'h-10 w-10 text-[15px]')
      }
    >
      {initials(user)}
    </span>
  );
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ------------------------------ Overview ------------------------------ */
function Overview({ user }) {
  const navigate = useNavigate();
  const [sendingCode, setSendingCode] = useState(false);
  const [verificationError, setVerificationError] = useState(null);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
  const stats = [
    { k: 'Name', v: fullName },
    { k: 'Email', v: user.email },
    { k: 'Member since', v: fmtDate(user.createdAt) },
  ];
  return (
    <div>
      <div className="mb-7 flex items-center gap-4">
        <Avatar user={user} xl />
        <div>
          <h1 className="text-2xl">Hi, {user.firstName || 'there'}</h1>
          <p className="text-ink-muted">Manage your TGO account and sign-in details.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.k} className="rounded-xl2 border border-line bg-surface p-5">
            <div className="mb-1.5 text-[13px] text-ink-muted">{s.k}</div>
            <div className="break-words text-[17px] font-semibold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl2 border border-line bg-surface p-5">
        <div className="mb-1.5 text-[13px] text-ink-muted">Email status</div>
        {user.emailVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success">
            Verified
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              Not verified
            </span>
            <Button
              size="sm"
              variant="primary"
              loading={sendingCode}
              onClick={async () => {
                setSendingCode(true);
                setVerificationError(null);
                try {
                  await api.post('/api/auth/resend-verification', { email: user.email });
                  navigate('/verify-email?email=' + encodeURIComponent(user.email));
                } catch (err) {
                  setVerificationError(err.message || 'Could not send a verification code.');
                  setSendingCode(false);
                }
              }}
            >
              Verify email
            </Button>
            {verificationError && <Alert kind="error">{verificationError}</Alert>}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- Personal info ---------------------------- */
function PersonalInfo({ user, setUser }) {
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    country: user.country || '',
    phone: user.phone || '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const dirty =
    form.firstName !== (user.firstName || '') ||
    form.lastName !== (user.lastName || '') ||
    form.country !== (user.country || '') ||
    form.phone !== (user.phone || '');

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setMsg({ kind: 'error', text: 'First and last name can’t be empty.' });
      return;
    }
    const patch = {};
    ['firstName', 'lastName', 'country', 'phone'].forEach((k) => {
      const v = form[k].trim();
      if (v !== (user[k] || '')) patch[k] = v;
    });
    if (!Object.keys(patch).length) return;

    setSaving(true);
    try {
      const { user: updated } = await api.patch('/api/users/me', patch);
      setUser(updated);
      setForm({
        firstName: updated.firstName || '',
        lastName: updated.lastName || '',
        country: updated.country || '',
        phone: updated.phone || '',
      });
      setMsg({ kind: 'success', text: 'Changes saved.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message || 'Could not save your changes.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl">Personal info</h1>
      <p className="mb-6 text-ink-muted">This information is shared with apps you sign in to.</p>

      <form onSubmit={save} className="panel">
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-[17px]">Profile</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Your name, country, and phone.</p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-6">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName">
              <TextInput id="firstName" value={form.firstName} onChange={set('firstName')} />
            </Field>
            <Field label="Last name" htmlFor="lastName">
              <TextInput id="lastName" value={form.lastName} onChange={set('lastName')} />
            </Field>
          </div>
          <Field label="Country" htmlFor="country">
            <TextInput id="country" value={form.country} onChange={set('country')} />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <TextInput id="phone" type="tel" value={form.phone} onChange={set('phone')} />
          </Field>

          <Field label="Email" hint="Email can’t be changed here.">
            <TextInput value={user.email} disabled />
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------ Security ------------------------------ */
function Security() {
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [errs, setErrs] = useState({});
  const set = (k) => (e) => setPw((p) => ({ ...p, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    const found = {};
    if (!pw.current) found.current = 'Enter your current password';
    if (pw.next.length < 8) found.next = 'Use at least 8 characters';
    if (pw.confirm !== pw.next) found.confirm = 'Passwords do not match';
    setErrs(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      await api.post('/api/users/me/password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      });
      setPw({ current: '', next: '', confirm: '' });
      setMsg({ kind: 'success', text: 'Your password has been updated.' });
    } catch (err) {
      if (err.code === 'invalid_credentials') {
        setErrs({ current: 'Current password is incorrect' });
      } else {
        setMsg({ kind: 'error', text: err.message || 'Could not update your password.' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl">Security</h1>
      <p className="mb-6 text-ink-muted">Keep your account safe with a strong password.</p>

      <form onSubmit={save} className="panel">
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-[17px]">Change password</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            You’ll stay signed in on this device after changing it.
          </p>
        </div>
        <div className="flex flex-col gap-4 px-6 py-6">
          {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
          <Field label="Current password" htmlFor="current" error={errs.current}>
            <PasswordInput
              id="current"
              autoComplete="current-password"
              value={pw.current}
              onChange={set('current')}
              invalid={!!errs.current}
            />
          </Field>
          <Field label="New password" htmlFor="next" error={errs.next} hint="At least 8 characters.">
            <PasswordInput
              id="next"
              autoComplete="new-password"
              value={pw.next}
              onChange={set('next')}
              invalid={!!errs.next}
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={errs.confirm}>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={set('confirm')}
              invalid={!!errs.confirm}
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={saving}>
              Update password
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------ Dashboard ----------------------------- */
export default function Dashboard() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');

  const nav = user.isAdmin
    ? [...BASE_NAV, { id: 'admin', label: 'Admin', icon: IconShield }]
    : BASE_NAV;

  async function handleSignOut() {
    await logout();
    navigate('/', { replace: true });
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

  return (
    <div className="min-h-full md:grid md:grid-cols-[264px_1fr]">
      {/* sidebar */}
      <aside className="sticky top-0 z-10 border-b border-line bg-surface md:h-screen md:border-b-0 md:border-r md:p-3.5">
        <div className="hidden px-2.5 py-4 md:block">
          <Logo />
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:p-0">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={'nav-item' + (section === id ? ' nav-item-active' : '')}
              aria-current={section === id ? 'page' : undefined}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* main */}
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-3 md:px-7">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium leading-tight">{fullName}</div>
              <div className="text-[13px] text-ink-muted">{user.email}</div>
            </div>
            <Avatar user={user} />
            <Button size="sm" variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </header>

        <main
          className={
            'w-full px-5 py-8 md:px-7 ' +
            (section === 'apps' || section === 'admin' ? 'max-w-5xl' : 'max-w-3xl')
          }
        >
          {section === 'overview' && <Overview user={user} />}
          {section === 'personal' && <PersonalInfo user={user} setUser={setUser} />}
          {section === 'security' && <Security />}
          {section === 'apps' && <AppsManager />}
          {section === 'admin' && <AppsManager admin />}
        </main>
      </div>
    </div>
  );
}
