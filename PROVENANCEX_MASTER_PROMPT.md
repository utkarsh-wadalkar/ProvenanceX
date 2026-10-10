# ProvenanceX — MASTER PROMPT (Monad Blitz Pune V3)

> Paste everything inside the **"BEGIN PROMPT"** / **"END PROMPT"** markers into Claude Code / Cursor / your coding agent.
> Everything above and below those markers is for you (the human), not the agent.

## Human checklist (do these BEFORE pasting)

1. Install: Node 20+, Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`), Git, GitHub CLI (`gh`), Vercel CLI (`npm i -g vercel`).
2. Create a **fresh burner wallet** for deployment. Fund it with testnet MON from the Monad faucet (see docs.monad.xyz). Never use a wallet with real funds.
3. Create an empty **public** GitHub repo named `provenancex`.
4. Keep these ready: `PRIVATE_KEY` (burner), a WalletConnect project ID (optional), X and LinkedIn logged in.
5. Hard deadlines (IST, 10 Oct 2026): **code freeze 5:30 PM**, **submission close 5:45 PM**, demos 6:00–8:30 PM. Nothing pushed after 5:30 counts.

### Suggested timeline (3 people)

| Person | Role | Tasks |
|---|---|---|
| A | Contracts + deploy | Contract, tests, deploy, verify source, mainnet (bonus) |
| B | Frontend | Create / Verify / Passport / Demo pages, Vercel deploy |
| C | Build in public + README | X/LinkedIn posts, demo video, ad video, README, submission, views |

Order of work: contract → deploy → frontend wired to deployed address → README → posts. Post the first social post as soon as the repo exists, not at the end (views take time, 5K+ needed by 5:45 PM).

---

## BEGIN PROMPT

You are a senior full-stack + Solidity engineer. Build **ProvenanceX**: on-chain **Content Passports** for AI-generated assets, deployed on **Monad Testnet**. You have roughly 4 hours. Optimize for (1) a flawless 3-minute live demo and (2) the hackathon rubric below. Do not stop to ask questions: make sensible decisions, record each one in the README under "Decisions", and keep going. Prefer the smallest version that fully works over a large one that half works. Commit early and often with clear messages. Push to `main` continuously.

### 0. RUBRIC YOU ARE OPTIMIZING FOR (400 points)

- **Basic (100, required):** public GitHub repo; README with live URL + contract address; contracts deployed on Monad Testnet; project publicly hosted (Vercel is fine).
- **Project Working (100):** all announced functions work; a live on-chain transaction can happen during the demo; contract source verified on the explorer; someone else can run it from the README alone.
- **Build in Public (100):** social post tagging @monad, @monad_dev, @geeky_kartikey; 30s+ demo video; creative ad video; 5K+ combined views.
- **Bonus (100):** Monad Mainnet deploy (+25); custom domain (+15); judges score pre-market fit, revenue potential, innovation (up to 20 each).

Every engineering decision must serve one of those lines. Do not add features that do not.

### 1. PRODUCT

Every AI-generated asset (image first; any file type works for hashing) receives a cryptographic **certificate of origin** and a **tamper-evident audit trail** stored on Monad. Anyone, on any platform, drops a file into a verifier and sees: who made it, with which tool, when, its edit history, its lineage (parent/derivatives), and whether it has been altered or revoked.

One-liner: *"A passport for every AI-generated asset: verify where it came from, anywhere it travels."*

### 2. CHAIN FACTS (verify against docs.monad.xyz before use; if a value fails, fix it from the docs and note it in the README)

- Monad Testnet: chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`, native token MON, explorer `https://testnet.monadexplorer.com`.
- Monad Mainnet (bonus): chain ID `143`, RPC `https://rpc.monad.xyz`. Confirm in docs.
- Foundry: set `evm_version = "prague"` in `foundry.toml` (Monad targets the Prague fork). Solidity `0.8.28`.
- Public RPCs may rate-limit and may restrict `eth_getLogs` block ranges. **Do not depend on long-range log scans.** Design for this (see Section 3, paged reads).
- Contract verification: follow the "verify a contract" page in the Monad docs (Sourcify / explorer verifier). Run verification right after deploy and put the explorer link in the README.
- Optional P256/passkey precompile: `0x0100` (EIP-7951, ~6900 gas). Docs: docs.monad.xyz/developer-essentials/precompiles. Only attempt after everything else is done and green.

