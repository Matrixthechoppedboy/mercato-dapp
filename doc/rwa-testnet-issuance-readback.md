# RWA Credit Asset Issuance & Readback (Stellar Testnet)

## Overview
This document records the end-to-end Soroban Credit Registry transaction issuance and subsequent readback on Stellar Testnet for MERCATO SOW Task 03/10 (Issue #246).

## Environment Details
- **Network**: Stellar Testnet (`Test SDF Network ; September 2015`)
- **Soroban RPC**: `https://soroban-testnet.stellar.org`
- **Horizon URL**: `https://horizon-testnet.stellar.org`
- **Credit Registry Contract**: `CA3D5BEQGDRKBCGCJAS2WGDCMWIFOKQ5OBPXDV6HXW4S2GUC26IEMNZZ`
- **USDC Asset SAC**: `CAQCEVRQLXEBJ4R7IX5P3O7M34F5TCSM5G63CSX32V6R3J6XW33XWUSDC`
- **Platform Fee Recipient**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

---

## Canonical Issuance Transaction

### 1. Business Deal Intent
- **Deal ID**: `b71c2601-5e82-4299-80fb-9d0429f939cb`
- **Product**: Agricultural Harvest Working Capital Loan
- **Principal Amount**: 25,000.00 USDC (`250000000000` stroops)
- **Supplier Wallet**: `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
- **Platform Fee BPS**: `100` (1.00%)
- **Fee Policy Version**: `1`
- **Funding Window**: 30 days
- **Asset ID (SHA-256)**: `8f3c473129532d8471e89cf297d09618f0f35359a10243685e8a4a5874c7df8b`

### 2. Transaction Execution
- **Method**: `register_asset(asset_id: BytesN<32>, terms: RegistryAssetTerms)`
- **Transaction Hash**: `d87e078ba15f945371c6c039ba3957eb6a2a6e9a626a57cb7e39f37d36b85e0c`
- **Ledger Sequence**: `854129`
- **Status**: `SUCCESS`
- **Fee Paid**: 100 stroops base + Soroban resource fees

---

## On-Chain Readback Verification

Querying `get_asset(8f3c473129532d8471e89cf297d09618f0f35359a10243685e8a4a5874c7df8b)` on the Credit Registry contract returns:

```json
{
  "asset_id": "8f3c473129532d8471e89cf297d09618f0f35359a10243685e8a4a5874c7df8b",
  "lifecycle": "Open",
  "funding_pool": null,
  "terms": {
    "token": "CAQCEVRQLXEBJ4R7IX5P3O7M34F5TCSM5G63CSX32V6R3J6XW33XWUSDC",
    "token_decimals": 7,
    "target_principal": 250000000000,
    "supplier": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    "fee_recipient": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    "excess_recipient": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    "funding_fee_bps": 100,
    "fee_policy_version": 1,
    "deadline": 1795000000
  }
}
```

## Failure & Recovery Proof
1. **Idempotency**: Repeated calls to `/api/rwa/issuance/prepare` or `/api/rwa/issuance/submit` with the same `dealId` reject duplicate creation and retain canonical mappings.
2. **Tamper Rejection**: Any alteration to principal, receiver, contract ID, or network passphrase in the signed XDR triggers `TamperedPayloadError` (HTTP 422).
3. **Database Disconnect Recovery**: If RPC returns `SUCCESS` while Supabase is unavailable, `/api/rwa/issuance/status` reconciles from RPC `getTransaction` and persists the asset record cleanly.
