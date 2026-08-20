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

export const wardColors: Record<string, string> = {
  North: colors.g700,
  East: '#1565c0',
  Central: colors.gold,
  West: '#00695c',
  South: '#7b1fa2',
}

export const wardCodes: Record<string, number> = {
  North: 100,
  East: 200,
  Central: 300,
  West: 400,
  South: 500,
}

export const wards = ['North', 'East', 'Central', 'West', 'South'] as const

export const genders = ['Male', 'Female'] as const

export const genderColors: Record<string, string> = {
  Male: colors.g700,
  Female: colors.gold,
}

export type League = {
  label: string
  color: string
  info?: string
  // Ionicons name shown inside the colour dot for leagues with no scanned
  // badge artwork (see components/league-badge.tsx) — a generic icon reads
  // better than a bare circle, without pretending it's the league's real mark.
  icon?: string
}

export const leagues: Record<string, League> = {
  None: { label: 'No League / Organisation', color: '#9e9e9e' },
  PrayerMens: { label: "Prayer Men's League", color: colors.brandRed, info: "Meets Sundays 8H00. Contact Ntate Lufuno Tshikovhi, 082 638 1883" },
  PrayerWomens: {
    label: "Prayer Women's League",
    color: '#ad1457',
    info: "Meets Sundays 8H00. Contact Mme Matshidiso Mogoase, 072 182 0472",
    icon: 'heart-outline',
  },
  PrayerYouth: {
    label: 'Prayer Youth League',
    color: '#e65100',
    info: "Meets Sundays 8H00. Contact Vhukhudo Makuya, 079 592 3835",
  },
  YoungAdults: { label: 'Young Adults League', color: '#4b6fb6', info: 'Every 2nd Monday 18H00. Contact Sis Kholo Rabotho, 082 577 1709' },
  SundaySchool: {
    label: 'Sunday School',
    color: '#00897b',
    info: 'For children. Ask at the Secretariat Desk',
    icon: 'book-outline',
  },
  ConfirmationClass: {
    label: 'Confirmation Class',
    color: '#5d4037',
    info: 'Preparation classes ahead of Confirmation',
    icon: 'ribbon-outline',
  },
  ELCSAMO: { label: 'ELCSAMO (Music Organisation)', color: colors.brandNavy, info: 'Sun after church, Thu 18H00, Sat 14H00. Contact Mr Azwi Ramakuela' },
  ELCSASO: {
    label: 'ELCSASO (Student Organisation)',
    color: '#2e7d32',
    info: 'UP / TUT / Eduvos chapters. Ask at the Secretariat Desk',
    icon: 'school-outline',
  },
  DiaconateMinistry: {
    label: 'Diaconate Ministry',
    color: '#37474f',
    info: 'Serve, Care, Give Hope. Outreach and donations ministry',
    icon: 'hand-left-outline',
  },
}

export const leagueKeys = Object.keys(leagues)

export const radius = { md: 10, lg: 20, xl: 28 }
