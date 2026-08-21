import { Alert as RNAlert } from 'react-native'

// Native iOS/Android has a real Alert.alert — no custom host needed.
export const Alert = RNAlert

export function AlertHost() {
  return null
}
