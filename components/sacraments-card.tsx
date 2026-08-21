import { BarRow } from './ui'
import { CollapsibleSection } from './collapsible-section'
import { colors } from '../theme'
import type { SacramentStat } from '../lib/types'

export function SacramentsCard({ sacraments }: { sacraments: SacramentStat }) {
  const baptPct = sacraments.total ? Math.round((sacraments.baptised / sacraments.total) * 100) : 0
  const confPct = sacraments.total ? Math.round((sacraments.confirmed / sacraments.total) * 100) : 0
  return (
    <CollapsibleSection title="Sacraments">
      <BarRow label="Baptised" sub={`${sacraments.baptised} of ${sacraments.total}`} value={baptPct} max={100} color={colors.g700} />
      <BarRow label="Confirmed" sub={`${sacraments.confirmed} of ${sacraments.total}`} value={confPct} max={100} color={colors.gold} />
    </CollapsibleSection>
  )
}
