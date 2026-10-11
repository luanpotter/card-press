import { Pica } from "pica";
import type { Rgb } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import { RasterScaling } from "@/types/session";

/** Decoded pixels, 8 bits per channel, 4 channels (straight, not premultiplied, alpha) */
export interface RgbaPixels {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Opaque pixels, 8 bits per channel, 3 channels: the layout of a PDF DeviceRGB image */
export interface RgbPixels {
  width: number;
  height: number;
  data: Uint8Array;
}

// Raw buffers only, so no canvas or web workers: the same code runs in the browser and in tests
const resampler = new Pica({ features: ["js", "wasm"] });

/**
 * Composite pixels over an opaque background, as they would show on paper of that color
 */
function flatten({ width, height, data }: RgbaPixels, background: Rgb): RgbaPixels {
  const flat = new Uint8Array(data.length);
  const backdrop = [background.r, background.g, background.b];
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 255;
    for (let channel = 0; channel < 3; channel++) {
      const color = data[i + channel] ?? 0;
      flat[i + channel] = Math.round((color * alpha + (backdrop[channel] ?? 0) * (255 - alpha)) / 255);
    }
    flat[i + 3] = 255;
  }
  return { width, height, data: flat };
}

/**
 * Resize by taking, for each target pixel, the source pixel under its center: no new colors, hard edges kept
 */
function nearest({ width, height, data }: RgbaPixels, target: Dimension): RgbaPixels {
  const resized = new Uint8Array(target.width * target.height * 4);
  // The source column of each target column is the same on every row
  const sourceColumns = Array.from({ length: target.width }, (_, x) => Math.floor(((x + 0.5) * width) / target.width));

  // Byte by byte, as millions of subarray copies are an order of magnitude slower
  let output = 0;
  for (let y = 0; y < target.height; y++) {
    const sourceRow = Math.floor(((y + 0.5) * height) / target.height) * width;
    for (const column of sourceColumns) {
      const source = (sourceRow + column) * 4;
      for (let channel = 0; channel < 4; channel++) {
        resized[output++] = data[source + channel] ?? 0;
      }
    }
  }
  return { width: target.width, height: target.height, data: resized };
}

/**
 * Bring opaque pixels to the target size, as the scaling asks
 */
async function scale(flat: RgbaPixels, target: Dimension, scaling: RasterScaling): Promise<RgbaPixels> {
  if (scaling === RasterScaling.Original || (flat.width === target.width && flat.height === target.height)) {
    return flat;
  }
  if (scaling === RasterScaling.Nearest) {
    return nearest(flat, target);
  }

  const resized = await resampler.resizeBuffer({
    src: flat.data,
    width: flat.width,
    height: flat.height,
    toWidth: target.width,
    toHeight: target.height,
    filter: "lanczos3",
  });
  return { width: target.width, height: target.height, data: resized };
}

/**
 * Drop the alpha channel of opaque pixels
 */
function toRgb({ width, height, data }: RgbaPixels): RgbPixels {
  const rgb = new Uint8Array(width * height * 3);
  // Byte by byte, as millions of subarray copies are an order of magnitude slower
  for (let source = 0, target = 0; source < data.length; source += 4, target += 3) {
    rgb[target] = data[source] ?? 0;
    rgb[target + 1] = data[source + 1] ?? 0;
    rgb[target + 2] = data[source + 2] ?? 0;
  }
  return { width, height, data: rgb };
}

/**
 * Prepare an image for print: flattened onto the background (printers handle transparency badly)
 * and, unless kept at its own size, resampled to exactly the target size (rather than by the printer driver).
 */
export async function toPrintRaster(
  image: RgbaPixels,
  target: Dimension,
  background: Rgb,
  scaling: RasterScaling
): Promise<RgbPixels> {
  // Flattening first keeps the resampler from blending in the color of fully transparent pixels
  return toRgb(await scale(flatten(image, background), target, scaling));
}
