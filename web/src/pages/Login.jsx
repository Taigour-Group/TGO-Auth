import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { readReturnTo, continueAfterAuth } from '../lib/returnTo.js';
import AuthLayout from '../components/AuthLayout.jsx';
import { Field, PasswordInput, UsernameField, Button, Alert } from '../components/ui.jsx';
import { EMAIL_DOMAIN } from '../lib/config.js';

export default function Login() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = readReturnTo(location.search);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? Continue the OAuth handoff, or go to the account.
  useEffect(() => {
    if (!loading && user) continueAfterAuth(returnTo, navigate);
  }, [loading, user, returnTo, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Accept a bare username or a full address; assemble the @domain email.
      const id = username.trim().toLowerCase();
      const email = id.includes('@') ? id : id + '@' + EMAIL_DOMAIN;
      await login(email, password);
      continueAfterAuth(returnTo, navigate);
    } catch (err) {
      setError(err.message || 'Could not sign you in. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Continue to your TGO account"
      footer={
        <>
          New to TGO?{' '}
          <Link to={'/signup' + location.search} className="font-medium">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert kind="error">{error}</Alert>}

        <Field label="Username" htmlFor="username">
          <UsernameField
            id="username"
            autoComplete="username"
            autoFocus
            placeholder="your-name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" variant="primary" block loading={submitting} className="mt-1">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
