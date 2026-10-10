# ProvenanceX: disaster-media provenance pitch

## Purpose

Disaster-response teams can receive alarming images and videos through chats and social feeds with no reliable context. ProvenanceX lets a team check whether the exact file matches a registered fingerprint, inspect what source declaration a signing wallet made, and read later recorded events. It is a provenance aid for human review, not an incident-truth or AI-detection system.

## Illustrative user story

A volunteer coordinator receives a flood image in a response chat. They upload the file, check whether its exact hash has a passport, review the signed declaration and the signer address, then compare the post's time and location with an independent source before routing it. A dHash candidate may point to a visually similar image if the upload has changed; it does not prove the image came from the same event. This describes a proposed workflow, not a verified case study or current customer story.

## What the product distinguishes

- **File identity:** exact canonical SHA-256 matching confirms that submitted bytes match a registered passport (with the documented ProvenanceX PNG metadata chunk excluded). It does not prove the content is true.
- **Source declaration:** the registering wallet signs one of `[captured]`, `[synthetic]`, `[edited]`, or `[unknown]` in the existing `tool` value, along with the tool or publisher name. The declaration is self-attested. Legacy unprefixed declarations parse as unknown.
- **Publisher signal:** a deployment can configure trusted wallet addresses through `NEXT_PUBLIC_TRUSTED_PUBLISHERS`. An exact match to a configured address can be displayed as an allowlist signal. An empty list trusts nobody; the allowlist does not prove legal identity or physical reality.
- **Visual similarity:** dHash can suggest a related registered image when exact bytes differ. It can miss edits or identify unrelated lookalikes. Videos and other non-images get exact hashing only.
- **Context corroboration:** response teams still need to check time, location, weather, and independent reporting before routing resources. ProvenanceX performs no automatic real/fake, deepfake, or incident classification.

## Target users to interview

- Emergency response and disaster-relief teams that triage media submitted by the public.
- Emergency communications groups that coordinate evidence between responders.
- Newsrooms and fact-checkers that need to track file copies and source declarations.
- Publishers or agencies willing to publish from an explicitly configured signer address.

These are research targets, not existing customers or confirmed demand.

## Testable pre-market-fit hypotheses

1. **Intake fit:** in 8 observed workflow trials, at least 6 coordinators can complete an exact-file check and explain what it does not prove without prompting.
2. **Source understanding:** at least 8 of 10 interviewees understand that `[captured]` is a signer declaration and that an allowlist match is not evidence of physical reality.
3. **Changed-file behavior:** in 10 trials with original files, screenshots, and recompressed images, reviewers distinguish exact matches from dHash candidates and do not treat a candidate as proof that the file depicts the same event.
4. **Integration demand:** at least one response, newsroom, or publisher team requests a scoped technical pilot with a named workflow owner and a review policy.
5. **Operating model:** teams indicate whether they prefer a managed per-asset service, an API, or an embeddable widget after seeing the actual verification limits and costs. No price point is assumed.

## Pilot measures

With informed consent, measure completion time, exact-match success for unchanged files, changed-file candidate precision/recall on an agreed test set, how often users seek independent context, comprehension of the source-declaration limits, and repeat use after a week. Track whether teams request a pilot and identify an owner. Do not claim fewer false alarms, faster rescues, improved truth detection, customers, or traction unless a study measures those outcomes and supports the claim.

## Business model proposal

The current contract charges no registration fee. Potential future revenue includes a managed per-asset provenance service, a bulk API for media intake, or a publisher/response-platform widget. The existing `/api/verify` endpoint is a public read-only exact-hash lookup; it has no authentication, bulk service, or SLA. Validate demand, trust governance, privacy, and operating cost before building paid features.
