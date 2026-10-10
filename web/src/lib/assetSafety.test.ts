import { describe, expect, it } from "vitest";
import {
  assertByteLimit,
  assertImageDimensions,
  MAX_ASSET_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  MAX_METADATA_JSON_BYTES,
  readBoundedResponse,
  readImageDimensions,
} from "@/lib/assetSafety";

describe("asset safety boundaries", () => {
  it("accepts the configured file and metadata limits and rejects the next byte", () => {
    expect(() => assertByteLimit(MAX_ASSET_BYTES, MAX_ASSET_BYTES, "Asset")).not.toThrow();
    expect(() => assertByteLimit(MAX_ASSET_BYTES + 1, MAX_ASSET_BYTES, "Asset")).toThrow(/size limit/);
    expect(() => assertByteLimit(MAX_METADATA_JSON_BYTES, MAX_METADATA_JSON_BYTES, "Metadata JSON")).not.toThrow();
    expect(() => assertByteLimit(MAX_METADATA_JSON_BYTES + 1, MAX_METADATA_JSON_BYTES, "Metadata JSON")).toThrow(/size limit/);
  });

  it("caps decoded image axes and total pixel count", () => {
    expect(() => assertImageDimensions(MAX_IMAGE_DIMENSION, Math.floor(MAX_IMAGE_PIXELS / MAX_IMAGE_DIMENSION))).not.toThrow();
    expect(() => assertImageDimensions(MAX_IMAGE_DIMENSION + 1, 1)).toThrow(/safety limit/);
    expect(() => assertImageDimensions(5000, 5000)).toThrow(/safety limit/);
    expect(() => assertImageDimensions(0, 1)).toThrow(/safety limit/);
  });

  it("rejects oversized PNG dimensions from the header before decode", () => {
    const header = new Uint8Array(24);
    header.set([137, 80, 78, 71], 0);
    const view = new DataView(header.buffer);
    view.setUint32(16, 5000); view.setUint32(20, 5000);
    expect(() => readImageDimensions(header, "image/png")).toThrow(/safety limit/);
    view.setUint32(16, 4000); view.setUint32(20, 4000);
    expect(readImageDimensions(header, "image/png")).toEqual({ width: 4000, height: 4000 });
  });

  it("bounds remote response streams even when content-length is absent", async () => {
    const chunks = [new Uint8Array(8 * 1024), new Uint8Array(5 * 1024)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); },
    });
    await expect(readBoundedResponse(new Response(body), 12 * 1024, "Metadata JSON")).rejects.toThrow(/12 KB size limit/);
  });

  it("rejects an oversized advertised response before reading its body", async () => {
    const response = new Response(new ReadableStream<Uint8Array>(), { headers: { "content-length": "262145" } });
    await expect(readBoundedResponse(response, MAX_METADATA_JSON_BYTES, "Metadata JSON")).rejects.toThrow(/size limit/);
  });

  it("accepts a response exactly at its byte ceiling", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(12 * 1024)); controller.close(); } });
    expect((await readBoundedResponse(new Response(body), 12 * 1024, "Metadata JSON")).byteLength).toBe(12 * 1024);
  });
});
