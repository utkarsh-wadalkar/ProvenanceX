import type { Hex } from "viem";
import { buildDeclaredTool } from "@/lib/sourceDeclaration";

export const DEMO_SIGNED_TOOL = buildDeclaredTool("synthetic", "Procedural demo artwork");

export function createDemoRegistrationInput(input: { contentHash: Hex; perceptualHash: bigint }) {
  return {
    ...input,
    tool: DEMO_SIGNED_TOOL,
    metadataURI: "",
  };
}
