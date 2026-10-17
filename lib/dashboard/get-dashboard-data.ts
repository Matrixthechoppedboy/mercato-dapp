import type { SupabaseClient } from '@supabaase/supabase-js'
import type { AdminApprovalPreview, DashboardDealRow, DashboardPayload } from './types'

/**
 * Dashboard data loader.
 *
 * Every Supabase query response is inspected for an `error` field. Required
 * sections that fail are surfaced to the route error boundary by throwing a
 * `TypedDashboardError`. Optional sections that fail are marked as
 * unavailable in the payload (`unavailableSections`) so the UI can render an
 * explicit "unavailable" state instead of a misleading zero/empty state.
 */

export type DashboardSection =
  | 'deals'
  | 'roleStats'
  | 'supplierCompanies'
  | 'supplierDeals'
  | 'supplierPendingDeliveries'
  | 'supplierProducts'
  | 'adminStats'
  | 'adminRecentDeals'
  | 'adminApprovalPreview'
  | 'adminEscrow'

export interface DashboardSectionError {
  section: DashboardSection
  operation: string
  code?: string
  message: string
}

export class TypedDashboardError extends Error {
  readonly section: DashboardSection
  readonly operation: string
  readonly code?: string

  constructor(details: DashboardSectionError) {
    super(
      `Dashboard section "${details.section}" failed during "${details.operation}": ${details.message}`,
    )
    this.name = 'TypedDashboardError'
    this.section = details.section
    this.operation = details.operation
    this.code = details.code
  }
}

interface QueryErrorLike {
  code?: string
  message?: string
}

function toSectionError(
  section: DashboardSection,
  operation: string,
  error: QueryErrorLike,
): DashboardSectionError {
  return {
    section,
    operation,
    code: error.code,
    message: error.message || 'Unknown database error',
  }
}

/**
 * Required sections throw so the route error boundary catches them.
 * Optional sections are recorded and the consumer renders an explicit
 * unavailable state.
 */
function failRequired(details: DashboardSectionError): never {
  throw new TypedDashboardError(details)
}

