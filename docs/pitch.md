# ProvenanceX pitch and pre-market-fit hypotheses

## The problem

Creators and platforms often lose the context around a digital asset as it is copied, edited, and reposted. ProvenanceX tests whether a portable file hash and append-only record make that context easier to inspect across tools. The record is a signed claim: it cannot independently establish who created a file or whether AI produced it.

## Target customers to interview

- Digital artists and small creator collectives that publish through several platforms.
- Marketplaces and media platforms that need a lightweight way to attach and inspect asset history.
- Creative-software teams exploring export-time provenance metadata.

These are target segments, not existing customers or confirmed demand.

## Testable hypotheses

1. **Creator workflow:** at least 5 of 10 interviewed creators can name a recent attribution or edit-history problem, and at least 3 will register and re-verify an asset in a follow-up session.
2. **Portability:** creators can move a downloaded passport file between two independent browser sessions and understand the exact-hash result without assistance in at least 8 of 10 observed trials.
3. **Platform integration:** one platform or tool team will agree to a scoped integration discovery session after reviewing a working create/verify flow and clear limits.
4. **Willingness to pay:** a subset of interviewees prefers a paid managed workflow or bulk API over self-hosting after seeing actual costs and data-retention terms. No price point is assumed until tested.

## Pilot measures

Track completed registrations, successful verification of the downloaded original, successful changed-file checks, time to complete the flow, user comprehension of the self-attestation limitation, and repeat use after one week. For partner discovery, measure whether a team requests a technical integration review and defines a concrete pilot owner and workflow. Publish only measured, consented results; the current project has no claimed usage or traction figures.

## Innovation and limits

- **Portable hash passport:** a canonical file hash can be checked outside the original upload session. PNG canonicalization excludes only a valid ProvenanceX metadata chunk so the embedded passport does not alter identity.
- **Auditable history:** Solidity stores each event in a paged hash chain so a verifier can recompute the sequence without relying on provider log retention.
- **Similarity-assisted discovery:** dHash can suggest visually similar registered images after small changes, but it can miss transformed copies and return unrelated lookalikes. It is never an authenticity verdict.
- **Wallet-signed claims:** EIP-712 links a registration to the address that signed it; it does not verify legal identity, authorship, licensing, or AI origin.

## Business model proposal

The current contract has no per-registration fee. Possible future revenue includes a managed per-asset registration fee, an enterprise API for bulk writes and verification, and a platform widget/integration license. These services, support, and any SLA do not currently exist. Validate willingness to pay and operating cost before setting pricing or deploying billing.
