# ProvenanceX — shared task tracker

Shared by Utkarsh and Codex. Update this file as work progresses; keep completed checks and pending deployment requirements accurate.

Last updated: 10 October 2026, 15:52 IST.

Submission schedule: engineering handoff by **17:15 IST**; reserve **17:15–17:30 IST** for the form and video; submit before **17:30 IST**, as requested.

## Current focus

Public GitHub, verified testnet contract, and the general-media Vercel build are live. The terminology update is validated: Create now says Register your media, and all frontend pages use media registration/record wording. Utkarsh's next source push will publish this refinement to the connected Vercel project. Build in Public belongs to Utkarsh.

## Product purpose

General media provenance for everyday users, creators, and social sharing: register or verify photos, videos, and files; inspect signer-declared captured, synthetic, edited, or unknown source; follow edit history and derivatives. Clearly flag declared AI/synthetic media. Exact hashing proves file identity; image similarity is a hint. Download media from social posts for verification; social URL ingestion and automatic AI/deepfake detection are not implemented.

## Rubric — evidence before checking off

| Track | Criterion | Points | Status / evidence |
|---|---|---:|---|
| Basic | Public GitHub repository | 25 | **Evidence ready:** [ProvenanceX](https://github.com/utkarsh-wadalkar/ProvenanceX), public repository |
| Basic | README with live public page and contract address | 25 | **Evidence ready:** README contains live app, public repository, contract, and transaction links |
| Basic | Contract deployed on Monad Testnet | 25 | **Evidence ready:** address `0xe33c5b4e0d9148bab301807d39bf2c0349037cce`, confirmed block 69776667 |
| Basic | Publicly hosted project | 25 | **Evidence ready:** [live app](https://provenancex.vercel.app), general-media build `48711c6` READY and public homepage checked; terminology refinement in progress |
| Project Working | All announced functions work | 25 | 20 web tests, contract/exporter checks, local cross-stack integration, and real testnet registration/verification/append rehearsal pass; final review found no blocking code issue |
| Project Working | Live chain transaction during demo | 25 | **Rehearsal confirmed:** [register](https://testnet.monadexplorer.com/tx/0xaa5c6aa579dcabfde0c73e92da53cd628e338ba7d9b61c72fd461d98a99cf250) and [append](https://testnet.monadexplorer.com/tx/0x67ea0b93fd4247372e8024e23bbd0b93fed1b81a7ae8f1bd80d0277ee6767c75); repeat live during pitch |
| Project Working | Explorer verifies contract source | 25 | **Source verified:** [MonadVision contract](https://testnet.monadvision.com/address/0xe33c5b4e0d9148bab301807d39bf2c0349037cce?tab=Contract) shows Full Match; public Monad Sourcify proof also confirms `exact_match` |
| Project Working | Someone else can run from README | 25 | Clean source copy passed setup, tests, and build; public clone passed root setup and 16 contract tests. Independent teammate handoff remains to be demonstrated |
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
- [x] Validate TypeScript helpers against the actual contract on a local Anvil chain.
- [x] Complete README, submission sheet, social copy, video scripts, and demo checklist; team-owned names and publication evidence remain to be supplied.
- [x] Align all product surfaces and pitch with general media provenance and social sharing.
- [x] Replace visible passport terminology with clear media registration and verification wording across pages and share image; validated locally, awaiting source publication.
- [x] Test setup from a clean source copy; additionally cloned the public repository and passed its root setup and all 16 contract tests.

## Validation evidence

- Contract: **16/16 tests pass**, including 256 Hamming-distance fuzz cases and stored-block assertions.
- Contract coverage, including the block-number amendment: **100% lines and functions**, 99.15% statements, 95.24% branches.
- Web: **20 unit tests passed** for the terminology update, including record-only, revoked-record, and displayed-file status regressions. Optional Anvil integration passed separately.
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
- [x] Publish the validated general-media frontend to Vercel and verify public access (`48711c6`, READY).
- [x] Record live URL, contract / explorer links, and demo transaction hashes.
- [x] Publish source to a public GitHub repository. Utkarsh published `main`; the general-media deployment uses revision `48711c6ed2f8ac7d35ec20548c97a02122587b39`. This environment prohibits Codex from creating Git commits.
- [ ] Record / publish demo and ad videos, social posts, and submission evidence.

Do not paste private keys into this file or chat. Configure a disposable, funded testnet deployer in the ignored local environment file. An optional public demo key must be a separate testnet-only burner.

## Decisions to preserve

- All subagents use Luna, as requested.
- Canonical PNG hashing excludes only ProvenanceX's own `tEXt` metadata chunk; parsing validates CRCs and bounds.
- Non-PNG images are converted to PNG before registration; arbitrary non-image files retain their bytes.
- Perceptual matching is a heuristic, not cryptographic proof of origin; registration is creator self-attestation.
- Full trail proof uses paged on-chain records. Historical transaction links query only the stored event block.
- Deployment fields remain null until a successful real deployment receipt exists. Local-chain tests do not count as Monad Testnet deployment.
- Preserve user Git changes. Utkarsh published the project on `main`; do not reset or recreate the earlier feature checkout.

## Update log

All new timestamps use IST (UTC+05:30). Earlier entries did not record clock times; those are marked explicitly rather than backdated.

- 10 Oct, time not recorded: Contract and shared libraries implemented; contract review approved. CRC fix and shared-library validation in progress. Shared tracker created at the user's request.
- 10 Oct, time not recorded: Shared-library review approved; web tests, typecheck, lint, and production build pass. Complete UI implementation started.
- 10 Oct, time not recorded: Portable Anvil installed and a disposable local chain started for integration validation. This is not a public testnet deployment.
- 10 Oct, time not recorded: Landing, Create, Verify, Passport, Demo, and API route scaffolds are present. UI integration fixes and sample assets are being completed before validation.
- 10 Oct, time not recorded: UI implementation complete; typecheck, tests, and production build pass. Browser checks and task review started; lint has nine image optimization warnings to assess.
- 10 Oct, time not recorded: UI review fixes complete; 11 tests, typecheck, warning-free lint, and production build pass. Vercel project created; scoped re-review and final browser checks underway.
- 10 Oct, time not recorded: UI fix review approved; docs/integration task started. Added every Basic, Project Working, Bonus, and human-owned Build in Public criterion. Funded testnet burner configured privately; fresh local key required for mainnet, desired custom domain pending.
- 10 Oct, time not recorded: Public testnet contract confirmed at block 69776667; deployment transaction `0x7909c5b4890c0ba88a03f63219e5b1478d790c71793229a9e3dced386730adba`. Sourcify exact source match verified. Fixed real-address TypeScript narrowing issue; production build passes with actual manifest.
- 10 Oct, time not recorded: User clarified disaster-response purpose. Added focused task for signed source declarations, configured publisher trust, and clear AI/synthetic labels without claiming automatic real/fake detection. Git diff shows no unmerged entries or conflict markers; preserve existing README draft and merge targeted corrections.
- 10 Oct, time not recorded: Public GitHub connected; production Vercel deployment is READY at https://provenancex.vercel.app. Public homepage, live registry count, API, passport source declaration, and complete two-event trail verified. Real testnet demo registered, exported/reverified its PNG, detected changed pixels through dHash, rejected a different signer, then confirmed an append. Final fix removes exact-file claims from modified demo and record-only passport views.

- 10 Oct, 14:45 IST: Added timestamps and the 17:15 engineering / 17:30 submission schedule. Final source-label fixes approved; web 20 tests pass, one optional integration test skipped, typecheck/lint/build pass. Public GitHub clean-clone contract setup and all 16 contract tests pass. Final frontend publication and documentation evidence update in progress.
- 10 Oct, 15:17 IST: User expanded the product to general photos, videos, files, and social sharing and removed the earlier niche. Updated every frontend page, shared header/footer, verification guidance, metadata, README, pitch, and social/video drafts. Local validation and production publication are pending. Browser automation and the Luna documentation agent hit account usage limits; local source edits continue.
- 10 Oct, 15:48 IST: General-media revision 48711c6 is READY on Vercel; public homepage shows photos, videos, and social-sharing copy. MonadVision displays verified Full Match contract source. Final Luna review found no blocking code issues. New copy task replaces visible passport terminology across the frontend; publication and validation follow.
- 10 Oct, 15:52 IST: Replaced visible passport labels across Overview, Create, Verify, Demo, public record, errors, QR text, and share image. Create now says Register your media / Registration details. Social-post guidance explicitly requires downloaded files. README and submission copy use general media wording; 20 web tests, typecheck, lint, production build, and scoped Luna review pass. Source publication pending Utkarsh push; no Git commits created by Codex.
