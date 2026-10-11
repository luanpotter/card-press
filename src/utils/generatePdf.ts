import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  type PDFPage,
  type PDFRef,
  popGraphicsState,
  PrintScaling,
  pushGraphicsState,
  rgb,
} from "pdf-lib";
import type { Template, Slot, Guideline } from "@/types/template";
import type { Card, CardBacks } from "@/types/session";
import { type Rgb, WHITE } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import { MirrorAxis, PAGE_DIMENSIONS } from "@/types/page";
import { decodeImage, isDecodable, mimeTypeOf } from "@/utils/decodeImage";
import { toPrintRaster } from "@/utils/printRaster";
import { targetPixels } from "@/utils/printResolution";

// Convert mm to PDF points (1 inch = 72 points, 1 inch = 25.4mm)
const MM_TO_POINTS = 72 / 25.4;

interface StoredImage {
  name: string;
  data: string; // data URL
}

interface StoredPdf {
  name: string;
  data: string; // data URL
}

interface GeneratePdfOptions {
  template: Template;
  cards: Card[];
  getImage: (id: string) => StoredImage | undefined;
  getPdf: (id: string) => StoredPdf | undefined;
  onProgress?: (current: number, total: number) => void;
  signal?: AbortSignal;
  /** When provided, the backs PDF is generated instead of the fronts one */
  backs?: Omit<CardBacks, "enabled"> | undefined;
  /** Color painted over every slot left without a card; unset paints nothing */
  emptySlotColor?: Rgb | undefined;
  /** Resolution every card image is rendered at, in pixels per printed inch */
  printDpi: number;
}

interface ExpandedCard {
  imageId: string;
  cardBackId: string | undefined;
}

/**
 * Expand cards by their count into a flat array of image IDs (and optionally back IDs)
 */
function expandCards(cards: Card[]): ExpandedCard[] {
  const expanded: ExpandedCard[] = [];
  for (const card of cards) {
    for (let i = 0; i < card.count; i++) {
      expanded.push({ imageId: card.imageId, cardBackId: card.cardBackId });
    }
  }
  return expanded;
}

/**
 * Ask viewers to print at actual size, lest "fit to page" rescale the cards and cut lines
 */
function printAtActualSize(doc: PDFDocument): void {
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
}

/**
 * Reflect every page of a document across the given axis, including all contents.
 *
 * Pages are drawn as embedded form XObjects with a negative scale.
 * This goes through the saved bytes; embedding pages of a still-open document loses their resources.
 */
async function mirrorPdf(pdfBytes: Uint8Array, mirror: MirrorAxis): Promise<Uint8Array> {
  const vertical = mirror === MirrorAxis.Vertical;
  const source = await PDFDocument.load(pdfBytes);
  const mirrored = await PDFDocument.create();

  const pages = source.getPages();
  const embeddedPages = await mirrored.embedPages(pages);

  for (const [index, page] of pages.entries()) {
    const embeddedPage = embeddedPages[index];
    if (!embeddedPage) {
      continue;
    }

    const { width, height } = page.getSize();
    // Drawing from the far edge with a negative size flips that axis around the page center
    mirrored.addPage([width, height]).drawPage(embeddedPage, {
      x: vertical ? 0 : width,
      y: vertical ? height : 0,
      width: vertical ? width : -width,
      height: vertical ? -height : height,
    });
  }

  printAtActualSize(mirrored);
  return await mirrored.save();
}

/**
 * Convert data URL to Uint8Array
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1];
  if (!base64) throw new Error("Invalid data URL");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Where a slot lands on the page, in PDF points.
 * The PDF origin is bottom-left, while slots are measured from the top of the page in mm.
 */
function slotRect(
  slot: Slot,
  cardWidth: number,
  cardHeight: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: slot.x * MM_TO_POINTS,
    y: (pageHeight - slot.y - cardHeight) * MM_TO_POINTS,
    width: cardWidth * MM_TO_POINTS,
    height: cardHeight * MM_TO_POINTS,
  };
}

/**
 * Embed a card image into the document, ready to be drawn any number of times.
 *
 * Printers resample images to their own grid and flatten transparency, both badly,
 * so the image goes in at exactly the print resolution as an opaque, losslessly compressed RGB image.
 */
