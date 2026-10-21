import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/route-auth'
import {
  DealNotEligibleError,
  DuplicateIssuanceError,
  prepareIssuanceIntent,
} from '@/lib/rwa/transaction-intent-service'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return auth.response
  }

  let body: { dealId?: string; signingWallet?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  if (!body.dealId || typeof body.dealId !== 'string') {
    return NextResponse.json({ error: 'dealId is required.' }, { status: 400 })
  }

  if (!body.signingWallet || typeof body.signingWallet !== 'string') {
    return NextResponse.json({ error: 'signingWallet is required.' }, { status: 400 })
  }

  try {
    const result = await prepareIssuanceIntent(
      { dealId: body.dealId, signingWallet: body.signingWallet },
      auth.userId,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err: unknown) {
    if (err instanceof DealNotEligibleError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    if (err instanceof DuplicateIssuanceError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    const message = err instanceof Error ? err.message : 'Failed to prepare issuance intent.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
