import { describe, expect, test } from "bun:test";
import { PDFDocument, PrintScaling } from "pdf-lib";
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

const HORIZONTAL_BACKS = { defaultBackId: "jpeg", mirror: MirrorAxis.Horizontal };

function card(imageId: string, count = 1): Card {
  return { id: imageId, name: imageId, count, imageId };
}

async function generate(
  cards: Card[],
  {
    backs,
    template = TEMPLATE,
    basePdf,
  }: { backs?: typeof HORIZONTAL_BACKS | undefined; template?: Template; basePdf?: string } = {}
): Promise<Uint8Array> {
  return await generatePdf({
    template,
    cards,
    getImage: (id) => (IMAGES[id] ? { name: id, data: IMAGES[id] } : undefined),
    getPdf: () => (basePdf ? { name: "base.pdf", data: basePdf } : undefined),
    backs,
  });
}

/** What a promise rejects with; fails when it resolves instead */
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return await promise.then(
    () => {
      throw new Error("Expected a rejection");
    },
    (error: unknown) => error
  );
}

describe("generatePdf", () => {
  test("lays out one page per full set of slots, at the template page size", async () => {
    const { pages } = await inspectPdf(await generate([card("opaque", 3)]));

    expect(pages.map((page) => page.images.length)).toEqual([2, 1]);
    expect(pages[0]?.widthMm).toBeCloseTo(215.9, 5);
    expect(pages[0]?.heightMm).toBeCloseTo(279.4, 5);
  });

  test("places cards at the card size, fronts and mirrored backs alike", async () => {
    for (const backs of [undefined, HORIZONTAL_BACKS]) {
      const { pages } = await inspectPdf(await generate([card("opaque")], { backs }));
      expect(pages[0]?.images[0]?.placedWidthMm).toBeCloseTo(63.5, 5);
      expect(pages[0]?.images[0]?.placedHeightMm).toBeCloseTo(88.9, 5);
    }
  });

  test("embeds each distinct image once, however many cards show it", async () => {
    for (const backs of [undefined, HORIZONTAL_BACKS]) {
      const { pages } = await inspectPdf(await generate([card("opaque", 2), card("alpha", 2)], { backs }));
      const ids = pages.flatMap((page) => page.images.map((image) => image.id));
      expect(ids).toHaveLength(4);
      expect(new Set(ids).size).toBe(backs ? 1 : 2);
    }
  });

  test("asks viewers to print at actual size", async () => {
    for (const backs of [undefined, HORIZONTAL_BACKS]) {
      const doc = await PDFDocument.load(await generate([card("opaque")], { backs }));
      expect(doc.catalog.getViewerPreferences()?.getPrintScaling()).toBe(PrintScaling.None);
    }
  });

  test("refuses images it cannot print, rather than leaving their slot blank", async () => {
    expect(await rejection(generate([card("svg")]))).toHaveProperty(
      "message",
      'Cannot print "svg": image/svg+xml images are not supported'
    );
  });

  test("refuses a base PDF whose page differs from the template's", async () => {
    const a4 = await PDFDocument.create();
    a4.addPage([595.28, 841.89]);
    const basePdf = dataUrl("application/pdf", await a4.save());
    const template = { ...TEMPLATE, cricut: { basePdfId: "base", cricutUrl: undefined } };

    expect(await rejection(generate([card("opaque")], { template, basePdf }))).toHaveProperty(
      "message",
      'The base PDF "base.pdf" is 210.0×297.0mm, but the template page is Letter (215.9×279.4mm)'
    );
  });

  // Documents current behavior that the print-quality work will change

  test("embeds translucent PNGs with an SMask", async () => {
    const { pages } = await inspectPdf(await generate([card("alpha")]));
    expect(pages[0]?.images[0]?.hasSMask).toBe(true);
  });

  test("embeds images at their source resolution", async () => {
    const { pages } = await inspectPdf(await generate([card("opaque")]));
    // 250 pixels over 2.5in
    expect(pages[0]?.images[0]?.ppiX).toBeCloseTo(100, 5);
  });
});
