import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { Alert } from '../lib/alert'
import { Button } from './ui'

// Chrome/Edge/Android fire `beforeinstallprompt` when the site is installable;
// it isn't in TypeScript's DOM lib.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

// iPhone/iPad browsers can't trigger an install; the user has to use Share → Add to Home Screen.
function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/**
 * "Install app" button for the web build. Shows only where installing is
 * possible and hasn't happened yet: the browser's own install prompt on
 * Android and desktop Chrome/Edge, and the Add to Home Screen steps on iPhone
 * and iPad. Renders nothing inside the installed app, on native, or in browsers
 * that can't install (e.g. desktop Firefox).
 */
export function InstallAppButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => Platform.OS === 'web' && isStandalone())

  useEffect(() => {
    if (Platform.OS !== 'web') return
    const onPrompt = (e: Event) => {
      e.preventDefault() // keep the browser's mini-infobar out of the way; we show our own button
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPromptEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (Platform.OS !== 'web' || installed) return null
  const ios = isIos()
  if (!promptEvent && !ios) return null

  async function install() {
    if (promptEvent) {
      await promptEvent.prompt()
      await promptEvent.userChoice
      setPromptEvent(null) // the event can only be used once
      return
    }
    Alert.alert('Install on your iPhone or iPad', 'Tap the Share button in Safari, then choose “Add to Home Screen”.')
  }

  return <Button title="Install the app" variant={variant} onPress={install} />
}
