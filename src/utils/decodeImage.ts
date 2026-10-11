import type { RgbaPixels } from "@/utils/printRaster";

/** Image formats the browser decodes for us */
const DECODABLE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export function mimeTypeOf(dataUrl: string): string {
  return dataUrl.slice("data:".length, dataUrl.indexOf(";"));
}

export function isDecodable(dataUrl: string): boolean {
  return DECODABLE_TYPES.has(mimeTypeOf(dataUrl));
}

/**
 * Decode an image data URL into its pixels, at the image's own size
 */
export async function decodeImage(dataUrl: string): Promise<RgbaPixels> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none" });
  try {
    const { width, height } = bitmap;
    const context = new OffscreenCanvas(width, height).getContext("2d");
    if (!context) {
      throw new Error("Failed to get canvas context");
    }
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, width, height);
    return { width, height, data: new Uint8Array(data.buffer) };
  } finally {
    bitmap.close();
  }
}
