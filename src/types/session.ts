import { WHITE, type Rgb } from "@/types/color";
import { MirrorAxis } from "@/types/page";

export interface Card {
  id: string;
  name: string;
  count: number;
  imageId: string;
  cardBackId?: string | undefined; // Optional per-card back override
}

export interface CardBacks {
  enabled: boolean;
  /** Back image used by all cards without a custom override */
  defaultBackId: string | undefined;
  /** How the sheet is flipped between prints, so the back PDF matches */
  mirror: MirrorAxis;
}

export const DEFAULT_CARD_BACKS: CardBacks = {
  enabled: false,
  defaultBackId: undefined,
  mirror: MirrorAxis.Horizontal,
};

// Default to white to not waste ink (prints nothing).
export const DEFAULT_EMPTY_SLOT_COLOR: Rgb = WHITE;

// At or above the grid most printer drivers resample images to (300/600, 360/720 on Epson).
export const DEFAULT_PRINT_DPI = 600;

/** How SVG images go into the PDF */
export enum SvgOutput {
  /** Rendered to pixels by resvg, the same in every browser */
  RasterResvg = "raster-resvg",
  /** Rendered to pixels by the browser, with the system fonts */
  RasterBrowser = "raster-browser",
  /** Kept as vector graphics */
  Vector = "vector",
}

// Consistent across browsers, and keeps masks and filters that a vector PDF would need transparency for
export const DEFAULT_SVG_OUTPUT = SvgOutput.RasterResvg;

export interface Session {
  id: string;
  name: string;
  templateId: string;
  cards: Card[];
  cardBacks?: CardBacks;
  /**
   * Color used to paint solid rectangles over empty slots.
   * Unset disables it, if the backing PDF template showing is the intent.
   */
  emptySlotColor?: Rgb | undefined;
  /** Resolution card images are rendered at, in pixels per inch of the printed card */
  printDpi?: number | undefined;
  svgOutput?: SvgOutput | undefined;
}

export function getCardBacks(session: Session): CardBacks {
  return session.cardBacks ?? DEFAULT_CARD_BACKS;
}

export function getPrintDpi(session: Session): number {
  return session.printDpi ?? DEFAULT_PRINT_DPI;
}

export function getSvgOutput(session: Session): SvgOutput {
  return session.svgOutput ?? DEFAULT_SVG_OUTPUT;
}
