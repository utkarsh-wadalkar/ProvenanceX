import { describe, expect, it } from "vitest";
import { buildDeclaredTool, evaluateMediaPolicy, mediaIntegrityLabel, MAX_SIGNED_TOOL_BYTES, parseSourceDeclaration, parseTrustedPublishers } from "@/lib/sourceDeclaration";

const publisher = "0x000000000000000000000000000000000000dEaD";

describe("signed media source declarations", () => {
  it("parses all explicit declarations and treats untagged legacy tools as unknown", () => {
    expect(parseSourceDeclaration("[captured] Field camera")).toEqual({ source: "captured", tool: "Field camera" });
    expect(parseSourceDeclaration("[synthetic] Procedural sample" )).toEqual({ source: "synthetic", tool: "Procedural sample" });
    expect(parseSourceDeclaration("[edited] Cut + color")).toEqual({ source: "edited", tool: "Cut + color" });
    expect(parseSourceDeclaration("Old untagged registration")).toEqual({ source: "unknown", tool: "Old untagged registration" });
  });

  it("enforces the final UTF-8 signed tool field limit", () => {
    const atLimit = buildDeclaredTool("captured", "a".repeat(MAX_SIGNED_TOOL_BYTES - "[captured] ".length));
    expect(new TextEncoder().encode(atLimit).byteLength).toBe(MAX_SIGNED_TOOL_BYTES);
    expect(() => buildDeclaredTool("captured", `${"a".repeat(50)}🚨🚨🚨`)).toThrow(/64 UTF-8 bytes/);
  });

  it("accepts valid configured wallet addresses and ignores invalid entries", () => {
    expect(parseTrustedPublishers(`${publisher},not-an-address,0x123`)).toMatchObject({ configured: true, invalidCount: 2 });
    expect(parseTrustedPublishers("bad-address")).toMatchObject({ configured: false, invalidCount: 1 });
    expect(parseTrustedPublishers("")).toMatchObject({ configured: false, invalidCount: 0 });
  });

  it("distinguishes allowlisted and unlisted captured declarations", () => {
    const trusted = evaluateMediaPolicy({ decision: "exact", signedTool: "[captured] AP newsroom", creator: publisher, trustedPublishers: publisher });
    expect(trusted.publisherTrust).toBe("trusted");
    expect(trusted.declaration.source).toBe("captured");
    expect(trusted.reviewRequired).toBe(true);
    expect(trusted.reviewReasons.join(" ")).toMatch(/corroboration/);
    const unlisted = evaluateMediaPolicy({ decision: "exact", signedTool: "[captured] Camera", creator: publisher, trustedPublishers: "" });
    expect(unlisted.publisherTrust).toBe("unlisted");
    expect(unlisted.reviewReasons.join(" ")).toMatch(/self-declared/);
    const invalidConfig = evaluateMediaPolicy({ decision: "exact", signedTool: "[captured] Camera", creator: publisher, trustedPublishers: "malformed-wallet-address" });
    expect(invalidConfig.publisherTrust).toBe("unlisted");
    expect(invalidConfig.trustedPublisherListConfigured).toBe(false);
    expect(invalidConfig.invalidTrustedPublisherCount).toBe(1);
  });

  it("requires review for exact synthetic, modified, and revoked media", () => {
    const synthetic = evaluateMediaPolicy({ decision: "exact", signedTool: "[synthetic] Procedural sample", creator: publisher });
    expect(synthetic.declaration.label).toMatch(/synthetic/);
    expect(synthetic.reviewRequired).toBe(true);
    const modified = evaluateMediaPolicy({ decision: "perceptual", signedTool: "[captured] Newsroom", creator: publisher, trustedPublishers: publisher });
    expect(modified.reviewRequired).toBe(true);
    expect(modified.reviewReasons.join(" ")).toMatch(/differs/);
    const revoked = evaluateMediaPolicy({ decision: "revoked", signedTool: "[captured] Newsroom", creator: publisher, trustedPublishers: publisher });
    expect(revoked.reviewRequired).toBe(true);
    expect(revoked.reviewReasons.join(" ")).toMatch(/revoked/);
  });

  it("does not invent a signer or declaration for a file with no passport", () => {
    const missing = evaluateMediaPolicy({ decision: "none" });
    expect(missing.declaration.source).toBe("unknown");
    expect(missing.publisherTrust).toBe("unknown");
    expect(missing.reviewRequired).toBe(true);
  });

  it("separates a revoked record page from an exact revoked-file match", () => {
    expect(mediaIntegrityLabel("revoked-record")).toBe("Revoked media record · file comparison required");
    expect(mediaIntegrityLabel("revoked")).toBe("Exact content match · registration revoked");
    const record = evaluateMediaPolicy({ decision: "revoked-record", signedTool: "[captured] Newsroom" });
    expect(record.reviewReasons.join(" ")).toMatch(/no file was compared/);
  });
});
