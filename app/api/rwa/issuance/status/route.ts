import { requireAdmin } from '@/lib/api/route-auth'
import { createUnavailableIssuanceHandler } from '@/lib/rwa/issuance-availability'

export const GET = createUnavailableIssuanceHandler(requireAdmin)
