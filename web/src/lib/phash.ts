import { decodeSafeImage } from "@/lib/assetSafety";

const U64_MASK = (1n << 64n) - 1n;
export function hamming(a: bigint, b: bigint): number {
  let x = (a ^ b) & U64_MASK;
  let count = 0;
  while (x !== 0n) { x &= x - 1n; count++; }
  return count;
}

export async function dHash(input: Blob): Promise<bigint> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") throw new Error("Perceptual hashing requires a browser image decoder.");
  const bitmap = await decodeSafeImage(input);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 9; canvas.height = 8;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D is unavailable.");
    context.drawImage(bitmap, 0, 0, 9, 8);
    const { data } = context.getImageData(0, 0, 9, 8);
    const gray = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let hash = 0n;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4;
      hash = (hash << 1n) | (gray(i) > gray(i + 4) ? 1n : 0n);
    }
    return hash & U64_MASK;
  } finally { bitmap.close(); }
}

export function hammingDistance64(a: bigint, b: bigint): number { return hamming(a, b); }
