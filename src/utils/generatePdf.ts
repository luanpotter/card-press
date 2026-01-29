import { PDFDocument, type PDFPage } from "pdf-lib";
import type { Template, Slot } from "@/types/template";
import type { Card } from "@/types/session";
import { PAGE_DIMENSIONS } from "@/types/page";

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
  // For generating backs PDF
  defaultCardBackId?: string | undefined;
  generateBacks?: boolean;
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
function getImageType(dataUrl: string): "png" | "jpeg" | null {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "jpeg";
  return null;
}

/**
 * Draw an image on a PDF page at the specified slot position
 */
async function drawCardOnPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  slot: Slot,
  cardWidth: number,
  cardHeight: number,
  pageHeight: number,
  imageData: string
): Promise<void> {
  const imageType = getImageType(imageData);
  if (!imageType) {
    // Unsupported image type, skip silently
    return;
  }

  const imageBytes = dataUrlToBytes(imageData);
  const image = imageType === "png" ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);

  // Convert mm to points
  const x = slot.x * MM_TO_POINTS;
  const width = cardWidth * MM_TO_POINTS;
  const height = cardHeight * MM_TO_POINTS;

  // PDF coordinate system has origin at bottom-left, so flip Y
  // slot.y is from top in mm, convert to bottom-left origin
  const y = (pageHeight - slot.y - cardHeight) * MM_TO_POINTS;

  page.drawImage(image, {
    x,
    y,
    width,
    height,
  });
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
  defaultCardBackId,
  generateBacks = false,
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

  if (template.basePdfId) {
    const basePdf = getPdf(template.basePdfId);
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

    // Place each card in its slot
    for (let slotIndex = 0; slotIndex < pageCards.length; slotIndex++) {
      const expandedCard = pageCards[slotIndex];
      const slot = template.slots[slotIndex];

      if (!expandedCard || !slot) continue;

      // Determine which image to use (front or back)
      let imageIdToUse: string;
      if (generateBacks) {
        // For backs: use card-specific back, fall back to default, or skip if none
        imageIdToUse = expandedCard.cardBackId ?? defaultCardBackId ?? "";
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
        image.data
      );

      // Yield to main thread periodically to keep UI responsive
      if (slotIndex % 3 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  return await pdfDoc.save();
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
