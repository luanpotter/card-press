import { PDFDocument, type PDFPage, rgb } from "pdf-lib";
import type { Template, Slot, Guideline } from "@/types/template";
import type { Card, CardBacks } from "@/types/session";
import { MirrorAxis, PAGE_DIMENSIONS } from "@/types/page";

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
 * Detect image type from data URL
 */
function getImageType(dataUrl: string): "png" | "jpeg" | "webp" | null {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "jpeg";
  if (dataUrl.startsWith("data:image/webp")) return "webp";
  return null;
}

/**
 * Convert a WebP image to PNG using canvas
 */
async function convertWebpToPng(webpDataUrl: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = webpDataUrl;
  });
}

/**
 * Draw an image on a PDF page at the specified slot position, possibly mirrorer.
 * For flipped pages (backs), we render the images themselves mirrored so they reverse back
 * correctly when the whole page is mirrored for the slots and cut lines.
 */
async function drawCardOnPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  slot: Slot,
  cardWidth: number,
  cardHeight: number,
  pageHeight: number,
  imageData: string,
  mirror: MirrorAxis | undefined
): Promise<void> {
  let imageType = getImageType(imageData);
  if (!imageType) {
    // Unsupported image type, skip silently
    return;
  }

  // Convert WebP to PNG since pdf-lib doesn't support WebP
  let finalImageData = imageData;
  if (imageType === "webp") {
    finalImageData = await convertWebpToPng(imageData);
    imageType = "png";
  }

  const imageBytes = dataUrlToBytes(finalImageData);
  const image = imageType === "png" ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);

  // Convert mm to points
  const x = slot.x * MM_TO_POINTS;
  const width = cardWidth * MM_TO_POINTS;
  const height = cardHeight * MM_TO_POINTS;

  // PDF coordinate system has origin at bottom-left, so flip Y
  // slot.y is from top in mm, convert to bottom-left origin
  const y = (pageHeight - slot.y - cardHeight) * MM_TO_POINTS;

  // A negative size draws the image reversed, from the opposite edge of the same slot
  const reverseVertically = mirror === MirrorAxis.Vertical;
  const reverseHorizontally = mirror !== undefined && !reverseVertically;

  page.drawImage(image, {
    x: reverseHorizontally ? x + width : x,
    y: reverseVertically ? y + height : y,
    width: reverseHorizontally ? -width : width,
    height: reverseVertically ? -height : height,
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
    }
  }

  // Create output document
  const pdfDoc = await PDFDocument.create();

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

    // Place each card in its slot
    for (let slotIndex = 0; slotIndex < pageCards.length; slotIndex++) {
      // Check for cancellation
      if (signal?.aborted) {
        throw new DOMException("PDF generation cancelled", "AbortError");
      }

      const expandedCard = pageCards[slotIndex];
      const slot = template.slots[slotIndex];

      if (!expandedCard || !slot) continue;

      // Determine which image to use (front or back)
      let imageIdToUse: string;
      if (backs) {
        // For backs: use card-specific back, fall back to default, or skip if none
        imageIdToUse = expandedCard.cardBackId ?? backs.defaultBackId ?? "";
        if (!imageIdToUse) continue;
      } else {
        imageIdToUse = expandedCard.imageId;
      }

      const image = getImage(imageIdToUse);
      if (!image) {
        // Image not found, skip this slot
        continue;
      }

      // Report progress
      const cardIndex = startIdx + slotIndex;
      onProgress?.(cardIndex + 1, expandedCards.length);

      await drawCardOnPage(
        pdfDoc,
        page,
        slot,
        template.cardSize.width,
        template.cardSize.height,
        pageDimensions.height,
        image.data,
        backs?.mirror
      );

      // Yield to main thread periodically to keep UI responsive
      if (slotIndex % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

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
