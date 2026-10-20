# RWA repayment capability boundary

This document records the Trustless Work capability boundary used by the RWA
payout schedule seam in `lib/trustless/repayment-payout-schedule.ts`.

## Verified from the installed SDK

`@trustless-work/escrow` 3.0.5 exposes multi-release escrows whose milestones
carry an individual `receiver`, `amount`, and `description`. The initialize
payload accepts a milestone array, and release funds are addressed by milestone
index.

The adapter consumes an already-frozen tranche list and maps every position to
its own milestone and receiver. It does not derive entitlements.

## Not verified

The repository does not yet contain evidence from a deployed multi-release
contract for:

- updating receivers or amounts after funding or partial release;
- milestone-count limits and minimum escrow balances;
- exact Trustless Work fee rounding for multiple receivers;
- two distinct receivers receiving payouts on Testnet.

No on-chain evidence is claimed by this change.

## Why full #251 is blocked

Issue #251 depends on #244 (position schema and frozen ledger), #246 (verified
transaction-intent service), #248 (contribution reconciliation and funding
authority), and #250 (exact pro-rata entitlements and dust accounting). Those
pieces are not present in this repository. This increment therefore stops at a
pure, validated handoff from the future entitlement ledger to a Trustless Work
milestone payload. It must not be presented as completed on-chain payout
integration.
