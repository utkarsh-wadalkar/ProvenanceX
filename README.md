# ProvenanceX

**A file provenance and source-declaration workflow for disaster-response teams reviewing viral media.** It can confirm that bytes match a registration and show what a wallet declared; it cannot decide whether an incident is real.

> **Screenshot/GIF:** TODO: add a real screenshot or recorded demo GIF. Bundled media is sample content, not a product screenshot.

## Live demo and deployments

| Resource | Status |
| --- | --- |
| Live app | TODO: add the public production URL after the deployed site has been checked. |
| Repository | TODO: add the verified public repository URL. |
| Monad Testnet contract (10143) | [`0xe33c5b4e0d9148bab301807d39bf2c0349037cce`](https://testnet.monadexplorer.com/address/0xe33c5b4e0d9148bab301807d39bf2c0349037cce), deployed at block `69776667`; deployment tx [`0x7909c5b4890c0ba88a03f63219e5b1478d790c71793229a9e3dced386730adba`](https://testnet.monadexplorer.com/tx/0x7909c5b4890c0ba88a03f63219e5b1478d790c71793229a9e3dced386730adba). |
| Testnet source verification | [Sourcify exact match, chain 10143](https://sourcify-api-monad.blockvision.org/v2/contract/10143/0xe33c5b4e0d9148bab301807d39bf2c0349037cce). |
| Monad Mainnet contract (143) | Not deployed. Mainnet requires a separately funded key and operator decision. |
| Custom domain | Pending the domain the team selects and controls. |
| Demo / ad videos | TODO: add the published demo and creative ad video links. |
| Social posts | TODO: add the published X and LinkedIn links. Draft copy is in [docs/posts.md](docs/posts.md). |
| Demo transaction hashes | TODO: add only transactions from the final recorded demo rehearsal. The deployment transaction above is not a demo registration. |

Monad Testnet uses chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`, currency MON, and [Monad Explorer](https://testnet.monadexplorer.com/). Testnet MON is available from the [Monad Faucet](https://faucet.monad.xyz/). Confirm current network settings against [Monad's documentation](https://docs.monad.xyz).

## 1. Problem and solution

During a disaster, responders can receive alarming images or videos with little source context. ProvenanceX checks the exact file fingerprint against a registry and displays a signed declaration of captured, synthetic, edited, or unknown source, along with any configured publisher allowlist signal. If bytes differ, image perceptual matching can suggest a related image passport. It does not detect AI or deepfakes and cannot establish incident truth. Teams must corroborate the date, location, and context with another reliable source before dispatch.

## 2. How it works

The browser computes SHA-256 for the file and an image-only dHash for possible similarity lookup. The creator signs the content hash, a declared source tag and tool/publisher name together using EIP-712; that declaration is packed into the existing `tool` string and is limited to 64 UTF-8 bytes. The contract stores the passport and later audit events. A verifier reads bounded pages, checks the hash chain, and compares the exact file hash first. Any configured publisher allowlist is a deployment setting and review signal, not proof that the media depicts a real event.

```mermaid
flowchart LR
    A[Image, video, or other file] --> B[SHA-256; image dHash]
    B --> C[Source declaration + tool/publisher]
    C --> D[Creator EIP-712 signature]
    D --> E[register]
    E --> F[Passport and paged trail events]
    F --> G[Read pages and verify the hash chain]
    A --> H[Check exact file]
    G --> H
    H --> I[Review identity, declaration, and corroborating context]
```

The source declaration is one of `[captured]`, `[synthetic]`, `[edited]`, or `[unknown]`. Legacy unprefixed records parse as unknown. The registering wallet signs the declaration; no model or detector classifies the media. An empty trusted-publisher list trusts nobody. A trusted match means only that the registering address appears in the configured list. Exact file integrity, signer identity, source declaration, and incident truth are separate questions.

### Architecture and contract API

| Component / function | Who can call | Purpose |
| --- | --- | --- |
| Browser hashing and `prepareAsset()` | Anyone using the app | Canonical SHA-256 for exact identity and dHash for image similarity. Videos and other non-image files get exact hashing only. |
| `register(contentHash, perceptualHash, tool, metadataURI, parentId, sig)` | Any caller presenting a valid signature from the registering wallet | Register a file claim and optional parent. The declaration and tool name are signed in the `tool` value. |
| `verifyByHash(contentHash)` / `passportIdByContentHash(contentHash)` | Anyone | Look up an exact registered file hash. |
| `getPassport(passportId)` / `getChildren(passportId)` | Anyone | Read passport fields and direct derivatives. |
| `totalPassports()` / `getPage(offset, limit)` | Anyone | Read registry size and pages, capped at 200. |
| `trailLength(passportId)` / `getTrailPage(passportId, offset, limit)` | Anyone | Read the stored audit trail in pages capped at 200. |
| `appendEvent(passportId, eventType, dataHash)` | Creator or authorized operator | Append a signed-wallet-origin event to the history. |
| `authorize(passportId, operator, allowed)` | Passport creator | Grant or remove append permission. |
| `revoke(passportId)` | Passport creator | Revoke the passport and prevent later trail appends. |
| `GET /api/verify?hash=0x…` | Public, read-only | Return exact-hash registry and declaration policy fields; it is not an incident verification service or SLA-backed API. |

The contract is [ContentPassport.sol](contracts/src/ContentPassport.sol), built with Solidity 0.8.28, Prague EVM settings, OpenZeppelin EIP-712 and ECDSA. The web app contains the Create, Verify, Passport, and guided Demo pages. The source declaration is stored as a signed `tool` string to preserve the deployed contract and ABI.

## 3. Verification outcomes and limits

| App result | Meaning |
| --- | --- |
| Exact passport match / file integrity verified | The uploaded canonical file hash matches a registered passport. It says nothing by itself about source, author, or incident truth. |
| Declared captured media | The signer selected `[captured]`; unless its address is configured as a trusted publisher, treat this as self-declared. Even an allowlisted publisher requires independent context checks. |
| Declared synthetic media | The signer selected `[synthetic]`; no AI detector ran. |
| Modified / re-encoded candidate | An image dHash is within the matching threshold of a passport. The candidate's declaration belongs to that passport, not necessarily the uploaded copy. |
| Revoked / no passport / source unknown | These are distinct states. A registry or RPC failure is shown as an error, not as no match. |

For PNG, canonical SHA-256 excludes only a CRC-valid ProvenanceX metadata chunk, so embedding the passport does not change exact identity. Other PNG metadata remains hashed. Non-PNG images are converted to PNG before registration. Other file types are hashed as submitted. dHash is a non-cryptographic image similarity heuristic; crops, recompression, edits, and lookalike images can cause misses or false candidates. The zero sentinel is excluded from similarity search.

## 4. Run it yourself

### Prerequisites and clean setup

- Git, Node.js 20 or newer, npm, and a browser wallet for wallet-driven writes.
- Forge 1.7.1 is pinned through the portable npm package; OpenZeppelin Contracts 5.4.0 is pinned. Monad's current documentation recommends Forge 1.8 or newer for deployment; this project uses 1.7.1 for reproducible local checks, so follow Monad's current deployment guidance before publishing a new contract.
- A public repository clone URL has not yet been supplied. Replace the TODO below with the team's actual URL.

```sh
git clone TODO_PUBLIC_REPOSITORY_URL provenancex
cd provenancex
npm ci --ignore-scripts
npm run install:contracts
npm --prefix web ci
```

The root Foundry package has an upstream POSIX-only postinstall that fails under Windows `cmd`; `npm ci --ignore-scripts` installs its optional platform binary, which runs without that script. The contracts install command installs OpenZeppelin. `web/package-lock.json` pins the app dependencies.

### Environment and network

Copy `.env.example` to `contracts/.env`. It documents the deployer's local-only `PRIVATE_KEY`, `CHAIN_ID`, RPC override variables, and the optional frontend settings. To override frontend settings, copy `web/.env.example` to `web/.env.local`. `NEXT_PUBLIC_RPC_URL` selects the browser RPC; `NEXT_PUBLIC_SITE_URL` sets the public origin; `NEXT_PUBLIC_GITHUB_URL` controls the source link; and `NEXT_PUBLIC_TRUSTED_PUBLISHERS` is a comma-separated list of publisher wallet addresses configured by the deployer. The optional `NEXT_PUBLIC_DEMO_KEY` is public to every visitor and must only be a disposable, low-balance Testnet key. Never put a deployment key there.

| Testnet setting | Value |
| --- | --- |
| Network / chain ID | Monad Testnet / `10143` (`0x279f`) |
| RPC | `https://testnet-rpc.monad.xyz` |
| Explorer | [testnet.monadexplorer.com](https://testnet.monadexplorer.com/) |
| Faucet | [faucet.monad.xyz](https://faucet.monad.xyz/) |

### Contract checks

```sh
npm run build
npm test
npm run test:exporter
```

### Optional local-chain integration

In a second terminal, start local Anvil on the expected chain, then run the integration command from the repository root:

```sh
npm exec --yes --package=@foundry-rs/anvil@1.7.1 -- anvil --host 127.0.0.1 --port 8545 --chain-id 10143
npm run integration:local
```

The integration generates ephemeral in-memory accounts, funds them through Anvil, deploys the compiled contract, registers an EIP-712 claim, checks duplicate rejection, reads the stored trail through the web ABI, verifies the hash chain, exercises creator/operator appends, and checks revocation. Fixture details go to ignored task scratch. Anvil results are local development evidence only, never Testnet or Mainnet deployment evidence.

### Web app checks and use

```sh
cd web
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000`. Connect a wallet on Monad Testnet to submit a real registration. In Create, choose the source declaration and tool/publisher name before signing. In Verify, upload the exact file; review the hash result, declaration, signer and allowlist signal. Open the passport for its event history. For a perceptual candidate, remember that the candidate's declaration does not automatically apply to the changed upload. Confirm date, location, and incident context independently before responders act.

The current UI manifest is configured for Monad Testnet at the contract address above. Testnet writes cost test MON but the contract currently charges no registration fee.

### Deploy and export

Use a separate low-balance deployment account. Keep its key only in `contracts/.env`. For Testnet, set `CHAIN_ID=10143` and use Foundry's `monad` RPC alias from the repository root:

```sh
npm exec -- forge script contracts/script/Deploy.s.sol:Deploy --root contracts --rpc-url monad --broadcast
npm run export:deployment
```

The exporter verifies the selected RPC reports the requested chain ID, then requires a successful ContentPassport receipt and mined block number. With no `CHAIN_ID`, it defaults to Testnet and writes `web/src/lib/deployment.json` plus the generated ABI. The committed canonical Testnet manifest is already configured to the deployed contract above. Source verification is separate; claim it only after the explorer or Sourcify confirms an exact match.

### Optional Mainnet 143 export

No Mainnet deployment exists. A future operator must use a separate funded key and Mainnet RPC. Set `CHAIN_ID=143` and `MAINNET_RPC_URL` in the operator shell, deploy with `--rpc-url "$MAINNET_RPC_URL"`, then run `npm run export:deployment`. In PowerShell set `$env:CHAIN_ID='143'` and `$env:MAINNET_RPC_URL='https://<official-mainnet-rpc>'` before those commands. The exporter validates chain ID 143 and writes `web/src/lib/deployment.mainnet.json`; it does not overwrite the Testnet manifest. The current web UI still targets Testnet. Verify Mainnet source with the appropriate official flow before publishing any address.

### Production URL and custom domain

Set the actual deployment URL in the project environment as `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_GITHUB_URL` only after each is known and checked. Attach the team-selected domain to the existing Vercel project, add the DNS records Vercel shows, wait for domain verification, and check HTTPS routing before listing it here. The domain is pending team selection; no purchase or DNS change is claimed.

## 5. Product scenario, roadmap, and business model

An illustrative scenario, not a reported case study: a volunteer coordinator receives a flood image in a response chat. They check the exact file, inspect the signed source declaration and any configured publisher signal, then compare time, location, and context with another source before deciding whether to route it. If a screenshot differs from a registered image, dHash may surface a related passport; it cannot establish that the screenshot shows the same event.

The first customer discovery should focus on disaster-response organizations, emergency communication teams, fact-checkers, and newsrooms. Test whether a file-level provenance check fits their intake workflow and whether they understand the self-attestation and corroboration limits. Record pilot metrics only after consented trials; no adoption, customer, or false-alarm reduction results are claimed.

Potential revenue is a per-asset managed service, a bulk verification API, or an embeddable widget for response platforms. The deployed contract has no fee, and the current endpoint has no SLA. These are proposals to validate with teams, not shipped services.

Roadmap: test the intake workflow with response and verification teams; improve source declaration and trusted-publisher administration; evaluate ingestion of external source attestations; and consider a separate Mainnet deployment only after pilot demand, trust governance, security, and costs are understood. See [docs/pitch.md](docs/pitch.md) for measurable hypotheses and [docs/demo-checklist.md](docs/demo-checklist.md) for rehearsal steps.

## 6. Submission links, team, and license

See [docs/submission.md](docs/submission.md) for the handoff checklist and [docs/posts.md](docs/posts.md) for ready-to-paste X/LinkedIn copy, a thread, and video scripts. Update only with real URLs, transactions, and view-count evidence. Social publishing is the team's task.

Team: TODO: add confirmed names and roles. The project is MIT licensed; see [LICENSE](LICENSE).
