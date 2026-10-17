import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type DashboardStatTileProps = {
  label: string
  value: number | string | null | undefined
  icon: LucideIcon
  iconClassName?: string
  highlight?: boolean
  footer?: string
  /** When true, the tile represents an unavailable optional section rather than a valid zero/empty state. */
  unavailable?: boolean
  /** Optional explanation for why the tile is unavailable. */
  unavailableMessage?: string
}

function formatValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

export function DashboardStatTile({
  label,
  value,
  icon: Icon,
  iconClassName,
  highlight,
  footer,
  unavailable,
  unavailableMessage,
}: DashboardStatTileProps) {
  const isUnavailable = Boolean(unavailable)
  const displayValue = isUnavailable ? '—' : formatValue(value)
  const displayFooter = isUnavailable
    ? (unavailableMessage ?? 'Unavailable right now')
    : footer

  return (
    <div
      data-unavailable={isUnavailable ? 'true' : undefined}
      aria-disabled={isUnavailable ? true : undefined}
      className={cn(
        'flex min-h-[7.5rem] min-w-0 flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5',
        highlight && !isUnavailable &&
          'border-amber-300/50 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/20',
        isUnavailable && 'border-dashed border-muted-foreground/40 bg-muted/40',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
        <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
          {label}
        </p>
        <Icon className={cn('h-4 w-4 shrink-0 opacity-70', iconClassName)} aria-hidden />
      </div>
      <p
        className={cn(
          'min-w-0 truncate font-display text-2xl font-normal tabular-nums tracking-tight sm:text-3xl',
          isUnavailable ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {displayValue}
      </p>
      {displayFooter && (
        <p className={cn(
          'mt-auto min-w-0 truncate pt-1.5 text-xs',
          isUnavailable ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
        )}>
          {displayFooter}
        </p>
      )}
    </div>
  )
}
