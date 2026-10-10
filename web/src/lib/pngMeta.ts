export type PassportMetadata = { passportId: `0x${string}`; contract: `0x${string}`; chainId: number };
const SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const decoder = new TextDecoder("latin1");
const encoder = new TextEncoder();
import { parsePngChunks, pngCrc32 } from "@/lib/png";
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encoder.encode(type); const out = new Uint8Array(data.length + 12); const view = new DataView(out.buffer);
  view.setUint32(0, data.length); out.set(typeBytes, 4); out.set(data, 8);
  view.setUint32(8 + data.length, pngCrc32(out.subarray(4, 8 + data.length)));
  return out;
}
function provenanceValue(data: Uint8Array): string | undefined {
  const nul = data.indexOf(0);
  return nul >= 0 && decoder.decode(data.subarray(0, nul)) === "provenancex" ? decoder.decode(data.subarray(nul + 1)) : undefined;
}
function metadataFrom(value: string): PassportMetadata | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (typeof parsed.passportId !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(parsed.passportId) ||
        typeof parsed.contract !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(parsed.contract) ||
        !Number.isSafeInteger(parsed.chainId) || Number(parsed.chainId) < 1) return null;
    return { passportId: parsed.passportId as `0x${string}`, contract: parsed.contract as `0x${string}`, chainId: Number(parsed.chainId) };
  } catch { return null; }
}
export function readPassportMetadata(input: Uint8Array): PassportMetadata | null {
  const bytes = new Uint8Array(input); const chunks = parsePngChunks(bytes);
  for (const item of chunks) if (item.type === "tEXt") {
    const value = provenanceValue(item.data);
    if (value !== undefined) return metadataFrom(value);
  }
  return null;
}
export function writePassportMetadata(input: Uint8Array, metadata: PassportMetadata): Uint8Array {
  const bytes = new Uint8Array(input); const chunks = parsePngChunks(bytes);
  if (!metadataFrom(JSON.stringify(metadata))) throw new Error("Invalid media record metadata.");
  const text = concat([encoder.encode("provenancex\0"), encoder.encode(JSON.stringify(metadata))]);
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]; let added = false;
  for (const item of chunks) {
    if (item.type === "tEXt" && provenanceValue(item.data) !== undefined) continue;
    if (item.type === "IEND" && !added) { parts.push(chunk("tEXt", text)); added = true; }
    parts.push(bytes.subarray(item.start, item.end));
  }
  return concat(parts);
}
export function isPng(input: Blob | Uint8Array): Promise<boolean> | boolean {
  if (input instanceof Uint8Array) return SIG.every((v, i) => input[i] === v);
  return input.slice(0, 8).arrayBuffer().then((b) => isPng(new Uint8Array(b)));
}
