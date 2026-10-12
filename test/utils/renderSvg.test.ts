import { describe, expect, test } from "bun:test";
import wasmPath from "@resvg/resvg-wasm/index_bg.wasm" with { type: "file" };
import { WHITE } from "@/types/color";
import { initResvg, renderSvg } from "@/utils/renderSvg";
import { SVG_BYTES } from "@test/helpers/images";

describe("renderSvg", () => {
  test("covers the target on both axes, opaque on the background", async () => {
    await initResvg(await Bun.file(wasmPath).arrayBuffer());
    // A square SVG for a 15×21 card: the height decides the scale
    const { width, height, data } = renderSvg(SVG_BYTES, () => ({ width: 15, height: 21 }), WHITE);

    expect({ width, height }).toEqual({ width: 21, height: 21 });
    // Half transparent red on white, with no premultiplied darkening
    expect([...data.slice(0, 4)]).toEqual([255, 127, 127, 255]);
  });
});
