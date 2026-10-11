import type { Dimension } from "@/types/dimension";
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
 * Raster on a full page of the template once every slot holds a card rendered at the given resolution
 */
export function pageMegapixels(template: Template, dpi: number): number {
  const { width, height } = targetPixels(template.cardSize, dpi);
  return (template.slots.length * width * height) / 1e6;
}
