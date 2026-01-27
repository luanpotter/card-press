import type { Dimension } from "@/types/dimension";

export enum PageSize {
  A4 = "A4",
  Letter = "Letter",
}

export const PAGE_DIMENSIONS: Record<PageSize, Dimension> = {
  [PageSize.A4]: { width: 210, height: 297 },
  [PageSize.Letter]: { width: 216, height: 279 },
};
