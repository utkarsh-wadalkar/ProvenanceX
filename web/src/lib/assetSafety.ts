export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_METADATA_JSON_BYTES = 256 * 1024;
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 24_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function assertByteLimit(size: number, maximum: number, label = "File"): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > maximum) {
    throw new Error(`${label} exceeds the ${Math.floor(maximum / 1024 / 1024)} MB size limit.`);
  }
}

export function assertImageDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) {
    throw new Error(`Image dimensions exceed the ${MAX_IMAGE_DIMENSION}px / ${MAX_IMAGE_PIXELS.toLocaleString()} pixel safety limit.`);
  }
}

export function assertSafeAssetFile(file: File): void {
  assertByteLimit(file.size, MAX_ASSET_BYTES, "Asset");
  if (file.type.startsWith("image/") && !ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Use a PNG, JPEG, WebP, or GIF image. Other files can still be registered as files.");
  }
}

export async function readBoundedBlob(blob: Blob, maximum = MAX_ASSET_BYTES, label = "File"): Promise<Uint8Array> {
  assertByteLimit(blob.size, maximum, label);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assertByteLimit(bytes.byteLength, maximum, label);
  return bytes;
}

function u24le(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

export function readImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  let width = 0; let height = 0;
  if (mimeType === "image/png" && bytes.length >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    width = view.getUint32(16); height = view.getUint32(20);
  } else if (mimeType === "image/gif" && bytes.length >= 10 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70) {
    width = bytes[6] | (bytes[7] << 8); height = bytes[8] | (bytes[9] << 8);
  } else if (mimeType === "image/webp" && bytes.length >= 30 && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
    const kind = String.fromCharCode(...bytes.subarray(12, 16));
    if (kind === "VP8X") { width = 1 + u24le(bytes, 24); height = 1 + u24le(bytes, 27); }
    else if (kind === "VP8 " && bytes.length >= 30) { width = ((bytes[27] << 8) | bytes[26]) & 0x3fff; height = ((bytes[29] << 8) | bytes[28]) & 0x3fff; }
    else if (kind === "VP8L" && bytes.length >= 25) { width = 1 + bytes[21] + ((bytes[22] & 0x3f) << 8); height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10); }
  } else if (mimeType === "image/jpeg" && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        height = (bytes[offset + 5] << 8) | bytes[offset + 6]; width = (bytes[offset + 7] << 8) | bytes[offset + 8]; break;
      }
      offset += 2 + length;
    }
  }
  if (!width || !height) throw new Error("Image dimensions could not be safely read from the file.");
  assertImageDimensions(width, height);
  return { width, height };
}

export async function decodeSafeImage(blob: Blob): Promise<ImageBitmap> {
  assertByteLimit(blob.size, MAX_ASSET_BYTES, "Image");
  const bytes = await readBoundedBlob(blob);
  readImageDimensions(bytes, blob.type.toLowerCase());
  if (typeof createImageBitmap === "undefined") throw new Error("A browser image decoder is required.");
  const bitmap = await createImageBitmap(blob);
  try { assertImageDimensions(bitmap.width, bitmap.height); return bitmap; }
  catch (error) { bitmap.close(); throw error; }
}

export async function readBoundedResponse(response: Response, maximum: number, label: string): Promise<Uint8Array> {
  const advertised = response.headers.get("content-length");
  if (advertised && /^\d+$/.test(advertised)) {
    if (Number(advertised) > maximum) void response.body?.cancel().catch(() => undefined);
    assertByteLimit(Number(advertised), maximum, label);
  }
  if (!response.body) throw new Error(`${label} response has no readable body.`);
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) { void reader.cancel().catch(() => undefined); throw new Error(`${label} exceeds the ${maximum < 1024 * 1024 ? `${Math.ceil(maximum / 1024)} KB` : `${Math.floor(maximum / 1024 / 1024)} MB`} size limit.`); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

export async function fetchBoundedResource(url: string, options: { maximum: number; maximumForType?: (contentType: string) => number; timeoutMs?: number; label: string; allowedTypes: readonly string[] }): Promise<{ bytes: Uint8Array; contentType: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("Remote previews require a public HTTPS URL.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  try {
    const response = await fetch(parsed, { signal: controller.signal, credentials: "omit", redirect: "follow" });
    if (!response.ok) throw new Error(`${options.label} request failed (${response.status}).`);
    const finalUrl = new URL(response.url || parsed.href);
    if (finalUrl.protocol !== "https:") throw new Error("Remote preview redirected outside HTTPS.");
    const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!options.allowedTypes.some((type) => contentType === type || (type.endsWith("/*") && contentType.startsWith(type.slice(0, -1))))) {
      throw new Error(`${options.label} has an unsupported content type.`);
    }
    return { bytes: await readBoundedResponse(response, options.maximumForType?.(contentType) ?? options.maximum, options.label), contentType };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${options.label} request timed out.`);
    throw error;
  } finally { clearTimeout(timer); }
}

function publicHttpsUrl(value: string): string {
  if (value.length > 2048) throw new Error("Preview URL is too long.");
  const candidate = value.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${value.slice(7)}` : value;
  const url = new URL(candidate);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Previews require a public HTTPS or IPFS URL.");
  return url.href;
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const { bytes, contentType } = await fetchBoundedResource(url, {
    maximum: MAX_ASSET_BYTES, timeoutMs: 8000, label: "Image preview", allowedTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  readImageDimensions(bytes, contentType);
  const blob = new Blob([toArrayBuffer(bytes)], { type: contentType });
  const bitmap = await decodeSafeImage(blob); bitmap.close();
  return blob;
}

/** Fetch optional public metadata and image previews with byte, type, dimension, and time limits. */
export async function fetchSafeAssetPreview(uri: string): Promise<string | null> {
  const url = publicHttpsUrl(uri);
  const allowedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  const first = await fetchBoundedResource(url, {
    maximum: MAX_ASSET_BYTES, maximumForType: (type) => type.startsWith("image/") ? MAX_ASSET_BYTES : MAX_METADATA_JSON_BYTES,
    timeoutMs: 8000, label: "Asset preview", allowedTypes: [...allowedImageTypes, "application/json", "application/ld+json"],
  });
  if (first.contentType.startsWith("image/")) {
    readImageDimensions(first.bytes, first.contentType);
    const blob = new Blob([toArrayBuffer(first.bytes)], { type: first.contentType });
    const bitmap = await decodeSafeImage(blob); bitmap.close();
    return URL.createObjectURL(blob);
  }
  assertByteLimit(first.bytes.byteLength, MAX_METADATA_JSON_BYTES, "Metadata JSON");
  let metadata: unknown;
  try { metadata = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(first.bytes)); }
  catch { throw new Error("Preview metadata is not valid JSON."); }
  const image = metadata && typeof metadata === "object" ? (metadata as { image?: unknown }).image : undefined;
  if (typeof image !== "string") return null;
  const imageUrl = publicHttpsUrl(image);
  const blob = await fetchImageBlob(imageUrl);
  return URL.createObjectURL(blob);
}
