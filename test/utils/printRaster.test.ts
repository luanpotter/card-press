import { describe, expect, test } from "bun:test";
import { WHITE } from "@/types/color";
import { toPrintRaster } from "@/utils/printRaster";

function solid(width: number, height: number, rgba: number[]) {
  return { width, height, data: Uint8Array.from({ length: width * height * 4 }, (_, i) => rgba[i % 4] ?? 0) };
}

describe("toPrintRaster", () => {
  test("flattens translucent pixels onto the background", async () => {
    const halfRed = solid(1, 1, [255, 0, 0, 128]);
    const { data } = await toPrintRaster(halfRed, { width: 1, height: 1 }, WHITE);
    expect([...data]).toEqual([255, 127, 127]);
  });

  test("resamples to exactly the target size, as opaque RGB", async () => {
    const { width, height, data } = await toPrintRaster(
      solid(4, 4, [10, 20, 30, 255]),
      { width: 10, height: 7 },
      WHITE
    );

    expect({ width, height }).toEqual({ width: 10, height: 7 });
    expect(data).toEqual(Uint8Array.from({ length: 10 * 7 * 3 }, (_, i) => [10, 20, 30][i % 3] ?? 0));
  });
});
