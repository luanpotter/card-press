import { describe, expect, mock, test } from "bun:test";
import { Window } from "happy-dom";
import { PDFDocument, PrintScaling } from "pdf-lib";
import { CardFit, RasterScaling, SvgOutput, type Card } from "@/types/session";
import type { Template } from "@/types/template";
import { MirrorAxis, PageSize } from "@/types/page";
import { rasterizeCard } from "@/utils/cardRaster";
import * as decoding from "@/utils/decodeImage";
import { type GeneratedPdf, generatePdf } from "@/utils/generatePdf";
import * as lazyModules from "@/utils/lazyModules";
import type { RasterWorkers } from "@/utils/rasterWorkers";
import { decodeImage } from "@test/helpers/decodeImage";
import { dataUrl, jpegBytes, pngBytes, SVG_BYTES } from "@test/helpers/images";
import { inspectPdf } from "@test/helpers/inspectPdf";

// The browser decoder needs createImageBitmap and a canvas
void mock.module("@/utils/decodeImage", () => ({ ...decoding, decodeImage }));

// SVGs are checked by parsing them, as the page does
globalThis.DOMParser = new Window().DOMParser as unknown as typeof DOMParser;

// The workers run the same rasterizer, which runs here in the test instead
const inThread: RasterWorkers = {
  rasterize: async (prepare, rendering) => await rasterizeCard(await prepare(), rendering),
};
void mock.module("@/utils/lazyModules", () => ({ ...lazyModules, loadRasterWorkers: () => Promise.resolve(inThread) }));

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
  text: dataUrl("image/svg+xml", svgBytes('<text x="1" y="9"><tspan>Hi</tspan></text>')),
  // Left behind by editors, or commented out: nothing to draw
  noText: dataUrl("image/svg+xml", svgBytes('<!-- <text>Hi</text> --><text x="1" y="9"><tspan> </tspan></text>')),
  blur: dataUrl(
    "image/svg+xml",
    svgBytes(
      '<filter id="f"><feGaussianBlur stdDeviation="1"/></filter><rect width="10" height="10" filter="url(#f)"/>'
    )
  ),
  // Browsers don't decode TIFFs
  tiff: dataUrl("image/tiff", new Uint8Array()),
};

function svgBytes(content: string): Uint8Array {
  return new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${content}</svg>`);
}

const HORIZONTAL_BACKS = { defaultBackId: "jpeg", mirror: MirrorAxis.Horizontal };

function card(imageId: string, count = 1): Card {
  return { id: imageId, name: imageId, count, imageId };
}

interface GenerateOptions {
  backs?: typeof HORIZONTAL_BACKS | undefined;
  template?: Template;
  basePdf?: string;
  printDpi?: number;
  cardFit?: CardFit;
  svgOutput?: SvgOutput;
}

/** The PDF's bytes, as most tests only look at the PDF */
async function generate(cards: Card[], options: GenerateOptions = {}): Promise<Uint8Array> {
  return (await generateReported(cards, options)).bytes;
}

async function generateReported(
  cards: Card[],
  {
    backs,
    template = TEMPLATE,
    basePdf,
    printDpi = 600,
    cardFit = CardFit.Stretch,
    // The browser renderer needs a DOM
    svgOutput = SvgOutput.RasterResvg,
  }: GenerateOptions
): Promise<GeneratedPdf> {
  return await generatePdf({
    template,
    cards,
    getImage: (id) => (IMAGES[id] ? { name: id, data: IMAGES[id] } : undefined),
    getPdf: () => (basePdf ? { name: "base.pdf", data: basePdf } : undefined),
    backs,
    printDpi,
    rasterScaling: RasterScaling.Lanczos,
    svgOutput,
    cardFit,
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

  test("reports the cards and raster of each page", async () => {
    const { pages } = await generateReported([card("opaque", 3)], {});

    // 1500×2100 cards at 600 dpi
    expect(pages).toEqual([
      { rasterCards: 2, vectorCards: 0, megapixels: 6.3 },
      { rasterCards: 1, vectorCards: 0, megapixels: 3.15 },
    ]);
  });

  test("places cards at the card size, fronts and mirrored backs alike", async () => {
    for (const backs of [undefined, HORIZONTAL_BACKS]) {
      const { pages } = await inspectPdf(await generate([card("opaque")], { backs }));
      expect(pages[0]?.images[0]?.placedWidthMm).toBeCloseTo(63.5, 5);
      expect(pages[0]?.images[0]?.placedHeightMm).toBeCloseTo(88.9, 5);
    }
  });

  test("fits cards whole at their own ratio, rendered at the print resolution, fronts and mirrored backs alike", async () => {
    for (const backs of [undefined, HORIZONTAL_BACKS]) {
      // A square JPEG and a square SVG, in a 2.5×3.5in slot: 2.5in square, 1500px at 600 dpi
      const pdf = await generate([card("jpeg"), card("svg")], { backs, cardFit: CardFit.Fit });
      for (const image of (await inspectPdf(pdf)).pages.flatMap((page) => page.images)) {
        expect(image.placedWidthMm).toBeCloseTo(63.5, 5);
        expect(image.placedHeightMm).toBeCloseTo(63.5, 5);
        expect([image.pixelWidth, image.pixelHeight]).toEqual([1500, 1500]);
      }
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
    expect(await rejection(generate([card("tiff")]))).toHaveProperty(
      "message",
      'Cannot print "tiff": image/tiff images are not supported'
    );
  });

  test("refuses SVG text where it cannot be drawn with its font, rather than dropping or swapping it", async () => {
    for (const [svgOutput, reason] of [
      [SvgOutput.RasterResvg, "Raster (resvg) has no fonts"],
      [SvgOutput.Vector, "Vector cannot embed its fonts"],
    ] as const) {
      expect(await rejection(generate([card("text")], { svgOutput }))).toHaveProperty(
        "message",
        `Cannot print "text": it has text, and ${reason}: convert its text to curves (outlines) in the SVG, ` +
          "or use the Raster (browser) SVG output"
      );
    }
    expect((await inspectPdf(await generate([card("noText")]))).pages[0]?.images).toHaveLength(1);
  });

  test("refuses SVGs with parts vector output would leave out", async () => {
    expect(await rejection(generate([card("blur")], { svgOutput: SvgOutput.Vector }))).toHaveProperty(
      "message",
      'Cannot print "blur": uses filter, feGaussianBlur, which vector output cannot draw: use a raster SVG output'
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

  test("renders every card at exactly the print resolution, whatever its source size", async () => {
    for (const printDpi of [300, 600]) {
      // A 250×350 PNG, a 2×2 JPEG and a 10×10 SVG
      const { pages } = await inspectPdf(await generate([card("opaque"), card("jpeg"), card("svg")], { printDpi }));
      const images = pages.flatMap((page) => page.images);

      expect(images).toHaveLength(3);
      for (const image of images) {
        expect(image.ppiX).toBeCloseTo(printDpi, 5);
        expect(image.ppiY).toBeCloseTo(printDpi, 5);
      }
    }
  });

  test("embeds cards as opaque, losslessly compressed RGB, with no transparency to flatten", async () => {
    const { pages } = await inspectPdf(await generate([card("alpha"), card("jpeg"), card("svg")]));
    const images = pages.flatMap((page) => page.images);

    expect(pages.flatMap((page) => page.transparency)).toEqual([]);
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image).toMatchObject({ colorSpace: "DeviceRGB", bitsPerComponent: 8, filters: ["FlateDecode"] });
    }
  });
});
