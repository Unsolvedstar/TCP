import { BarRow } from './ui'
import { CollapsibleSection } from './collapsible-section'
import { genderColors, genders } from '../theme'
import type { GenderStat } from '../lib/types'

export function GenderBreakdownCard({ genderStats }: { genderStats: GenderStat[] }) {
  const max = Math.max(1, ...genders.map((g) => genderStats.find((s) => s.gender === g)?.cnt ?? 0))
  return (
    <CollapsibleSection title="Gender Breakdown">
      {genders.map((g) => (
        <BarRow key={g} label={g} value={genderStats.find((s) => s.gender === g)?.cnt ?? 0} max={max} color={genderColors[g]} />
      ))}
    </CollapsibleSection>
  )
}
