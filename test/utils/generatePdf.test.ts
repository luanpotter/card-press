import { describe, expect, test } from "bun:test";
import type { Card } from "@/types/session";
import type { Template } from "@/types/template";
import { MirrorAxis, PageSize } from "@/types/page";
import { generatePdf } from "@/utils/generatePdf";
import { dataUrl, jpegBytes, pngBytes, SVG_BYTES } from "@test/helpers/images";
import { inspectPdf } from "@test/helpers/inspectPdf";

const TEMPLATE: Template = {
  id: "test",
  name: "Test",
  pageSize: PageSize.Letter,
  cardSize: { width: 63.5, height: 88.9 }, // 2.5×3.5in
  slots: [
    { x: 10, y: 10 },
    { x: 80, y: 10 },
  ],
  guidelines: [],
  cricut: undefined,
};

const IMAGES: Record<string, string> = {
  alpha: dataUrl("image/png", pngBytes(250, 350, [255, 0, 0, 128])),
  opaque: dataUrl("image/png", pngBytes(250, 350, [0, 255, 0, 255])),
  jpeg: dataUrl("image/jpeg", jpegBytes(2, 2, [0x33, 0x66, 0x99])),
  svg: dataUrl("image/svg+xml", SVG_BYTES),
};

function card(imageId: string, count = 1): Card {
  return { id: imageId, name: imageId, count, imageId };
}

async function generate(cards: Card[], backs?: Parameters<typeof generatePdf>[0]["backs"]) {
  const bytes = await generatePdf({
    template: TEMPLATE,
    cards,
    getImage: (id) => (IMAGES[id] ? { name: id, data: IMAGES[id] } : undefined),
    getPdf: () => undefined,
    backs,
  });
  return await inspectPdf(bytes);
}

describe("generatePdf", () => {
  test("lays out one page per full set of slots, at the template page size", async () => {
    const { pages } = await generate([card("opaque", 3)]);

    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.widthMm).toBeCloseTo(215.9, 5);
      expect(page.heightMm).toBeCloseTo(279.4, 5);
    }
    expect(pages.map((page) => page.images.length)).toEqual([2, 1]);
  });

  test("places images at the card size, so ppi follows the source pixels", async () => {
    const { pages } = await generate([card("opaque")]);
    const image = pages[0]?.images[0];

    expect(image?.placedWidthMm).toBeCloseTo(63.5, 5);
    expect(image?.placedHeightMm).toBeCloseTo(88.9, 5);
    // 250 pixels over 2.5in
    expect(image?.ppiX).toBeCloseTo(100, 5);
    expect(image?.ppiY).toBeCloseTo(100, 5);
    expect(image?.filters).toEqual(["FlateDecode"]);
    expect(image?.hasSMask).toBe(false);
  });

  test("passes JPEGs through", async () => {
    const { pages } = await generate([card("jpeg")]);
    expect(pages[0]?.images[0]?.filters).toEqual(["DCTDecode"]);
  });

  // Documents current behavior that the print-quality work will change

  test("embeds translucent PNGs with an SMask", async () => {
    const { pages } = await generate([card("alpha")]);
    expect(pages[0]?.images[0]?.hasSMask).toBe(true);
    expect(pages[0]?.transparency).toHaveLength(1);
  });

  test("embeds the same image again for every copy", async () => {
    const { pages } = await generate([card("opaque", 2)]);
    const ids = new Set(pages[0]?.images.map((image) => image.id));
    expect(ids.size).toBe(2);
    expect(pages[0]?.rasterMegapixels).toBeCloseTo(2 * 0.0875, 5);
  });

  test("silently leaves SVG cards out", async () => {
    const { pages } = await generate([card("svg")]);
    expect(pages[0]?.images).toEqual([]);
  });

  test("keeps backs at the card size when mirroring the page", async () => {
    const { pages } = await generate([card("opaque")], { defaultBackId: "jpeg", mirror: MirrorAxis.Horizontal });
    const image = pages[0]?.images[0];

    expect(pages[0]?.images).toHaveLength(1);
    expect(image?.filters).toEqual(["DCTDecode"]);
    expect(image?.placedWidthMm).toBeCloseTo(63.5, 5);
    expect(image?.placedHeightMm).toBeCloseTo(88.9, 5);
  });
});
