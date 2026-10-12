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
import { SvgOutput, type Card, type CardBacks, type CardFit, type RasterScaling } from "@/types/session";
import { type Rgb, WHITE } from "@/types/color";
import type { Dimension } from "@/types/dimension";
import { MirrorAxis, PAGE_DIMENSIONS } from "@/types/page";
import type { CardRaster, RasterRendering, RasterSource } from "@/utils/cardRaster";
import { decodeImage, ImageFormat, imageFormatOf, isDecodable, mimeTypeOf } from "@/utils/decodeImage";
import { loadRasterWorkers, loadSvgRenderer, loadVectorSvg } from "@/utils/lazyModules";
import { fittedPixels, fittedSize, targetPixels } from "@/utils/printResolution";
import { checkSvgOutput, parseSvg } from "@/utils/svgSupport";

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
  rasterScaling: RasterScaling;
  svgOutput: SvgOutput;
  cardFit: CardFit;
}

interface ExpandedCard {
  name: string;
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
      expanded.push({ name: card.name, imageId: card.imageId, cardBackId: card.cardBackId });
    }
  }
  return expanded;
}

/**
 * The image printed for a card: its front, or its back, falling back to the session's default back
 */
function cardImageId(card: ExpandedCard, backs: GeneratePdfOptions["backs"]): string | undefined {
  return backs ? (card.cardBackId ?? backs.defaultBackId) : card.imageId;
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
 * A card embedded in the document, ready to be drawn any number of times.
 * It is drawn by stretching its box, from the origin to its width and height, over where it goes in the slot.
 */
interface EmbeddedCard {
  ref: PDFRef;
  width: number;
  height: number;
  /** Size of what it shows, in any unit, for its ratio */
  shape: Dimension;
}

/** How card images are rendered for print, the same for every card of a document */
interface CardRendering extends RasterRendering {
  svgOutput: SvgOutput;
}

/**
 * Embed a rasterized card as an image
 */
function embedRaster(pdfDoc: PDFDocument, raster: CardRaster): EmbeddedCard {
  const stream = pdfDoc.context.stream(raster.data, {
    Type: "XObject",
    Subtype: "Image",
    Width: raster.width,
    Height: raster.height,
    BitsPerComponent: 8,
    ColorSpace: "DeviceRGB",
    Filter: "FlateDecode",
  });
  // An image fills the unit square, whatever its pixels' ratio
  return {
    ref: pdfDoc.context.register(stream),
    width: 1,
    height: 1,
    shape: { width: raster.width, height: raster.height },
  };
}

/**
 * Embed an SVG as vector graphics, sharp at any printer resolution
 */
async function embedVectorSvg(pdfDoc: PDFDocument, svg: Element): Promise<EmbeddedCard> {
  const { svgToPdf } = await loadVectorSvg();
  const svgPdf = await svgToPdf(svg);
  const [page] = await pdfDoc.embedPdf(svgPdf);
  if (!page) {
    throw new Error("its vector conversion has no page");
  }
  const { width, height } = page;
  return { ref: page.ref, width, height, shape: { width, height } };
}

/**
 * What a card is rasterized from, prepared on the page, where SVGs rendered by the browser have to be
 */
async function rasterSource(image: StoredImage, { sizePx, svgOutput, fit }: CardRendering): Promise<RasterSource> {
  if (imageFormatOf(image.data) !== ImageFormat.Svg) {
    return { kind: "image", dataUrl: image.data };
  }
  if (svgOutput === SvgOutput.RasterBrowser) {
    return { kind: "pixels", pixels: await decodeImage(image.data, (own) => fittedPixels(own, sizePx, fit)) };
  }
  // Through the loader, for its status to show while it downloads
  return { kind: "svg", svg: dataUrlToBytes(image.data), resvg: await loadSvgRenderer() };
}

/**
 * Embed a card image into the document, with SVGs embedded as the session asks.
 * Rasters are made by the image workers, several at once.
 * Throws why it cannot, for the caller to say which card it is.
 */
async function embedCard(
  pdfDoc: PDFDocument,
  image: StoredImage,
  rendering: CardRendering,
  signal: AbortSignal
): Promise<EmbeddedCard> {
  if (!isDecodable(image.data)) {
    throw new Error(`${mimeTypeOf(image.data)} images are not supported`);
  }
  const { svgOutput } = rendering;
  if (imageFormatOf(image.data) === ImageFormat.Svg && svgOutput !== SvgOutput.RasterBrowser) {
    const svg = parseSvg(new TextDecoder().decode(dataUrlToBytes(image.data)));
    checkSvgOutput(svg, svgOutput);
    if (svgOutput === SvgOutput.Vector) {
      return await embedVectorSvg(pdfDoc, svg);
    }
  }

  const workers = await loadRasterWorkers();
  return embedRaster(pdfDoc, await workers.rasterize(() => rasterSource(image, rendering), rendering, signal));
}

/**
 * Draw a card on a PDF page at the specified slot position, possibly mirrorer.
 * For flipped pages (backs), we render the cards themselves mirrored so they reverse back
 * correctly when the whole page is mirrored for the slots and cut lines.
 */
function drawCardOnPage(
  page: PDFPage,
  slot: Slot,
  cardWidth: number,
  cardHeight: number,
  pageHeight: number,
  card: EmbeddedCard,
  background: Rgb,
  fit: CardFit,
  mirror: MirrorAxis | undefined
): void {
  // Centered in the slot, which it fills unless fitted at its own ratio
  const slotBox = slotRect(slot, cardWidth, cardHeight, pageHeight);
  const { width, height } = fittedSize(card.shape, slotBox, fit);
  const x = slotBox.x + (slotBox.width - width) / 2;
  const y = slotBox.y + (slotBox.height - height) / 2;

  // What shows around fitted cards and through transparent parts of vector ones; images are flattened onto it
  drawEmptySlot(page, slot, cardWidth, cardHeight, pageHeight, background);

  // A negative size draws the card reversed, from the opposite edge of the same slot
  const reverseVertically = mirror === MirrorAxis.Vertical;
  const reverseHorizontally = mirror !== undefined && !reverseVertically;
  const scaleX = width / card.width;
  const scaleY = height / card.height;

  const name = page.node.newXObject("Card", card.ref);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(
      reverseHorizontally ? -scaleX : scaleX,
      0,
      0,
      reverseVertically ? -scaleY : scaleY,
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
  rasterScaling,
  svgOutput,
  cardFit,
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
  // Cards sit on the same background as empty slots, so transparent corners match them.
  // With no slot color the base PDF shows through empty slots, but cards can't be flattened onto it: use the paper.
  const cardBackground = emptySlotColor ?? WHITE;
  const rendering: CardRendering = {
    sizePx: targetPixels(template.cardSize, printDpi),
    background: cardBackground,
    rasterScaling,
    svgOutput,
    fit: cardFit,
  };

  // Each image is embedded once, however many cards and slots show it.
  // All are started at once, for the workers to rasterize several together; the first failure stops the rest.
  const stopped = new AbortController();
  const embedding = AbortSignal.any(signal ? [signal, stopped.signal] : [stopped.signal]);
  const embeddedCards = new Map<string, Promise<EmbeddedCard>>();
  let failure: Error | undefined;
  for (const expandedCard of expandedCards) {
    const imageId = cardImageId(expandedCard, backs);
    const image = imageId && getImage(imageId);
    if (imageId && image && !embeddedCards.has(imageId)) {
      const embedded = embedCard(pdfDoc, image, rendering, embedding);
      embedded.catch((error: unknown) => {
        // Named as the card list shows it, not by its stored image
        const card = backs ? `the back of "${expandedCard.name}"` : `"${expandedCard.name}"`;
        failure ??= new Error(`Cannot print ${card}: ${error instanceof Error ? error.message : String(error)}`);
        stopped.abort();
      });
      embeddedCards.set(imageId, embedded);
    }
  }

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

      // A slot with no card has no back either, lest the backs PDF print backs for missing fronts
      const imageIdToUse = expandedCard && cardImageId(expandedCard, backs);
      const embedded = imageIdToUse && embeddedCards.get(imageIdToUse);
      if (!expandedCard || !embedded) {
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

      let embeddedCard: EmbeddedCard;
      try {
        embeddedCard = await embedded;
      } catch (error) {
        if (signal?.aborted) {
          throw new DOMException("PDF generation cancelled", "AbortError");
        }
        // The first failure, which stopped the cards still waiting, like this one may have been
        throw failure ?? error;
      }

      drawCardOnPage(
        page,
        slot,
        template.cardSize.width,
        template.cardSize.height,
        pageDimensions.height,
        embeddedCard,
        cardBackground,
        cardFit,
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
