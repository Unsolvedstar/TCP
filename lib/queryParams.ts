// Parses a deep link's query string and #fragment into one params object, and
// pulls out an `errorCode` if present. Supabase's password-reset email puts the
// tokens in the fragment on some setups and the query on others, so both count.
//
// This used to be imported from `expo-auth-session/build/QueryParams`, but SDK 58
// stopped exposing that deep path in the package's `exports` map.
export function getQueryParams(input: string): { errorCode: string | null; params: Record<string, string> } {
  const url = new URL(input, 'https://phony.example')
  const errorCode = url.searchParams.get('errorCode')
  url.searchParams.delete('errorCode')

  const params: Record<string, string> = Object.fromEntries(url.searchParams)
  if (url.hash) {
    new URLSearchParams(url.hash.replace(/^#/, '')).forEach((value, key) => {
      params[key] = value
    })
  }
  return { errorCode, params }
}