### 3. SMART CONTRACT

Repo layout:

```
/contracts   (Foundry project)
  src/ContentPassport.sol
  test/ContentPassport.t.sol
  script/Deploy.s.sol
  foundry.toml
/web         (Next.js app)
/README.md
/.env.example
```

Dependencies: OpenZeppelin (`EIP712`, `ECDSA`) only. Install with `forge install OpenZeppelin/openzeppelin-contracts`.

**Contract `ContentPassport`** (Solidity `^0.8.24`, custom errors, NatSpec on every external function, events for every state change):

```solidity
struct Passport {
    bytes32 contentHash;     // SHA-256 of file bytes
    uint64  perceptualHash;  // 64-bit dHash for re-encoded matching
    address creator;
    string  tool;            // e.g. "Gemini", "Stable Diffusion"
    string  metadataURI;     // optional (ipfs:// or https://)
    uint64  createdAt;
    bytes32 parentId;        // 0x0 if original
    bytes32 trailHead;       // head of hash-chained audit trail
    bool    revoked;
}
```

State:
- `mapping(bytes32 => Passport) passports;`
- `mapping(bytes32 => bytes32) passportIdByContentHash;`
- `mapping(bytes32 => mapping(address => bool)) operators;`
- `bytes32[] allIds;` (enables paged reads without `getLogs`)
- `mapping(bytes32 => bytes32[]) children;`

Functions:
1. `register(bytes32 contentHash, uint64 perceptualHash, string tool, string metadataURI, bytes32 parentId, bytes sig) returns (bytes32 passportId)`
   - `passportId = keccak256(abi.encode(contentHash, msg.sender, block.timestamp))`.
   - Verify an **EIP-712** signature by `msg.sender` over `Register(bytes32 contentHash,string tool,string metadataURI)`. Domain name `"ProvenanceX"`, version `"1"`.
   - Revert `AlreadyRegistered(existingId)` if `contentHash` exists (first creator wins).
   - If `parentId != 0`, parent must exist, else `ParentNotFound`. Push to `children[parentId]`.
   - Initial `trailHead = keccak256(abi.encode(bytes32(0), "REGISTERED", contentHash, block.timestamp))`.
   - Enforce string length limits (tool <= 64 bytes, metadataURI <= 256 bytes).
   - Emit `PassportRegistered(passportId, creator, contentHash, perceptualHash, tool, parentId)`.
2. `appendEvent(bytes32 passportId, string eventType, bytes32 dataHash)`
   - Only creator or an authorized operator; revert `Unauthorized`. Revert if revoked.
   - `trailHead = keccak256(abi.encode(trailHead, eventType, dataHash, block.timestamp))`.
   - Emit `TrailEvent(passportId, eventType, dataHash, trailHead, msg.sender, block.timestamp)`.
3. `authorize(bytes32 passportId, address operator, bool allowed)` (creator only). Emit `OperatorSet`.
4. `revoke(bytes32 passportId)` (creator only). Sets `revoked = true`, emits `Revoked`.
5. Views:
   - `verifyByHash(bytes32 contentHash) view returns (bool exists, bytes32 passportId, Passport memory p)`
   - `getPassport(bytes32 passportId) view returns (Passport memory)`
   - `getChildren(bytes32 passportId) view returns (bytes32[] memory)`
   - `totalPassports() view returns (uint256)`
   - `getPage(uint256 offset, uint256 limit) view returns (bytes32[] ids, uint64[] perceptualHashes, bytes32[] contentHashes)` (limit capped at 200)
   - `hammingDistance(uint64 a, uint64 b) pure returns (uint8)`
   - `trailLength(bytes32 passportId)` via a counter stored per passport (add `uint32 trailCount` to the struct or a separate mapping).

