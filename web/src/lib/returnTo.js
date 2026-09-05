// Helpers for the OAuth "come back here after you sign in" handoff.
//
// The identity server sends users to /login?return_to=<issuer>/oauth/authorize?...
// After a successful sign in we send the browser back to that URL so the server
// can re-check the session and continue to the consent screen.
//
// We only ever follow a return_to that points at an /oauth/authorize endpoint,
// so a crafted link can't turn sign-in into an open redirect to an arbitrary page.

export function readReturnTo(search) {
  const raw = new URLSearchParams(search).get('return_to');
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.pathname.endsWith('/oauth/authorize')) return url.toString();
  } catch {
    /* ignore malformed values */
  }
  return null;
}

export function continueAfterAuth(returnTo, navigate) {
  if (returnTo) {
    window.location.href = returnTo;
  } else {
    navigate('/dashboard', { replace: true });
  }
}
