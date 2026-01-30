import { registerSource, type ParsedCard, type FetchResult } from "@/sources/index";

interface PokemonCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

/**
 * Parse a Pokemon card list in common formats:
 * - "3 Pikachu"
 * - "2x Charizard"
 */
export function parsePokemonCardList(text: string): ParsedCard[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const cards: ParsedCard[] = [];

  for (const line of lines) {
    // Skip comments and section headers
    if (line.startsWith("//") || line.startsWith("#") || line.startsWith("==") || line.startsWith("--")) continue;

    // Match: optional count (with optional 'x'), then card name
    const regex = /^(\d+)\s*x?\s+(.+)$/i;
    const match = regex.exec(line);

    if (match?.[1] && match[2]) {
      const count = parseInt(match[1], 10);
      const name = match[2].trim();
      if (name && count > 0) {
        cards.push({ count, name });
      }
    } else {
      // Try without count (default to 1)
      const name = line.trim();
      if (name) {
        cards.push({ count: 1, name });
      }
    }
  }

  return cards;
}

/**
 * Fetch a single card from TCGdex API
 * API: https://api.tcgdex.net/v2/en/cards?name=pikachu
 */
async function fetchCardFromTCGdex(name: string): Promise<PokemonCard> {
  // Search by name (laxist match by default)
  const url = `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API error: ${String(response.status)}`);
  }

  const data = (await response.json()) as PokemonCard[];

  if (data.length === 0) {
    throw new Error("Card not found");
  }

  // Try to find exact match first
  const exactMatch = data.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (exactMatch) return exactMatch;

  // Return first result
  const result = data[0];
  if (!result) {
    throw new Error("Card not found");
  }
  return result;
}

/**
 * Fetch card image and convert to data URL
 */
async function fetchCardImage(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch image");
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch multiple cards from TCGdex API with rate limiting
 */
export async function fetchCardsFromPokemonTCG(
  cards: ParsedCard[],
  addImage: (name: string, data: string) => string,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card?.name) continue;

    onProgress?.(i + 1, cards.length, card.name);

    try {
      const pokemonCard = await fetchCardFromTCGdex(card.name);

      if (!pokemonCard.image) {
        results.push({
          name: pokemonCard.name,
          count: card.count,
          error: "No image available",
        });
        continue;
      }

      // TCGdex returns image URL without extension, add /high.png for high quality PNG
      // (pdf-lib doesn't support WebP, so we use PNG)
      const imageUrl = `${pokemonCard.image}/high.png`;

      // Fetch the image
      const imageData = await fetchCardImage(imageUrl);

      // Store image immediately during fetch
      const imageId = addImage(`${pokemonCard.name}.png`, imageData);

      results.push({
        name: pokemonCard.name,
        count: card.count,
        imageId,
        imageData,
      });
    } catch (error) {
      results.push({
        name: card.name,
        count: card.count,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Rate limiting: 100ms between requests
    if (i < cards.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

registerSource({
  id: "pokemon-tcgdex",
  name: "Pokémon TCG (TCGdex)",
  placeholder: "3 Pikachu\n2x Charizard\nMewtwo",
  parse: parsePokemonCardList,
  fetch: fetchCardsFromPokemonTCG,
});
