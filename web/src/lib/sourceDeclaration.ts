import { isAddress } from "viem";

export const MAX_SIGNED_TOOL_BYTES = 64;
export const SOURCE_TYPES = ["captured", "synthetic", "edited", "unknown"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];
export type MediaDecision = "exact" | "record" | "perceptual" | "revoked" | "revoked-record" | "none" | "unverified";

const labels: Record<SourceType, string> = {
  captured: "Official release / Captured media",
  synthetic: "Declared synthetic / AI-assisted media",
  edited: "Edited official release",
  unknown: "Source declared by publisher",
};

export function parseSourceDeclaration(signedTool: string): { source: SourceType; tool: string } {
  const match = signedTool.match(/^\[(captured|synthetic|edited|unknown)\]\s*/);
  if (!match) return { source: "unknown", tool: signedTool };
  return { source: match[1] as SourceType, tool: signedTool.slice(match[0].length) };
}

export function mediaIntegrityLabel(decision: MediaDecision): string {
  if (decision === "exact") return "Exact file match · Authentic publication confirmed";
  if (decision === "record") return "Registered publication record · file comparison required";
  if (decision === "revoked") return "Exact content match · registration revoked";
  if (decision === "revoked-record") return "Revoked media record · file comparison required";
  if (decision === "perceptual") return "Modified copy · Visually similar registered publication";
  if (decision === "unverified") return "Verification pending · Select a file to check";
  return "No matching official registration found";
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

/** Trust is an explicit publisher registry signal verifying institutional authority. */
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
  if (input.decision === "none") reviewReasons.push("No registered media record matched this file.");
  if (input.decision === "record") reviewReasons.push("An official publication record exists, but no file was compared in this view.");
  if (input.decision === "revoked-record") reviewReasons.push("A revoked publication record loaded, but no file was compared in this view.");
  if (input.decision === "unverified") reviewReasons.push("This selected file has no verification result; select a file to compare against official registrations.");
  if (input.decision === "perceptual") reviewReasons.push("This file differs from a visually similar registered official release.");
  if (input.decision === "revoked") reviewReasons.push("The matching media registration has been revoked by the issuer.");
  if (declaration.source === "synthetic") reviewReasons.push("The signer declared this media synthetic or AI-assisted; no detector was used.");
  if (declaration.source === "captured" && publisherTrust !== "trusted") reviewReasons.push("Captured media is self-declared by an unlisted publisher; check identity verification status.");
  if (declaration.source === "unknown") reviewReasons.push("Source declared by registering publisher.");
  if (declaration.source === "edited") reviewReasons.push("Publisher declared edits; review original release and edit history.");
  if (input.decision === "exact" && declaration.source === "captured" && publisherTrust === "trusted") reviewReasons.push("Verified publisher identity confirmed on Monad Testnet; original source claims still subject to independent corroboration.");
  if (input.decision === "exact" && declaration.source === "captured" && publisherTrust !== "trusted") reviewReasons.push("Exact file hash matches registered publication; publisher identity remains self-declared.");
  return {
    declaration: { source: declaration.source, label: labels[declaration.source], tool: declaration.tool },
    publisherTrust,
    trustedPublisherListConfigured: allowlist.configured,
    invalidTrustedPublisherCount: allowlist.invalidCount,
    reviewRequired: true,
    reviewReasons,
  } as const;
}


