import { DEFAULT_CARD_SIZE } from "@/types/card";
import type { Dimension } from "@/types/dimension";
import { PAGE_DIMENSIONS, PageSize } from "@/types/page";
import { generateGrid } from "@/utils/grid";
import { US_LETTER_CRICUT_TEMPLATE_PDF } from "@/generated/assets";

export interface Slot {
  x: number;
  y: number;
}

export interface Template {
  id: string;
  name: string;
  pageSize: PageSize;
  cardSize: Dimension;
  slots: Slot[];
  basePdfId: string | undefined;
}

/** Default template definition with optional bundled PDF */
export interface DefaultTemplate extends Omit<Template, "id" | "basePdfId"> {
  /** Bundled PDF data URL to be added to PDF store when loading defaults */
  bundledPdf?: { name: string; dataUrl: string };
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "A4 - MTG 3x3",
    pageSize: PageSize.A4,
    cardSize: DEFAULT_CARD_SIZE,
    slots: generateGrid({
      cols: 3,
      rows: 3,
      gap: 5,
      cardSize: DEFAULT_CARD_SIZE,
      pageSize: PAGE_DIMENSIONS[PageSize.A4],
    }),
  },
  {
    name: "Letter - MTG 3x3",
    pageSize: PageSize.Letter,
    cardSize: DEFAULT_CARD_SIZE,
    slots: generateGrid({
      cols: 3,
      rows: 3,
      gap: 5,
      cardSize: DEFAULT_CARD_SIZE,
      pageSize: PAGE_DIMENSIONS[PageSize.Letter],
    }),
  },
  {
    name: "Letter / Cricut - MTG 3x2",
    pageSize: PageSize.Letter,
    cardSize: DEFAULT_CARD_SIZE,
    slots: generateCricutSlots(),
    bundledPdf: {
      name: "Cricut Template",
      dataUrl: US_LETTER_CRICUT_TEMPLATE_PDF,
    },
  },
];

function generateCricutSlots() {
  // Offset from PDF content area (36pt x, 42pt y from top)
  // 36 points = 12.7mm exactly, 42 points = 14.8166...mm
  const offset = { x: 12.7, y: (42 * 25.4) / 72 };
  const gap = { x: 6.311, dy: 8.811 };
  return [
    { x: 0, y: 0 },
    { x: gap.x, y: 0 },
    { x: gap.x * 2, y: 0 },
    { x: 0, y: gap.dy },
    { x: gap.x, y: gap.dy },
    { x: gap.x * 2, y: gap.dy },
  ].map((slot) => ({ x: slot.x + offset.x, y: slot.y + offset.y }));
}
