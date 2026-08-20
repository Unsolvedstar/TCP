import { useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Button } from './ui'
import { styles } from './wizard.styles'

export type WizardStepDef = {
  key: string
  title: string
  subtitle?: string
  render: () => ReactNode
  /** Return an error message to block advancing, or null/undefined to allow it. */
  validate?: () => string | null | undefined
}

export function Wizard({
  steps,
  onComplete,
  completeLabel = 'Submit',
  submitting = false,
  step: controlledStep,
  onStepChange,
}: {
  steps: WizardStepDef[]
  onComplete: () => void
  completeLabel?: string
  submitting?: boolean
  /** Optional controlled step index, if the parent needs to reset the wizard. */
  step?: number
  onStepChange?: (index: number) => void
}) {
  const [internalStep, setInternalStep] = useState(0)
  const index = controlledStep ?? internalStep
  const [error, setError] = useState('')

  function setIndex(next: number) {
    setInternalStep(next)
    onStepChange?.(next)
  }

  const step = steps[index]
  const isFirst = index === 0
  const isLast = index === steps.length - 1

  function goNext() {
    const err = step.validate?.()
    if (err) {
      setError(err)
      return
    }
    setError('')
    if (isLast) {
      onComplete()
    } else {
      setIndex(index + 1)
    }
  }

  function goBack() {
    setError('')
    setIndex(Math.max(0, index - 1))
  }

  return (
    <View>
      <View style={styles.dotsRow}>
        {steps.map((s, i) => (
          <View key={s.key} style={styles.dotWrap}>
            <View style={[styles.dot, i === index && styles.dotCurrent, i < index && styles.dotDone]}>
              <Text style={[styles.dotText, i <= index && styles.dotTextActive]}>{i < index ? '✓' : i + 1}</Text>
            </View>
            {i < steps.length - 1 && <View style={[styles.dotLine, i < index && styles.dotLineDone]} />}
          </View>
        ))}
      </View>

      <Text style={styles.stepCount}>
        Step {index + 1} of {steps.length}
      </Text>
      <Text style={styles.stepTitle}>{step.title}</Text>
      {step.subtitle ? <Text style={styles.stepSubtitle}>{step.subtitle}</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.body}>{step.render()}</View>

      <View style={styles.nav}>
        {!isFirst && (
          <View style={{ flex: 1 }}>
            <Button title="Back" variant="secondary" onPress={goBack} disabled={submitting} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Button title={isLast ? completeLabel : 'Next'} onPress={goNext} loading={submitting && isLast} />
        </View>
      </View>
    </View>
  )
}
