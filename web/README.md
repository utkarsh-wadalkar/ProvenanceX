# ProvenanceX web app

Next.js 14 App Router UI for creative passports on Monad Testnet (chain 10143). The contract manifest at `src/lib/deployment.json` is intentionally null until a real deployment receipt is exported. In that state, the app clearly reports that deployment is pending, disables registration and guided on-chain steps, and never invents a passport or a live count.

## Run locally

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` only if you need to override the public RPC, configure the optional demo signer, or set the deployed public site URL. `NEXT_PUBLIC_DEMO_KEY` is intentionally shipped to every browser; use only a disposable Monad Testnet burner holding valueless test MON. It is restricted to chain ID 10143, and demo registration and append use the same signer. Prefer an injected wallet for normal use.

## Asset handling

Create and verify compute SHA-256 and dHash in the browser. A canonical PNG hash removes only the CRC-valid `provenancex` `tEXt` metadata chunk, so downloading the passported PNG preserves its original registry match. JPEG and other browser-decodable images are normalized to PNG before registration; non-image files retain their exact bytes and do not receive perceptual matching. Embedded passport metadata is an untrusted lookup hint and is never proof of authenticity. An exact match confirms that the file contents match a registry entry; it does not independently prove who or what (including an AI tool) created the work.

The three bundled procedural PNG artworks are original sample assets and are labeled as samples. The Create page also tries a keyless image source with an 8-second timeout, then falls back to those local samples. Each sample selection gets a unique pixel variation, so the offline walkthrough can create distinct registrations.

## Registry, verification, and trail

The Verify page checks canonical exact SHA-256 first. If no exact record exists, image dHash candidates are compared against the indexed registry, with a maximum Hamming distance of 6. An incomplete bounded scan and RPC failures remain errors; neither is reported as “no passport found.” Passport pages read the complete paged trail, recompute its hash chain against the on-chain head, and resolve transaction links by exact stored block. Public metadata previews are optional, HTTPS/IPFS only, and time-bounded.

`GET /api/verify?hash=0x…` returns the matching record as JSON. Invalid hashes receive HTTP 400; an undeployed contract or unavailable RPC receives HTTP 503. Bigint fields are serialized as decimal strings.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

This scaffold stays on the requested patched Next 14.2 line and should be upgraded to a supported major in a separately reviewed change.
