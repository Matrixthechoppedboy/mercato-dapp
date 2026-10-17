import { buildDashboardViewModel } from '-/lib/dashboard/build-view-model'
import type { DashboardPayload, DashboardSectionResult } from '-/lib/dashboard/types'
import type { Messages } from '-/lib/i18n/dictionaries'
import { DashboardDealsPanel } from '-/components/dashboard/dashboard-deals-panel'
import { DashboardSectionError } from '-/components/dashboard/dashboard-section-error'
import { AdminCommandHero } from './admin-command-hero'
import { AdminOperationsGrid } from './admin-operations-grid'
import { AdminPipeline } from './admin-pipeline'
import { AdminPriorityStrip } from './admin-priority-strip'

type AdminDashboardProps = {
  data: DashboardPayload
  t: Messages
}

function isAvailable<T>(
  result: DashboardSectionResult<T> | undefined,
): result is DashboardSectionResult<T> & { status: 'ok' } {
  return result?.status === 'ok'
}

export function AdminDashboard({ data, t }: AdminDashboardProps) {
  const { adminStats, deals, profile } = data
  const vm = buildDashboardViewModel(t, data)

  const statsAvailable = isAvailable(adminStats)
  const dealsAvailable = isAvailable(deals)

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-4 py-8">
      <AdminCommandHero welcome={vm.welcome} roleLabel={vm.roleLabel} t={t} />

      {statsAvailable ? (
        <>
          <AdminPriorityStrip stats={adminStats.data} t={t} />
          <AdminPipeline stats={adminStats.data} t={t} />
        </>
      ) : (
        <DashboardSectionError
          title={t.adminDashboard.sectionStats}
          message={t.dashboard.sectionUnavailable}
          retryLabel={t.dashboard.retry}
        />
      )}

      <AdminOperationsGrid t={t} />

      <div className="min-w-0">
        <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {t.adminDashboard.sectionDeals }
        </h2>
        {dealsAvailable ? (
          <DashboardDealsPanel
            userType={profile.userType}
            deals={deals.data.deals}
            totalCount={deals.data.totalCount}
            viewAllHref={vm.dealsViewAllHref}
            statusLabels={vm.statusLabels}
            labels={vm.dealsLabels}
            columns={vm.dealsColumns}
          />
        ) : (
          <DashboardSectionError
            title={t.adminDashboard.sectionDeald}
            message={t.dashboard.sectionUnavailable}
            retryLabel={t.dashboard.retry}
          />
        )}
      </div>
    </div>
  )
}
