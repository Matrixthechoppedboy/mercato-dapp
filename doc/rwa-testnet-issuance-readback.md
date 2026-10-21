# RWA issuance: implementation and Testnet evidence status

**Incomplete. There is no verified Testnet issuance/readback for this PR.**

The previous version of this document incorrectly presented unverified contract
addresses, a transaction hash and a ledger as successful on-chain evidence.
Those claims have been withdrawn. The registry and token addresses failed the
Stellar SDK's StrKey validation; the cited transaction was not found by the
Testnet RPC or Horizon. RPC history is bounded, so `NOT_FOUND` alone would not
prove that a historical transaction never existed.

## What this draft implements

- A reusable check of a wallet-signed Soroban envelope against the exact
  server-owned unsigned transaction reviewed by the administrator. It checks
  the complete signature base and a real Ed25519 signature on the selected
  network, rejects expired/unbounded transactions and fee-bump envelopes, and
  supports only a single source-account signer/authorization flow.
- Admin-protected prepare, submit and status endpoints that return HTTP 503
  with `RWA_ISSUANCE_UNAVAILABLE`. They do not prepare transactions, submit to
  RPC, write financial mappings, or report completed issuance. There is no
  environment flag that enables the unfinished flow.
- Local tests with real SDK-generated XDR and disposable test signatures.
  These tests do not submit transactions or establish Testnet evidence.

The provisional business orchestration, invented financial snapshot/hash
format, synthetic deployment defaults, unused confirmation card and unreleased
schema migration have been removed from this draft. Existing legacy deal
creation, funding, repayment and database migrations are unchanged.

## Required to complete #246

1. Integrate #244's approved eligibility evidence, locked snapshot/version,
   canonical commitments, maturity rule, persistence and uniqueness constraints.
2. Integrate #245's registry ABI, issuer authorization, deterministic issuance
   identity, events/readback and verified Testnet deployment manifest.
3. Persist the business intent and each transaction attempt before signing or
   submission. Compare signed XDR with that stored, reviewed attempt; record
   its hash before network submission. Reconcile unknown attempts before retry.
4. Confirm successful ledger inclusion **and** the expected registry result,
   event and readback before atomically recording the canonical asset mapping.
   Recover chain success/DB failure into that same issuance identity.
5. Add the EN/ES admin review/action/status UI and approved SWK signing flow;
   keep unsupported Pollar operations disabled. Complete the issue's mocked
   RPC/wallet, authorization, concurrency, recovery and database tests.
6. Perform a real Testnet issuance using the authorized wallet. Record source
   revision, deployed contract/WASM/network, transaction hash, ledger, decoded
   call, expected result/event and matching readback. Store no secret keys or
   private documents in evidence. Only then replace this pending status with
   independently verifiable receipt links and mark the PR ready for review.

## Local validation of the correction

Using the repository's pinned Bun 1.3.14:

- `bun test __tests__/rwa`: 38 passed, 0 failed.
- `bunx eslint lib/rwa app/api/rwa __tests__/rwa`: passed.
- `bun build`: passed. The existing Next.js configuration skips type checking.
- `bun lint`: 91 errors and 47 warnings, identical to base commit
  `763f9901bbcd46bf06f5102bf14de82a1fc388d0` after normalizing checkout paths.
- `bunx tsc --noEmit`: the same 21 diagnostics as that base commit, with no
  diagnostics in the RWA files.

These local checks do not establish on-chain acceptance. See the
[Stellar RPC confirmation and retention
documentation](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransaction).
