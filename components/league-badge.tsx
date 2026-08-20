import { Image } from 'react-native'
import type { LeagueKey } from '../lib/types'

// Only these leagues have their own official badge artwork (scanned from the
// parish's Sunday bulletins) — the rest fall back to a plain colour Chip
// elsewhere, which is an honest reflection of what artwork actually exists.
const BADGES: Partial<Record<LeagueKey, ReturnType<typeof require>>> = {
  YoungAdults: require('../assets/brand/badge-young-adults.png'),
  ELCSAMO: require('../assets/brand/badge-elcsamo.png'),
  PrayerMens: require('../assets/brand/badge-prayer-mens.png'),
  PrayerYouth: require('../assets/brand/badge-prayer-youth.png'),
  PrayerWomens: require('../assets/brand/badge-prayer-womens.png'),
}

export function hasLeagueBadge(leagueKey: LeagueKey) {
  return leagueKey in BADGES
}

export function LeagueBadge({ leagueKey, size = 40 }: { leagueKey: LeagueKey; size?: number }) {
  const source = BADGES[leagueKey]
  if (!source) return null
  return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />
}
