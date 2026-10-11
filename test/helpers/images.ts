import { encode as encodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";

/**
 * Synthetic images for tests, built without a DOM or canvas.
 */

type Rgba = [number, number, number, number];

/** 8-bit RGBA pixels, all of one color */
function solidPixels(width: number, height: number, rgba: Rgba): Buffer {
  return Buffer.alloc(width * height * 4, Buffer.from(rgba));
}

/** A solid-color RGBA PNG */
export function pngBytes(width: number, height: number, rgba: Rgba): Uint8Array {
  const png = new PNG({ width, height });
  png.data = solidPixels(width, height, rgba);
  // A copy, as pdf-lib reads a Buffer's underlying memory from its start
  return Uint8Array.from(PNG.sync.write(png));
}

/** A solid-color JPEG; JPEG has no alpha, so it is always opaque */
export function jpegBytes(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const { data } = encodeJpeg({ width, height, data: solidPixels(width, height, [...rgb, 255]) }, 95);
  return Uint8Array.from(data);
}

/** Images as the app stores them */
export function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
