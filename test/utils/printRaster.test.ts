import { describe, expect, test } from "bun:test";
import { WHITE } from "@/types/color";
import { RasterScaling } from "@/types/session";
import { toPrintRaster } from "@/utils/printRaster";

function solid(width: number, height: number, rgba: number[]) {
  return { width, height, data: Uint8Array.from({ length: width * height * 4 }, (_, i) => rgba[i % 4] ?? 0) };
}

/** RGB pixels, all of one color */
function solidRgb(width: number, height: number, rgb: number[]) {
  return Uint8Array.from({ length: width * height * 3 }, (_, i) => rgb[i % 3] ?? 0);
}

describe("toPrintRaster", () => {
  test("flattens translucent pixels onto the background", async () => {
    const halfRed = solid(1, 1, [255, 0, 0, 128]);
    const { data } = await toPrintRaster(halfRed, { width: 1, height: 1 }, WHITE, RasterScaling.Lanczos);
    expect([...data]).toEqual([255, 127, 127]);
  });

  test("resamples to exactly the target size, as opaque RGB", async () => {
    const { width, height, data } = await toPrintRaster(
      solid(4, 4, [10, 20, 30, 255]),
      { width: 10, height: 7 },
      WHITE,
      RasterScaling.Lanczos
    );

    expect({ width, height }).toEqual({ width: 10, height: 7 });
    expect(data).toEqual(solidRgb(10, 7, [10, 20, 30]));
  });

  test("scales with nearest neighbor without mixing colors", async () => {
    // Red and blue side by side, doubled
    const pixels = { width: 2, height: 1, data: Uint8Array.from([255, 0, 0, 255, 0, 0, 255, 255]) };
    const { width, height, data } = await toPrintRaster(pixels, { width: 4, height: 2 }, WHITE, RasterScaling.Nearest);

    expect({ width, height }).toEqual({ width: 4, height: 2 });
    const row = [255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255];
    expect([...data]).toEqual([...row, ...row]);
  });

  test("keeps the original pixels at their own size, still flattened", async () => {
    const { width, height, data } = await toPrintRaster(
      solid(4, 4, [255, 0, 0, 128]),
      { width: 10, height: 7 },
      WHITE,
      RasterScaling.Original
    );

    expect({ width, height }).toEqual({ width: 4, height: 4 });
    expect(data).toEqual(solidRgb(4, 4, [255, 127, 127]));
  });
});
