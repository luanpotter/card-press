import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasmUrl from "@resvg/resvg-wasm/index_bg.wasm" with { type: "file" };
import { type Rgb, rgbToHex } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import type { RgbaPixels } from "@/utils/printRaster";

// Bundled, the import is a URL relative to the page; under Bun (in tests), a file path
const WASM_URL = new URL(wasmUrl, typeof location === "undefined" ? "file://" : location.href);

let loading: Promise<void> | undefined;

/** Load resvg's WebAssembly, once; a failed load is retried next time */
export function loadResvg(): Promise<void> {
  loading ??= initWasm(fetch(WASM_URL)).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/**
 * Render an SVG with resvg, which draws the same in every browser, onto an opaque background.
 *
 * resvg only scales uniformly, so the SVG is drawn just large enough to cover the target size on both axes:
 * a mismatched aspect ratio is then only ever scaled down to the target, never up.
 */
export async function renderSvg(svg: Uint8Array, target: Dimension, background: Rgb): Promise<RgbaPixels> {
  await loadResvg();

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
