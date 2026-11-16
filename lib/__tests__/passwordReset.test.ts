import { parseRecoveryParams, passwordProblem } from '../passwordReset'

describe('parseRecoveryParams', () => {
  it('reads tokens from the hash', () => {
    const p = parseRecoveryParams('#access_token=a&refresh_token=r&type=recovery', '')
    expect(p).toMatchObject({ accessToken: 'a', refreshToken: 'r', code: null, error: null })
  })
  it('reads a PKCE code from the query', () => {
    expect(parseRecoveryParams('', '?code=abc').code).toBe('abc')
  })
  it('reads an expired-link error', () => {
    expect(parseRecoveryParams('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired', '').error).toBe(
      'Email link is invalid or has expired'
    )
  })
  it('is empty when there is nothing', () => {
    expect(parseRecoveryParams('', '')).toEqual({ accessToken: null, refreshToken: null, code: null, error: null })
  })
})

describe('passwordProblem', () => {
  it('rejects short and mismatched passwords', () => {
    expect(passwordProblem('short', 'short')).toMatch(/8 characters/)
    expect(passwordProblem('longenough1', 'different1')).toMatch(/do not match/)
    expect(passwordProblem('longenough1', 'longenough1')).toBeNull()
  })
})
