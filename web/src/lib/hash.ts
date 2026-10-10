import { keccak256, toBytes } from "viem";
import { isPngBytes, parsePngChunks } from "@/lib/png";
import { assertByteLimit, MAX_ASSET_BYTES } from "@/lib/assetSafety";

const textDecoder = new TextDecoder("latin1");

function removeProvenanceTextChunk(bytes: Uint8Array): Uint8Array {
  if (!isPngBytes(bytes)) return bytes;
  const chunks = parsePngChunks(bytes);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  for (const chunk of chunks) {
    const nul = chunk.type === "tEXt" ? chunk.data.indexOf(0) : -1;
    const isProvenance = nul >= 0 && textDecoder.decode(chunk.data.subarray(0, nul)) === "provenancex";
    if (!isProvenance) parts.push(bytes.subarray(chunk.start, chunk.end));
  }
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
}

async function bytesOf(input: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  assertByteLimit(input instanceof Blob ? input.size : input.byteLength, MAX_ASSET_BYTES, "Asset");
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  const bytes = new Uint8Array(await input.arrayBuffer());
  assertByteLimit(bytes.byteLength, MAX_ASSET_BYTES, "Asset");
  return bytes;
}

export async function sha256Raw(input: Blob | ArrayBuffer | Uint8Array): Promise<`0x${string}`> {
  const bytes = await bytesOf(input);
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable in this context.");
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return `0x${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export async function sha256Hex(file: Blob | ArrayBuffer | Uint8Array): Promise<`0x${string}`> {
  const bytes = await bytesOf(file);
  return sha256Raw(removeProvenanceTextChunk(bytes));
}

export function bytes32KeccakUtf8(value: string): `0x${string}` { return keccak256(toBytes(value)); }
