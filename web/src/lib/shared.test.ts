import { describe, expect, it } from "vitest";
import { sha256Hex, sha256Raw } from "@/lib/hash";
import { hamming } from "@/lib/phash";
import { readPassportMetadata, writePassportMetadata } from "@/lib/pngMeta";
import { computeTrailHead, verifyPagedTrail, verifyTrailEntries, ZERO_HEAD, type TrailEntry } from "@/lib/trail";
import { matchTrailTransactionHash, verifyDecision } from "@/lib/registry";
import { keccak256, encodeAbiParameters } from "viem";

function crc(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) { c ^= byte; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = new TextEncoder().encode(type); const bytes = new Uint8Array(data.length + 12); const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length); bytes.set(typeBytes, 4); bytes.set(data, 8); view.setUint32(data.length + 8, crc(bytes.subarray(4, data.length + 8))); return bytes;
}
function png(...extra: Uint8Array[]) {
  const ihdr = new Uint8Array(13); new DataView(ihdr.buffer).setUint32(0, 1); new DataView(ihdr.buffer).setUint32(4, 1); ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array([137,80,78,71,13,10,26,10]), pngChunk("IHDR", ihdr), ...extra, pngChunk("IDAT", new Uint8Array([1,2,3])), pngChunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out;
}
function corruptTextCrc(bytes: Uint8Array, keyword: string) {
  const copy = new Uint8Array(bytes); let offset = 8;
  while (offset + 12 <= copy.length) {
    const length = new DataView(copy.buffer, copy.byteOffset + offset, 4).getUint32(0);
    const end = offset + 12 + length;
    const type = new TextDecoder("latin1").decode(copy.subarray(offset + 4, offset + 8));
    if (type === "tEXt") {
      const data = copy.subarray(offset + 8, offset + 8 + length); const nul = data.indexOf(0);
      if (nul >= 0 && new TextDecoder("latin1").decode(data.subarray(0, nul)) === keyword) { copy[end - 1] ^= 1; return copy; }
    }
    offset = end;
  }
  throw new Error(`Missing ${keyword} PNG tEXt chunk.`);
}
const metadata = { passportId: `0x${"11".repeat(32)}` as const, contract: `0x${"22".repeat(20)}` as const, chainId: 10143 };

