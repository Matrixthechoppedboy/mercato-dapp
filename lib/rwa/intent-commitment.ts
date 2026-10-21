import { createHash } from 'crypto'
import type { CreditAssetTerms } from './types'

/**
 * Computes a deterministic 32-byte hex asset ID from dealId and core immutable terms.
 */
export function computeAssetId(dealId: string, terms: CreditAssetTerms): string {
  const payload = JSON.stringify({
    dealId,
    token: terms.token,
    tokenDecimals: terms.tokenDecimals,
    targetPrincipal: terms.targetPrincipal,
    supplier: terms.supplier,
    feeRecipient: terms.feeRecipient,
    excessRecipient: terms.excessRecipient,
    fundingFeeBps: terms.fundingFeeBps,
    feePolicyVersion: terms.feePolicyVersion,
    deadline: terms.deadline,
  })
  return createHash('sha256').update(payload).digest('hex')
}

/**
 * Computes the cryptographic commitment (SHA-256 hex) of reviewed terms.
 */
export function computeReviewedPayloadCommitment(terms: CreditAssetTerms): string {
  const canonical = JSON.stringify({
    token: terms.token,
    tokenDecimals: terms.tokenDecimals,
    targetPrincipal: terms.targetPrincipal,
    supplier: terms.supplier,
    feeRecipient: terms.feeRecipient,
    excessRecipient: terms.excessRecipient,
    fundingFeeBps: terms.fundingFeeBps,
    feePolicyVersion: terms.feePolicyVersion,
    deadline: terms.deadline,
  })
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Validates whether candidate terms match an expected commitment.
 */
export function verifyReviewedPayloadCommitment(
  terms: CreditAssetTerms,
  expectedCommitment: string,
): boolean {
  const actual = computeReviewedPayloadCommitment(terms)
  return actual === expectedCommitment
}