Perceptual matching is done **off-chain in the frontend** by reading `getPage` pages and computing Hamming distance locally. Never loop over all passports in a state-changing call.

**Tests (Foundry, target 100% line coverage; run `forge coverage`):**
happy path register; duplicate content reverts; bad signature reverts; signature from a different signer reverts; parent missing reverts; derivative chain (child links to parent, `getChildren` correct); unauthorized `appendEvent` reverts; authorized operator succeeds; hash-chain integrity (recompute `trailHead` off-chain in the test and compare); revoke blocks `appendEvent`; string length limits; `getPage` pagination bounds; `hammingDistance` known vectors; fuzz test on `hammingDistance` (symmetry, `d(a,a)=0`).

**Deploy script `script/Deploy.s.sol`:** reads `PRIVATE_KEY` from env, deploys, logs the address and the deployment block number. Write the address + block + chain ID to `web/src/lib/deployment.json` (via a small shell script or manual step documented in README).

Deploy commands to document in README:

```bash
cd contracts
cp ../.env.example .env   # fill PRIVATE_KEY
forge build && forge test -vv && forge coverage
forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
# then verify per Monad docs; paste explorer link into README
```

### 4. FRONTEND (`/web`)

Stack: Next.js 14 App Router, TypeScript, Tailwind, `wagmi` + `viem` (RainbowKit optional; plain injected connector is fine). Define Monad Testnet as a custom chain. Contract address and ABI come from `deployment.json` and a generated `abi.ts`. No backend database. No paid APIs. No API keys required to run.

**Shared libs (`/web/src/lib`):**
- `hash.ts`: `sha256Hex(file)` (Web Crypto) returns `0x…` bytes32.
- `phash.ts`: 64-bit **dHash** (resize to 9x8 grayscale on a canvas, compare adjacent pixels) returns `bigint`. Also `hamming(a,b)`.
- `pngMeta.ts`: write and read a PNG `tEXt` chunk (`provenancex` = JSON `{passportId, contract, chainId}`). Re-encode via canvas where needed and note limits in the README.
- `eip712.ts`: typed data matching the contract domain exactly.
- `trail.ts`: recompute `trailHead` client-side from the event list and compare with the on-chain value (this is the "tamper-evident" proof shown in the UI).
- `registry.ts`: read helpers using `getPage` with batched `multicall` and a small in-memory cache. Use `getLogs` only over narrow recent ranges (for live feed), never full history.

**Pages:**
1. `/` Landing: pitch, 3-step explainer (Generate → Sign → Verify anywhere), CTAs for Create and Verify, live counter from `totalPassports()`, a "Why Monad" strip (sub-second finality and cheap writes make per-asset registration practical), link to GitHub and contract on explorer.
2. `/create`: upload an image **or** press "Generate" (use a keyless image URL; if fetch fails or is CORS-blocked, show a clear fallback to upload and bundle 3 sample AI-style images in `/public/samples` so the demo never depends on the network). Compute SHA-256 and dHash in-browser; fields: tool name, optional parent passport ID; sign EIP-712; call `register`; show tx hash with explorer link and a confirmation toast with elapsed time. After confirmation: embed passport metadata into the PNG, offer **Download passported file**, and show a **certificate card** with QR code linking to `/p/[id]`.
3. `/verify`: drag-and-drop any file. Order: read embedded PNG metadata as a hint → compute SHA-256 → `verifyByHash`. Results:
   - Exact match, not revoked → green **AUTHENTIC** (creator, tool, time, trail length, link to passport page).
   - Exact match, revoked → grey **REVOKED**.
   - No exact match, but perceptual distance <= 6 against indexed passports → amber **MODIFIED / RE-ENCODED COPY of passport X** (show distance).
   - Otherwise → red **NO PASSPORT FOUND**.
   Animate the result chip; keep logic in testable pure functions.
