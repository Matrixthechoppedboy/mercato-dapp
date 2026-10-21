import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/route-auth'
import { submitIssuanceIntent } from '@/lib/rwa/transaction-intent-service'
import { TamperedPayloadError } from '@/lib/rwa/registry-client'

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return auth.response
  }

  let body: { intentId?: string; signedXdr?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 })
  }

  if (!body.intentId || typeof body.intentId !== 'string') {
    return NextResponse.json({ error: 'intentId is required.' }, { status: 400 })
  }

  if (!body.signedXdr || typeof body.signedXdr !== 'string') {
    return NextResponse.json({ error: 'signedXdr is required.' }, { status: 400 })
  }

  try {
    const result = await submitIssuanceIntent(
      { intentId: body.intentId, signedXdr: body.signedXdr },
      auth.userId,
    )
    if (!result.ok && result.status === 'failed') {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  } catch (err: unknown) {
    if (
      err instanceof TamperedPayloadError ||
      (err instanceof Error && err.name === 'TamperedPayloadError')
    ) {
      return NextResponse.json({ error: (err as Error).message, status: 'tampered' }, { status: 422 })
    }
    const message = err instanceof Error ? err.message : 'Failed to submit issuance intent.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
