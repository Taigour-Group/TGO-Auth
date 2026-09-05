import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import { Button, Field, TextInput, Alert } from '../components/ui.jsx';
import { api } from '../lib/api.js';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const email = params.get('email') || '';
  const returnTo = params.get('returnTo') || '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.post('/api/auth/verify-email', { email, code });
      const loginParams = new URLSearchParams();
      if (returnTo) loginParams.set('returnTo', returnTo);
      navigate('/login' + (loginParams.toString() ? '?' + loginParams.toString() : ''));
    } catch (err) {
      setError(err.message || 'Could not verify your email.');
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const result = await api.post('/api/auth/resend-verification', { email });
      setMessage(result.message);
    } catch (err) {
      setError(err.message || 'Could not resend the verification code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={`Enter the six-digit code sent to ${email}`}
      footer={
        <>
          Already verified? <Link to="/login" className="font-medium">Sign in</Link>
        </>
      }
    >
      <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
        {error && <Alert kind="error">{error}</Alert>}
        {message && <Alert kind="success">{message}</Alert>}
        <Field label="Verification code" htmlFor="code" hint="The code expires in 10 minutes.">
          <TextInput
            id="code"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
          />
        </Field>
        <Button type="submit" variant="primary" block loading={submitting}>
          Verify email
        </Button>
        <Button type="button" variant="secondary" block loading={resending} onClick={resend}>
          Send a new code
        </Button>
      </form>
    </AuthLayout>
  );
}