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

const DEFAULT_LANG = "en";

/**
 * Normalize a Scryfall set code: strip non-alphanumeric characters and uppercase.
 */
function normalizeSetCode(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized || undefined;
}

interface SetBlock {
  set?: string;
  number?: string;
  lang?: string;
}

/**
 * Parse a set block: either a bare set code "(UMA)", or a collector-number
 * reference "(UMA:1)" / "(UMA:1:ja)" (language defaults to "en").
 */
function parseSetBlock(raw: string | undefined): SetBlock {
  if (!raw) return {};

  const [codePart, numberPart, langPart] = raw.split(":").map((p) => p.trim());
  const set = normalizeSetCode(codePart);
  if (!numberPart) {
    return set ? { set } : {};
  }

  const number = numberPart.replace(/[^a-zA-Z0-9]/g, "");
  const lang = (langPart ? langPart.replace(/[^a-zA-Z]/g, "") : DEFAULT_LANG).toLowerCase();

  return { ...(set ? { set } : {}), ...(number ? { number } : {}), lang };
}

/**
 * Parse a card list in common MTG formats:
 * - "1 Mana Vault"
 * - "2x Counterspell"
 * - "1x Sol Ring (UMA)"
 * - "1x (UMA:1)" - fetch by collector number
 * - "1x (UMA:1:ja)" - fetch by collector number in a specific language
 */
export function parseCardList(text: string): ParsedCard[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const cards: ParsedCard[] = [];

  // Match: optional count (with optional 'x'), then optional card name, then optional set block
  // Examples: "1 Mana Vault", "2x Counterspell", "1x Sol Ring (UMA)", "1x (UMA:1:ja)"
  const regex = /^(?:(\d+)\s*x?\s+)?(.*?)(?:\s*\(([^)]+)\))?(?:\s*\d+)?(?:\s*\[.*\])?$/i;

  for (const line of lines) {
    // Skip comments
    if (line.startsWith("//") || line.startsWith("#")) continue;

    const match = regex.exec(line);
    if (!match) continue;

    const count = match[1] ? parseInt(match[1], 10) : 1;
    const name = match[2]?.trim();
    const { set, number, lang } = parseSetBlock(match[3]);

    if (count > 0 && (name || (set && number))) {
      cards.push({
        count,
        ...(name ? { name } : {}),
        ...(set ? { set } : {}),
        ...(number ? { number } : {}),
        ...(lang ? { lang } : {}),
      });
    }
  }

  return cards;
}

interface ScryfallError {
  details?: string;
}

/**
 * Fetch a card from Scryfall by name, optionally scoped to a set (alphanumeric set code)
 */
export async function fetchCardFromScryfall(name: string, set?: string): Promise<ScryfallCard> {
  const params = new URLSearchParams({ fuzzy: name });
  const normalizedSet = normalizeSetCode(set);
  if (normalizedSet) {
    params.set("set", normalizedSet);
  }

  const url = `https://api.scryfall.com/cards/named?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ScryfallError;
    throw new Error(error.details ?? `Card not found: ${name}`);
  }

  return (await response.json()) as ScryfallCard;
}

/**
 * Fetch a card from Scryfall by set code and collector number, optionally in a specific language (default "en")
 */
export async function fetchCardByCollectorNumber(
  set: string,
  number: string,
  lang: string = DEFAULT_LANG
): Promise<ScryfallCard> {
  const code = normalizeSetCode(set)?.toLowerCase();
  const collectorNumber = number.trim();
  const normalizedLang = (lang || DEFAULT_LANG).toLowerCase();

  if (!code || !collectorNumber) {
    throw new Error("A set code and collector number are required");
  }

  const url = `https://api.scryfall.com/cards/${encodeURIComponent(code)}/${encodeURIComponent(collectorNumber)}/${encodeURIComponent(normalizedLang)}`;
  const response = await fetch(url);

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as ScryfallError;
    throw new Error(error.details ?? `Card not found: ${code.toUpperCase()} #${collectorNumber}`);
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
  onProgress?: (current: number, total: number, name: string) => void,
  signal?: AbortSignal
): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  for (let i = 0; i < cards.length; i++) {
    // Check for cancellation
    if (signal?.aborted) {
      break;
    }

    const card = cards[i];
    if (!card) continue;

    const label = card.name ?? `${card.set ?? "?"} #${card.number ?? "?"}`;
    onProgress?.(i + 1, cards.length, label);

    try {
      let scryfallCard: ScryfallCard;
      if (card.name) {
        scryfallCard = await fetchCardFromScryfall(card.name, card.set);
      } else if (card.set && card.number) {
        scryfallCard = await fetchCardByCollectorNumber(card.set, card.number, card.lang);
      } else {
        results.push({ name: label, count: card.count, error: "Missing card name or set/collector number" });
        continue;
      }

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
        name: label,
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
  placeholder: "1 Mana Vault\n2x Counterspell\nSol Ring\n1x (UMA:1)\n1x (UMA:1:ja)",
  parse: parseCardList,
  fetch: fetchCardsFromScryfall,
});
