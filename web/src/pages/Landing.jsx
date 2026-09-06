import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { Logo, Button, IconShield, IconKey, IconGrid } from '../components/ui.jsx';
import { BRAND } from '../lib/brand.js';

const FEATURES = [
  {
    icon: IconShield,
    title: 'Security built in',
    body: 'Passwords are hashed with bcrypt, the sign-in session is a signed httpOnly cookie, and access tokens expire quickly by default.',
  },
  {
    icon: IconKey,
    title: 'A real sign-in provider',
    body: 'TGO ID speaks OpenID Connect and OAuth 2.0, so you can add “Sign in with TGO” to any app using standard libraries.',
  },
  {
    icon: IconGrid,
    title: 'One profile, every app',
    body: 'Update your name or email once. Every app you’ve signed in to reads the same profile through a single account.',
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function go(path) {
    setMenuOpen(false);
    navigate(path);
  }

  const actions = user ? (
    <>
      <Button variant="ghost" size="sm" onClick={() => go('/guide')}>
        Developer guide
      </Button>
      <Button variant="primary" size="sm" onClick={() => go('/dashboard')}>
        Go to your account
      </Button>
    </>
  ) : (
    <>
      <Button variant="ghost" size="sm" onClick={() => go('/guide')}>
        Developer guide
      </Button>
      <Button variant="ghost" size="sm" onClick={() => go('/login')}>
        Sign in
      </Button>
      <Button variant="primary" size="sm" onClick={() => go('/signup')}>
        Create account
      </Button>
    </>
  );

  return (
    <div>
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur-md backdrop-saturate-150 sm:px-6 sm:py-4">
        <Logo />
        <div className="hidden items-center gap-2.5 sm:flex">{loading ? null : actions}</div>
        <div className="relative sm:hidden">
          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-line-strong bg-surface text-ink transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
          {menuOpen && !loading && (
            <div className="absolute right-0 top-12 z-30 flex w-52 flex-col gap-1 rounded-xl2 border border-line bg-surface p-2 shadow-card">
              {actions}
            </div>
          )}
        </div>
      </nav>

      <header className="mx-auto max-w-3xl px-6 pb-12 pt-20 text-center sm:pt-28">
        <h1 className="text-[clamp(1.9rem,1.2rem+2.6vw,2.85rem)] font-bold leading-[1.05] tracking-[-0.03em]">
          One account for everything TGO
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[17px] text-ink-muted">
          Sign in once and carry the same TGO account across every app your team builds. Security,
          sessions, and tokens are handled for you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {user ? (
            <Button variant="primary" onClick={() => navigate('/dashboard')}>
              Go to your account
            </Button>
          ) : (
            <>
              <Button variant="primary" onClick={() => navigate('/signup')}>
                Create your account
              </Button>
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </>
          )}
        </div>
        <p className="mt-5 text-[13px] text-ink-subtle">
          Free for personal use · Built on OpenID Connect
        </p>
      </header>

      <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-6 pb-20 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <article key={title} className="rounded-xl2 border border-line bg-surface p-6">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink/5 text-ink">
              <Icon />
            </span>
            <h3 className="mb-1.5 mt-3.5 text-base">{title}</h3>
            <p className="text-[15px] text-ink-muted">{body}</p>
          </article>
        ))}
      </section>

      <footer className="pb-10 text-center text-[13px] text-ink-subtle">
        <span>© {new Date().getFullYear()} TGO · </span>
        <Link to="/login" className="text-ink-muted">
          Sign in
        </Link>{' '}
        ·{' '}
        <Link to="/signup" className="text-ink-muted">
          Create account
        </Link>
      </footer>
    </div>
  );
}
