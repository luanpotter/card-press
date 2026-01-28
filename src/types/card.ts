import type { Dimension } from "@/types/dimension";

export enum CardSizePreset {
  MTG = "MTG",
  YuGiOh = "Yu-Gi-Oh!",
  Custom = "Custom",
}

export const CARD_SIZE_PRESETS: Record<Exclude<CardSizePreset, CardSizePreset.Custom>, Dimension> = {
  [CardSizePreset.MTG]: { width: 63, height: 88 },
  [CardSizePreset.YuGiOh]: { width: 59, height: 86 },
};

export const DEFAULT_CARD_SIZE: Dimension = CARD_SIZE_PRESETS[CardSizePreset.MTG];

export function getCardSizePreset(dimension: Dimension): CardSizePreset {
  for (const [preset, size] of Object.entries(CARD_SIZE_PRESETS)) {
    if (size.width === dimension.width && size.height === dimension.height) {
      return preset as CardSizePreset;
    }
  }
  return CardSizePreset.Custom;
}
