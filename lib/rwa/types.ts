/**
 * Types and interfaces for RWA Credit Asset Issuance & Transaction Intent Service (Issue #246).
 */

export type TransactionIntentStatus =
  | 'prepared'
  | 'submitted'
  | 'unknown'
  | 'confirmed'
  | 'failed'

export type CreditAssetLifecycle = 'Open' | 'Settled' | 'Cancelled'

export type CreditAssetTerms = {
  readonly token: string
  readonly tokenDecimals: number
  /** Amount in base units (stroops / 10^7 for USDC). */
  readonly targetPrincipal: string
  readonly supplier: string
  readonly feeRecipient: string
  readonly excessRecipient: string
  readonly fundingFeeBps: number
  readonly feePolicyVersion: number
  /** Deadline timestamp in unix epoch seconds. */
  readonly deadline: number
}

export type CreditAssetRecord = {
  readonly id: string
  readonly dealId: string
  readonly assetId: string
  readonly contractId: string
  readonly terms: CreditAssetTerms
  readonly lifecycle: CreditAssetLifecycle
  readonly fundingPool: string | null
  readonly issuanceTxHash: string
  readonly issuanceLedger: number
  readonly createdAt: string
  readonly updatedAt: string
}

export type TransactionIntent = {
  readonly id: string
  readonly dealId: string
  readonly intentType: string
  readonly assetId: string
  readonly status: TransactionIntentStatus
  readonly adminUserId: string | null
  readonly signingWallet: string
  readonly contractId: string
  readonly method: string
  readonly network: 'testnet' | 'mainnet'
  readonly networkPassphrase: string
  readonly reviewedPayloadCommitment: string
  readonly termsPayload: CreditAssetTerms
  readonly unsignedXdr: string | null
  readonly signedXdr: string | null
  readonly txHash: string | null
  readonly ledger: number | null
  readonly failureMessage: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type PrepareIssuanceInput = {
  readonly dealId: string
  readonly signingWallet: string
}

export type PrepareIssuanceResult = {
  readonly intentId: string
  readonly assetId: string
  readonly unsignedXdr: string
  readonly terms: CreditAssetTerms
  readonly reviewedPayloadCommitment: string
}

export type SubmitIssuanceInput = {
  readonly intentId: string
  readonly signedXdr: string
}

export type SubmitIssuanceResult = {
  readonly ok: boolean
  readonly status: TransactionIntentStatus
  readonly assetId: string
  readonly txHash?: string
  readonly ledger?: number
  readonly error?: string
}

export type ReconcileIssuanceResult = {
  readonly intentId: string
  readonly status: TransactionIntentStatus
  readonly assetId: string
  readonly txHash?: string | null
  readonly ledger?: number | null
  readonly assetRecord?: CreditAssetRecord | null
  readonly error?: string
}
