import { Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../lib/authContext'
import { Alert } from '../lib/alert'
import { colors } from '../theme'

export function SignOutButton() {
  const { signOut } = useAuth()
  return (
    <Pressable
      onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ])}
      style={{ paddingHorizontal: 16 }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Sign out"
    >
      <Ionicons name="log-out-outline" size={22} color={colors.g700} />
    </Pressable>
  )
}
