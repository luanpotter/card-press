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
}

export function getCardBacks(session: Session): CardBacks {
  return session.cardBacks ?? DEFAULT_CARD_BACKS;
}
