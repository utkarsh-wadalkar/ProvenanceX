# OATH — SINGLE MASTER PROMPT

> Paste everything below the line into Claude Code (or any coding agent) in an EMPTY git repo. It builds the whole project end to end. Run it in a terminal where `forge`, `node` (20+) and `git` exist.

---

## ROLE
You are a principal engineer and tech lead shipping a hackathon project in under 5 hours. You own contracts, backend, frontend, docs and launch assets. Reliability on a projector and on phones beats cleverness. Work in phases, run the tests and builds yourself, and report at the end of each phase in 3 lines max. If a phase is independent, run it in parallel with sub-agents (contracts / server / web).

## PRODUCT
**Oath — "Stake it. Prove it. Win it."** Players stake native MON on a goal. A phone sensor (accelerometer shake count, with a tap fallback) proves progress via a backend attestor. Everyone who finishes splits the stakes of everyone who quit (minus a 2% fee). If nobody finishes, everyone is refunded. Demo game: **Shake-Off** (shake 40 times in 30 s).

## NETWORKS (verified against docs.monad.xyz)
- Testnet: chain id **10143**, RPC `https://testnet-rpc.monad.xyz`, explorers `https://testnet.monadvision.com` and `https://testnet.monadscan.com`.
- Mainnet: chain id **143**, RPC `https://rpc.monad.xyz`, explorers `https://monadvision.com` and `https://monadscan.com`.
- Monad charges gas by gas LIMIT, not gas used: never hardcode large gas limits or gas prices; let viem estimate.
- Foundry >= 1.8 with `network = "monad"`. Preferred scaffold: `forge init --template monad-developers/foundry-monad`.

## REPO LAYOUT
```
/contracts   Foundry project (OathPool)
/shared      OathPool.abi.json
/server      Express + TypeScript (tsx) + viem; serves API and built web app
/web         Vite + React + TypeScript + Tailwind + viem (no wagmi, no ethers)
/docs        pitch.md, social.md, video-scripts.md
README.md  .env.example  package.json (root scripts)
```

---

## PHASE 1 — CONTRACTS (`/contracts`)
1. Scaffold with the Monad template (or Foundry >=1.8, solc 0.8.28, `metadata = true`, `metadata_hash = "none"`, `use_literal_content = true`, RPC aliases `monad_testnet`, `monad_mainnet`). Delete template Counter files.
2. Create these three files VERBATIM. Never weaken a revert check.

