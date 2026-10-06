import { Alert } from './alert'

type RpcResult = { error: { message: string } | null }

// The "call an RPC, alert on failure, otherwise refresh" pattern repeated across
// the admin screens. Also converts a thrown/rejected call (network down) into the
// same alert — as a bare `await supabase.rpc(...)` inside an Alert button's
// onPress it would be an unhandled rejection. Resolves true on success.
export async function rpcAction(call: () => PromiseLike<RpcResult>, errorTitle: string, onSuccess?: () => void | Promise<unknown>): Promise<boolean> {
  let message: string | null = null
  try {
    const { error } = await call()
    if (error) message = error.message
  } catch (e) {
    message = e instanceof Error ? e.message : 'Network error. Please try again.'
  }
  if (message !== null) {
    Alert.alert(errorTitle, message)
    return false
  }
  await onSuccess?.()
  return true
}
