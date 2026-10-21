import type { AuthResult } from '@/lib/api/route-auth'

/** Keep financial actions unavailable until their canonical integrations exist. */
export function createUnavailableIssuanceHandler(requireAdmin: () => Promise<AuthResult>) {
  return async function unavailableIssuance(): Promise<Response> {
    const auth = await requireAdmin()
    if (!auth.ok) return auth.response

    return Response.json(
      {
        ok: false,
        status: 'unavailable',
        code: 'RWA_ISSUANCE_UNAVAILABLE',
        error: 'RWA issuance is not available yet.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
