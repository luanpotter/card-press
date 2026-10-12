import type { Dimension } from "@/types/dimension";
import type { RgbaPixels } from "@/utils/printRaster";

export enum ImageFormat {
  Png = "PNG",
  Jpeg = "JPEG",
  WebP = "WebP",
  Svg = "SVG",
}

export const FORMATS_BY_MIME_TYPE = new Map([
  ["image/png", ImageFormat.Png],
  ["image/jpeg", ImageFormat.Jpeg],
  ["image/jpg", ImageFormat.Jpeg],
  ["image/webp", ImageFormat.WebP],
  ["image/svg+xml", ImageFormat.Svg],
]);

export function mimeTypeOf(dataUrl: string): string {
  return dataUrl.slice("data:".length, dataUrl.indexOf(";"));
}

/** The format of an image data URL, unless it cannot be decoded. */
export function imageFormatOf(dataUrl: string): ImageFormat | undefined {
  return FORMATS_BY_MIME_TYPE.get(mimeTypeOf(dataUrl));
}

export function isDecodable(dataUrl: string): boolean {
  return imageFormatOf(dataUrl) !== undefined;
}

/** Read back what was drawn on a fresh canvas of the given size */
function drawPixels(
  width: number,
  height: number,
  draw: (context: OffscreenCanvasRenderingContext2D) => void
): RgbaPixels {
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) {
    throw new Error("Failed to get canvas context");
  }
  draw(context);
  const { data } = context.getImageData(0, 0, width, height);
  return { width, height, data: new Uint8Array(data.buffer) };
}

/**
 * Render an SVG with the browser's own renderer, at exactly the size chosen from its own.
 * Drawn straight at print size, its shapes stay sharp instead of being resampled from a smaller raster.
 */
async function renderSvg(dataUrl: string, sizeFor: (own: Dimension) => Dimension): Promise<RgbaPixels> {
  // createImageBitmap does not take SVGs, but an image element renders them, with the system fonts
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const size = sizeFor({ width: image.naturalWidth, height: image.naturalHeight });
  return drawPixels(size.width, size.height, (context) => context.drawImage(image, 0, 0, size.width, size.height));
}

/**
 * Decode an image data URL into its pixels.
 * Rasters come out at their own size, and vectors are rendered at the size chosen from their own.
 */
export async function decodeImage(dataUrl: string, sizeFor: (own: Dimension) => Dimension): Promise<RgbaPixels> {
  if (imageFormatOf(dataUrl) === ImageFormat.Svg) {
    return await renderSvg(dataUrl, sizeFor);
  }

  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: "none" });
  try {
    return drawPixels(bitmap.width, bitmap.height, (context) => context.drawImage(bitmap, 0, 0));
  } finally {
    bitmap.close();
  }
}
