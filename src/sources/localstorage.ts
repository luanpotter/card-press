import { registerSource, type ParsedCard, type FetchResult } from "@/sources/index";
import { useImageStore } from "@/app/store/images";

/**
 * Parse a card list - expects image names, one per line with optional count
 * Examples:
 * - "Mana Vault"
 * - "2 Counterspell"
 * - "2x Sol Ring"
 */
export function parseLocalList(text: string): ParsedCard[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const cards: ParsedCard[] = [];

  for (const line of lines) {
    // Skip comments
    if (line.startsWith("//") || line.startsWith("#")) continue;

    // Match: optional count (with optional 'x'), then name
    const regex = /^(\d+)\s*x?\s+(.+)$/i;
    const match = regex.exec(line);

    if (match?.[1] && match[2]) {
      const count = parseInt(match[1], 10);
      const name = match[2].trim();
      if (name && count > 0) {
        cards.push({ count, name });
      }
    } else {
      // Name only (default to 1)
      cards.push({ count: 1, name: line });
    }
  }

  return cards;
}

/**
 * Find images in local storage by name (fuzzy match)
 */
export function fetchFromLocalStorage(
  cards: ParsedCard[],
  _storeImage: (name: string, data: string) => string,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];
  const images = useImageStore.getState().images;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;

    const name = card.name ?? "";

    onProgress?.(i + 1, cards.length, name);

    // Find image by exact name match first
    let found = images.find((img) => img.name.toLowerCase() === name.toLowerCase());

    // If not found, try partial match (name contains search term)
    found ??= images.find((img) => img.name.toLowerCase().includes(name.toLowerCase()));

    // If still not found, try if search term contains image name
    found ??= images.find((img) => name.toLowerCase().includes(img.name.toLowerCase()));

    if (found) {
      results.push({
        name,
        count: card.count,
        imageId: found.id,
        imageData: found.data,
      });
    } else {
      results.push({
        name,
        count: card.count,
        error: `Not found in local storage`,
      });
    }
  }

  return Promise.resolve(results);
}

// Register the source
registerSource({
  id: "localstorage",
  name: "Local Storage",
  placeholder: `Enter image names (one per line):

Mana Vault
2 Counterspell
3x Sol Ring

These will be matched against images already stored in your browser from previous imports.`,
  fetch: fetchFromLocalStorage,
  parse: parseLocalList,
});
