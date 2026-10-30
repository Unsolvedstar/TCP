import { useWindowDimensions, type ViewStyle } from 'react-native'

// Below this width the app keeps its phone layout (bottom tabs, one column);
// at or above it we're on a tablet/desktop browser and use the wide layout.
export const WIDE_BREAKPOINT = 900

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT
}

// Content columns, centred in the window. Spread into a ScrollView/FlatList's
// contentContainerStyle next to the screen's own padding — on a phone the
// window is narrower than every max-width, so these change nothing there.
//   wide   — dashboards and the member portal, which split into columns
//   medium — single-column lists, settings and detail screens
//   sheet  — full-screen pop-ups (member profile, edit forms)
//   narrow — sign-in / registration forms
export const contentWide: ViewStyle = { width: '100%', maxWidth: 1180, alignSelf: 'center' }
export const contentMedium: ViewStyle = { width: '100%', maxWidth: 880, alignSelf: 'center' }
export const contentSheet: ViewStyle = { width: '100%', maxWidth: 680, alignSelf: 'center' }
export const contentNarrow: ViewStyle = { width: '100%', maxWidth: 520, alignSelf: 'center' }
