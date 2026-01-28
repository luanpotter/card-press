import { DEFAULT_CARD_SIZE } from "@/types/card";
import type { Dimension } from "@/types/dimension";
import { PAGE_DIMENSIONS, PageSize } from "@/types/page";
import { generateGrid } from "@/utils/grid";

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

export const DEFAULT_TEMPLATES: Omit<Template, "id">[] = [
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
    basePdfId: undefined,
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
    basePdfId: undefined,
  },
];
