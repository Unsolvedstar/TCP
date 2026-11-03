/** Tidy what someone typed: no spaces, upper case. Mirrors set_family_code (0032). */
export function normalizeFamilyCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

/** Returns a message to show the person, or null when the code is acceptable. */
export function familyCodeProblem(input: string): string | null {
  const code = normalizeFamilyCode(input)
  if (!/^[A-Z0-9]*$/.test(code)) return 'Use only letters and numbers, with no spaces or symbols.'
  if (code.length < 6) return 'Make it at least 6 letters or numbers.'
  if (code.length > 12) return 'Make it 12 letters or numbers at most.'
  return null
}
