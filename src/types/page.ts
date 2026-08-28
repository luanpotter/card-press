import type { Dimension } from "@/types/dimension";

export enum PageSize {
  A4 = "A4",
  Letter = "Letter",
}

export const PAGE_DIMENSIONS: Record<PageSize, Dimension> = {
  [PageSize.A4]: { width: 210, height: 297 },
  [PageSize.Letter]: { width: 215.9, height: 279.4 },
};

/**
 * Card Backs must be mirrorer in one way or another, lest the printing be mismatched with the front.
 */
export enum MirrorAxis {
  /** Turned left over right, like a book page, around the vertical axis: the top edge stays up. */
  Horizontal = "horizontal",
  /** Turned bottom over top, like a calendar page, around the horizontal axis: the left edge stays left. */
  Vertical = "vertical",
}
