import { CARD_SIZE_PRESETS, CardSizePreset } from "@/types/card";
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
  /** Whether this should be set as the default template when loaded */
  isDefault?: boolean;
}

const mtgSize = CARD_SIZE_PRESETS[CardSizePreset.MTG];
const yugiohSize = CARD_SIZE_PRESETS[CardSizePreset.YuGiOh];

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: "A4 - MTG 3x3",
    ...griSslots({
      pageSize: PageSize.A4,
      cardSize: mtgSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "A4 - Yu-Gi-Oh! 3x3",
    ...griSslots({
      pageSize: PageSize.A4,
      cardSize: yugiohSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "Letter - MTG 3x3",
    ...griSslots({
      pageSize: PageSize.Letter,
      cardSize: mtgSize,
      cols: 3,
      rows: 3,
    }),
  },
  {
    name: "Letter - Yu-Gi-Oh! 3x3",
    ...griSslots({
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
    slots: generateCricutSlots(),
    bundledPdf: {
      name: "Cricut Template",
      dataUrl: US_LETTER_CRICUT_TEMPLATE_PDF,
    },
    isDefault: true,
  },
];

function griSslots({
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
} {
  return {
    pageSize,
    cardSize,
    slots: generateGrid({
      cols,
      rows,
      gap: 5,
      cardSize,
      pageSize: PAGE_DIMENSIONS[pageSize],
    }),
  };
}

function generateCricutSlots(): Slot[] {
  const offset = { x: 13.2, y: 46.8 };
  const gap = { x: 63.11, dy: 88.11 };
  return [
    { x: 0, y: 0 },
    { x: gap.x, y: 0 },
    { x: gap.x * 2, y: 0 },
    { x: 0, y: gap.dy },
    { x: gap.x, y: gap.dy },
    { x: gap.x * 2, y: gap.dy },
  ].map((slot) => ({ x: slot.x + offset.x, y: slot.y + offset.y }));
}
