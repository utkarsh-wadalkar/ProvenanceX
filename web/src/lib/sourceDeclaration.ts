import { isAddress } from "viem";

export const MAX_SIGNED_TOOL_BYTES = 64;
export const SOURCE_TYPES = ["captured", "synthetic", "edited", "unknown"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type MediaDecision = "exact" | "perceptual" | "revoked" | "none";

const labels: Record<SourceType, string> = {
  captured: "Declared captured media",
  synthetic: "Declared AI / synthetic media",
  edited: "Declared edited media",
  unknown: "Source unknown",
};

export function parseSourceDeclaration(signedTool: string): { source: SourceType; tool: string } {
  const match = signedTool.match(/^\[(captured|synthetic|edited|unknown)\]\s*/);
  if (!match) return { source: "unknown", tool: signedTool };
  return { source: match[1] as SourceType, tool: signedTool.slice(match[0].length) };
}

/** Build the exact tool string committed by the existing signed registration. */
export function buildDeclaredTool(source: SourceType, toolName: string): string {
  if (!SOURCE_TYPES.includes(source)) throw new Error("Choose a valid source declaration.");
  const trimmed = toolName.trim();
  if (!trimmed) throw new Error("Enter the tool or publisher name.");
  const signedTool = `[${source}] ${trimmed}`;
  const bytes = new TextEncoder().encode(signedTool).byteLength;
  if (bytes > MAX_SIGNED_TOOL_BYTES) throw new Error(`The signed declaration and tool name must fit within ${MAX_SIGNED_TOOL_BYTES} UTF-8 bytes (currently ${bytes}).`);
  return signedTool;
}

export function parseTrustedPublishers(config: string | undefined): { addresses: Set<string>; configured: boolean; invalidCount: number } {
  const values = (config ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const addresses = new Set<string>();
  let invalidCount = 0;
  for (const value of values) {
    if (!isAddress(value)) { invalidCount++; continue; }
    addresses.add(value.toLowerCase());
  }
  return { addresses, configured: addresses.size > 0, invalidCount };
}

/** Trust is an explicit deployer allowlist signal, never proof that media depicts a real event. */
export function evaluateMediaPolicy(input: {
  decision: MediaDecision;
  signedTool?: string | null;
  creator?: string | null;
  trustedPublishers?: string;
}) {
  const declaration = parseSourceDeclaration(input.signedTool ?? "");
  const allowlist = parseTrustedPublishers(input.trustedPublishers);
  const creator = input.creator ?? "";
  const publisherTrust = !creator || !isAddress(creator) ? "unknown" : allowlist.addresses.has(creator.toLowerCase()) ? "trusted" : "unlisted";
  const reviewReasons: string[] = [];
  if (input.decision === "none") reviewReasons.push("No registered passport matched this file.");
  if (input.decision === "perceptual") reviewReasons.push("This file differs from a visually similar registered asset.");
  if (input.decision === "revoked") reviewReasons.push("The matching passport has been revoked.");
  if (declaration.source === "synthetic") reviewReasons.push("The signer declared this media AI-generated or synthetic; no detector was used.");
  if (declaration.source === "captured" && publisherTrust !== "trusted") reviewReasons.push("Captured media is self-declared by an unlisted publisher; review its origin.");
  if (declaration.source === "unknown") reviewReasons.push("This source is unknown or comes from a legacy unsigned declaration.");
  if (declaration.source === "edited") reviewReasons.push("The signer declared edits; review the original and edit history.");
  if (input.decision === "exact" && declaration.source === "captured" && publisherTrust === "trusted") reviewReasons.push("Publisher is allowlisted, but date, location, and incident context still need corroboration.");
  if (input.decision === "exact" && declaration.source === "captured" && publisherTrust !== "trusted") reviewReasons.push("Verify publisher identity before relying on the captured-media declaration.");
  return {
    declaration: { source: declaration.source, label: labels[declaration.source], tool: declaration.tool },
    publisherTrust,
    trustedPublisherListConfigured: allowlist.configured,
    invalidTrustedPublisherCount: allowlist.invalidCount,
    reviewRequired: true,
    reviewReasons,
  } as const;
}
