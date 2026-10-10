# ProvenanceX product analysis

## Product and audience
ProvenanceX gives photos, videos, and files a public media passport on Monad Testnet. Creators sign a source declaration; people checking downloaded media compare file identity and inspect that declaration and history. Intended users include creators, social-media users, moderators, and publishers. The problem is loss of source context when media is shared or edited.

## Repository inspection
Reviewed the root README and package manifests; frontend routes `/`, `/create`, `/verify`, `/demo`, `/p/[id]`; the read-only backend `/api/verify`; registry, source-declaration, hashing, PNG metadata, wallet and trail code; Solidity contract; pitch and demo checklist; bundled assets. Architecture and product requirements are also documented in README and PROVENANCEX_MASTER_PROMPT.md. Existing application edits were present before this task and are preserved.

## Strongest working features
1. Browser SHA-256 identity and EIP-712 signed declarations: captured, synthetic, edited, unknown.
2. Exact registered-file comparison, with source declaration and publisher trust displayed separately.
3. Image-only dHash candidates when bytes change, explicitly labeled as similarity hints.
4. Complete paged hash-chain verification, public passport pages and embeddable badges.

## Demo plan constraints
Show actual UI, actual hashing and live registry reads. Use bundled procedural artwork and public Testnet records only. Do not claim an AI detector, truth verification, video similarity, URL ingestion, adoption or Mainnet deployment. Prefer existing public demo registrations to avoid wallet setup and irreversible writes on camera. Creator preparation can be demonstrated without submitting a new transaction. Final workflow selection depends on confirming available exact demo files and live RPC reads.

## Runtime
Next.js 14 / React 18 / wagmi / viem frontend, Solidity 0.8.28 ContentPassport contract. Start from root with `npm --prefix web run dev`; default URL `http://localhost:3000`. No login is required for browsing, verification or public passports. Registration/history writes require a Testnet wallet or explicitly configured disposable public demo signer. Current contract: `0xe33c5b4e0d9148bab301807d39bf2c0349037cce`, chain 10143.

## Assets and evidence
Bundled samples: planet.png, monolith.png, crystal.png; favicon and OpenGraph SVGs. README documents a public synthetic rehearsal passport `0x6c27ab45a494b45be78b79f5a173ea55c54040818d75420dbee2b8e01a768d6e` and its real registration/append receipts. No private/customer media is needed.