**`src/OathPool.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title OathPool
/// @notice Stake MON on a goal. Finishers split the stakes of those who quit.
contract OathPool {
    error NotOwner();
    error NotAttestor();
    error BadParams();
    error NoPool();
    error JoinClosed();
    error AlreadyJoined();
    error WrongStake();
    error NotJoined();
    error NotLive();
    error NotEnded();
    error AlreadyFinalized();
    error NotFinalized();
    error NothingToClaim();
    error AlreadyClaimed();
    error TransferFailed();
    error Reentrancy();

    struct Pool {
        address creator;
        uint64 joinDeadline;
        uint64 endTime;
        uint32 target;
        uint32 players;
        uint32 finishers;
        bool finalized;
        uint256 stake;
        uint256 bonusPerFinisher;
        string goal;
    }

    uint16 public constant FEE_BPS = 200; // 2% of forfeited stakes

    address public owner;
    address public attestor;
    uint256 public poolCount;
    uint256 public feesAccrued;
    uint256 private _lock = 1;

    mapping(uint256 => Pool) private _pools;
    mapping(uint256 => mapping(address => bool)) public joined;
    mapping(uint256 => mapping(address => uint32)) public progress;
    mapping(uint256 => mapping(address => bool)) public finished;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event PoolCreated(
        uint256 indexed id,
        address indexed creator,
        string goal,
        uint256 stake,
        uint64 joinDeadline,
        uint64 endTime,
        uint32 target
    );
    event Joined(uint256 indexed id, address indexed player, uint32 players);
    event Progress(uint256 indexed id, address indexed player, uint32 value);
    event Finished(uint256 indexed id, address indexed player, uint32 finishers);
    event Finalized(uint256 indexed id, uint32 players, uint32 finishers, uint256 forfeited, uint256 fee);
    event Claimed(uint256 indexed id, address indexed player, uint256 amount);
    event AttestorChanged(address indexed attestor);

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(address _attestor) {
        owner = msg.sender;
        attestor = _attestor;
        emit AttestorChanged(_attestor);
    }

    function setAttestor(address a) external {
        if (msg.sender != owner) revert NotOwner();
        attestor = a;
        emit AttestorChanged(a);
    }

    function createPool(
        string calldata goal,
        uint256 stake,
        uint64 joinSeconds,
        uint64 durationSeconds,
        uint32 target
    ) external returns (uint256 id) {
        if (
            stake == 0 || joinSeconds == 0 || durationSeconds == 0 || target == 0 || bytes(goal).length == 0
                || bytes(goal).length > 140
        ) revert BadParams();

        id = ++poolCount;
        Pool storage p = _pools[id];
        p.creator = msg.sender;
        p.stake = stake;
        p.joinDeadline = uint64(block.timestamp) + joinSeconds;
        p.endTime = p.joinDeadline + durationSeconds;
        p.target = target;
        p.goal = goal;
        _emitCreated(id);
    }

    // Separate function keeps the stack shallow (avoids "stack too deep" without via-ir).
    function _emitCreated(uint256 id) private {
        Pool storage p = _pools[id];
        emit PoolCreated(id, p.creator, p.goal, p.stake, p.joinDeadline, p.endTime, p.target);
    }

    function join(uint256 id) external payable {
        Pool storage p = _pool(id);
        if (block.timestamp >= p.joinDeadline) revert JoinClosed();
        if (joined[id][msg.sender]) revert AlreadyJoined();
        if (msg.value != p.stake) revert WrongStake();
        joined[id][msg.sender] = true;
        p.players++;
        emit Joined(id, msg.sender, p.players);
    }

    /// @notice Attestor reports a player's progress. Monotonic. Marks finished at target.
    function attest(uint256 id, address player, uint32 value) external {
        if (msg.sender != attestor) revert NotAttestor();
        Pool storage p = _pool(id);
        if (!joined[id][player]) revert NotJoined();
        if (block.timestamp < p.joinDeadline || block.timestamp > p.endTime) revert NotLive();
        if (value <= progress[id][player]) return;

        progress[id][player] = value;
        emit Progress(id, player, value);

        if (!finished[id][player] && value >= p.target) {
            finished[id][player] = true;
            p.finishers++;
            emit Finished(id, player, p.finishers);
        }
    }

    /// @notice Anyone can settle a pool after it ends.
    function finalize(uint256 id) external {
        Pool storage p = _pool(id);
        if (block.timestamp <= p.endTime) revert NotEnded();
        if (p.finalized) revert AlreadyFinalized();
        p.finalized = true;

        uint256 f = p.finishers;
        uint256 forfeited;
        uint256 fee;
        if (f > 0 && p.players > f) {
            forfeited = uint256(p.players - f) * p.stake;
            fee = (forfeited * FEE_BPS) / 10_000;
            uint256 distributable = forfeited - fee;
            p.bonusPerFinisher = distributable / f;
            fee += distributable - (p.bonusPerFinisher * f); // rounding dust to treasury
            feesAccrued += fee;
        }
        emit Finalized(id, p.players, p.finishers, forfeited, fee);
    }

    function payoutOf(uint256 id, address user) public view returns (uint256) {
        Pool storage p = _pool(id);
        if (!p.finalized || !joined[id][user] || claimed[id][user]) return 0;
        if (finished[id][user]) return p.stake + p.bonusPerFinisher;
        if (p.finishers == 0) return p.stake; // nobody finished: full refund
        return 0;
    }

    function claim(uint256 id) external nonReentrant {
        Pool storage p = _pool(id);
        if (!p.finalized) revert NotFinalized();
        if (!joined[id][msg.sender]) revert NotJoined();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();
        uint256 amt = payoutOf(id, msg.sender);
        if (amt == 0) revert NothingToClaim();
        claimed[id][msg.sender] = true;
        (bool ok,) = msg.sender.call{value: amt}("");
        if (!ok) revert TransferFailed();
        emit Claimed(id, msg.sender, amt);
    }

    function withdrawFees(address payable to) external nonReentrant {
        if (msg.sender != owner) revert NotOwner();
        uint256 amt = feesAccrued;
        feesAccrued = 0;
        (bool ok,) = to.call{value: amt}("");
        if (!ok) revert TransferFailed();
    }

    function getPool(uint256 id) external view returns (Pool memory) {
        return _pool(id);
    }

    function _pool(uint256 id) internal view returns (Pool storage) {
        if (id == 0 || id > poolCount) revert NoPool();
        return _pools[id];
    }
}
```

