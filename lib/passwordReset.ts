// Helpers for the "forgot password" email flow. The reset email links back to /reset-password;
// Supabase puts the proof either in the URL hash (#access_token=…&refresh_token=…&type=recovery)
// or, with the PKCE flow, in the query (?code=…). Errors (expired link) come back the same way.

export type RecoveryParams = {
  accessToken: string | null
  refreshToken: string | null
  code: string | null
  error: string | null
}

export function parseRecoveryParams(hash: string, search: string): RecoveryParams {
  const h = new URLSearchParams(hash.replace(/^#/, ''))
  const q = new URLSearchParams(search.replace(/^\?/, ''))
  const get = (k: string) => h.get(k) ?? q.get(k)
  return {
    accessToken: get('access_token'),
    refreshToken: get('refresh_token'),
    code: q.get('code'),
    error: get('error_description') ?? get('error'),
  }
}

// Where the email link should send people. Only meaningful in the browser (this app is a PWA).
export function resetRedirectUrl(): string | undefined {
  if (typeof window === 'undefined' || !window.location?.origin) return undefined
  return `${window.location.origin}/reset-password`
}

export function passwordProblem(password: string, confirm: string): string | null {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.'
  if (password !== confirm) return 'Passwords do not match.'
  return null
}