async function embedCardImage(
  pdfDoc: PDFDocument,
  image: StoredImage,
  sizePx: Dimension,
  background: Rgb
): Promise<PDFRef> {
  if (!isDecodable(image.data)) {
    throw new Error(`Cannot print "${image.name}": ${mimeTypeOf(image.data)} images are not supported`);
  }

  const pixels = await toPrintRaster(await decodeImage(image.data), sizePx, background);

  const stream = pdfDoc.context.flateStream(pixels.data, {
    Type: "XObject",
    Subtype: "Image",
    Width: pixels.width,
    Height: pixels.height,
    BitsPerComponent: 8,
    ColorSpace: "DeviceRGB",
  });
  return pdfDoc.context.register(stream);
}

/**
 * Draw an image on a PDF page at the specified slot position, possibly mirrorer.
 * For flipped pages (backs), we render the images themselves mirrored so they reverse back
 * correctly when the whole page is mirrored for the slots and cut lines.
 */
function drawCardOnPage(
  page: PDFPage,
  slot: Slot,
  cardWidth: number,
  cardHeight: number,
  pageHeight: number,
  image: PDFRef,
  mirror: MirrorAxis | undefined
): void {
  const { x, y, width, height } = slotRect(slot, cardWidth, cardHeight, pageHeight);

  // A negative size draws the image reversed, from the opposite edge of the same slot
  const reverseVertically = mirror === MirrorAxis.Vertical;
  const reverseHorizontally = mirror !== undefined && !reverseVertically;

  // An image fills the unit square, so this matrix scales it to the slot
  const name = page.node.newXObject("Card", image);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      reverseHorizontally ? -width : width,
      0,
      0,
      reverseVertically ? -height : height,
      reverseHorizontally ? x + width : x,
      reverseVertically ? y + height : y
    ),
    drawObject(name),
    popGraphicsState()
  );
}

/**
 * Paint a slot that holds no card, covering whatever the base PDF draws there.
 * No color paints nothing, leaving the base template visible.
 */
function drawEmptySlot(
  page: PDFPage,
  slot: Slot,
  cardWidth: number,
  cardHeight: number,
  pageHeight: number,
  color: Rgb | undefined
): void {
  if (!color) {
    return;
  }

  page.drawRectangle({
    ...slotRect(slot, cardWidth, cardHeight, pageHeight),
    color: rgb(color.r / 255, color.g / 255, color.b / 255),
  });
}

/**
 * Draw guidelines on a PDF page as thin black lines
 */
function drawGuidelines(page: PDFPage, guidelines: Guideline[], pageWidthMm: number, pageHeightMm: number): void {
  const lineThickness = 0.5; // points

  for (const guideline of guidelines) {
    if (guideline.direction === "horizontal") {
      // Horizontal line at distance from top edge, spanning full width
      const y = (pageHeightMm - guideline.distance) * MM_TO_POINTS;
      page.drawLine({
        start: { x: 0, y },
        end: { x: pageWidthMm * MM_TO_POINTS, y },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });
    } else {
      // Vertical line at distance from left edge, spanning full height
      const x = guideline.distance * MM_TO_POINTS;
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: pageHeightMm * MM_TO_POINTS },
        thickness: lineThickness,
        color: rgb(0, 0, 0),
      });
    }
  }
}

/**
 * Generate a PDF with cards placed according to the template
 */
