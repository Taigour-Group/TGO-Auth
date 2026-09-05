// Shared frontend constants.
//
// Every TGO account uses this email domain. It's shown as a fixed, non-editable
// suffix on the sign-up and sign-in forms (like Gmail forcing @gmail.com).
// Keep this in sync with SIGNUP_EMAIL_DOMAIN in the server's .env.
export const EMAIL_DOMAIN = 'tgo.com';

// Vite proxies these paths locally. Production uses the separately deployed API.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path) {
	return `${API_URL}${path}`;
}
