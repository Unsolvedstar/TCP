import { useRef, useState } from 'react'
import { PanResponder, Text, View, type GestureResponderEvent } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { captureRef } from 'react-native-view-shot'
import { styles } from './signature-pad.styles'

/**
 * Native implementation — draws strokes with react-native-svg via
 * PanResponder, then snapshots the view to a PNG data URI with
 * react-native-view-shot after each stroke, so there's no separate
 * "confirm" step: by the time the user moves on, the latest drawing is
 * already captured. See signature-pad.web.tsx for why this is a separate
 * file rather than a runtime platform check.
 */
export function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUri: string | null) => void }) {
  const viewRef = useRef<View>(null)
  const [paths, setPaths] = useState<string[]>([])
  const currentPath = useRef('')

  async function captureAndSave() {
    if (!viewRef.current) return
    try {
      const uri = await captureRef(viewRef.current, { format: 'png', result: 'data-uri' })
      onChange(uri)
    } catch {
      // Best-effort — the drawing is still visible on screen either way;
      // the user can clear and re-sign if it doesn't take.
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`
        setPaths((p) => [...p, currentPath.current])
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`
        setPaths((p) => [...p.slice(0, -1), currentPath.current])
      },
      onPanResponderRelease: () => {
        currentPath.current = ''
        captureAndSave()
      },
    })
  ).current

  function clear() {
    setPaths([])
    onChange(null)
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>Signature</Text>
      <View style={styles.box} ref={viewRef} {...panResponder.panHandlers}>
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#1c1c1c" strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
      </View>
      <View style={styles.row}>
        <Text style={styles.hint}>{value ? 'Signed ✓' : 'Sign above with your finger'}</Text>
        <Text style={styles.clearLink} onPress={clear}>
          Clear
        </Text>
      </View>
    </View>
  )
}
