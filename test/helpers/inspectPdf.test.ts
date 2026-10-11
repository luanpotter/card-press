import { describe, expect, test } from "bun:test";
import { degrees, PDFDocument, rgb } from "pdf-lib";
import { jpegBytes, pngBytes } from "@test/helpers/images";
import { inspectPdf } from "@test/helpers/inspectPdf";

const JPEG_2X2 = jpegBytes(2, 2, [0x33, 0x66, 0x99]);

describe("inspectPdf", () => {
  test("reports the page size in mm", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);

    const [page] = (await inspectPdf(await doc.save())).pages;
    expect(page?.widthMm).toBeCloseTo(215.9, 5);
    expect(page?.heightMm).toBeCloseTo(279.4, 5);
    expect(page?.images).toEqual([]);
    expect(page?.transparency).toEqual([]);
  });

  test("computes the placed resolution of an image, whatever its rotation", async () => {
    const doc = await PDFDocument.create();
    const image = await doc.embedJpg(JPEG_2X2);
    const page = doc.addPage([612, 792]);
    // 2 pixels over 72 points (1 inch) is 2 ppi; 1 inch is 25.4mm
    page.drawImage(image, { x: 100, y: 100, width: 72, height: 36, rotate: degrees(90) });

    const [report] = (await inspectPdf(await doc.save())).pages;
    expect(report?.images).toHaveLength(1);
    const placement = report?.images[0];
    expect(placement?.pixelWidth).toBe(2);
    expect(placement?.pixelHeight).toBe(2);
    expect(placement?.placedWidthMm).toBeCloseTo(25.4, 5);
    expect(placement?.placedHeightMm).toBeCloseTo(12.7, 5);
    expect(placement?.ppiX).toBeCloseTo(2, 5);
    expect(placement?.ppiY).toBeCloseTo(4, 5);
    expect(placement?.filters).toEqual(["DCTDecode"]);
    expect(placement?.colorSpace).toBe("DeviceRGB");
    expect(placement?.bitsPerComponent).toBe(8);
    expect(placement?.hasSMask).toBe(false);
  });

  test("counts each distinct image once towards the page raster", async () => {
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(pngBytes(1000, 500, [0, 0, 0, 255]));
    const page = doc.addPage([612, 792]);
    page.drawImage(image, { x: 0, y: 0, width: 100, height: 50 });
    page.drawImage(image, { x: 200, y: 0, width: 100, height: 50 });

    const [report] = (await inspectPdf(await doc.save())).pages;
    expect(report?.images).toHaveLength(2);
    expect(report?.rasterMegapixels).toBeCloseTo(0.5, 5);
  });

  test("flags images with an alpha channel", async () => {
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(pngBytes(4, 4, [255, 0, 0, 128]));
    doc.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 72, height: 72 });

    const [report] = (await inspectPdf(await doc.save())).pages;
    const placement = report?.images[0];
    expect(placement?.hasSMask).toBe(true);
    expect(report?.transparency).toEqual([`image ${placement?.id ?? ""} has an SMask`]);
  });

  test("flags graphics states with constant alpha", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]).drawRectangle({ x: 0, y: 0, width: 10, height: 10, color: rgb(1, 0, 0), opacity: 0.5 });

    const [report] = (await inspectPdf(await doc.save())).pages;
    expect(report?.transparency).toEqual(["ExtGState /ca 0.5"]);
  });

  test("follows images into form XObjects, through negative scales", async () => {
    const inner = await PDFDocument.create();
    const image = await inner.embedJpg(JPEG_2X2);
    inner.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 72, height: 72 });

    const outer = await PDFDocument.create();
    const [embedded] = await outer.embedPdf(await inner.save());
    if (!embedded) throw new Error("No page embedded");
    // Mirrored and halved: the image ends up half an inch wide
    outer.addPage([612, 792]).drawPage(embedded, { x: 306, y: 0, width: -306, height: 396 });

    const [report] = (await inspectPdf(await outer.save())).pages;
    expect(report?.images).toHaveLength(1);
    expect(report?.images[0]?.placedWidthMm).toBeCloseTo(12.7, 5);
    expect(report?.images[0]?.ppiX).toBeCloseTo(4, 5);
  });

  test("parses past strings and inline images in content streams", async () => {
    const doc = await PDFDocument.create();
    const image = await doc.embedJpg(JPEG_2X2);
    const page = doc.addPage([612, 792]);
    const name = page.node.newXObject("Im", image.ref);

    const content = [
      "% a comment with Do in it",
      "BT (a \\) Q (nested) q) Tj <48 49> Tj [(x) -20 (y)] TJ ET",
      "q 1 0 0 1 0 0 cm BI /W 1 /H 1 /CS /G /BPC 8 ID \xff EI Q",
      "<< /MCID 0 >> BDC",
      `q 144 0 0 72 10 10 cm /${name.decodeText()} Do Q`,
      "EMC",
    ].join("\n");
    const bytes = Uint8Array.from(content, (char) => char.charCodeAt(0));
    page.node.addContentStream(doc.context.register(doc.context.stream(bytes)));

    const [report] = (await inspectPdf(await doc.save())).pages;
    expect(report?.images).toHaveLength(1);
    expect(report?.images[0]?.placedWidthMm).toBeCloseTo(50.8, 5);
    expect(report?.images[0]?.placedHeightMm).toBeCloseTo(25.4, 5);
    expect(report?.transparency).toEqual(["inline image (not inspected)"]);
  });
});
