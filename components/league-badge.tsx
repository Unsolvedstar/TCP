import { Image } from 'react-native'

// Only these leagues have their own official badge artwork (scanned from the
// parish's Sunday bulletins) — the rest fall back to a plain colour Chip
// elsewhere, which is an honest reflection of what artwork actually exists.
// Keyed by the league row's stable `key` string (not its id, which is a
// per-congregation uuid) — this is bundled artwork tied to TCP's specific
// leagues, not a mapping that can vary per congregation.
const BADGES: Record<string, ReturnType<typeof require>> = {
  YoungAdults: require('../assets/brand/badge-young-adults.png'),
  ELCSAMO: require('../assets/brand/badge-elcsamo.png'),
  PrayerMens: require('../assets/brand/badge-prayer-mens.png'),
  PrayerYouth: require('../assets/brand/badge-prayer-youth.png'),
  PrayerWomens: require('../assets/brand/badge-prayer-womens.png'),
}

export function hasLeagueBadge(leagueKey: string) {
  return leagueKey in BADGES
}

export function LeagueBadge({ leagueKey, size = 40 }: { leagueKey: string; size?: number }) {
  const source = BADGES[leagueKey]
  if (!source) return null
  return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
}
