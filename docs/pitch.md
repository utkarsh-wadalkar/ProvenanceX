# ProvenanceX: media media records for every share

## Purpose

Photos, videos, and AI-generated posts move through feeds and chats faster than their source information. ProvenanceX lets everyday users compare a downloaded file with a registered original, inspect its signed source declaration, and follow its edit history. Creators can register their media and share a public media record alongside their post.

## Illustrative user story

A person receives a striking video in a group chat and wants to repost it. They download the video and check it in ProvenanceX. An exact match links to its registering wallet, declared source, and history. A synthetic declaration is visibly flagged. If no media record matches, the source remains unknown. For images, a similarity candidate can suggest a related original after an edit; it is a hint, not proof. This is a proposed workflow, not a measured customer case study.

## Three-minute pitch

“Keep the source with every share. ProvenanceX gives photos, videos, and files a portable media media record on Monad. A creator signs what they know about the source: captured, synthetic, edited, or unknown. Anyone can compare the actual file with that registration and inspect its history. In the demo, we register a synthetic sample, verify the downloaded PNG, change a pixel, and show the exact match fail while image similarity finds a candidate. We then append a real history event. File identity, signed source claims, and content truth are separate questions. Our next step is testing whether creators and everyday users can make provenance part of how they post and repost.”

## What works today

- Exact canonical SHA-256 comparison for photos, videos, and files; only ProvenanceX's own PNG media record metadata is excluded.
- Wallet-signed captured, synthetic, edited, or unknown declarations; legacy untagged records remain unknown.
- Optional publisher allowlist signal. It identifies configured wallet addresses, not legal identity or content truth.
- Image dHash similarity hints, complete hash-chain history, parent/derivative links, and revocation.
- Public media record pages, embeddable badges, PNG downloads, QR certificates, and a real Monad Testnet demo.

Download media from a social post for comparison; direct social URL ingestion is not implemented. Video checks compare exact bytes only. The product does not automatically classify AI/deepfakes or determine whether a post is true.

## Pre-market-fit hypotheses

- Interview 10 everyday social users and 10 independent creators about their source-checking and original-sharing habits.
- In eight observed trials, at least six people can verify a file and explain the difference between an exact match and a signed declaration without prompting.
- Test originals, screenshots, and recompressed images; measure exact-match success, image-candidate precision, completion time, comprehension, and repeat use after a week.
- Seek two consented pilots with creators, moderators, fact-checkers, or publishers, with a named workflow owner. These are targets, not claimed customers or demand.

## Revenue proposal

Registration currently has no platform fee; users pay network gas. Proposed experiments: a free individual checker, an optional creator plan around $5/month for managed publishing tools, and a publisher/moderation integration starting around $49/month. These are pricing hypotheses requiring interviews and cost validation, not current plans or paid features. A future bulk API, managed service, and widget subscription could serve platforms. The current /api/verify is a public read-only hash lookup without authentication, bulk service, or an SLA.

## Innovation backed by the demo

One portable record joins an EIP-712 source declaration, exact file identity, paged on-chain audit history, and derivative links. PNG media records travel inside a downloadable file; public links and badges share the record separately. Exact comparisons and image similarity remain visibly distinct. The implementation avoids full-history log scans and verifies the entire stored hash chain. Explain these working differences without claiming a novel AI detector or unsupported uniqueness.

## Evidence and handoff

Live app: https://provenancex.vercel.app/
Public source: https://github.com/utkarsh-wadalkar/ProvenanceX
Public deployment and demo receipts: [submission sheet](submission.md).

Engineering handoff by **17:15 IST on 10 October 2026**; reserve 15 minutes for form/video and submit before **17:30 IST**. Build in Public recording and publication belong to Utkarsh.
