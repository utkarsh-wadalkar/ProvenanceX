# Media provenance demo checklist

**Schedule:** finish the engineering handoff by 17:15 IST on 10 Oct 2026, leaving 15 minutes for the form and video; submit before 17:30 IST.

## Before the demo

- [ ] Open the checked production URL and confirm the testnet contract and network labels.
- [ ] Confirm the wallet has test MON and is set to Monad Testnet (chain 10143).
- [ ] Load a clearly labeled illustrative synthetic sample, the real registered media record file, and one edited copy; know the expected exact/candidate states.
- [ ] The rehearsal media record is [`0x6c27ab45a494b45be78b79f5a173ea55c54040818d75420dbee2b8e01a768d6e`](https://provenancex.vercel.app/p/0x6c27ab45a494b45be78b79f5a173ea55c54040818d75420dbee2b8e01a768d6e). Its declaration is `[synthetic] Procedural demo artwork` and its registration is on Testnet.
- [ ] Decide and show the source declaration selected for each registration. Do not relabel the legacy untagged registration as synthetic.
- [ ] If a trusted publisher is demonstrated, confirm its signer address is in the deployed allowlist; explain that this is a review signal only.
- [ ] Open Verify, the sample media record, the explorer, and the relevant independent context source in separate tabs.
- [ ] Record a backup video using a real transaction receipt and actual on-screen outcomes.
- [ ] Check browser console, Wi-Fi/hotspot, laptop battery, and that no private keys or seed phrases are visible.

## During the demo

- [ ] Explain that ProvenanceX checks registered file identity and signed source declarations; it flags declared synthetic media and does not automatically detect AI/deepfakes or decide whether a post is true.
- [ ] Register only the clearly identified demo sample and wait for the actual Testnet receipt.
- [ ] Verify the downloaded file's exact hash, then show its signed declaration and signer/allowlist status separately.
- [ ] Change a pixel or use the edited sample. Label any dHash result as a similarity hint, not proof of a shared source or truthful post.
- [ ] Show the media record's paged trail and its hash-chain result.
- [ ] If showing the public rehearsal, cite registration tx [`0xaa5c6aa579dcabfde0c73e92da53cd628e338ba7d9b61c72fd461d98a99cf250`](https://testnet.monadexplorer.com/tx/0xaa5c6aa579dcabfde0c73e92da53cd628e338ba7d9b61c72fd461d98a99cf250) and creator append tx [`0x67ea0b93fd4247372e8024e23bbd0b93fed1b81a7ae8f1bd80d0277ee6767c75`](https://testnet.monadexplorer.com/tx/0x67ea0b93fd4247372e8024e23bbd0b93fed1b81a7ae8f1bd80d0277ee6767c75).
- [ ] Close by checking the original creator and context before reposting, and show how creators can share a media record with their media.
- [ ] If an RPC or deployment error occurs, state that no verification result was produced; do not present the error as “no record.”

## After the demo

- [ ] Add only the final rehearsal's actual registration transaction hashes and published media links to `docs/submission.md`.
- [ ] Capture genuine post analytics after publication; otherwise leave the counts unavailable.
