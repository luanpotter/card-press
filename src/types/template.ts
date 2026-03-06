import { CARD_SIZE_PRESETS, CardSizePreset } from "@/types/card";
import type { Dimension } from "@/types/dimension";
import { PAGE_DIMENSIONS, PageSize } from "@/types/page";
import { generateGrid } from "@/utils/grid";
import { US_LETTER_CRICUT_TEMPLATE_PDF } from "@/generated/assets";

export interface Slot {
  x: number;
  y: number;
}

export type GuidelineDirection = "horizontal" | "vertical";

export interface Guideline {
  direction: GuidelineDirection;
  distance: number; // dy for horizontal, dx for vertical (mm from page edge)
}

export interface Template {
  id: string;
  name: string;
  pageSize: PageSize;
  cardSize: Dimension;
  slots: Slot[];
  guidelines: Guideline[];
  basePdfId: string | undefined;
}

/** Default template definition with optional bundled PDF */
export interface DefaultTemplate extends Omit<Template, "id" | "basePdfId"> {
  /** Bundled PDF data URL to be added to PDF store when loading defaults */
  bundledPdf?: { name: string; dataUrl: string };
  /** Whether this should be set as the default template when loaded */
  isDefault?: boolean;
}

/** Generate guidelines centered between and around slots on the grid */
export function generateGridGuidelines({
  cols,
  rows,
  gap,
  cardSize,
  pageSize,
}: {
  cols: number;
  rows: number;
  gap: number;
  cardSize: Dimension;
  pageSize: Dimension;
}): Guideline[] {
  const totalWidth = cols * cardSize.width + (cols - 1) * gap;
  const totalHeight = rows * cardSize.height + (rows - 1) * gap;
  const startX = (pageSize.width - totalWidth) / 2;
  const startY = (pageSize.height - totalHeight) / 2;

  const guidelines: Guideline[] = [];

  // Vertical guidelines: before first col, between cols, after last col
  for (let col = 0; col <= cols; col++) {
    let x: number;
    if (col === 0) {
      x = startX - gap / 2;
    } else if (col === cols) {
      x = startX + totalWidth + gap / 2;
    } else {
      x = startX + col * cardSize.width + (col - 0.5) * gap;
    }
    guidelines.push({ direction: "vertical", distance: Math.max(0, x) });
  }

  // Horizontal guidelines: before first row, between rows, after last row
  for (let row = 0; row <= rows; row++) {
    let y: number;
    if (row === 0) {
      y = startY - gap / 2;
    } else if (row === rows) {
      y = startY + totalHeight + gap / 2;
    } else {
      y = startY + row * cardSize.height + (row - 0.5) * gap;
    }
    guidelines.push({ direction: "horizontal", distance: Math.max(0, y) });
  }

  return guidelines;
}

const mtgSize = CARD_SIZE_PRESETS[CardSizePreset.MTG];
const yugiohSize = CARD_SIZE_PRESETS[CardSizePreset.YuGiOh];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "A4 - MTG 3x3",
    ...gridSlots({
      pageSize: PageSize.A4,
      cardSize: mtgSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "A4 - Yu-Gi-Oh! 3x3",
    ...gridSlots({
      pageSize: PageSize.A4,
      cardSize: yugiohSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "Letter - MTG 3x3",
    ...gridSlots({
      pageSize: PageSize.Letter,
      cardSize: mtgSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "Letter - Yu-Gi-Oh! 3x3",
    ...gridSlots({
      pageSize: PageSize.Letter,
      cardSize: yugiohSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "Letter / Cricut - MTG 2x3",
    pageSize: PageSize.Letter,
    cardSize: mtgSize,
    ...generateCricutSlotsAndGuidelines(),
    bundledPdf: {
      name: "Cricut Template",
      dataUrl: US_LETTER_CRICUT_TEMPLATE_PDF,
    },
    isDefault: true,
  },
];

function gridSlots({
  pageSize,
  cardSize,
  cols,
  rows,
}: {
  pageSize: PageSize;
  cardSize: Dimension;
  cols: number;
  rows: number;
}): {
  pageSize: PageSize;
  cardSize: Dimension;
  slots: Slot[];
  guidelines: Guideline[];
} {
  const gridConfig = {
    cols,
    rows,
    gap: 0.2,
    cardSize,
    pageSize: PAGE_DIMENSIONS[pageSize],
  };
  return {
    pageSize,
    cardSize,
    slots: generateGrid(gridConfig),
    guidelines: generateGridGuidelines(gridConfig),
  };
}

function generateCricutSlotsAndGuidelines(): { slots: Slot[]; guidelines: Guideline[] } {
  const offset = { x: 12.7, y: 46.8 };
  const gap = { x: 63.11, dy: 88.11 };
  const cardWidth = 63;
  const cardHeight = 88;
  const cols = 3;
  const rows = 2;

  const slots = [
    { x: 0, y: 0 },
    { x: gap.x, y: 0 },
    { x: gap.x * 2, y: 0 },
    { x: 0, y: gap.dy },
    { x: gap.x, y: gap.dy },
    { x: gap.x * 2, y: gap.dy },
  ].map((slot) => ({ x: slot.x + offset.x, y: slot.y + offset.y }));

  const guidelines: Guideline[] = [];
  const gapX = gap.x - cardWidth;
  const gapY = gap.dy - cardHeight;

  // Vertical guidelines: before, between, and after columns
  for (let col = 0; col <= cols; col++) {
    let x: number;
    if (col === 0) {
      x = offset.x - gapX / 2;
    } else if (col === cols) {
      x = offset.x + col * gap.x - gapX + gapX / 2;
    } else {
      x = offset.x + col * gap.x - gapX / 2;
    }
    guidelines.push({ direction: "vertical", distance: Math.max(0, x) });
  }

  // Horizontal guidelines: before, between, and after rows
  for (let row = 0; row <= rows; row++) {
    let y: number;
    if (row === 0) {
      y = offset.y - gapY / 2;
    } else if (row === rows) {
      y = offset.y + row * gap.dy - gapY + gapY / 2;
    } else {
      y = offset.y + row * gap.dy - gapY / 2;
    }
    guidelines.push({ direction: "horizontal", distance: Math.max(0, y) });
  }

  return { slots, guidelines };
}