**`test/OathPool.t.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OathPool} from "../src/OathPool.sol";

contract OathPoolTest is Test {
    OathPool pool;
    address attestor = address(0xA77E);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA401);

    function setUp() public {
        pool = new OathPool(attestor);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    function _joinAll(uint256 id) internal {
        vm.prank(alice);
        pool.join{value: 1 ether}(id);
        vm.prank(bob);
        pool.join{value: 1 ether}(id);
        vm.prank(carol);
        pool.join{value: 1 ether}(id);
    }

    function test_FullFlow_FinishersSplitForfeits() public {
        uint256 id = pool.createPool("Shake 50 times", 1 ether, 60, 120, 50);
        _joinAll(id);
        vm.warp(block.timestamp + 61);
        vm.startPrank(attestor);
        pool.attest(id, alice, 50);
        pool.attest(id, bob, 20);
        vm.stopPrank();
        vm.warp(block.timestamp + 121);
        pool.finalize(id);

        // pot = bob + carol = 2 ether; fee 2% = 0.04; alice gets 1 + 1.96
        uint256 before = alice.balance;
        vm.prank(alice);
        pool.claim(id);
        assertEq(alice.balance - before, 2.96 ether);
        assertEq(pool.feesAccrued(), 0.04 ether);

        vm.prank(bob);
        vm.expectRevert(OathPool.NothingToClaim.selector);
        pool.claim(id);

        vm.prank(alice);
        vm.expectRevert(OathPool.AlreadyClaimed.selector);
        pool.claim(id);
    }

    function test_NobodyFinishes_FullRefund() public {
        uint256 id = pool.createPool("Shake 50 times", 1 ether, 60, 120, 50);
        _joinAll(id);
        vm.warp(block.timestamp + 61 + 121);
        pool.finalize(id);
        uint256 before = bob.balance;
        vm.prank(bob);
        pool.claim(id);
        assertEq(bob.balance - before, 1 ether);
        assertEq(pool.feesAccrued(), 0);
    }

    function test_OnlyAttestor_AndWindowRules() public {
        uint256 id = pool.createPool("Shake 50 times", 1 ether, 60, 120, 50);
        _joinAll(id);

        vm.prank(alice);
        vm.expectRevert(OathPool.NotAttestor.selector);
        pool.attest(id, alice, 50);

        vm.prank(attestor);
        vm.expectRevert(OathPool.NotLive.selector); // join phase, round not started
        pool.attest(id, alice, 10);

        vm.warp(block.timestamp + 61);
        vm.prank(attestor);
        pool.attest(id, alice, 10);
        assertEq(pool.progress(id, alice), 10);

        vm.warp(block.timestamp + 200);
        vm.prank(attestor);
        vm.expectRevert(OathPool.NotLive.selector); // ended
        pool.attest(id, alice, 50);
    }

    function test_JoinRules() public {
        uint256 id = pool.createPool("Shake 50 times", 1 ether, 60, 120, 50);
        vm.prank(alice);
        vm.expectRevert(OathPool.WrongStake.selector);
        pool.join{value: 0.5 ether}(id);

        vm.prank(alice);
        pool.join{value: 1 ether}(id);
        vm.prank(alice);
        vm.expectRevert(OathPool.AlreadyJoined.selector);
        pool.join{value: 1 ether}(id);

        vm.warp(block.timestamp + 61);
        vm.prank(bob);
        vm.expectRevert(OathPool.JoinClosed.selector);
        pool.join{value: 1 ether}(id);
    }

    function test_CannotFinalizeEarlyOrTwice() public {
        uint256 id = pool.createPool("Shake 50 times", 1 ether, 60, 120, 50);
        vm.expectRevert(OathPool.NotEnded.selector);
        pool.finalize(id);
        vm.warp(block.timestamp + 181);
        pool.finalize(id);
        vm.expectRevert(OathPool.AlreadyFinalized.selector);
        pool.finalize(id);
    }
}
```