export async function generatePdf({
  template,
  cards,
  getImage,
  getPdf,
  onProgress,
  signal,
  backs,
  emptySlotColor,
  printDpi,
}: GeneratePdfOptions): Promise<Uint8Array> {
  const expandedCards = expandCards(cards);

  if (expandedCards.length === 0) {
    throw new Error("No cards to generate");
  }

  const slotsPerPage = template.slots.length;
  if (slotsPerPage === 0) {
    throw new Error("Template has no slots defined");
  }

  const totalPages = Math.ceil(expandedCards.length / slotsPerPage);
  const pageDimensions = PAGE_DIMENSIONS[template.pageSize];
  const pageWidthPts = pageDimensions.width * MM_TO_POINTS;
  const pageHeightPts = pageDimensions.height * MM_TO_POINTS;

  // Load base PDF if available
  let basePdfDoc: PDFDocument | null = null;

  if (template.cricut?.basePdfId) {
    const basePdf = getPdf(template.cricut.basePdfId);
    if (basePdf) {
      const pdfBytes = dataUrlToBytes(basePdf.data);
      basePdfDoc = await PDFDocument.load(pdfBytes);

      // Slots are measured on the template page, so a base page of another size misplaces every card
      const basePage = basePdfDoc.getPages()[0];
      if (basePage) {
        const { width, height } = basePage.getSize();
        const tolerance = 1; // points, for rounding in PDFs exported elsewhere
        if (Math.abs(width - pageWidthPts) > tolerance || Math.abs(height - pageHeightPts) > tolerance) {
          const mm = (points: number) => (points / MM_TO_POINTS).toFixed(1);
          throw new Error(
            `The base PDF "${basePdf.name}" is ${mm(width)}×${mm(height)}mm, but the template page ` +
              `is ${template.pageSize} (${mm(pageWidthPts)}×${mm(pageHeightPts)}mm)`
          );
        }
      }
    }
  }

  // Create output document
  const pdfDoc = await PDFDocument.create();
  const embeddedImages = new Map<string, PDFRef>();
  const cardSizePx = targetPixels(template.cardSize, printDpi);
  // Cards sit on the same background as empty slots, so transparent corners match them.
  // With no slot color the base PDF shows through empty slots, but cards can't be flattened onto it: use the paper.
  const cardBackground = emptySlotColor ?? WHITE;

  // Process each page worth of cards
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    // Get or create the page
    let page: PDFPage;

    if (basePdfDoc) {
      // Copy the first page from base PDF as template for each page
      const [copiedPage] = await pdfDoc.copyPages(basePdfDoc, [0]);
      if (copiedPage) {
        page = pdfDoc.addPage(copiedPage);
      } else {
        page = pdfDoc.addPage([pageWidthPts, pageHeightPts]);
      }
    } else {
      // Add a blank page
      page = pdfDoc.addPage([pageWidthPts, pageHeightPts]);
    }

    // Get cards for this page
    const startIdx = pageIndex * slotsPerPage;
    const pageCards = expandedCards.slice(startIdx, startIdx + slotsPerPage);

    if (signal?.aborted) {
      throw new DOMException("PDF generation cancelled", "AbortError");
    }
    drawGuidelines(page, template.guidelines, pageDimensions.width, pageDimensions.height);

    // Place each card in its slot; slots left over are filled instead
    for (let slotIndex = 0; slotIndex < slotsPerPage; slotIndex++) {
      // Check for cancellation
      if (signal?.aborted) {
        throw new DOMException("PDF generation cancelled", "AbortError");
      }

      const expandedCard = pageCards[slotIndex];
      const slot = template.slots[slotIndex];

      if (!slot) continue;

      // Determine which image to use (front or back); backs fall back to the session default.
      // A slot with no card has no back either, lest the backs PDF print backs for missing fronts.
      const imageIdToUse =
        expandedCard && (backs ? (expandedCard.cardBackId ?? backs.defaultBackId) : expandedCard.imageId);

      const image = imageIdToUse ? getImage(imageIdToUse) : undefined;
      if (!imageIdToUse || !image) {
        // No card (or no image) for this slot: paint over the base template instead
        drawEmptySlot(
          page,
          slot,
          template.cardSize.width,
          template.cardSize.height,
          pageDimensions.height,
          emptySlotColor
        );
        continue;
      }

      // Report progress
      const cardIndex = startIdx + slotIndex;
      onProgress?.(cardIndex + 1, expandedCards.length);

      // Each image is embedded once, however many cards and slots show it
      let pdfImage = embeddedImages.get(imageIdToUse);
      if (!pdfImage) {
        pdfImage = await embedCardImage(pdfDoc, image, cardSizePx, cardBackground);
        embeddedImages.set(imageIdToUse, pdfImage);
      }

      drawCardOnPage(
        page,
        slot,
        template.cardSize.width,
        template.cardSize.height,
        pageDimensions.height,
        pdfImage,
        backs?.mirror
      );

      // Yield to main thread periodically to keep UI responsive
      if (slotIndex % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  printAtActualSize(pdfDoc);
  const pdfBytes = await pdfDoc.save();
  return backs ? await mirrorPdf(pdfBytes, backs.mirror) : pdfBytes;
}

/**
 * Download a PDF as a file
 */
export function downloadPdf(pdfBytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
