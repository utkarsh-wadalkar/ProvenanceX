import type { Hex } from "viem";
import { buildDeclaredTool } from "@/lib/sourceDeclaration";
import type { MediaDecision } from "@/lib/sourceDeclaration";

export const DEMO_SIGNED_TOOL = buildDeclaredTool("synthetic", "Procedural demo artwork");

export type DemoFileStatus = "registered" | "exact" | "perceptual" | "unverified";

export function demoDecisionForFileStatus(status: DemoFileStatus): MediaDecision {
  if (status === "registered" || status === "exact") return "exact";
  if (status === "perceptual") return "perceptual";
  return "unverified";
}

export function createDemoRegistrationInput(input: { contentHash: Hex; perceptualHash: bigint }) {
  return {
    ...input,
    tool: DEMO_SIGNED_TOOL,
    metadataURI: "",
  };
}
