export enum PageSize {
  A4 = "A4",
  Letter = "Letter",
}

export interface CardSize {
  width: number;
  height: number;
}

export interface Slot {
  x: number;
  y: number;
}

export interface Template {
  id: string;
  name: string;
  pageSize: PageSize;
  cardSize: CardSize;
  slots: Slot[];
  basePdfId: string | undefined;
}

export const DEFAULT_CARD_SIZE: CardSize = { width: 63, height: 88 };

export const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  [PageSize.A4]: { width: 210, height: 297 },
  [PageSize.Letter]: { width: 216, height: 279 },
};