**`script/Deploy.s.sol`**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OathPool} from "../src/OathPool.sol";

contract Deploy is Script {
    function run() external {
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        vm.startBroadcast();
        OathPool pool = new OathPool(attestor);
        vm.stopBroadcast();
        console.log("OathPool deployed at:", address(pool));
    }
}
```
3. Run `forge build && forge test -vv`. All 5 tests must pass. If something fails, fix test setup or arithmetic, never the contract's safety checks.
4. Export the ABI: `mkdir -p ../shared && jq '.abi' out/OathPool.sol/OathPool.json > ../shared/OathPool.abi.json`.
5. Write `contracts/DEPLOY.md` with exact commands:
   - `cast wallet import deployer --interactive`
   - Testnet: `forge script script/Deploy.s.sol:Deploy --rpc-url https://testnet-rpc.monad.xyz --account deployer --broadcast`
   - Mainnet: same with `--rpc-url https://rpc.monad.xyz`
   - Verify MonadVision (Sourcify): `forge verify-contract <ADDR> OathPool --chain <10143|143> --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org/ --constructor-args $(cast abi-encode "constructor(address)" $ATTESTOR_ADDRESS)`
   - Verify Monadscan: `forge verify-contract <ADDR> OathPool --chain <10143|143> --verifier etherscan --etherscan-api-key $MONADSCAN_API_KEY --constructor-args $(cast abi-encode "constructor(address)" $ATTESTOR_ADDRESS) --watch`
6. **Never broadcast a transaction yourself.** Print the commands for the human and continue.

## PHASE 2 — SERVER (`/server`)
Express + TypeScript (run with `tsx`) + viem. Env (`.env.example`): `CHAIN_ID=10143`, `RPC_URL=https://testnet-rpc.monad.xyz`, `RPC_URL_FALLBACKS=`, `EXPLORER_URL=https://testnet.monadvision.com`, `CONTRACT_ADDRESS=`, `ATTESTOR_PRIVATE_KEY=`, `FAUCET_PRIVATE_KEY=`, `DRIP_AMOUNT_MON=0.2`, `PORT=8080`, `WAITLIST_URL=`. Runs on mainnet by env change only.

