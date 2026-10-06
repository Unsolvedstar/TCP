import { Linking } from 'react-native'
import { Alert } from './alert'

// Linking.openURL rejects when nothing on the device can handle the URL (no
// dialer, no browser, SnapScan missing...). Called bare from onPress that is an
// unhandled promise rejection, so every external link goes through here.
export async function openUrlSafely(url: string, failureMessage = "Couldn't open that link on this device."): Promise<boolean> {
  try {
    await Linking.openURL(url)
    return true
  } catch {
    Alert.alert('Unable to open link', failureMessage)
    return false
  }
}