export async function getDashboardData(
  supabase: SupabaseClient,
  userId: string,
  profile: {
    full_name?: string | null
    contact_name?: string | null
    company_name?: string | null
    user_type?: string | null
  } | null,
  userEmail: string | undefined,
  companyFilterId: string | null,
): Promise<DashboardPayload> {
  const userType = profile?.user_type || 'pyme'
  const fullName = profile?.full_name || profile?.contact_name || userEmail || ''
  const companyName = profile?.company_name

  let deals: DashboardDealRow[] = []
  let supplierCompanies: { id: string; company_name: string | null; logo_url?: string | null }[] = []
  let supplierProductsForCard: DashboardPayload['supplierProductsForCard'] = null
  let adminStats: DashboardPayload['adminStats'] = null
  let adminApprovalPreview: AdminApprovalPreview[] = []
  let roleStats: DashboardPayload['roleStats'] = null
  const unavailableSections: DashboardSectionError[] = []

  if (userType === 'pyme') {
    const [dealsResult, totalResult, activeResult, completedResult, seekingResult] =
      await Promise.all([
        supabase
          .from('deals')
          .select(
            'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, milestones(id, status)',
          )
          .eq('pyme_id', userId)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', userId),
        supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('pyme_id', userId)
          .in('status', ['funded', 'in_progress']),
        supabase.from('deals').select('*', { count: 'exact', head: true }).eq('pyme_id', userId).eq('status', 'completed'),
        supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .eq('pyme_id', userId)
          .eq('status', 'seeking_funding'),
      ])

    if (dealsResult.error) {
      failRequired(toSectionError('deals', 'deals.list', dealsResult.error))
    }
    if (totalResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.total', totalResult.error))
    }
    if (activeResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.active', activeResult.error))
    }
    if (completedResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.completed', completedResult.error))
    }
    if (seekingResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.seekingFunding', seekingResult.error))
    }

    deals = (dealsResult.data || []) as DashboardDealRow[]
    roleStats = {
      total: totalResult.count ?? 0,
      active: activeResult.count ?? 0,
      completed: completedResult.count ?? 0,
      seekingFunding: seekingResult.count ?? 0,
    }
  } else if (userType === 'investor') {
    const [dealsResult, totalResult, activeResult, completedResult] = await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), milestones(id, status)',
        )
        .eq('investor_id', userId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', userId),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('investor_id', userId)
        .in('status', ['funded', 'in_progress']),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('investor_id', userId).eq('status', 'completed'),
    ])

    if (dealsResult.error) {
      failRequired(toSectionError('deals', 'deals.list', dealsResult.error))
    }
    if (totalResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.total', totalResult.error))
    }
    if (activeResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.active', activeResult.error))
    }
    if (completedResult.error) {
      failRequired(toSectionError('roleStats', 'deals.count.completed', completedResult.error))
    }

    deals = (dealsResult.data || []) as DashboardDealRow[]
    roleStats = {
      total: totalResult.count ?? 0,
      active: activeResult.count ?? 0,
      completed: completedResult.count ?? 0,
    }
  } else if (userType === 'supplier') {
    const myCompaniesResult = await supabase
      .from('supplier_companies')
      .select('id, company_name, logo_url')
      .eq('owner_id', userId)

    if (myCompaniesResult.error) {
      failRequired(
        toSectionError('supplierCompanies', 'supplier_companies.list', myCompaniesResult.error),
      )
    }

    supplierCompanies = (myCompaniesResult.data ?? []).map((c) => ({
      id: c.id,
      company_name: c.company_name,
      logo_url: (c as { logo_url?: string | null }).logo_url ?? null,
    }))
    const companyIds = supplierCompanies.map((c) => c.id)

    if (companyIds.length > 0) {
      const filterByCompany =
        companyFilterId && companyIds.includes(companyFilterId) ? companyFilterId : null
      const dealsBase = filterByCompany
        ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
        : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)

      const [dealsResult, totalResult, activeResult, completedResult] = await Promise.all([
        (filterByCompany
          ? supabase
              .from('deals')
              .select(
                'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url), milestones(id, status)',
              )
              .eq('supplier_id', filterByCompany)
          : supabase
              .from('deals')
              .select(
                'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url), milestones(id, status)',
              )
              .in('supplier_id', companyIds))
          .order('created_at', { ascending: false })
          .limit(10),
        dealsBase,
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)
        ).in('status', ['funded', 'in_progress']),
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)).in('status', ['funded', 'in_progress']),
        (filterByCompany
          ? supabase.from('deals').select('*', { count: 'exact', head: true }).eq('supplier_id', filterByCompany)
          : supabase.from('deals').select('*', { count: 'exact', head: true }).in('supplier_id', companyIds)).eq('status', 'completed'),
      ])

      if (dealsResult.error) {
        failRequired(toSectionError('supplierDeals', 'deals.list', dealsResult.error))
      }
      if (totalResult.error) {
        failRequired(toSectionError('roleStats', 'deals.count.total', totalResult.error))
      }
      if (activeResult.error) {
        failRequired(toSectionError('roleStats', 'deals.count.active', activeResult.error))
      }
      if (completedResult.error) {
        failRequired(toSectionError('roleStats', 'deals.count.completed', completedResult.error))
      }

      deals = (dealsResult.data || []) as DashboardDealRow[]
      roleStats = {
        total: totalResult.count ?? 0,
        active: activeResult.count ?? 0,
        completed: completedResult.count ?? 0,
      }
    }

    const productsResult = await supabase
      .from('products')
      .select('id, name, price, stock, image_url')
      .in('supplier_id', companyIds.length > 0 ? companyIds : [''])
      .limit(10)

    if (productsResult.error) {
      unavailableSections.push(
        toSectionError('supplierProducts', 'products.list', productsResult.error),
      )
    } else {
      supplierProductsForCard = (productsResult.data ?? []) as DashboardPayload['supplierProductsForCard']
    }
  } else if (userType === 'admin') {
    const [
      totalDeals,
      activeDeals,
      completedDeals,
      totalUsers,
      totalCompanies,
      totalProducts,
      pendingApprovals,
    ] = await Promise.all([
      supabase.from('deals').select('*', { count: 'exact', head: true }),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .in('status', ['funded', 'in_progress']),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('supplier_companies').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'seeking_funding'),
    ])

    const adminQueries: Array<[string, typeof totalDeals]> = [
      ['deals.count.total', totalDeals],
      ['deals.count.active', activeDeals],
      ['deals.count.completed', completedDeals],
      ['profiles.count', totalUsers],
      ['supplier_companies.count', totalCompanies],
      ['products.count', totalProducts],
      ['deals.count.pendingApprovals', pendingApprovals],
    ]

    for (const [operation, result] of adminQueries) {
      if (result.error) {
        failRequired(toSectionError('adminStats', operation, result.error))
      }
    }

    adminStats = {
      totalDeles: totalDeals.count ?? 0,
      activeDeles: activeDeals.count ?? 0,
      completedDeals: completedDeals.count ?? 0,
      totalUsers: totalUsers.count ?? 0,
      totalCompanies: totalCompanies.count ?? 0,
      totalProducts: totalProducts.count ?? 0,
      pendingApprovals: pendingApprovals.count ?? 0,
    }

    const recentDealsResult = await supabase
      .from('deals')
      .select(
        'id, title, product_name, description, status, amount, term_days, interest_rate, created_at, funded_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name), supplier:supplier_companies(company_name, full_name, contact_name, logo_url), milestones(id, status)',
      )
      .order('created_at', { ascending: false })
      .limit(8)

    if (recentDealsResult.error) {
      failRequired(toSectionError('adminRecentDeals', 'deals.list.recent', recentDealsResult.error))
    }

    deals = (recentDealsResult.data || []) as DashboardDealRow[]

    const approvalPreviewResult = await supabase
      .from('deals')
      .select('id, title, product_name, amount, created_at, pyme:profiles!deals_pyme_id_fkey(company_name, full_name, contact_name)')
      .eq('status', 'seeking_funding')
      .order('created_at', { ascending: false })
      .limit(5)

    if (approvalPreviewResult.error) {
      unavailableSections.push(
        toSectionError('adminApprovalPreview', 'deals.list.approvalPreview', approvalPreviewResult.error),
      )
    } else {
      adminApprovalPreview = (approvalPreviewResult.data ?? []) as AdminApprovalPreview[]
    }
  }

  return {
    deals,
    roleStats,
    supplierCompanies,
    supplierProductsForCard,
    adminStats,
    adminApprovalPreview,
    unavailableSections,
    userType,
    fullName,
    companyName,
  } as DashboardPayload
}
