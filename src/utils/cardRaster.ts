import type { InitInput } from "@resvg/resvg-wasm";
import type { Rgb } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import type { RasterScaling } from "@/types/session";
import { decodeImage } from "@/utils/decodeImage";
import { type RgbaPixels, toPrintRaster } from "@/utils/printRaster";
import { initResvg, renderSvg } from "@/utils/renderSvg";

/**
 * Turning a card image into the pixels printed for it.
 * It needs no page, so it runs in the image workers (and in tests), keeping the page responsive.
 */

/** How card images are rendered for print, the same for every card of a document */
export interface RasterRendering {
  /** Size of a card in pixels, at the print resolution */
  sizePx: Dimension;
  /** Color that images are flattened onto */
  background: Rgb;
  rasterScaling: RasterScaling;
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

/**
 * Compress bytes into a PDF FlateDecode stream (zlib format).
 * The browser's native zlib is about 3× faster than pdf-lib's JavaScript one, for files 1-2% bigger.
 */
async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const compressed = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(compressed).arrayBuffer());
}

async function sourcePixels(source: RasterSource, { sizePx, background }: RasterRendering): Promise<RgbaPixels> {
  switch (source.kind) {
    case "image":
      return await decodeImage(source.dataUrl, sizePx);
    case "svg":
      await initResvg(source.resvg);
      return renderSvg(source.svg, sizePx, background);
    case "pixels":
      return source.pixels;
  }
}

/**
 * Rasterize a card for print: opaque, at the print resolution unless kept at its own, losslessly compressed.
 * Printers resample images to their own grid and flatten transparency, both badly, so neither is left to them.
 */
export async function rasterizeCard(source: RasterSource, rendering: RasterRendering): Promise<CardRaster> {
  const { sizePx, background, rasterScaling } = rendering;
  const rgb = await toPrintRaster(await sourcePixels(source, rendering), sizePx, background, rasterScaling);
  return { width: rgb.width, height: rgb.height, data: await deflate(rgb.data) };
}
