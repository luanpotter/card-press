import { describe, expect, test } from "bun:test";
import { PageSize } from "@/types/page";
import type { Template } from "@/types/template";
import { CardFit } from "@/types/session";
import { fittedSize, pageMegapixels, targetPixels } from "@/utils/printResolution";

describe("targetPixels", () => {
  test("prints the physical size at exactly the given resolution", () => {
    // 2.5×3.5in
    expect(targetPixels({ width: 63.5, height: 88.9 }, 600)).toEqual({ width: 1500, height: 2100 });
  });

  test("rounds to whole pixels", () => {
    // MTG cards are 63×88mm, about 2.48×3.46in
    expect(targetPixels({ width: 63, height: 88 }, 600)).toEqual({ width: 1488, height: 2079 });
  });
});

describe("fittedSize", () => {
  test("stretches to the slot, or fits whole at the image's own ratio", () => {
    const slot = { width: 63.5, height: 88.9 };
    expect(fittedSize({ width: 300, height: 100 }, slot, CardFit.Stretch)).toEqual(slot);
    // Wide: as wide as the slot; tall: as tall
    expect(fittedSize({ width: 300, height: 100 }, slot, CardFit.Fit)).toEqual({ width: 63.5, height: 63.5 / 3 });
    expect(fittedSize({ width: 100, height: 400 }, slot, CardFit.Fit)).toEqual({ width: 88.9 / 4, height: 88.9 });
  });
});

describe("pageMegapixels", () => {
  test("counts every slot of the page", () => {
    const template: Template = {
      id: "test",
      name: "Test",
      pageSize: PageSize.Letter,
      cardSize: { width: 63.5, height: 88.9 },
      slots: Array.from({ length: 9 }, () => ({ x: 0, y: 0 })),
      guidelines: [],
      cricut: undefined,
    };

    expect(pageMegapixels(template, 600)).toBeCloseTo((9 * 1500 * 2100) / 1e6, 5);
  });
});
