import { dHash } from "@/lib/phash";
import { isPng } from "@/lib/pngMeta";
import { assertSafeAssetFile, decodeSafeImage, readBoundedBlob, readImageDimensions } from "@/lib/assetSafety";
export type PreparedAsset = { file: File; perceptualHash: bigint; isImage: boolean };

export async function prepareAsset(file: File): Promise<PreparedAsset> {
  assertSafeAssetFile(file);
  if (!file.type.startsWith("image/")) return { file, perceptualHash: 0n, isImage: false };
  const bytes = await readBoundedBlob(file);
  readImageDimensions(bytes, file.type.toLowerCase());
  if (await isPng(bytes)) return { file, perceptualHash: await dHash(file), isImage: true };
  if (typeof document === "undefined") throw new Error("Image conversion requires a browser.");
  const bitmap = await decodeSafeImage(file);
  try {
    const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable.");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG conversion failed.")), "image/png"));
    const converted = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png", lastModified: file.lastModified });
    return { file: converted, perceptualHash: await dHash(converted), isImage: true };
  } finally { bitmap.close(); }
}
