import { initWasm, type InitInput, Resvg } from "@resvg/resvg-wasm";
import { type Rgb, rgbToHex } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import type { RgbaPixels } from "@/utils/printRaster";

let loading: Promise<void> | undefined;

/** Load resvg's WebAssembly, once per thread; a failed load is retried next time */
export function initResvg(wasm: InitInput): Promise<void> {
  loading ??= initWasm(wasm).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/**
 * Render an SVG with resvg, which draws the same in every browser, onto an opaque background.
 * resvg must be loaded first, with initResvg.
 *
 * resvg only scales uniformly, so the SVG is drawn just large enough to cover the target size on both axes:
 * a mismatched aspect ratio is then only ever scaled down to the target, never up.
 */
export function renderSvg(svg: Uint8Array, target: Dimension, background: Rgb): RgbaPixels {
  const original = new Resvg(svg);
  const zoom = Math.max(target.width / original.width, target.height / original.height);
  original.free();

  // resvg leaves translucent pixels premultiplied; on an opaque background, there are none
  const resvg = new Resvg(svg, { fitTo: { mode: "zoom", value: zoom }, background: rgbToHex(background) });
  try {
    const image = resvg.render();
    const pixels = { width: image.width, height: image.height, data: image.pixels };
    image.free();
    return pixels;
  } finally {
    resvg.free();
  }
}
