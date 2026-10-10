const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export type ParsedPngChunk = { type: string; start: number; end: number; data: Uint8Array };
export function isPngBytes(bytes: Uint8Array): boolean {
  return bytes.length >= PNG_SIGNATURE.length && PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}
export function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function parsePngChunks(bytes: Uint8Array): ParsedPngChunk[] {
  if (!isPngBytes(bytes)) throw new Error("Invalid PNG signature.");
  const chunks: ParsedPngChunk[] = [];
  let offset = PNG_SIGNATURE.length;
  let ended = false;
  while (offset < bytes.length) {
    if (chunks.length >= 100_000) throw new Error("PNG contains too many chunks.");
    if (offset + 12 > bytes.length) throw new Error("Malformed PNG: truncated chunk header.");
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const end = offset + 12 + length;
    if (end > bytes.length || end < offset) throw new Error("Malformed PNG: chunk exceeds file bounds.");
    const type = new TextDecoder("latin1").decode(bytes.subarray(offset + 4, offset + 8));
    if (!/^[A-Za-z]{4}$/.test(type)) throw new Error("Malformed PNG: invalid chunk type.");
    const crcOffset = offset + 8 + length;
    const expectedCrc = new DataView(bytes.buffer, bytes.byteOffset + crcOffset, 4).getUint32(0);
    const actualCrc = pngCrc32(bytes.subarray(offset + 4, crcOffset));
    if (actualCrc !== expectedCrc) throw new Error(`PNG CRC mismatch in ${type} chunk.`);
    const data = bytes.subarray(offset + 8, crcOffset);
    chunks.push({ type, start: offset, end, data });
    offset = end;
    if (type === "IEND") {
      if (length !== 0) throw new Error("Malformed PNG: IEND must be empty.");
      ended = true;
      break;
    }
  }
  if (!ended || offset !== bytes.length) throw new Error("Malformed PNG: missing IEND or trailing bytes.");
  if (chunks[0]?.type !== "IHDR" || chunks[0].data.length !== 13) throw new Error("Malformed PNG: invalid IHDR.");
  if (chunks.slice(1).some((chunk) => chunk.type === "IHDR")) throw new Error("Malformed PNG: duplicate IHDR.");
  return chunks;
}
