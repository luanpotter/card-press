import type { Dimension } from "@/types/dimension";
import { CardFit } from "@/types/session";
import type { Template } from "@/types/template";

const MM_PER_INCH = 25.4;

/**
 * Beyond this much raster per page, printer drivers hit memory limits and fall back to crude resampling
 */
export const MAX_PAGE_MEGAPIXELS = 50;

/**
 * Pixel size that prints a physical size at exactly the given resolution
 */
export function targetPixels(sizeMm: Dimension, dpi: number): Dimension {
  return {
    width: Math.round((sizeMm.width / MM_PER_INCH) * dpi),
    height: Math.round((sizeMm.height / MM_PER_INCH) * dpi),
  };
}

/**
 * Size an image takes in its slot, in the slot's units: the whole slot, or as large as fits whole at its own ratio
 */
export function fittedSize(image: Dimension, slot: Dimension, fit: CardFit): Dimension {
  if (fit === CardFit.Stretch) {
    return slot;
  }
  const scale = Math.min(slot.width / image.width, slot.height / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

/**
 * Pixel size an image is printed at in a slot of the given pixel size, at least one pixel each way
 */
export function fittedPixels(image: Dimension, slotPx: Dimension, fit: CardFit): Dimension {
  const { width, height } = fittedSize(image, slotPx, fit);
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/**
 * Raster on a full page of the template once every slot holds a card rendered at the given resolution
 */
export function pageMegapixels(template: Template, dpi: number): number {
  const { width, height } = targetPixels(template.cardSize, dpi);
  return (template.slots.length * width * height) / 1e6;
}