- Chain via `defineChain` from env. Public client uses `fallback([http(RPC_URL), ...fallbacks])`.
- Two wallet clients (attestor, faucet), each `privateKeyToAccount(key, { nonceManager })` (`nonceManager` exported from `viem`), each with its own **single in-process promise queue** for all txs. On a nonce error, reset and retry once. No hardcoded gas price. Do not await receipts for progress attestations; do await for `finalize`.
- Endpoints:
  - `GET /api/config` → `{chainId, rpcUrl, explorerUrl, contract, waitlistUrl, attestor}` (client loads config at runtime).
  - `POST /api/drip {address}` → sends `DRIP_AMOUNT_MON` once per address, max 5 per IP per hour; `{txHash}`; if the address already holds >= 0.05 MON return `{skipped:true}`.
  - `POST /api/shake {poolId, address, count}` (phones, every ~500 ms). Validate: pool exists; `joined(poolId,address)` (cache positives); now is between `joinDeadline` and `endTime` (cache pool times); count is a monotonically increasing integer; `count <= elapsedLiveSeconds*10 + 3`. Store live count in memory. If `count >= target` and player not yet finished, queue `attest(poolId,address,target)` immediately. Else if count rose >= 10 since last attested value and >= 3 s since this player's last attest, queue `attest(poolId,address,count)`. Respond `{ok:true, live, target}`.
  - `GET /api/stream/:poolId` → SSE every 400 ms: `{phase: join|live|settling|done, now, joinDeadline, endTime, target, players:[{address,live,onchain,finished}], feed:[last 30 decoded events]}`. The server polls `getLogs` every 600 ms and keeps a last-processed block; clients never poll the RPC for logs.
  - `GET /api/pools` → latest 10 pools read from chain.
  - `GET /healthz`.
- Lifecycle worker per known pool: at `endTime - 1s` flush final live counts that exceed on-chain progress (a revert is harmless); at `endTime + 1s` call `finalize` (await receipt, ignore `AlreadyFinalized`). Players claim from the UI.
- Serve `/web/dist` with SPA fallback.
- On startup print attestor and faucet addresses and balances and the contract address; warn loudly if on-chain `attestor()` != attestor key's address. Label every tx hash in logs. Never log secrets.

## PHASE 3 — WEB (`/web`)
Vite + React + TS + Tailwind + viem. Mobile-first, dark, high contrast, huge touch targets, legible from 5 m on a projector. Load config from `/api/config`. Use `viem/chains` or `defineChain` for the chain.

Routes:
1. **`/` Home:** title and tagline; "Create a Pool" form prefilled with Shake-Off (goal "Shake your phone 40 times", stake 0.01, join 45 s, round 30 s, target 40); after `createPool` confirms parse `PoolCreated` for the id, navigate to `/pool/:id`, show an "Open Arena" link; recent pools list from `/api/pools`; waitlist QR plus link.
2. **`/pool/:id` Player view** (state machine driven by SSE and chain reads):
   - Wallet: burner key via `generatePrivateKey` in `localStorage`; show short address and balance; auto-call `/api/drip` if balance < 0.05 MON; "Wallet" disclosure with Export key / Reset; notice "Demo wallet stored in this browser. Testnet funds only."
   - JOIN: big "STAKE 0.01 MON & JOIN" → `join(id)` signed locally; pending → confirmed with explorer link; countdown to `joinDeadline`. On this tap, call `DeviceMotionEvent.requestPermission()` where it exists (iOS needs a user gesture and HTTPS).
   - LIVE: "GO" splash; shake detection from `devicemotion` (acceleration magnitude incl. gravity crossing ~18 m/s², 250 ms debounce, `navigator.vibrate(30)` if available). ALWAYS also show a big **TAP TO COUNT** button that counts identically. POST `/api/shake` every 500 ms. Show counter, progress ring toward target, live value next to on-chain confirmed value.
   - SETTLING: "Settling on Monad…" with finalize tx link when visible.
   - DONE: if `payoutOf > 0` show **CLAIM** → `claim(id)` → confetti, amount, explorer link. Forfeiters see "You funded the winners." All-fail shows refund + claim.
   - Every tx shows `${explorer}/tx/${hash}`. Map revert errors to plain English (e.g. `JoinClosed` → "Joining has closed").
3. **`/arena/:id` Arena (projector):** full-screen, no scroll. Top: goal, phase badge, huge countdown. Center: one progress bar per player sorted by progress (short address, animated live value, solid on-chain marker that jumps when `Progress` lands, FINISHED flash + confetti on `Finished`). Right: live tx feed with explorer links. Bottom: pot, players, finishers, payout per finisher after finalize. Show contract address and a "Monad Testnet" badge permanently.

