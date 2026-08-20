import { Image, Text, View } from 'react-native'
import { useLiturgicalSeason } from '../lib/liturgical-theme'
import { styles } from './church-header.styles'

/**
 * Shared header used on every public screen (sign in, register, reset
 * password, the landing page): the real parish crest inside a ring tinted
 * with whatever the current liturgical season is. The ring is always a
 * neutral backdrop behind the (green) crest so the logo stays legible no
 * matter which season colour is active — including Ordinary Time, when the
 * season colour is the same green as the crest itself.
 */
export function ChurchHeader({ title, subtitle, showSeason = true }: { title: string; subtitle?: string; showSeason?: boolean }) {
  const season = useLiturgicalSeason()
  return (
    <View style={styles.header}>
      <View style={[styles.halo, { borderColor: season.color }]}>
        <Image source={require('../assets/brand/church-logo.png')} style={styles.logo} resizeMode="contain" />
      </View>
      {showSeason ? (
        <View style={[styles.seasonPill, { backgroundColor: season.color }]}>
          <Text style={[styles.seasonPillText, { color: season.text }]}>{season.name}</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}
