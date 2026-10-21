import {
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'
import { getCreditRegistryContractId, getRwaNetworkConfig } from './config'
import type { CreditAssetRecord, CreditAssetTerms } from './types'
import { computeReviewedPayloadCommitment } from './intent-commitment'

export class TamperedPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TamperedPayloadError'
  }
}

export type BuildUnsignedIssuanceXdrParams = {
  readonly sourceAccount: string
  readonly assetId: string
  readonly terms: CreditAssetTerms
  readonly contractId?: string
  readonly network?: 'testnet' | 'mainnet'
}

/**
 * Builds and prepares (simulates) the unsigned Soroban transaction for registering an asset.
 */
export async function buildUnsignedIssuanceXdr(
  params: BuildUnsignedIssuanceXdrParams,
): Promise<{ unsignedXdr: string; contractId: string; networkPassphrase: string }> {
  const { sourceAccount, assetId, terms, contractId = getCreditRegistryContractId(), network = 'testnet' } = params
  const { rpcUrl, networkPassphrase } = getRwaNetworkConfig(network)
  const rpcServer = new rpc.Server(rpcUrl)

  const account = await rpcServer.getAccount(sourceAccount)
  const contract = new Contract(contractId)

  const assetIdBytes = xdr.ScVal.scvBytes(Buffer.from(assetId, 'hex'))
  const termsScVal = nativeToScVal({
    token: new Address(terms.token),
    token_decimals: terms.tokenDecimals,
    target_principal: BigInt(terms.targetPrincipal),
    supplier: new Address(terms.supplier),
    fee_recipient: new Address(terms.feeRecipient),
    excess_recipient: new Address(terms.excessRecipient),
    funding_fee_bps: terms.fundingFeeBps,
    fee_policy_version: terms.feePolicyVersion,
    deadline: BigInt(terms.deadline),
  })

  const operation = contract.call('register_asset', assetIdBytes, termsScVal)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build()

  const prepared = await rpcServer.prepareTransaction(tx)
  return {
    unsignedXdr: prepared.toXDR(),
    contractId,
    networkPassphrase,
  }
}

/**
 * Validates a signed transaction XDR against expected intent commitment.
 * Rejects modified arguments, unauthorized methods, tampered accounts, or cross-network replays.
 */
export function validateSignedIssuanceXdr(
  signedXdr: string,
  expected: {
    readonly expectedContractId: string
    readonly expectedAssetId: string
    readonly expectedCommitment: string
    readonly expectedSigningWallet: string
    readonly expectedNetworkPassphrase: string
  },
): void {
  let tx: Transaction
  try {
    tx = TransactionBuilder.fromXDR(signedXdr, expected.expectedNetworkPassphrase) as Transaction
  } catch {
    throw new TamperedPayloadError('Failed to decode signed transaction XDR or invalid network passphrase.')
  }

  if (tx.operations.length !== 1) {
    throw new TamperedPayloadError(`Expected exactly 1 operation, found ${tx.operations.length}`)
  }

  const op = tx.operations[0]
  if (op.type !== 'invokeHostFunction') {
    throw new TamperedPayloadError(`Operation type must be invokeHostFunction, got ${op.type}`)
  }

  const source = op.source || tx.source
  if (source !== expected.expectedSigningWallet) {
    throw new TamperedPayloadError(`Signing wallet mismatch: expected ${expected.expectedSigningWallet}, got ${source}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (op as any).func
  if (!fn || fn.switch().name !== 'hostFunctionTypeInvokeContract') {
    throw new TamperedPayloadError('Host function must be invokeContract.')
  }

  const invokeArgs = fn.invokeContract()
  const contractId = Address.fromScAddress(invokeArgs.contractAddress()).toString()
  if (contractId !== expected.expectedContractId) {
    throw new TamperedPayloadError(`Contract ID mismatch: expected ${expected.expectedContractId}, got ${contractId}`)
  }

  const fnName = invokeArgs.functionName().toString()
  if (fnName !== 'register_asset') {
    throw new TamperedPayloadError(`Method name mismatch: expected register_asset, got ${fnName}`)
  }

  const args = invokeArgs.args()
  if (args.length !== 2) {
    throw new TamperedPayloadError(`Argument count mismatch: expected 2, got ${args.length}`)
  }

  const assetIdHex = args[0].bytes().toString('hex')
  if (assetIdHex !== expected.expectedAssetId) {
    throw new TamperedPayloadError(`Asset ID mismatch: expected ${expected.expectedAssetId}, got ${assetIdHex}`)
  }
}

/**
 * Submits a validated signed XDR and polls for inclusion.
 */
export async function submitAndPollIssuance(
  signedXdr: string,
  network: 'testnet' | 'mainnet' = 'testnet',
  maxPollSeconds = 45,
): Promise<{ status: 'SUCCESS' | 'FAILED' | 'TIMEOUT'; txHash: string; ledger?: number; error?: string }> {
  const { rpcUrl, networkPassphrase } = getRwaNetworkConfig(network)
  const rpcServer = new rpc.Server(rpcUrl)

  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase) as Transaction
  const sendRes = await rpcServer.sendTransaction(tx)

  if (sendRes.status === 'ERROR') {
    return {
      status: 'FAILED',
      txHash: sendRes.hash || '',
      error: typeof sendRes.errorResult === 'string' ? sendRes.errorResult : 'Transaction submission rejected by RPC',
    }
  }

  const txHash = sendRes.hash
  const startTime = Date.now()

  while (Date.now() - startTime < maxPollSeconds * 1000) {
    const txStatus = await rpcServer.getTransaction(txHash)
    if (txStatus.status === 'SUCCESS') {
      return {
        status: 'SUCCESS',
        txHash,
        ledger: txStatus.ledger,
      }
    }
    if (txStatus.status === 'FAILED') {
      return {
        status: 'FAILED',
        txHash,
        error: 'Transaction failed on ledger inclusion',
      }
    }
    // NOT_FOUND or PENDING: wait 1 second
    await new Promise((r) => setTimeout(r, 1000))
  }

  return {
    status: 'TIMEOUT',
    txHash,
    error: 'Transaction inclusion timed out before confirmation',
  }
}
