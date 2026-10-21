import { createClient } from '@/lib/supabase/server'
import {
  computeAssetId,
  computeReviewedPayloadCommitment,
} from './intent-commitment'
import {
  buildUnsignedIssuanceXdr,
  submitAndPollIssuance,
  validateSignedIssuanceXdr,
} from './registry-client'
import {
  DEFAULT_PLATFORM_FEE_RECIPIENT,
  DEFAULT_USDC_TOKEN,
  getCreditRegistryContractId,
  RWA_CONFIG,
} from './config'
import type {
  CreditAssetTerms,
  PrepareIssuanceInput,
  PrepareIssuanceResult,
  ReconcileIssuanceResult,
  SubmitIssuanceInput,
  SubmitIssuanceResult,
} from './types'
import { getAppStellarNetwork, getStellarNetworkConfig } from '@/lib/stellar/network-config'

export class DealNotEligibleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DealNotEligibleError'
  }
}

export class DuplicateIssuanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DuplicateIssuanceError'
  }
}

/**
 * Prepares a deterministic issuance intent for an approved deal.
 */
export async function prepareIssuanceIntent(
  input: PrepareIssuanceInput,
  adminUserId: string,
): Promise<PrepareIssuanceResult> {
  const supabase = await createClient()

  // 1. Fetch deal strictly server-side
  const { data: deal, error: dealErr } = await supabase
    .from('deals')
    .select('*')
    .eq('id', input.dealId)
    .single()

  if (dealErr || !deal) {
    throw new DealNotEligibleError('Deal not found.')
  }

  // Eligible statuses: 'approved', 'seeking_funding', or 'funded' (configured by admin)
  if (!['approved', 'seeking_funding', 'funded'].includes(deal.status)) {
    throw new DealNotEligibleError(`Deal status '${deal.status}' is not eligible for asset issuance.`)
  }

  // 2. Check if deal already has a confirmed credit asset
  const { data: existingAsset } = await supabase
    .from('credit_assets')
    .select('id, asset_id')
    .eq('deal_id', input.dealId)
    .maybeSingle()

  if (existingAsset) {
    throw new DuplicateIssuanceError(`Deal already has a confirmed credit asset (${existingAsset.asset_id}).`)
  }

  // 3. Derive authoritative terms strictly server-side
  const supplierAddress = deal.supplier_contact || deal.pyme_id || input.signingWallet
  const targetPrincipalScaled = BigInt(Math.round(Number(deal.amount || 0) * 10 ** RWA_CONFIG.tokenDecimals)).toString()

  const deadlineTimestamp = deal.funding_expires_at
    ? Math.floor(new Date(deal.funding_expires_at).getTime() / 1000)
    : Math.floor(Date.now() / 1000) + RWA_CONFIG.defaultDeadlineDays * 86400

  const terms: CreditAssetTerms = {
    token: DEFAULT_USDC_TOKEN,
    tokenDecimals: RWA_CONFIG.tokenDecimals,
    targetPrincipal: targetPrincipalScaled,
    supplier: supplierAddress,
    feeRecipient: DEFAULT_PLATFORM_FEE_RECIPIENT,
    excessRecipient: DEFAULT_PLATFORM_FEE_RECIPIENT,
    fundingFeeBps: RWA_CONFIG.fundingFeeBps,
    feePolicyVersion: RWA_CONFIG.feePolicyVersion,
    deadline: deadlineTimestamp,
  }

  const assetId = computeAssetId(input.dealId, terms)
  const commitment = computeReviewedPayloadCommitment(terms)
  const network = getAppStellarNetwork()
  const contractId = getCreditRegistryContractId()

  // 4. Build and simulate unsigned XDR
  const { unsignedXdr, networkPassphrase } = await buildUnsignedIssuanceXdr({
    sourceAccount: input.signingWallet,
    assetId,
    terms,
    contractId,
    network,
  })

  // 5. Persist the transaction intent
  const { data: intentRow, error: intentErr } = await supabase
    .from('rwa_transaction_intents')
    .insert({
      deal_id: input.dealId,
      intent_type: 'issuance',
      asset_id: assetId,
      status: 'prepared',
      admin_user_id: adminUserId,
      signing_wallet: input.signingWallet,
      contract_id: contractId,
      method: 'register_asset',
      network,
      network_passphrase: networkPassphrase,
      reviewed_payload_commitment: commitment,
      terms_payload: terms,
      unsigned_xdr: unsignedXdr,
    })
    .select('id')
    .single()

  if (intentErr || !intentRow) {
    throw new Error(`Failed to save transaction intent: ${intentErr?.message}`)
  }

  return {
    intentId: intentRow.id,
    assetId,
    unsignedXdr,
    terms,
    reviewedPayloadCommitment: commitment,
  }
}

/**
 * Submits signed XDR for a prepared intent, verifying tamper protection and recording outcomes.
 */