4. `/p/[id]`: public passport page and embeddable badge: asset preview (if available locally via query or IPFS URI), creator, tool, timestamps, trail timeline (each event with tx link and a client-side "hash chain verified ✓" indicator), lineage (parent and children), revoked state. Include an `<iframe>`/script snippet "Embed this badge".
5. `/demo`: guided Demo Mode with four large numbered buttons that execute the exact 3-minute script (see Section 6), plus a right-side live feed of transactions with explorer links and elapsed time. Include a "Reset demo" button and pre-loaded sample assets.
6. `/api/verify?hash=0x…` (Next route handler): returns JSON `{exists, passportId, creator, tool, createdAt, revoked, trailHead}` by reading the contract. This is the "platform integration" story for judges.

Design: dark, modern, large status chips, generous spacing, subtle motion on verify results, mobile responsive (judges will scan the QR on phones). Add `<title>`, OpenGraph image, and a favicon so shared links look good in social posts.

Robustness requirements (the demo must never die on stage):
- Wrong network detected → one-click "Switch to Monad Testnet" (add chain if missing).
- No MON balance → show faucet link.
- RPC errors → retry with backoff and a friendly message.
- Provide a **"Demo wallet" fallback**: an optional env `NEXT_PUBLIC_DEMO_KEY` burner (testnet only, documented as such) that signs and sends transactions without a wallet popup, so the live tx can still happen if MetaMask misbehaves. Clearly label it as a testnet-only convenience.

### 5. OPTIONAL INNOVATION EXTRA (only after everything above is green)

Passkey signing: add `registerWithPasskey(...)` that verifies a WebAuthn P-256 signature via the Monad precompile at `0x0100` (staticcall with `hash‖r‖s‖x‖y`, check the 32-byte return equals 1). Add a "Sign with Face/Touch ID" button on `/create`. Test with a known P-256 vector. If it is not fully working by 4:15 PM IST, **delete it** rather than ship something broken.

### 6. THE 3-MINUTE DEMO SCRIPT (build `/demo` to run exactly this)

| Time | Action | What the judges see |
|---|---|---|
| 0:00–0:20 | Hook: "AI images are everywhere. Nobody can prove where one came from." State repo link, contract address, live URL, deployment (Monad Testnet). | Landing page |
| 0:20–1:00 | Step 1: Generate → Sign → **Register on-chain (live tx)** | Tx hash, sub-second confirmation, certificate card with QR |
| 1:00–1:30 | Step 2: "Move to another platform": open `/verify` in a new tab styled as **OtherSite**, drop the downloaded file | Green AUTHENTIC |
| 1:30–2:00 | Step 3: **Tamper** (flip one pixel) → re-verify | Red / amber result, hash mismatch explained |
| 2:00–2:30 | Step 4: add a derivative edit event (live tx), open `/p/[id]` | Trail grows, hash chain ✓, lineage |
| 2:30–3:00 | Business close: per-registration fee, enterprise verification API (`/api/verify`), embeddable badge. Show GitHub, explorer verified source. | Revenue and roadmap |

Say out loud during the pitch: **repo link, contract address, live URL, deployment.**

### 7. README (this is graded: "someone else can run it from the README without help")

Write `README.md` with these sections, complete and accurate:

1. Title, one-liner, screenshot/GIF.
2. **Live demo:** public URL. **Contract:** testnet address + explorer link (verified). **Mainnet:** address if deployed. **Video:** links to demo and ad videos. **Posts:** links to social posts.
3. Problem and solution (5 sentences max).
4. How it works (diagram in Mermaid): file → SHA-256 + dHash → EIP-712 signature → `register` → trail events → verify anywhere.
5. Architecture and contract API table (function, who can call, purpose).
6. **Run it yourself (copy-paste, tested from a clean clone):**
   prerequisites, `git clone`, `.env.example` explanation, Monad Testnet network details, faucet link, `cd contracts && forge test`, deploy command, `cd web && npm i && npm run dev`, how to use the demo page, how to run tests.
7. Decisions and trade-offs (including perceptual-hash limits and why paged reads instead of `getLogs`).
8. Why Monad (finality, throughput, cost) and business model (per-asset fee, enterprise API, platform widget).
9. Roadmap, team, license (MIT).

