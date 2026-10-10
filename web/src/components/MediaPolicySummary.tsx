import { evaluateMediaPolicy, mediaIntegrityLabel, type MediaDecision } from "@/lib/sourceDeclaration";

export function MediaPolicySummary({ decision, signedTool, creator }: { decision: MediaDecision; signedTool?: string | null; creator?: string | null }) {
  const policy = evaluateMediaPolicy({
    decision,
    signedTool,
    creator,
    trustedPublishers: process.env.NEXT_PUBLIC_TRUSTED_PUBLISHERS,
  });
  const relatedPrefix = decision === "perceptual" ? "Similar record only · " : decision === "revoked" ? "Revoked registration · " : decision === "revoked-record" ? "Revoked publication record only · " : decision === "unverified" || decision === "record" ? "Registered record only · " : "";
  const signerLabel = policy.publisherTrust === "trusted" ? "Verified Official Publisher" : policy.publisherTrust === "unlisted" ? "Self-Declared Publisher Identity" : "Unregistered Signer";
  return <section className="media-policy" aria-label="Publisher verification and media integrity">
    {policy.declaration.source === "captured" && <p className="publisher-declaration">{decision === "exact" && policy.publisherTrust === "trusted" ? "✓ Verified Official Source · Registered by verified government / institutional publisher" : `${relatedPrefix}${policy.publisherTrust === "trusted" ? "Official release by verified publisher" : "Self-declared publisher · Identity verification pending"}`}</p>}
    <div className="media-policy-facts">
      <div><span className="eyebrow">FILE INTEGRITY</span><strong>{mediaIntegrityLabel(decision)}</strong><small>Exact SHA-256 hash matching confirms authentic publication bytes on Monad.</small></div>
      <div><span className="eyebrow">PUBLISHER DECLARATION</span><strong>{policy.declaration.label}</strong>{policy.declaration.tool && <small>Registered by: {policy.declaration.tool}</small>}<small>Cryptographically signed by authorized publisher wallet.</small></div>
      <div><span className="eyebrow">TRUST LEVEL</span><strong>{relatedPrefix}{signerLabel}</strong><small>{policy.publisherTrust === "trusted" ? "Wallet verified through ProvenanceX Trusted Issuer Registry." : policy.publisherTrust === "unlisted" ? "Registered via self-declared wallet; request identity verification." : "No registered publication record found."}</small></div>
    </div>
    {decision === "perceptual" && <p className="policy-config">The declaration above belongs to a visually similar registered release. Verify exact bytes for official confirmation.</p>}
    {decision === "revoked" && <p className="policy-config">The registration for this media release was revoked by the issuing organization.</p>}
    {decision === "revoked-record" && <p className="policy-config">This view loaded a revoked publication record by ID.</p>}
    {decision === "unverified" && <p className="policy-config">Select a media file to check against registered publisher records on Monad.</p>}
    {decision === "record" && <p className="policy-config">Publication record loaded. Upload local file bytes to execute exact hash comparison.</p>}
    <p className="review-required"><b>VERIFIED SOURCE CHECK</b> Confirm official publisher identity and wallet registration before publishing or distributing releases.</p>
    {!policy.trustedPublisherListConfigured && <p className="policy-config">Issuer Registry is running in open mode. Organizations can request verified publisher identity onboarding.</p>}
  </section>;
}

