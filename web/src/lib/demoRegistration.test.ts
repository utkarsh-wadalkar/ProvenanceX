import { describe, expect, it } from "vitest";
import { createDemoRegistrationInput, DEMO_SIGNED_TOOL } from "@/lib/demoRegistration";
import { parseSourceDeclaration } from "@/lib/sourceDeclaration";
import type { Hex } from "viem";

describe("guided demo registration declaration", () => {
  it("passes the declared synthetic tool in the shared registration payload", () => {
    const registration = createDemoRegistrationInput({
      contentHash: `0x${"12".repeat(32)}` as Hex,
      perceptualHash: 42n,
    });

    expect(registration).toMatchObject({ tool: DEMO_SIGNED_TOOL, metadataURI: "" });
    expect(parseSourceDeclaration(registration.tool)).toEqual({
      source: "synthetic",
      tool: "Procedural demo artwork",
    });
  });
});
