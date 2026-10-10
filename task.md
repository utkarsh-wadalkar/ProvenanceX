# ProvenanceX — shared task tracker

Shared by Utkarsh and Codex. Update this file as work progresses; keep completed checks and pending deployment requirements accurate.

Last updated: 10 October 2026, IST.

## Current focus

Contract deployed and source verified on public testnet. Align product messaging and provenance labels with disaster-response media verification, then publish Vercel and finish integration/docs. Build in Public belongs to Utkarsh.

## Product purpose

Help rescue teams assess viral disaster media through file-integrity proof, signed source declarations, and configured trusted publishers. Clearly flag declared AI/synthetic media. A cryptographic match does not establish that an incident actually happened; unknown origins, edits, and incident context still require review. Image perceptual matching and exact video/file hashing are supported; automatic deepfake detection is not implemented.

## Rubric — evidence before checking off

| Track | Criterion | Points | Status / evidence |
|---|---|---:|---|
| Basic | Public GitHub repository | 25 | Pending repository URL and source publication |
| Basic | README with live public page and contract address | 25 | Documentation task active; real links to be recorded |
| Basic | Contract deployed on Monad Testnet | 25 | **Evidence ready:** address `0xe33c5b4e0d9148bab301807d39bf2c0349037cce`, confirmed block 69776667 |
| Basic | Publicly hosted project | 25 | Vercel project ready; deployment next |
| Project Working | All announced functions work | 25 | Unit checks and UI review pass; cross-stack/browser transaction checks pending |
| Project Working | Live chain transaction during demo | 25 | Requires confirmed public testnet registration/append and rehearsed walkthrough |
| Project Working | Explorer verifies contract source | 25 | **Source verified:** [public Monad Sourcify proof](https://sourcify-api-monad.blockvision.org/v2/contract/10143/0xe33c5b4e0d9148bab301807d39bf2c0349037cce), `exact_match`; MonadVision data API currently returns CORS/403 errors |
| Project Working | Someone else can run from README | 25 | Clean source install test active; teammate handoff still needed |
| Bonus | Same contract deployed on Monad Mainnet | 25 | Fresh locally configured mainnet burner needed; shared chat key is testnet-only |
| Bonus | Public page on custom domain | 15 | Utkarsh will provide another domain; existing account domain not selected |
| Bonus | Pre-market fit | up to 20 | Prepare customer/problem/pilot evidence and pitch; judges award points |
| Bonus | Revenue potential and strategy | up to 20 | Prepare concrete pricing and rollout hypotheses; judges award points |
| Bonus | Innovation and originality | up to 20 | Prepare demo-backed differentiators and limitations; judges award points |
| Build in Public | Tagged X/LinkedIn post | 25 | Utkarsh owns publication |
| Build in Public | At least 30-second running-product demo video | 25 | Utkarsh owns recording/publication |
| Build in Public | Creative ad video | 25 | Utkarsh owns recording/publication |
| Build in Public | At least 5,000 combined views before deadline | 25 | Utkarsh owns distribution and evidence |

No points are claimed as awarded. Check criteria only after the required evidence exists. Engineering targets Basic + Project Working + Bonus; Build in Public is tracked for handoff.

## Implementation

- [x] Read the master prompt and establish the implementation plan.
- [x] Implement ContentPassport: signed registration, duplicate protection, lineage, operators, revocation, pagination, Hamming distance.
- [x] Store paged audit entries, including block numbers for bounded transaction lookups.
- [x] Add contract tests and receipt-based deployment / ABI export scripts.
- [x] Scaffold Next.js 14, TypeScript, Tailwind, wagmi, and viem with pinned dependencies.
- [x] Implement SHA-256, dHash, PNG passport metadata, EIP-712, registry reads, audit verification, and wallet helpers.
- [x] Fix CRC validation in canonical PNG hashing and add regression coverage.
- [x] Approve the final shared-library fixes in review.
- [x] Build landing, Create, Verify, public Passport, and guided Demo pages.
- [x] Build `/api/verify`, QR certificates, downloadable files, badge embeds, and bundled sample artwork.
- [ ] Validate browser flows, responsive layout, and failure states. **Active**
- [ ] Validate TypeScript helpers against the actual contract on a local Anvil chain.
- [ ] Complete README, submission sheet, social copy, video scripts, and demo checklist.
- [ ] Align landing, source declarations, trusted publisher policy, verification labels, and pitch with disaster-response media triage. **Active**
- [ ] Test setup from a clean source copy.

## Validation evidence

- Contract: **16/16 tests pass**, including 256 Hamming-distance fuzz cases and stored-block assertions.
- Contract coverage, including the block-number amendment: **100% lines and functions**, 99.15% statements, 95.24% branches.
- Web: **17/17 unit tests pass**, covering hashing, metadata, trail, verification, size boundaries, and declaration/publisher policy. Optional Anvil integration is a separate run.
- Web typecheck and lint: **pass**.
- Web production build: **passes**, including the UI review fixes. Windows `.next` permissions required an escalated build retry.
- Contract task review: **approved**.
- Shared-library review: **approved**, including the CRC fix.
- Cross-stack Anvil integration: **passes**, including signed registration, exact lookup, trail proof, operator actions, append, duplicate rejection, and revocation.
- Clean source copy: contract 16 tests, exporter 3 tests, web checks and build pass. A configured-address TypeScript issue discovered there was fixed and validated in canonical source.
- Browser: landing and sample preparation work; API invalid input returns 400 and missing deployment returns 503. Verify has no horizontal overflow at 390 px and no console warnings or errors.
- UI review fixes **approved**: asset/metadata size limits, downloaded-file demo verification, signer continuity, clearly labeled sample artwork, and wallet-error feedback. Lint is warning-free.

## Deployment and submission

- [x] Verify public Monad Testnet RPC reports chain ID **10143**.
- [x] Confirm connected Vercel account is available and authorized for hosting.
- [x] Create the `provenancex` project in the connected Vercel team; deployment awaits the reviewed frontend.
- [x] Deploy the contract on Monad Testnet; Monad Sourcify confirms **exact_match** source verification.
- [x] Export real contract address, mined block, deployment transaction, and ABI.
- Contract: [`0xe33c5b4e0d9148bab301807d39bf2c0349037cce`](https://testnet.monadvision.com/address/0xe33c5b4e0d9148bab301807d39bf2c0349037cce?tab=Contract).
- Deployment: [confirmed transaction](https://testnet.monadvision.com/tx/0x7909c5b4890c0ba88a03f63219e5b1478d790c71793229a9e3dced386730adba), block **69776667**, chain **10143**.
- [ ] Publish the validated frontend to Vercel and verify public access.
- [ ] Record live URL, contract / explorer links, and demo transaction hashes.
- [ ] Publish source to a public GitHub repository. **Blocked: no remote configured; this environment prohibits Git commits.**
- [ ] Record / publish demo and ad videos, social posts, and submission evidence.

Do not paste private keys into this file or chat. Configure a disposable, funded testnet deployer in the ignored local environment file. An optional public demo key must be a separate testnet-only burner.

## Decisions to preserve

- All subagents use Luna, as requested.
- Canonical PNG hashing excludes only ProvenanceX's own `tEXt` metadata chunk; parsing validates CRCs and bounds.
- Non-PNG images are converted to PNG before registration; arbitrary non-image files retain their bytes.
- Perceptual matching is a heuristic, not cryptographic proof of origin; registration is creator self-attestation.
- Full trail proof uses paged on-chain records. Historical transaction links query only the stored event block.
- Deployment fields remain null until a successful real deployment receipt exists. Local-chain tests do not count as Monad Testnet deployment.
- Preserve the existing feature branch and unrelated deletion of `OATH_MASTER_PROMPT.md`.

## Update log

- 10 Oct: Contract and shared libraries implemented; contract review approved. CRC fix and shared-library validation in progress. Shared tracker created at the user's request.
- 10 Oct: Shared-library review approved; web tests, typecheck, lint, and production build pass. Complete UI implementation started.
- 10 Oct: Portable Anvil installed and a disposable local chain started for integration validation. This is not a public testnet deployment.
- 10 Oct: Landing, Create, Verify, Passport, Demo, and API route scaffolds are present. UI integration fixes and sample assets are being completed before validation.
- 10 Oct: UI implementation complete; typecheck, tests, and production build pass. Browser checks and task review started; lint has nine image optimization warnings to assess.
- 10 Oct: UI review fixes complete; 11 tests, typecheck, warning-free lint, and production build pass. Vercel project created; scoped re-review and final browser checks underway.
- 10 Oct: UI fix review approved; docs/integration task started. Added every Basic, Project Working, Bonus, and human-owned Build in Public criterion. Funded testnet burner configured privately; fresh local key required for mainnet, desired custom domain pending.
- 10 Oct: Public testnet contract confirmed at block 69776667; deployment transaction `0x7909c5b4890c0ba88a03f63219e5b1478d790c71793229a9e3dced386730adba`. Sourcify exact source match verified. Fixed real-address TypeScript narrowing issue; production build passes with actual manifest.
- 10 Oct: User clarified disaster-response purpose. Added focused task for signed source declarations, configured publisher trust, and clear AI/synthetic labels without claiming automatic real/fake detection. Git diff shows no unmerged entries or conflict markers; preserve existing README draft and merge targeted corrections.
