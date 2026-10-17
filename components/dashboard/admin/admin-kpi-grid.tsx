import {
  Building2,
  DollarSign,
  Landmark,
  Package,
  ShieldCheck,
  TrendingUp,
  Unlock,
  Users,
} from 'lucide-react'
import { DashboardStatTile } from '-/components/dashboard/dashboard-stat-tile'
import { formatCurrency } from '@/lib/format'
import { getRoleTheme } from '-/lib/dashboard/role-theme'
import type { AdminStats } from '-/lib/dashboard/types'
import type { Messages } from '-/lib/i18n/dictionaries'
import { cn } from '-/lib/utils'

type AdminKpiGridProps = {
  /**
   * Resolved admin stats. When a section's queries failed, the corresponding
   * fields are null and the section is reported in `unavailableSections`.
   */
  stats: AdminStats
  /** Sections whose queries failed; they must not render zero totals. */
  unavailableSections?: Readonly<Array<'platform' | 'operations'>>
  t: Messages
}

const UNAVAILABLE_LABEL = 'Unavailable'

function SectionUnavailable({ t }: { t: Messages }) {
  return (
    <div
      role='status'
      aria-live='polite'
      className='rounded-md border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/20 dark:text-amber-200'
    >
      {t.dashboard.sectionUnavailable ?? UNAVAILABLE_LABEL}
    </div>
  )
}

export function AdminKpiGrid({ stats, unavailableSections = [], t }: AdminKpiGridProps) {
  const m = t.adminDashboard
  const theme = getRoleTheme('admin')
  const dealStatus = t.dealStatus as Record<string, string>
  const unavailable = new Set(unavailableSections)
  const platformUnavailable = unavailable.has('platform')
  const opsUnavailable = unavailable.has('operations')

  const platformTiles = [
    {
      label: m.totalVolume,
      value:
        stats.totalVolume == null
          ? UNAVAILABLE_LABEL
          : formatComponent(stats.totalVolume),
      icon: DollarSign,
    },
  ]

  return (
    <div className='min-w-0 space-y-6'>
      <div>
        <h2 className='mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground'>
          {m.sectionPlatform}
        </h2>
        {platformUnavailable ? (
          <SectionUnavailable t={t} />
        ) : (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6'>
            {platformTiles.map((tile) => (
              <DashboardStatTile
                key={tile.label}
                label={tile.label}
                value={tile.value}
                icon={tile.icon}
                iconClassName={theme.statIcon}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
