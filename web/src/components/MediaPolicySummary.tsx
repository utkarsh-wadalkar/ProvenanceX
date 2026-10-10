import { evaluateMediaPolicy, type MediaDecision } from "@/lib/sourceDeclaration";

export function MediaPolicySummary({ decision, signedTool, creator }: { decision: MediaDecision; signedTool?: string | null; creator?: string | null }) {
  const policy = evaluateMediaPolicy({
    decision,
    signedTool,
    creator,
    trustedPublishers: process.env.NEXT_PUBLIC_TRUSTED_PUBLISHERS,
  });
  const integrity = decision === "exact" ? "Exact passport match · file integrity verified" : decision === "revoked" ? "Exact content match · passport revoked" : decision === "perceptual" ? "Modified / re-encoded copy · not an exact match" : "No passport record found";
  const relatedPrefix = decision === "perceptual" ? "Similar passport only · " : decision === "revoked" ? "Revoked passport · " : "";
  const signerLabel = policy.publisherTrust === "trusted" ? "trusted allowlist match" : policy.publisherTrust === "unlisted" ? "not on the publisher trust list" : "no registered signer to check";
  return <section className="media-policy" aria-label="File integrity and source declaration">
    {policy.declaration.source === "captured" && <p className="publisher-declaration">{decision === "exact" && policy.publisherTrust === "trusted" ? "Trusted publisher · declared captured media" : `${relatedPrefix}${policy.publisherTrust === "trusted" ? "captured media declared by a trusted publisher" : "self-declared captured media · origin review required"}`}</p>}
    <div className="media-policy-facts">
      <div><span className="eyebrow">FILE INTEGRITY</span><strong>{integrity}</strong><small>Hash matching confirms registered bytes; it does not establish incident truth.</small></div>
      <div><span className="eyebrow">SIGNED SOURCE DECLARATION</span><strong>{policy.declaration.label}</strong>{policy.declaration.tool && <small>Tool / publisher: {policy.declaration.tool}</small>}<small>{policy.declaration.source === "synthetic" ? "Creator-declared AI / synthetic media · no detector was used." : "Declaration is signed by the registering wallet, not independently proven."}</small></div>
      <div><span className="eyebrow">REGISTERING SIGNER</span><strong>{relatedPrefix}{signerLabel}</strong><small>{policy.publisherTrust === "trusted" ? "The allowlist is an organization review signal, not proof of physical reality or of this uploaded copy's origin." : policy.publisherTrust === "unlisted" ? "Publisher identity remains self-declared; review its origin." : "No passport means there is no registered signer or source declaration."}</small></div>
    </div>
    {decision === "perceptual" && <p className="policy-config">The declaration and publisher above belong to the similar registered passport; they do not establish the source of this modified file.</p>}
    {decision === "revoked" && <p className="policy-config">The declaration and publisher above belong to a revoked passport. The matching content has no active passport status.</p>}
    <p className="review-required"><b>REVIEW BEFORE DISPATCH</b> Verify date, location, and context; corroborate with another source before sending responders.</p>
    {!policy.trustedPublisherListConfigured && <p className="policy-config">Publisher trust is not configured. Treat source declarations as self-declared and verify publisher identity independently.</p>}
    {policy.invalidTrustedPublisherCount > 0 && <p className="policy-config">Some publisher trust entries are invalid and ignored. Treat affected publishers as untrusted and ask the deployment administrator to review the list.</p>}
  </section>;
}
