import type { InitInput } from "@resvg/resvg-wasm";
import type { Rgb } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import type { CardFit, RasterScaling } from "@/types/session";
import { decodeImage } from "@/utils/decodeImage";
import { deflate } from "@/utils/deflate";
import { type RgbaPixels, toPrintRaster } from "@/utils/printRaster";
import { fittedPixels } from "@/utils/printResolution";
import { initResvg, renderSvg } from "@/utils/renderSvg";

/**
 * Turning a card image into the pixels printed for it.
 * It needs no page, so it runs in the image workers (and in tests), keeping the page responsive.
 */

/** How card images are rendered for print, the same for every card of a document */
export interface RasterRendering {
  /** Size of a card slot in pixels, at the print resolution */
  sizePx: Dimension;
  /** Color that images are flattened onto */
  background: Rgb;
  rasterScaling: RasterScaling;
  fit: CardFit;
}

/** What a card is rasterized from */
export type RasterSource =
  /** A PNG, JPEG or WebP data URL */
  | { kind: "image"; dataUrl: string }
  /** An SVG, rendered by resvg from its compiled WebAssembly */
  | { kind: "svg"; svg: Uint8Array; resvg: InitInput }
  /** Pixels already decoded elsewhere, such as SVGs rendered by the page, which workers cannot do */
  | { kind: "pixels"; pixels: RgbaPixels };

/** Opaque RGB pixels at 8 bits per channel, zlib-compressed for a PDF FlateDecode image stream */
export interface CardRaster {
  width: number;
  height: number;
  data: Uint8Array;
}

async function sourcePixels(source: RasterSource, rendering: RasterRendering): Promise<RgbaPixels> {
  const sizeFor = (own: Dimension) => fittedPixels(own, rendering.sizePx, rendering.fit);
  switch (source.kind) {
    case "image":
      return await decodeImage(source.dataUrl, sizeFor);
    case "svg":
      await initResvg(source.resvg);
      return renderSvg(source.svg, sizeFor, rendering.background);
    case "pixels":
      return source.pixels;
  }
}

/**
 * Rasterize a card for print: opaque, at the print resolution unless kept at its own, losslessly compressed.
 * Printers resample images to their own grid and flatten transparency, both badly, so neither is left to them.
 * A fitted card is rasterized at the size it prints at, rather than its slot's.
 */
export async function rasterizeCard(source: RasterSource, rendering: RasterRendering): Promise<CardRaster> {
  const { sizePx, background, rasterScaling, fit } = rendering;
  const pixels = await sourcePixels(source, rendering);
  const rgb = await toPrintRaster(pixels, fittedPixels(pixels, sizePx, fit), background, rasterScaling);
  return { width: rgb.width, height: rgb.height, data: await deflate(rgb.data) };
}
