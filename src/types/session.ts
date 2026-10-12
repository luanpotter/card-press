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

/** How raster images are brought to the print resolution */
export enum RasterScaling {
  /** Resampled to exactly the print resolution with Lanczos, sharp and smooth */
  Lanczos = "lanczos",
  /** Resampled to exactly the print resolution by repeating or dropping pixels, keeping hard edges (pixel art) */
  Nearest = "nearest",
  /** Kept at the image's own size, left for the printer to resample */
  Original = "original",
}

export const DEFAULT_RASTER_SCALING = RasterScaling.Lanczos;

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

/** How a card image is shaped to its slot */
export enum CardFit {
  /** Fills the slot exactly, distorted if its aspect ratio differs */
  Stretch = "stretch",
  /** As large as fits whole in the slot, centered, with the slot background in the strips left over */
  Fit = "fit",
}

// Most card art is made at the card's own ratio, which both modes print the same
export const DEFAULT_CARD_FIT = CardFit.Stretch;

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
  rasterScaling?: RasterScaling | undefined;
  svgOutput?: SvgOutput | undefined;
  cardFit?: CardFit | undefined;
}

export function getCardBacks(session: Session): CardBacks {
  return session.cardBacks ?? DEFAULT_CARD_BACKS;
}

export function getPrintDpi(session: Session): number {
  return session.printDpi ?? DEFAULT_PRINT_DPI;
}

export function getRasterScaling(session: Session): RasterScaling {
  return session.rasterScaling ?? DEFAULT_RASTER_SCALING;
}

export function getSvgOutput(session: Session): SvgOutput {
  return session.svgOutput ?? DEFAULT_SVG_OUTPUT;
}

export function getCardFit(session: Session): CardFit {
  return session.cardFit ?? DEFAULT_CARD_FIT;
}
