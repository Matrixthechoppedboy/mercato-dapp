import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { TamperedPayloadError } from '@/lib/rwa/registry-client'
import { DealNotEligibleError, DuplicateIssuanceError } from '@/lib/rwa/transaction-intent-service'

const state = {
  adminOk: true,
  prepareResult: null as any,
  submitResult: null as any,
  statusResult: null as any,
  failWith: null as any,
}

mock.module('@/lib/api/route-auth', () => ({
  requireAdmin: async () =>
    state.adminOk
      ? { ok: true, userId: 'admin-1', email: 'admin@mercato.xyz' }
      : {
          ok: false,
          response: Response.json({ error: 'Forbidden' }, { status: 403 }),
        },
}))

mock.module('@/lib/rwa/transaction-intent-service', () => ({
  DealNotEligibleError,
  DuplicateIssuanceError,
  prepareIssuanceIntent: async (input: any) => {
    if (state.failWith) throw state.failWith
    return state.prepareResult || {
      intentId: 'intent-uuid-1',
      assetId: 'asset-123',
      unsignedXdr: 'AAAA_MOCK_UNSIGNED_XDR',
      terms: {} as any,
      reviewedPayloadCommitment: 'commit-123',
    }
  },
  submitIssuanceIntent: async (input: any) => {
    if (input.signedXdr === 'TAMPERED_XDR') {
      throw new TamperedPayloadError('Contract ID mismatch or tampered payload')
    }
    if (state.failWith) throw state.failWith
    return state.submitResult || {
      ok: true,
      status: 'confirmed',
      assetId: 'asset-123',
      txHash: 'tx-ok-123',
      ledger: 854129,
    }
  },
  reconcileIssuanceIntent: async (intentId: string) => {
    if (state.failWith) throw state.failWith
    return state.statusResult || {
      intentId,
      status: 'confirmed',
      assetId: 'asset-123',
      txHash: 'tx-ok-123',
      ledger: 854129,
    }
  },
}))

const { POST: preparePost } = await import('@/app/api/rwa/issuance/prepare/route')
const { POST: submitPost } = await import('@/app/api/rwa/issuance/submit/route')
const { GET: statusGet } = await import('@/app/api/rwa/issuance/status/route')

function postPrepare(body: unknown): Promise<Response> {
  return preparePost(
    new Request('http://localhost/api/rwa/issuance/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function postSubmit(body: unknown): Promise<Response> {
  return submitPost(
    new Request('http://localhost/api/rwa/issuance/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

function getStatus(intentId?: string): Promise<Response> {
  const url = intentId
    ? `http://localhost/api/rwa/issuance/status?intentId=${intentId}`
    : 'http://localhost/api/rwa/issuance/status'
  return statusGet(new Request(url, { method: 'GET' }))
}

beforeEach(() => {
  state.adminOk = true
  state.prepareResult = null
  state.submitResult = null
  state.statusResult = null
  state.failWith = null
})

afterEach(() => {
  mock.restore()
})

describe('RWA Issuance API Routes', () => {
  test('prepare: rejects non-admins with 403', async () => {
    state.adminOk = false
    const res = await postPrepare({ dealId: 'deal-1', signingWallet: 'GBB...' })
    expect(res.status).toBe(403)
  })

  test('prepare: validates required fields', async () => {
    const res1 = await postPrepare({ dealId: 'deal-1' })
    expect(res1.status).toBe(400)
    const res2 = await postPrepare({ signingWallet: 'GBB...' })
    expect(res2.status).toBe(400)
  })

  test('prepare: rejects unapproved deals with 422', async () => {
    state.failWith = new DealNotEligibleError('Deal status draft is not eligible for asset issuance.')
    const res = await postPrepare({ dealId: 'deal-1', signingWallet: 'GBB...' })
    expect(res.status).toBe(422)
  })

  test('prepare: rejects duplicate issuance with 409', async () => {
    state.failWith = new DuplicateIssuanceError('Deal already has a confirmed credit asset.')
    const res = await postPrepare({ dealId: 'deal-1', signingWallet: 'GBB...' })
    expect(res.status).toBe(409)
  })

  test('prepare: succeeds and returns intentId and unsignedXdr for eligible deal', async () => {
    const res = await postPrepare({
      dealId: 'deal-1',
      signingWallet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.intentId).toBe('intent-uuid-1')
    expect(data.unsignedXdr).toBe('AAAA_MOCK_UNSIGNED_XDR')
  })

  test('submit: rejects non-admins with 403', async () => {
    state.adminOk = false
    const res = await postSubmit({ intentId: 'intent-1', signedXdr: 'AAAA...' })
    expect(res.status).toBe(403)
  })

  test('submit: rejects tampered signed XDR with 422', async () => {
    const res = await postSubmit({ intentId: 'intent-1', signedXdr: 'TAMPERED_XDR' })
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.status).toBe('tampered')
  })

  test('submit: successfully finalizes inclusion on RPC success', async () => {
    const res = await postSubmit({ intentId: 'intent-1', signedXdr: 'VALID_SIGNED_XDR' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.status).toBe('confirmed')
    expect(data.txHash).toBe('tx-ok-123')
    expect(data.ledger).toBe(854129)
  })

  test('submit: marks status unknown on timeout for safe recovery', async () => {
    state.submitResult = {
      ok: false,
      status: 'unknown',
      assetId: 'asset-123',
      txHash: 'tx-timeout',
      error: 'Inclusion timed out',
    }
    const res = await postSubmit({ intentId: 'intent-1', signedXdr: 'TIMEOUT_XDR' })
    const data = await res.json()
    expect(data.ok).toBe(false)
    expect(data.status).toBe('unknown')
  })

  test('status: reconciles intent status by id', async () => {
    const res = await getStatus('intent-1')
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.intentId).toBe('intent-1')
  })

  test('status: rejects missing intentId parameter with 400', async () => {
    const res = await getStatus()
    expect(res.status).toBe(400)
  })
})
