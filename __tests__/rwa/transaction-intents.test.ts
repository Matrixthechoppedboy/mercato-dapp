import { describe, expect, test } from 'bun:test'
import {
  computeAssetId,
  computeReviewedPayloadCommitment,
  verifyReviewedPayloadCommitment,
} from '@/lib/rwa/intent-commitment'
import {
  TamperedPayloadError,
  validateSignedIssuanceXdr,
} from '@/lib/rwa/registry-client'
import type { CreditAssetTerms } from '@/lib/rwa/types'
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  nativeToScVal,
  Networks,
  StrKey,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk'

const contractId = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526'
const tokenContract = 'CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ'
const signer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

const mockTerms: CreditAssetTerms = {
  token: tokenContract,
  tokenDecimals: 7,
  targetPrincipal: '10000000000',
  supplier: signer,
  feeRecipient: signer,
  excessRecipient: signer,
  fundingFeeBps: 100,
  feePolicyVersion: 1,
  deadline: 1800000000,
}

describe('RWA Transaction Intent Commitments', () => {
  test('computes deterministic asset ID from dealId and terms', () => {
    const assetId1 = computeAssetId('deal-123', mockTerms)
    const assetId2 = computeAssetId('deal-123', mockTerms)
    expect(assetId1).toBe(assetId2)
    expect(assetId1).toHaveLength(64) // 32-byte hex string
  })

  test('different dealId produces different asset ID', () => {
    const idA = computeAssetId('deal-A', mockTerms)
    const idB = computeAssetId('deal-B', mockTerms)
    expect(idA).not.toBe(idB)
  })

  test('different terms produce different commitment', () => {
    const commitmentOriginal = computeReviewedPayloadCommitment(mockTerms)
    const tamperedTerms = { ...mockTerms, targetPrincipal: '99999999999' }
    const commitmentTampered = computeReviewedPayloadCommitment(tamperedTerms)
    expect(commitmentOriginal).not.toBe(commitmentTampered)
    expect(verifyReviewedPayloadCommitment(mockTerms, commitmentOriginal)).toBe(true)
    expect(verifyReviewedPayloadCommitment(tamperedTerms, commitmentOriginal)).toBe(false)
  })
})

describe('Signed XDR Validation and Tamper Rejection', () => {
  const assetId = computeAssetId('deal-123', mockTerms)
  const commitment = computeReviewedPayloadCommitment(mockTerms)

  function buildValidSignedXdr(customContract = contractId, customAssetId = assetId, customSigner = signer): string {
    const account = new Account(customSigner, '100')
    const contract = new Contract(customContract)
    const op = contract.call(
      'register_asset',
      xdr.ScVal.scvBytes(Buffer.from(customAssetId, 'hex')),
      nativeToScVal({
        token: new Address(mockTerms.token),
        token_decimals: mockTerms.tokenDecimals,
        target_principal: BigInt(mockTerms.targetPrincipal),
        supplier: new Address(mockTerms.supplier),
        fee_recipient: new Address(mockTerms.feeRecipient),
        excess_recipient: new Address(mockTerms.excessRecipient),
        funding_fee_bps: mockTerms.fundingFeeBps,
        fee_policy_version: mockTerms.feePolicyVersion,
        deadline: BigInt(mockTerms.deadline),
      }),
    )

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(300)
      .build()

    return tx.toXDR()
  }

  test('accepts valid untampered signed XDR', () => {
    const validXdr = buildValidSignedXdr()
    expect(() => {
      validateSignedIssuanceXdr(validXdr, {
        expectedContractId: contractId,
        expectedAssetId: assetId,
        expectedCommitment: commitment,
        expectedSigningWallet: signer,
        expectedNetworkPassphrase: Networks.TESTNET,
      })
    }).not.toThrow()
  })

  test('rejects tampered contract ID in signed XDR', () => {
    const alteredContract = StrKey.encodeContract(Buffer.alloc(32, 9))
    const tamperedXdr = buildValidSignedXdr(alteredContract)
    expect(() => {
      validateSignedIssuanceXdr(tamperedXdr, {
        expectedContractId: contractId,
        expectedAssetId: assetId,
        expectedCommitment: commitment,
        expectedSigningWallet: signer,
        expectedNetworkPassphrase: Networks.TESTNET,
      })
    }).toThrow(TamperedPayloadError)
  })

  test('rejects tampered asset ID in signed XDR', () => {
    const alteredAssetId = '0000000000000000000000000000000000000000000000000000000000000000'
    const tamperedXdr = buildValidSignedXdr(contractId, alteredAssetId)
    expect(() => {
      validateSignedIssuanceXdr(tamperedXdr, {
        expectedContractId: contractId,
        expectedAssetId: assetId,
        expectedCommitment: commitment,
        expectedSigningWallet: signer,
        expectedNetworkPassphrase: Networks.TESTNET,
      })
    }).toThrow(TamperedPayloadError)
  })

  test('rejects tampered signing wallet address', () => {
    const validXdr = buildValidSignedXdr()
    const wrongWallet = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
    expect(() => {
      validateSignedIssuanceXdr(validXdr, {
        expectedContractId: contractId,
        expectedAssetId: assetId,
        expectedCommitment: commitment,
        expectedSigningWallet: wrongWallet,
        expectedNetworkPassphrase: Networks.TESTNET,
      })
    }).toThrow(TamperedPayloadError)
  })
})