describe("shared content primitives", () => {
  it("hashes raw bytes and excludes only provenancex tEXt metadata", async () => {
    const otherText = pngChunk("tEXt", new TextEncoder().encode("Author\0Ada"));
    const embedded = pngChunk("tEXt", new TextEncoder().encode(`provenancex\0${JSON.stringify(metadata)}`));
    const original = png(otherText); const withMetadata = png(otherText, embedded);
    expect(await sha256Hex(withMetadata)).toBe(await sha256Hex(original));
    expect(await sha256Raw(withMetadata)).not.toBe(await sha256Raw(original));
    expect(await sha256Hex(new Uint8Array([1, 2, 3]))).toBe(await sha256Raw(new Uint8Array([1, 2, 3])));
    await expect(sha256Hex(corruptTextCrc(withMetadata, "provenancex"))).rejects.toThrow(/CRC mismatch in tEXt/);
    await expect(sha256Hex(original.subarray(0, original.length - 12))).rejects.toThrow(/missing IEND/);
    await expect(sha256Hex(new Uint8Array([...original, 0]))).rejects.toThrow(/trailing bytes/);
  });

  it("round trips metadata, replaces old records, and rejects CRC tampering", () => {
    const original = png(pngChunk("tEXt", new TextEncoder().encode("provenancex\0spoof")));
    const written = writePassportMetadata(original, metadata);
    expect(readPassportMetadata(written)).toEqual(metadata);
    const replaced = writePassportMetadata(written, { ...metadata, chainId: 10143, passportId: `0x${"33".repeat(32)}` });
    expect(readPassportMetadata(replaced)?.passportId).toBe(`0x${"33".repeat(32)}`);
    const damaged = new Uint8Array(replaced); damaged[damaged.length - 1] ^= 1;
    expect(() => readPassportMetadata(damaged)).toThrow(/CRC/);
    expect(readPassportMetadata(png(pngChunk("tEXt", new TextEncoder().encode("provenancex\0{\"passportId\":\"fake\"}"))))).toBeNull();
  });

  it("calculates 64-bit Hamming distance with unsigned masking", () => {
    expect(hamming(0n, 0n)).toBe(0);
    expect(hamming(0n, 0xffff_ffff_ffff_ffffn)).toBe(64);
    expect(hamming(-1n, 0n)).toBe(64);
    expect(hamming(0x8000_0000_0000_0001n, 1n)).toBe(1);
    for (let i = 0; i < 64; i++) expect(hamming(1n << BigInt(i), 0n)).toBe(1);
  });

  it("matches the Solidity abi.encode trail vector and validates a complete paged chain", async () => {
    const dataHash = `0x${"ab".repeat(32)}` as const;
    const head = computeTrailHead(ZERO_HEAD, "REGISTERED", dataHash, 1n);
    const solidityStyle = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "string" }, { type: "bytes32" }, { type: "uint256" }], [ZERO_HEAD, "REGISTERED", dataHash, 1n]));
    // Golden result for Solidity keccak256(abi.encode(previousHead, eventType, dataHash, uint256(timestamp))).
    expect(head).toBe("0xc4bc8b109ee95e42a950e8de05b66ddf47ef76aa26608fca19f007b649f5b353");
    expect(head).toBe(solidityStyle);
    const entry: TrailEntry = { previousHead: ZERO_HEAD, eventType: "REGISTERED", dataHash, trailHead: head, actor: `0x${"44".repeat(20)}`, timestamp: 1n, blockNumber: 1n };
    expect(verifyTrailEntries([entry], head, 1, dataHash).valid).toBe(true);
    expect((await verifyPagedTrail(1, head, async () => [entry], dataHash)).valid).toBe(true);
    expect(verifyTrailEntries([{ ...entry, trailHead: ZERO_HEAD }], head, 1).valid).toBe(false);
    expect(verifyTrailEntries([entry], head, 2).valid).toBe(false);
    expect((await verifyPagedTrail(1, head, async () => [], dataHash)).valid).toBe(false);
    const txHash = `0x${"55".repeat(32)}` as const;
    expect(matchTrailTransactionHash(`0x${"66".repeat(32)}`, entry, [{ args: { passportId: `0x${"66".repeat(32)}` }, transactionHash: txHash }])).toBe(txHash);
    const wrongTxHash = `0x${"77".repeat(32)}` as const;
    expect(matchTrailTransactionHash(`0x${"66".repeat(32)}`, { ...entry, eventType: "EDITED" }, [
      { args: { passportId: `0x${"66".repeat(32)}`, trailHead: ZERO_HEAD }, transactionHash: wrongTxHash },
      { args: { passportId: `0x${"66".repeat(32)}`, trailHead: head }, transactionHash: txHash },
    ])).toBe(txHash);
  });

  it("returns explicit exact, revoked, approximate and no-match decisions", () => {
    expect(verifyDecision({ exact: true, exists: true, revoked: false })).toBe("exact");
    expect(verifyDecision({ exact: true, exists: true, revoked: true })).toBe("revoked");
    expect(verifyDecision({ exact: false, exists: true, revoked: false })).toBe("authentic");
    expect(verifyDecision({ exact: false, exists: false, revoked: false, perceptualDistance: 6, candidateHash: 1n })).toBe("perceptual");
    expect(verifyDecision({ exact: false, exists: false, revoked: false, perceptualDistance: 0, candidateHash: 0n })).toBe("none");
    expect(verifyDecision({ exact: false, exists: false, revoked: false })).toBe("none");
  });
});