Rules: loading/empty/error states everywhere; retries with backoff on RPC reads; optimistic pending states; viem only; small dependency set.

Root `package.json` scripts: `dev` (server + web), `build` (web), `start` (server serving dist), `test:contracts`.

## PHASE 4 — INTEGRATION TEST (you run it)
`npm run build && npm start`. Use a local fork-free approach: if no funded keys/contract are available, run `anvil` locally with the contract deployed to validate the lifecycle (create → two joins → both reach 40 via tap → finished → auto-finalize → claim; third player stops at 10 and cannot claim) and report. No unhandled rejections during a 2-minute run. List every assumption you made.

## PHASE 5 — DOCS AND LAUNCH ASSETS
1. **`README.md`** (graded: "Proper README" and "someone else can run it from the README alone"). Sections in order: title/tagline/3-line description; **Live demo** (URL placeholders + "Try it in 60 seconds", 4 steps, no install); **Deployed contracts** table (testnet + mainnet: chain id, address, verified-explorer link; placeholders `TODO_FILL`); How it works (6-step lifecycle + ASCII diagram); Why Monad (sub-second finality shows live progress, near-zero fees make check-ins economical, EVM equivalence so Foundry/viem just work); Run locally (Node 20+, Foundry >=1.8, clone, `cp .env.example .env` with every variable explained, `forge test`, `npm install`, `npm run build`, `npm start`, funding attestor and faucet wallets, creating a first pool); Deploy your own (link to `contracts/DEPLOY.md`); Contract reference (functions, events, 2% fee, refund-if-nobody-finishes); Honest limitations (v1 trusted attestor; v2 passkey-signed device attestations verified on-chain via Monad's P256 precompile at `0x0100`, EIP-7951; burner demo wallets; unaudited); Business (2% of forfeited stakes, sponsored pools, B2B wellness/DAO commitments, device-attestation standard); Team and links.
2. **`docs/pitch.md`:** a 3-minute script: 0:00 hook; 0:12 create pool live (tx); 0:25 QR scan + joins; 0:40 problem/business while the join window runs; 1:25 GO, shake 30 s; 1:55 finalize; 2:10 claims; 2:30 say all four out loud (repo link, contract address, live URL, deployment on Monad testnet and mainnet); 2:45 close with the v2 roadmap. Include fallbacks (pre-run pool tab, 60 s backup video, phone hotspot).
3. **`docs/social.md`:** three X posts and one LinkedIn post with placeholders. Every post tags **@monad @monad_dev @geeky_kartikey**. Timing: launch post ~12:30 PM, demo-video post ~4:15 PM, ad post ~4:35 PM. No unsourced statistics.
4. **`docs/video-scripts.md`:** a 30-45 s product-running demo shot list and a 20-30 s creative ad shot list.
5. Add `.gitignore` (node_modules, dist, .env, out, cache, broadcast).

## HARD CONSTRAINTS
- No private keys, mnemonics or API keys in the repo, logs, client code, or git history. `.env` is gitignored; commit only `.env.example`.
- Do not broadcast any on-chain transaction or deploy; print commands for the human instead.
- Do not add features beyond this spec. No tokens, no upgradeability, no wagmi, no ethers.
- Commit in small logical commits with clear messages (the commit history is evidence the project was built during the event).
- If a step is blocked by something only a human can provide (funded keys, contract address, domain, form URL), stop that step, list exactly what you need, and continue with everything else.

## FINAL REPORT (end of run)
1. What was built, in 5 lines.
2. Exact human to-do list in order: fund wallets, set `.env`, deploy testnet, verify on both explorers, set `CONTRACT_ADDRESS`, host, domain, mainnet deploy, fill README placeholders, record videos, post.
3. Known gaps and assumptions.
