import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/route-auth'
import { reconcileIssuanceIntent } from '@/lib/rwa/transaction-intent-service'

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return auth.response
  }

  const url = new URL(req.url)
  const intentId = url.searchParams.get('intentId')

  if (!intentId) {
    return NextResponse.json({ error: 'intentId query parameter is required.' }, { status: 400 })
  }

  try {
    const result = await reconcileIssuanceIntent(intentId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reconcile issuance status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
