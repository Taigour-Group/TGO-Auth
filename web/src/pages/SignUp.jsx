import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { readReturnTo, continueAfterAuth } from '../lib/returnTo.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, TextInput, PasswordInput, UsernameField, Button, Alert } from '../components/ui.jsx';
import { EMAIL_DOMAIN } from '../lib/config.js';

const STEPS = 5;
const SUBTITLES = [
  'First, tell us your name',
  'Choose your username',
  'A few optional details',
  'How can apps reach you? (optional)',
  'Choose a password',
];
const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const USERNAME_RE = /^[a-z0-9]([a-z0-9._+-]{0,62}[a-z0-9])?$/i;

export default function SignUp() {
  const { user, loading, signup } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = readReturnTo(location.search);

  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    username: '',
    dob: '',
    gender: '',
    country: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [errs, setErrs] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (!loading && user) continueAfterAuth(returnTo, navigate);
  }, [loading, user, returnTo, navigate]);

  function validate(s) {
    const e = {};
    if (s === 0) {
      if (!f.firstName.trim()) e.firstName = 'Enter your first name';
      if (!f.lastName.trim()) e.lastName = 'Enter your last name';
    }
    if (s === 1 && !USERNAME_RE.test(f.username.trim()))
      e.username = 'Use letters, numbers, and . _ + - (no spaces)';
    if (s === 4) {
      if (f.password.length < 8) e.password = 'Use at least 8 characters';
      if (f.confirm !== f.password) e.confirm = 'Passwords do not match';
    }
    return e;
  }

  async function submit() {
    setSubmitting(true);
    setServerError(null);
    try {
      const payload = {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.username.trim().toLowerCase() + '@' + EMAIL_DOMAIN,
        password: f.password,
      };
      if (f.dob) payload.dob = f.dob;
      if (f.gender) payload.gender = f.gender;
      if (f.country.trim()) payload.country = f.country.trim();
      if (f.phone.trim()) payload.phone = f.phone.trim();
      await signup(payload);
      continueAfterAuth(returnTo, navigate);
    } catch (err) {
      setSubmitting(false);
      if (err.code === 'email_taken') {
        setServerError('That username is already taken — try signing in instead.');
        setErrs({ username: 'This username is already registered' });
        setStep(1);
      } else if (err.code === 'invalid_email_domain') {
        setServerError(err.message || `Accounts must use a @${EMAIL_DOMAIN} address.`);
        setStep(1);
      } else {
        setServerError(err.message || 'Could not create your account. Try again.');
      }
    }
  }

  function handleNext(e) {
    e.preventDefault();
    const found = validate(step);
    setErrs(found);
    if (Object.keys(found).length) return;
    if (step < STEPS - 1) setStep(step + 1);
    else submit();
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={SUBTITLES[step]}
      footer={
        <>
          Already have an account?{' '}
          <Link to={'/login' + location.search} className="font-medium">
            Sign in
          </Link>
        </>
      }
    >
      {/* progress */}
      <div className="mb-2 flex items-center gap-1.5">
        {Array.from({ length: STEPS }).map((_, i) => (
          <span
            key={i}
            className={
              'h-1 flex-1 rounded-full transition-colors ' +
              (i < step ? 'bg-ink' : i === step ? 'bg-accent' : 'bg-line')
            }
          />
        ))}
      </div>
      <p className="mb-5 text-center text-[13px] text-ink-subtle">
        Step {step + 1} of {STEPS}
      </p>

      <form onSubmit={handleNext} className="flex flex-col gap-4" noValidate>
        {serverError && <Alert kind="error">{serverError}</Alert>}

        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="firstName" error={errs.firstName}>
              <TextInput
                id="firstName"
                autoFocus
                autoComplete="given-name"
                value={f.firstName}
                onChange={set('firstName')}
                invalid={!!errs.firstName}
              />
            </Field>
            <Field label="Last name" htmlFor="lastName" error={errs.lastName}>
              <TextInput
                id="lastName"
                autoComplete="family-name"
                value={f.lastName}
                onChange={set('lastName')}
                invalid={!!errs.lastName}
              />
            </Field>
          </div>
        )}

        {step === 1 && (
          <Field
            label="Username"
            htmlFor="username"
            error={errs.username}
            hint={`Your sign-in address will be your-name@${EMAIL_DOMAIN}.`}
          >
            <UsernameField
              id="username"
              autoFocus
              autoComplete="username"
              placeholder="your-name"
              value={f.username}
              onChange={set('username')}
              invalid={!!errs.username}
            />
          </Field>
        )}

        {step === 2 && (
          <>
            <Field label="Date of birth" htmlFor="dob">
              <TextInput id="dob" type="date" autoFocus value={f.dob} onChange={set('dob')} />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <select id="gender" className="input" value={f.gender} onChange={set('gender')}>
                <option value="">Prefer not to say</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Country" htmlFor="country">
              <TextInput
                id="country"
                autoFocus
                autoComplete="country-name"
                placeholder="e.g. Nepal"
                value={f.country}
                onChange={set('country')}
              />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <TextInput
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+977 …"
                value={f.phone}
                onChange={set('phone')}
              />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <Field
              label="Password"
              htmlFor="password"
              error={errs.password}
              hint="At least 8 characters."
            >
              <PasswordInput
                id="password"
                autoFocus
                autoComplete="new-password"
                value={f.password}
                onChange={set('password')}
                invalid={!!errs.password}
              />
            </Field>
            <Field label="Confirm password" htmlFor="confirm" error={errs.confirm}>
              <PasswordInput
                id="confirm"
                autoComplete="new-password"
                value={f.confirm}
                onChange={set('confirm')}
                invalid={!!errs.confirm}
              />
            </Field>
          </>
        )}

        <div className="mt-1 flex gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setErrs({});
                setStep((s) => s - 1);
              }}
              disabled={submitting}
            >
              Back
            </Button>
          )}
          <Button type="submit" variant="primary" block loading={submitting}>
            {step < STEPS - 1 ? 'Continue' : 'Create account'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