Test the README by cloning the repo into a fresh folder and following it literally. Fix anything that fails.

### 8. SUBMISSION ARTIFACTS (generate these files in `/docs`)

- `docs/submission.md`: repo URL, live URL, contract address (testnet and mainnet), explorer verified links, tx hashes used in demo, video links, post links, view count screenshots. Fill with placeholders marked `TODO:` that the team completes before 5:45 PM.
- `docs/posts.md`: ready-to-paste copy for X and LinkedIn tagging **@monad, @monad_dev, @geeky_kartikey** (include the live URL, repo link, and a 2-line hook), plus a 4-tweet thread and a 30-second video voiceover script, plus a 20-second **creative ad** script (cold open on a fake viral AI image → "Who made this?" → ProvenanceX verify → tamper → red).
- `docs/demo-checklist.md`: pre-demo checklist (wallet funded, network set, sample assets loaded, tabs open, backup video recorded, battery and WiFi checked).

### 9. QUALITY BAR AND GUARDRAILS

- `forge test` passes, `forge coverage` near 100%, `npm run build` passes with no TypeScript errors, `npm run lint` clean.
- No secrets committed. `.env` in `.gitignore`. Only `.env.example` is committed. Burner keys only.
- No `localStorage` assumptions that break SSR; guard browser-only code.
- Pin dependency versions in lockfiles.
- Every external call has a timeout and an error state in the UI.
- Add a `LICENSE` (MIT).
- Keep commits small. Tag the final commit `v1.0-codefreeze`.

### 10. DELIVERY ORDER (follow strictly; stop adding scope at 4:45 PM IST)

1. Scaffold repo, Foundry project, Next.js app. Commit.
2. Write contract and tests. All green. Commit.
3. Deploy to Monad Testnet, verify source, save `deployment.json`. Commit.
4. Build `/create`, `/verify`, `/p/[id]` against the deployed contract. Commit.
5. Build `/demo`, `/api/verify`, landing page. Commit.
6. Deploy frontend to Vercel; confirm the public URL works in an incognito window on a phone.
7. Write README, `/docs` files. Run the clean-clone test.
8. (Optional) Mainnet deploy of the same contract for the +25 bonus; record address in README.
9. (Optional) Custom domain pointed at Vercel for the +15 bonus.
10. (Optional) Passkey extra, only if green and time remains.
11. Final push before **5:30 PM IST**. Print a final summary: URLs, addresses, tx hashes, what works, known limitations.

When finished with each step, print a one-line status and proceed to the next without asking for confirmation.

## END PROMPT

---

## Human notes (after the agent finishes)

**Before 5:30 PM IST (code freeze)**
- [ ] Repo public, final commit pushed
- [ ] Contract deployed on Monad Testnet and **source verified** (screenshot the explorer page)
- [ ] Vercel URL live, tested on a phone in incognito
- [ ] README clean-clone test passed by a teammate who did not write the code
- [ ] (Optional) Mainnet address in README, custom domain live

**Before 5:45 PM IST (submission close)**
- [ ] X post live tagging @monad, @monad_dev, @geeky_kartikey (demo video 30s+ attached)
- [ ] LinkedIn post live with the same tags
- [ ] Creative ad video posted
- [ ] Views screenshot (target 5K+ combined): ask friends and communities to engage early, and share in Monad Discord/Telegram groups
- [ ] Submit through the Pune V3 event portal

**On stage (3 minutes)**
- Say: repo link, contract address, live URL, deployment.
- Do one live transaction, then show the verified source on the explorer.
- Keep a pre-recorded backup demo video open in another tab in case of network failure.

**Judge-facing talking points**
- *Pre-market fit:* AI-content provenance is demanded by platforms, regulators, and creators right now.
- *Revenue:* per-registration fee, enterprise verification API and SLA, embeddable verification widget for platforms.
- *Innovation:* hash-chained audit trail + perceptual-hash fallback + lineage graph + (optional) passkey signing via Monad's native P256 precompile.
