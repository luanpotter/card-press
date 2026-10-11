import { Pica } from "pica";
import type { Rgb } from "@/types/color";
import type { Dimension } from "@/types/dimension";

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
 * Drop the alpha channel of opaque pixels
 */
function toRgb({ width, height, data }: RgbaPixels): RgbPixels {
  const rgb = new Uint8Array(width * height * 3);
  for (let source = 0, target = 0; source < data.length; source += 4, target += 3) {
    rgb.set(data.subarray(source, source + 3), target);
  }
  return { width, height, data: rgb };
}

/**
 * Prepare an image for print: flattened onto the background (printers handle transparency badly)
 * and resampled with Lanczos to exactly the target size (rather than by the printer driver).
 */
export async function toPrintRaster(image: RgbaPixels, target: Dimension, background: Rgb): Promise<RgbPixels> {
  // Flattening first keeps the resampler from blending in the color of fully transparent pixels
  const flat = flatten(image, background);
  if (flat.width === target.width && flat.height === target.height) {
    return toRgb(flat);
  }

  const resized = await resampler.resizeBuffer({
    src: flat.data,
    width: flat.width,
    height: flat.height,
    toWidth: target.width,
    toHeight: target.height,
    filter: "lanczos3",
  });
  return toRgb({ width: target.width, height: target.height, data: resized });
}
