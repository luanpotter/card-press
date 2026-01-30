import { registerSource, type ParsedCard } from "@/sources/index";

export interface ScryfallCard {
  name: string;
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
  };
  card_faces?: {
    name: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
      png: string;
    };
  }[];
}

export interface FetchResult {
  name: string;
  count: number;
  imageId?: string;
  imageData?: string; // Only used for preview in results, not stored
  error?: string;
}

/**
 * Parse a card list in common MTG formats:
 * - "1 Mana Vault"
 * - "2x Counterspell"
 * - "1x Sol Ring (UMA)"
 */
export function parseCardList(text: string): ParsedCard[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const cards: ParsedCard[] = [];

  for (const line of lines) {
    // Skip comments
    if (line.startsWith("//") || line.startsWith("#")) continue;

    // Match: optional count (with optional 'x'), then card name
    // Examples: "1 Mana Vault", "2x Counterspell", "Mana Vault"
    const regex = /^(\d+)\s*x?\s+(.+?)(?:\s*\([^)]+\))?(?:\s*\d+)?(?:\s*\[.*\])?$/i;
    const match = regex.exec(line);

    if (match?.[1] && match[2]) {
      const count = parseInt(match[1], 10);
      const name = match[2].trim();
      if (name && count > 0) {
        cards.push({ count, name });
      }
    } else {
      // Try without count (default to 1)
      const nameOnly = line
        .replace(/\s*\([^)]+\)\s*$/, "")
        .replace(/\s*\[.*\]\s*$/, "")
        .trim();
      if (nameOnly) {
        cards.push({ count: 1, name: nameOnly });
      }
    }
  }

  return cards;
}

interface ScryfallError {
  details?: string;
}

/**
 * Fetch a card from Scryfall by name
 */
export async function fetchCardFromScryfall(name: string): Promise<ScryfallCard> {
  const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ScryfallError;
    throw new Error(error.details ?? `Card not found: ${name}`);
  }

  return (await response.json()) as ScryfallCard;
}

/**
 * Get the best image URL from a Scryfall card (prefer PNG for print quality)
 */
export function getCardImageUrl(card: ScryfallCard): string | null {
  // Handle double-faced cards
  if (card.card_faces?.[0]?.image_uris) {
    const uris = card.card_faces[0].image_uris;
    return uris.png;
  }

  if (card.image_uris) {
    return card.image_uris.png;
  }

  return null;
}

/**
 * Download an image and convert to data URL
 */
export async function downloadImageAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${String(response.status)}`);
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch multiple cards with rate limiting (100ms between requests)
 * Images are stored via storeImage as they're fetched, so import is instant.
 */
export async function fetchCardsFromScryfall(
  cards: ParsedCard[],
  storeImage: (name: string, data: string) => string,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card?.name) continue;

    onProgress?.(i + 1, cards.length, card.name);

    try {
      const scryfallCard = await fetchCardFromScryfall(card.name);
      const imageUrl = getCardImageUrl(scryfallCard);

      if (!imageUrl) {
        results.push({
          name: scryfallCard.name,
          count: card.count,
          error: "No image available",
        });
        continue;
      }

      const imageData = await downloadImageAsDataUrl(imageUrl);
      // Store image immediately - this is async and non-blocking
      const imageId = storeImage(scryfallCard.name, imageData);

      results.push({
        name: scryfallCard.name,
        count: card.count,
        imageId,
        imageData, // Keep for preview thumbnail only
      });
    } catch (err) {
      results.push({
        name: card.name,
        count: card.count,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    // Rate limit: wait 100ms between requests (Scryfall asks for max 10 req/sec)
    if (i < cards.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return results;
}

registerSource({
  id: "mtg-scryfall",
  name: "Magic: The Gathering (Scryfall)",
  placeholder: "1 Mana Vault\n2x Counterspell\nSol Ring",
  parse: parseCardList,
  fetch: fetchCardsFromScryfall,
});
