import { createElement, useEffect, useRef } from 'react'
import { Text, View } from 'react-native'
import { styles } from './signature-pad.styles'

/**
 * Web implementation — a real <canvas>. react-native-view-shot (used on
 * native) has no web build, so this is a deliberately separate file rather
 * than a runtime Platform.OS branch: Metro resolves `signature-pad` to this
 * file on web and to signature-pad.native.tsx on iOS/Android, so the native
 * capture library is never even bundled here, let alone imported.
 */
export function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUri: string | null) => void }) {
  const canvasRef = useRef<any>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1c1c1c'

    function pos(e: any) {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    function down(e: any) {
      e.preventDefault()
      drawing.current = true
      const { x, y } = pos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    function move(e: any) {
      if (!drawing.current) return
      e.preventDefault()
      const { x, y } = pos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
      hasInk.current = true
    }
    function up() {
      if (!drawing.current) return
      drawing.current = false
      if (hasInk.current) onChange(canvas.toDataURL('image/png'))
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [onChange])

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasInk.current = false
    onChange(null)
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>Signature</Text>
      <View style={styles.box}>
        {createElement('canvas', {
          ref: canvasRef,
          width: 500,
          height: 160,
          style: { width: '100%', height: 160, touchAction: 'none', cursor: 'crosshair' },
        })}
      </View>
      <View style={styles.row}>
        <Text style={styles.hint}>{value ? 'Signed ✓' : 'Sign above with your mouse or finger'}</Text>
        <Text style={styles.clearLink} onPress={clear}>
          Clear
        </Text>
      </View>
    </View>
  )
}
