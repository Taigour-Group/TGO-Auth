import { Logo } from './ui.jsx';

// Centered card layout shared by sign up, sign in, and consent.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-full grid-rows-[auto_1fr_auto] p-5">
      <header className="flex justify-center py-3">
        <Logo />
      </header>

      <main className="grid place-items-center">
        <section className="card">
          {(title || subtitle) && (
            <div className="mb-7 text-center">
              {title && <h1 className="text-2xl">{title}</h1>}
              {subtitle && <p className="mt-1.5 text-[15px] text-ink-muted">{subtitle}</p>}
            </div>
          )}
          {children}
          {footer && <div className="mt-6 text-center text-[15px] text-ink-muted">{footer}</div>}
        </section>
      </main>

      <footer className="py-3 text-center text-[13px] text-ink-subtle">
        <span>© {new Date().getFullYear()} TGO · </span>
        <a href="/" className="text-ink-muted">
          Privacy
        </a>{' '}
        ·{' '}
        <a href="/" className="text-ink-muted">
          Terms
        </a>
      </footer>
    </div>
  );
}
