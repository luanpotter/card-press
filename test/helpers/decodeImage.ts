import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import { mimeTypeOf } from "@/utils/decodeImage";
import type { RgbaPixels } from "@/utils/printRaster";

/**
 * Stand-in for the browser decoder (which needs createImageBitmap and a canvas), for PNGs and JPEGs
 */
export function decodeImage(dataUrl: string): Promise<RgbaPixels> {
  const bytes = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  const mimeType = mimeTypeOf(dataUrl);

  if (mimeType === "image/png") {
    const { width, height, data } = PNG.sync.read(bytes);
    return Promise.resolve({ width, height, data: Uint8Array.from(data) });
  }
  if (mimeType === "image/jpeg") {
    const { width, height, data } = decodeJpeg(bytes, { useTArray: true, formatAsRGBA: true });
    return Promise.resolve({ width, height, data });
  }
  return Promise.reject(new Error(`Cannot decode ${mimeType} in tests`));
}
