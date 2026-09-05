import { env } from './env.js';

export async function sendVerificationEmail({ to, code }) {
  if (!env.tmailServiceToken) {
    throw new Error('TMAIL_SERVICE_TOKEN is not configured');
  }

  const response = await fetch(env.tmailServiceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.tmailServiceToken}`,
    },
    body: JSON.stringify({
      to,
      subject: 'Verify your TGO account',
      text: `Your TGO verification code is ${code}. It expires in ${Math.ceil(env.ttl.emailVerification / 60)} minutes. If you did not create this account, you can ignore this email.`,
      from: 'security@tgo.com',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`TMail rejected the verification email (${response.status}): ${detail}`);
  }
}