import { type CardRaster, type RasterRendering, type RasterSource, rasterizeCard } from "@/utils/cardRaster";

/**
 * Image worker: rasterizes cards, one at a time, off the page.
 * Built on its own by scripts/generate-assets.sh, as Bun's bundler does not split workers out of the app.
 */

export interface RasterRequest {
  source: RasterSource;
  rendering: RasterRendering;
}

export type RasterResponse = { raster: CardRaster } | { error: string };

self.onmessage = ({ data: { source, rendering } }: MessageEvent<RasterRequest>) => {
  rasterizeCard(source, rendering).then(
    (raster) => self.postMessage({ raster } satisfies RasterResponse, { transfer: [raster.data.buffer] }),
    (error: unknown) =>
      self.postMessage({ error: error instanceof Error ? error.message : String(error) } satisfies RasterResponse)
  );
};

// Tells the page it loaded, its first message
self.postMessage("ready");
