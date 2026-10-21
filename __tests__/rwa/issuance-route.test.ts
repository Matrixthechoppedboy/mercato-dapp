import { describe, expect, test } from 'bun:test'
import { NextResponse } from 'next/server'
import type { AuthResult } from '@/lib/api/route-auth'
import { createUnavailableIssuanceHandler } from '@/lib/rwa/issuance-availability'

describe('unavailable issuance route handler', () => {
  for (const status of [401, 403]) {
    test(`preserves the ${status} admin guard response`, async () => {
      const denied = NextResponse.json({ error: 'Denied' }, { status })
      const handler = createUnavailableIssuanceHandler(async () => ({ ok: false, response: denied }))
      expect(await handler()).toBe(denied)
    })
  }

  test('returns a non-cacheable unavailable response for an administrator', async () => {
    let checks = 0
    const handler = createUnavailableIssuanceHandler(async (): Promise<AuthResult> => {
      checks++
      return { ok: true, userId: 'test-admin', email: 'admin@example.invalid' }
    })
    const response = await handler()
    expect(checks).toBe(1)
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({
      ok: false,
      status: 'unavailable',
      code: 'RWA_ISSUANCE_UNAVAILABLE',
      error: 'RWA issuance is not available yet.',
    })
  })

  test('does not hide an authentication failure as an authorized result', async () => {
    const handler = createUnavailableIssuanceHandler(async () => { throw new Error('Auth unavailable') })
    await expect(handler()).rejects.toThrow('Auth unavailable')
  })
})