export async function submitIssuanceIntent(
  input: SubmitIssuanceInput,
  adminUserId: string,
): Promise<SubmitIssuanceResult> {
  const supabase = await createClient()

  // 1. Load intent
  const { data: intent, error: intentErr } = await supabase
    .from('rwa_transaction_intents')
    .select('*')
    .eq('id', input.intentId)
    .single()

  if (intentErr || !intent) {
    return { ok: false, status: 'failed', assetId: '', error: 'Transaction intent not found.' }
  }

  if (intent.status === 'confirmed') {
    return {
      ok: true,
      status: 'confirmed',
      assetId: intent.asset_id,
      txHash: intent.tx_hash,
      ledger: intent.ledger,
    }
  }

  // 2. Validate decoded signed XDR against stored intent commitment
  validateSignedIssuanceXdr(input.signedXdr, {
    expectedContractId: intent.contract_id,
    expectedAssetId: intent.asset_id,
    expectedCommitment: intent.reviewed_payload_commitment,
    expectedSigningWallet: intent.signing_wallet,
    expectedNetworkPassphrase: intent.network_passphrase,
  })

  // 3. Update intent to submitted
  await supabase
    .from('rwa_transaction_intents')
    .update({
      status: 'submitted',
      signed_xdr: input.signedXdr,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.intentId)

  // 4. Submit and poll
  const pollRes = await submitAndPollIssuance(input.signedXdr, intent.network)

  if (pollRes.status === 'SUCCESS' && pollRes.ledger) {
    // 5. Finalize asset mapping atomically
    const terms = intent.terms_payload as CreditAssetTerms
    await supabase.from('credit_assets').insert({
      deal_id: intent.deal_id,
      asset_id: intent.asset_id,
      contract_id: intent.contract_id,
      token: terms.token,
      token_decimals: terms.tokenDecimals,
      target_principal: terms.targetPrincipal,
      supplier: terms.supplier,
      fee_recipient: terms.feeRecipient,
      excess_recipient: terms.excessRecipient,
      funding_fee_bps: terms.fundingFeeBps,
      fee_policy_version: terms.feePolicyVersion,
      deadline: new Date(terms.deadline * 1000).toISOString(),
      lifecycle: 'Open',
      issuance_tx_hash: pollRes.txHash,
      issuance_ledger: pollRes.ledger,
    })

    await supabase
      .from('rwa_transaction_intents')
      .update({
        status: 'confirmed',
        tx_hash: pollRes.txHash,
        ledger: pollRes.ledger,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.intentId)

    return {
      ok: true,
      status: 'confirmed',
      assetId: intent.asset_id,
      txHash: pollRes.txHash,
      ledger: pollRes.ledger,
    }
  }

  if (pollRes.status === 'FAILED') {
    await supabase
      .from('rwa_transaction_intents')
      .update({
        status: 'failed',
        tx_hash: pollRes.txHash,
        failure_message: pollRes.error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.intentId)

    return {
      ok: false,
      status: 'failed',
      assetId: intent.asset_id,
      txHash: pollRes.txHash,
      error: pollRes.error,
    }
  }

  // TIMEOUT: record unknown status for reconciliation
  await supabase
    .from('rwa_transaction_intents')
    .update({
      status: 'unknown',
      tx_hash: pollRes.txHash,
      failure_message: pollRes.error,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.intentId)

  return {
    ok: false,
    status: 'unknown',
    assetId: intent.asset_id,
    txHash: pollRes.txHash,
    error: pollRes.error,
  }
}

/**
 * Reconciles an unknown or interrupted transaction intent.
 */
export async function reconcileIssuanceIntent(
  intentId: string,
): Promise<ReconcileIssuanceResult> {
  const supabase = await createClient()

  const { data: intent } = await supabase
    .from('rwa_transaction_intents')
    .select('*')
    .eq('id', intentId)
    .single()

  if (!intent) {
    return { intentId, status: 'failed', assetId: '', error: 'Intent not found.' }
  }

  if (intent.status === 'confirmed') {
    const { data: assetRecord } = await supabase
      .from('credit_assets')
      .select('*')
      .eq('deal_id', intent.deal_id)
      .maybeSingle()

    return {
      intentId,
      status: 'confirmed',
      assetId: intent.asset_id,
      txHash: intent.tx_hash,
      ledger: intent.ledger,
      assetRecord,
    }
  }

  // If already has confirmed asset in DB (repair scenario)
  const { data: existingAsset } = await supabase
    .from('credit_assets')
    .select('*')
    .eq('deal_id', intent.deal_id)
    .maybeSingle()

  if (existingAsset) {
    await supabase
      .from('rwa_transaction_intents')
      .update({
        status: 'confirmed',
        tx_hash: existingAsset.issuance_tx_hash,
        ledger: existingAsset.issuance_ledger,
        updated_at: new Date().toISOString(),
      })
      .eq('id', intentId)

    return {
      intentId,
      status: 'confirmed',
      assetId: intent.asset_id,
      txHash: existingAsset.issuance_tx_hash,
      ledger: existingAsset.issuance_ledger,
      assetRecord: existingAsset,
    }
  }

  return {
    intentId,
    status: intent.status,
    assetId: intent.asset_id,
    txHash: intent.tx_hash,
    ledger: intent.ledger,
    error: intent.failure_message,
  }
}
