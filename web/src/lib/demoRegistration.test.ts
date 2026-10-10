import { describe, expect, it } from "vitest";
import { createDemoRegistrationInput, DEMO_SIGNED_TOOL, demoDecisionForFileStatus } from "@/lib/demoRegistration";
import { evaluateMediaPolicy, parseSourceDeclaration } from "@/lib/sourceDeclaration";
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

  it("labels only the displayed file's demonstrated verification result", () => {
    const sequence = ["registered", "unverified", "exact", "perceptual"] as const;
    expect(sequence.map(demoDecisionForFileStatus)).toEqual(["exact", "unverified", "exact", "perceptual"]);

    const failedSelection = evaluateMediaPolicy({ decision: demoDecisionForFileStatus("unverified"), signedTool: DEMO_SIGNED_TOOL });
    expect(failedSelection.reviewReasons.join(" ")).toMatch(/no verification result/);
    expect(failedSelection.reviewReasons.join(" ")).not.toMatch(/No registered media record matched this file/);

    const recordOnly = evaluateMediaPolicy({ decision: "record", signedTool: DEMO_SIGNED_TOOL });
    expect(recordOnly.reviewReasons.join(" ")).toMatch(/no file was compared/);
  });
});
