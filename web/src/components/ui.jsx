import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EMAIL_DOMAIN } from '../lib/config.js';
import { BRAND } from '../lib/brand.js';

/* ------------------------------ logo ------------------------------ */
export function Logo({ large = false, to = BRAND.homeUrl, asLink = true }) {
  const image = (
    <div
      className="flex h-11 w-11 items-center justify-center rounded-xl border p-1.5 shadow-sm ring-1 ring-white/60"
      style={{
        backgroundColor: BRAND.logoBackground,
        borderColor: BRAND.logoBackgroundBorder,
      }}
    >
      <img
        src={BRAND.logoUrl}
        alt={BRAND.logoAlt}
        className="h-full w-full object-contain"
      />
    </div>
  );

  const inner = (
    <>
      {image}
      <span className={large ? 'text-lg' : ''}>{BRAND.name}</span>
    </>
  );
  const cls =
    'inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink hover:text-ink hover:no-underline';
  return asLink ? (
    <Link to={to} className={cls} aria-label={BRAND.ariaLabel}>
      {inner}
    </Link>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

/* ----------------------------- spinner ---------------------------- */
export function Spinner({ light = false }) {
  return (
    <span
      className={
        'inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] ' +
        (light ? 'border-white/40 border-t-white' : 'border-ink/20 border-t-ink')
      }
      aria-hidden="true"
    />
  );
}

/* ----------------------------- button ----------------------------- */
const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};
export function Button({
  variant = 'secondary',
  block = false,
  size,
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}) {
  const cls = [
    'btn',
    VARIANTS[variant] || VARIANTS.secondary,
    block && 'w-full',
    size === 'sm' && 'btn-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading && <Spinner light={variant === 'primary'} />}
      {children}
    </button>
  );
}

/* ------------------------------ field ----------------------------- */
export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-[13px] text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[13px] text-ink-muted">{hint}</span>
      ) : null}
    </div>
  );
}

/* --------------------------- text input --------------------------- */
export const TextInput = forwardRef(function TextInput({ invalid, className = '', ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={'input' + (invalid ? ' input-invalid' : '') + (className ? ' ' + className : '')}
      {...rest}
    />
  );
});

/* ------------------------- password input ------------------------- */
export const PasswordInput = forwardRef(function PasswordInput(
  { invalid, className = '', ...rest },
  ref
) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={
          'input pr-16' + (invalid ? ' input-invalid' : '') + (className ? ' ' + className : '')
        }
        {...rest}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-1.5 text-[13px]
          font-medium text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  );
});

/* -------------------- username (fixed @domain) -------------------- */
export const UsernameField = forwardRef(function UsernameField(
  { invalid, domain = EMAIL_DOMAIN, className = '', ...rest },
  ref
) {
  return (
    <div
      className={
        'flex items-stretch overflow-hidden rounded-[10px] border bg-surface transition ' +
        (invalid
          ? 'border-danger focus-within:shadow-[0_0_0_3px_rgba(217,45,32,0.2)]'
          : 'border-line-strong focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.25)]') +
        (className ? ' ' + className : '')
      }
    >
      <input
        ref={ref}
        type="text"
        inputMode="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="h-11 w-full min-w-0 bg-transparent px-[0.85rem] text-ink placeholder:text-ink-subtle focus:outline-none"
        {...rest}
      />
      <span className="flex select-none items-center whitespace-nowrap border-l border-line bg-surface-2 px-3 text-ink-muted">
        @{domain}
      </span>
    </div>
  );
});

/* ------------------------------ alert ----------------------------- */
const ALERT = {
  error: 'bg-danger-bg border-danger/30 text-[#912018]',

  success: 'bg-success-bg border-success/30 text-[#05603a]',
};
export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return (
    <div
      className={
        'flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-sm ' +
        (ALERT[kind] || ALERT.error)
      }
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-current" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------ icons ----------------------------- */
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};
export const IconShield = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l7 3v5c0 4.4-3 8.2-7 9-4-.8-7-4.6-7-9V6z" />
    <path d="M9.2 12l1.9 1.9L15 10" />
  </svg>
);
export const IconKey = (p) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M17 5l2.5 2.5M14.5 7.5L17 10" />
  </svg>
);
export const IconGrid = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);
export const IconUser = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.3 3.6-5.5 8-5.5s8 2.2 8 5.5" />
  </svg>
);
export const IconMail = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </svg>
);
export const IconLock = (p) => (
  <svg {...base} {...p}>
    <rect x="4" y="10" width="16" height="10" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
export const IconCheck = (p) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M5 12.5l4 4 10-10" />
  </svg>
);
export const IconPlus = (p) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCopy = (p) => (
  <svg {...base} width="18" height="18" {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
export const IconTrash = (p) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
);
