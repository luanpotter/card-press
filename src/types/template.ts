import type { Dimension } from "@/types/dimension";
import type { PageSize } from "@/types/page";

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

export const DEFAULT_CARD_SIZE: Dimension = { width: 63, height: 88 };
