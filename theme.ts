// g700 is the parish's real crest green, sampled directly from the official
// ELCSA logo (assets/brand/church-logo.png) — the rest of the green scale is
// built outward from that anchor.
export const colors = {
  g900: '#0a2603',
  g800: '#123a04',
  g700: '#1c4906',
  g600: '#2f6b0f',
  g500: '#4d8f26',
  g100: '#dcebd0',
  g50: '#f0f6ea',
  gold: '#c9a227',
  gold2: '#e8c547',
  gold3: '#f5d87a',
  goldBg: '#fdf8e6',
  cream: '#f7f4ee',
  warmBorder: '#e4ddd1',
  muted: '#8c7d6c',
  text: '#1c1c1c',
  white: '#ffffff',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  dangerBorder: '#fecaca',
  // Sampled from the other official ELCSA/Lutheran marks alongside the crest
  // (assets/brand/*.png) — the navy of ELCSAMO's badge, the vivid gold ring of
  // the Young Adults League badge, and the red of the Luther Rose.
  brandNavy: '#1b245f',
  brandGoldVivid: '#ffba25',
  brandRed: '#d71b39',
}

/**
 * Liturgical accent colours (Western/Lutheran tradition) — used by
 * lib/liturgical-theme.ts to tint hero banners with whatever season of the
 * church year it currently is, alongside (not replacing) the parish's green
 * brand identity everywhere else. Each entry carries its own readable text
 * colour since the festal gold is too light for white text.
 */
const purple = '#4b2e73'
export const liturgicalPalette = {
  ordinary: { color: colors.g700, text: colors.white }, // Epiphany season & the long Season after Pentecost
  advent: { color: purple, text: colors.white },
  christmas: { color: colors.gold2, text: colors.g900 },
  lent: { color: purple, text: colors.white },
  holyWeek: { color: purple, text: colors.white },
  maundyThursday: { color: colors.gold2, text: colors.g900 },
  goodFriday: { color: '#3a0d10', text: colors.white },
  eastertide: { color: colors.gold2, text: colors.g900 },
  pentecost: { color: colors.brandRed, text: colors.white },
  reformation: { color: colors.brandRed, text: colors.white },
  allSaints: { color: colors.gold2, text: colors.g900 },
}

// Wards and leagues used to be hardcoded here (one fixed list for TCP). They're
// now per-congregation rows in the `wards`/`leagues` tables — see
// lib/congregation-context.tsx — seeded for TCP with these same names/colors
// in supabase/migrations/0001_init.sql section 5.

export const genders = ['Male', 'Female'] as const

export const genderColors: Record<string, string> = {
  Male: colors.g700,
  Female: colors.gold,
}

export const radius = { md: 10, lg: 20, xl: 28 }
