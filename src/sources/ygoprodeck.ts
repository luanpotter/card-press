export interface YGOCard {
  id: number;
  name: string;
  card_images: {
    id: number;
    image_url: string;
    image_url_small: string;
    image_url_cropped: string;
  }[];
}

export interface YGOApiResponse {
  data: YGOCard[];
  error?: string;
}

export interface ParsedYGOCardLine {
  count: number;
  name?: string;
  id?: number;
}

export interface FetchResult {
  name: string;
  count: number;
  imageId?: string;
  imageData?: string;
  error?: string;
}

/**
 * Parse a Yu-Gi-Oh card list in common formats:
 * - "3 Dark Magician"
 * - "3x Blue-Eyes White Dragon"
 * - YDK format (card IDs)
 */
export function parseYGOCardList(text: string): ParsedYGOCardLine[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const cards: ParsedYGOCardLine[] = [];

  // Detect YDK format (starts with #created or has #main section)
  const isYDK = lines.some((l) => l.startsWith("#main") || l.startsWith("#created"));

  if (isYDK) {
    // YDK format: card IDs, one per line
    let inDeck = false;
    for (const line of lines) {
      if (line.startsWith("#main") || line.startsWith("#extra")) {
        inDeck = true;
        continue;
      }
      if (line.startsWith("!side") || line.startsWith("#")) {
        // Skip side deck and comments
        if (line.startsWith("!side")) inDeck = false;
        continue;
      }
      if (!inDeck) continue;

      const id = parseInt(line, 10);
      if (!isNaN(id) && id > 0) {
        // Check if we already have this card
        const existing = cards.find((c) => c.id === id);
        if (existing) {
          existing.count++;
        } else {
          cards.push({ count: 1, id });
        }
      }
    }
  } else {
    // Text format: COUNT NAME or COUNTx NAME
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
        if (name && !name.startsWith("#") && !name.startsWith("!")) {
          cards.push({ count: 1, name });
        }
      }
    }
  }

  return cards;
}

/**
 * Fetch a single card from YGOPRODeck API
 * Note: Requires CORS to be disabled in browser
 */
async function fetchCardFromYGO(card: ParsedYGOCardLine): Promise<YGOCard> {
  let url: string;

  if (card.id) {
    // Fetch by ID (passcode)
    url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${String(card.id)}`;
  } else if (card.name) {
    // Fuzzy search by name
    url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(card.name)}`;
  } else {
    throw new Error("Card must have either id or name");
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error ?? `Card not found`);
  }

  const data = (await response.json()) as YGOApiResponse;

  if (data.data.length === 0) {
    throw new Error("Card not found");
  }

  // If searching by name, try to find exact match first
  if (card.name) {
    const exactMatch = data.data.find((c) => c.name.toLowerCase() === card.name?.toLowerCase());
    if (exactMatch) return exactMatch;
  }

  // Return first result
  const result = data.data[0];
  if (!result) {
    throw new Error("Card not found");
  }
  return result;
}

/**
 * Fetch card image and convert to data URL
 * Note: Requires CORS to be disabled in browser
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
 * Fetch multiple cards from YGOPRODeck with rate limiting
 * Rate limit: 20 requests/second, we'll use 50ms delay to be safe
 */
export async function fetchCardsFromYGO(
  cards: ParsedYGOCardLine[],
  addImage: (name: string, data: string) => string,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card) continue;

    const cardName = card.name ?? `Card #${String(card.id)}`;
    onProgress?.(i + 1, cards.length, cardName);

    try {
      const ygoCard = await fetchCardFromYGO(card);
      const imageInfo = ygoCard.card_images[0];

      if (!imageInfo) {
        results.push({
          name: ygoCard.name,
          count: card.count,
          error: "No image available",
        });
        continue;
      }

      // Fetch the image
      const imageData = await fetchCardImage(imageInfo.image_url);

      // Store image immediately during fetch
      const imageId = addImage(`${ygoCard.name}.jpg`, imageData);

      results.push({
        name: ygoCard.name,
        count: card.count,
        imageId,
        imageData,
      });
    } catch (error) {
      results.push({
        name: cardName,
        count: card.count,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // Rate limiting: 50ms between requests (20 req/s limit)
    if (i < cards.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return results;
}
