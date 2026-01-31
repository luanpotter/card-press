import { registerSource, type ParsedCard, type FetchResult } from "@/sources/index";

// Dim Rift card data structure
interface DimRiftCard {
  key: string;
  name: string;
  type: { key: string; desc: string };
  faction?: { key: string; desc: string };
  extra?: { key: string; desc: string };
  rank?: number;
  subType?: string;
}

// Cache for card data to avoid refetching
let cardCache: DimRiftCard[] | null = null;
let cardCachePromise: Promise<DimRiftCard[]> | null = null;

const DOMAIN = "https://luan.xyz/projects/dim-rift";

/**
 * Fetch all cards from Dim Rift
 */
async function fetchAllCards(): Promise<DimRiftCard[]> {
  if (cardCache) return cardCache;

  if (cardCachePromise) return await cardCachePromise;

  cardCachePromise = (async () => {
    const response = await fetch(`${DOMAIN}/data/cards.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch cards: ${String(response.status)}`);
    }
    const data = (await response.json()) as DimRiftCard[];
    cardCache = data;
    return data;
  })();

  return await cardCachePromise;
}

/**
 * Get the image URL for a card
 */
function getCardImageUrl(key: string): string {
  return `${DOMAIN}/assets/_card-gen/${key}.png`;
}

/**
 * Parse a bracket filter expression and return matching cards
 * All tokens within a bracket are ANDed together
 * Examples:
 *   [men] - all Men faction cards
 *   [men extra] - all Men AND extra deck cards
 *   [fey -artifacts] - all Fey cards AND NOT artifacts
 *   [fey extra monument] - all Fey AND extra deck AND monument cards
 *   [rank1] or [r1] - all rank 1 cards
 *   [creature] - all creatures
 */
function parseFilterExpression(expr: string, cards: DimRiftCard[]): DimRiftCard[] {
  const tokens = expr.toLowerCase().trim().split(/\s+/);

  // Parse tokens into include/exclude filters
  const includes = new Set<string>();
  const excludes = new Set<string>();

  for (const token of tokens) {
    if (token.startsWith("-")) {
      excludes.add(token.slice(1));
    } else {
      includes.add(token);
    }
  }

  // Helper to normalize plurals and aliases
  function normalize(token: string): string[] {
    const aliases: Record<string, string[]> = {
      // Plurals -> singular
      artifacts: ["artifact"],
      creatures: ["creature"],
      monuments: ["monument"],
      // Type aliases
      equip: ["equipment"],
      equipment: ["equipment"],
      equips: ["equipment"],
      scroll: ["scroll"],
      scrolls: ["scroll"],
      vehicle: ["vehicle"],
      vehicles: ["vehicle"],
      // Extra deck
      extra: ["extra"],
      extradeck: ["extra"],
      main: ["main"],
      maindeck: ["main"],
      // Ranks
      r0: ["rank0"],
      r1: ["rank1"],
      r2: ["rank2"],
      r3: ["rank3"],
      rank0: ["rank0"],
      rank1: ["rank1"],
      rank2: ["rank2"],
      rank3: ["rank3"],
      // Subtypes
      spirit: ["spirit"],
      spirits: ["spirit"],
      mercenary: ["mercenary"],
      mercenaries: ["mercenary"],
      construct: ["construct"],
      constructs: ["construct"],
      monster: ["monster"],
      monsters: ["monster"],
      beast: ["beast"],
      beasts: ["beast"],
      human: ["human"],
      humans: ["human"],
      ally: ["ally"],
      allies: ["ally"],
      manifestation: ["manifestation"],
      manifestations: ["manifestation"],
    };
    return aliases[token] ?? [token];
  }

  // Filter cards
  return cards.filter((card) => {
    // Build card attributes for matching
    const attrs = new Set<string>();

    // Type
    attrs.add(card.type.key);

    // Faction
    if (card.faction?.key) {
      attrs.add(card.faction.key);
    }

    // Extra deck status
    if (card.extra?.key === "true") {
      attrs.add("extra");
    } else {
      attrs.add("main");
    }

    // Rank
    const rank = card.rank ?? 0;
    attrs.add(`rank${String(rank)}`);

    // Subtype
    if (card.subType) {
      attrs.add(card.subType.toLowerCase());
    }

    // Check includes: card must match ALL include tokens (AND logic)
    for (const include of includes) {
      const normalized = normalize(include);
      const matchesThisToken = normalized.some((n) => attrs.has(n));
      if (!matchesThisToken) {
        return false;
      }
    }

    // Check excludes: card must NOT match any normalized token from excludes
    for (const exclude of excludes) {
      const normalized = normalize(exclude);
      for (const n of normalized) {
        if (attrs.has(n)) {
          return false;
        }
      }
    }

    return true;
  });
}

type FindCardResult =
  | { status: "found"; card: DimRiftCard }
  | { status: "not-found" }
  | { status: "ambiguous"; matches: DimRiftCard[] };

/**
 * Find a card by name or key (case insensitive)
 */
function findCard(query: string, cards: DimRiftCard[]): FindCardResult {
  const q = query.toLowerCase().trim();

  // Exact key match
  const byKey = cards.find((c) => c.key === q);
  if (byKey) return { status: "found", card: byKey };

  // Exact name match (case insensitive)
  const byName = cards.find((c) => c.name.toLowerCase() === q);
  if (byName) return { status: "found", card: byName };

  // Single word partial match - if exactly one card contains this word in its name
  if (!q.includes(" ") && !q.includes("_")) {
    const matches = cards.filter((c) => {
      const words = c.name.toLowerCase().split(/\s+/);
      return words.some((word) => word.includes(q));
    });
    if (matches.length === 1 && matches[0]) {
      return { status: "found", card: matches[0] };
    }
    if (matches.length > 1) {
      return { status: "ambiguous", matches };
    }
  }

  return { status: "not-found" };
}

// Extended parsed card for Dim Rift including resolved cards from filters
export interface DimRiftParsedEntry {
  count: number;
  name?: string;
  key?: string;
  // For bracket expressions, we resolve them at parse time with the card list
  isFilter?: boolean;
  filterExpr?: string;
}

/**
 * Parse Dim Rift card list with advanced filter support
 * Formats:
 *   Card Name           -> 1x card by exact/fuzzy name
 *   2x card_key         -> 2x card by key
 *   2x [men]            -> 2x each card from Men faction
 *   [fey -artifacts]    -> 1x each non-artifact Fey card
 *   [fey extra monument] [wynn extra monument] -> all Fey or Wynn extra monuments
 */
export function parseDimRiftCardList(text: string): ParsedCard[] {
  // We need the cards to resolve filters, but parse is sync.
  // So we return placeholder entries that fetch() will resolve.
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const entries: ParsedCard[] = [];

  for (const line of lines) {
    // Skip comments
    if (line.startsWith("//") || line.startsWith("#")) continue;

    // Check for bracket expressions (can have multiple per line)
    const bracketRegex = /\[([^\]]+)\]/g;
    const brackets = [...line.matchAll(bracketRegex)];

    if (brackets.length > 0) {
      // Parse count prefix if present: "2x [men]" or just "[men]"
      const countMatch = /^(\d+)\s*x?\s*/.exec(line);
      const count = countMatch?.[1] ? parseInt(countMatch[1], 10) : 1;

      // Combine all bracket expressions on this line
      for (const match of brackets) {
        if (match[1]) {
          entries.push({
            count,
            // Store filter expression in name field with special prefix
            name: `__FILTER__:${match[1]}`,
          });
        }
      }
    } else {
      // Regular card entry: "2x Card Name" or "card_key" or "Card Name"
      const regex = /^(\d+)\s*x?\s+(.+)$/i;
      const match = regex.exec(line);

      if (match?.[1] && match[2]) {
        entries.push({
          count: parseInt(match[1], 10),
          name: match[2].trim(),
        });
      } else {
        // No count, default to 1
        entries.push({
          count: 1,
          name: line.trim(),
        });
      }
    }
  }

  return entries;
}

/**
 * Download an image and convert to data URL
 */
async function downloadImageAsDataUrl(url: string): Promise<string> {
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
 * Fetch cards from Dim Rift, resolving filters
 */
export async function fetchCardsFromDimRift(
  parsedCards: ParsedCard[],
  storeImage: (name: string, data: string) => string,
  onProgress?: (current: number, total: number, name: string) => void
): Promise<FetchResult[]> {
  // Fetch all card data first
  const allCards = await fetchAllCards();

  // Resolve parsed entries to actual cards
  const resolvedCards: { card: DimRiftCard; count: number }[] = [];

  for (const entry of parsedCards) {
    if (!entry.name) continue;

    // Check if it's a filter expression
    if (entry.name.startsWith("__FILTER__:")) {
      const filterExpr = entry.name.slice("__FILTER__:".length);
      const filtered = parseFilterExpression(filterExpr, allCards);

      for (const card of filtered) {
        resolvedCards.push({ card, count: entry.count });
      }
    } else {
      // Regular card lookup
      const result = findCard(entry.name, allCards);
      if (result.status === "found") {
        resolvedCards.push({ card: result.card, count: entry.count });
      } else if (result.status === "ambiguous") {
        // Ambiguous match - create error entry with match info
        const matchNames = result.matches.slice(0, 5).map((c) => c.name);
        const suffix = result.matches.length > 5 ? `, +${String(result.matches.length - 5)} more` : "";
        resolvedCards.push({
          card: {
            key: `__ERROR__:${entry.name}`,
            name: entry.name,
            type: { key: "ambiguous", desc: `Ambiguous: matches ${matchNames.join(", ")}${suffix}` },
          },
          count: entry.count,
        });
      } else {
        // Card not found - we'll handle this in the results
        resolvedCards.push({
          card: { key: `__ERROR__:${entry.name}`, name: entry.name, type: { key: "not-found", desc: "Not found" } },
          count: entry.count,
        });
      }
    }
  }

  // Deduplicate by key, summing counts
  const cardMap = new Map<string, { card: DimRiftCard; count: number }>();
  for (const { card, count } of resolvedCards) {
    const existing = cardMap.get(card.key);
    if (existing) {
      existing.count += count;
    } else {
      cardMap.set(card.key, { card, count });
    }
  }

  const uniqueCards = Array.from(cardMap.values());
  const results: FetchResult[] = [];

  // Fetch images for each unique card
  for (let i = 0; i < uniqueCards.length; i++) {
    const entry = uniqueCards[i];
    if (!entry) continue;

    const { card, count } = entry;

    onProgress?.(i + 1, uniqueCards.length, card.name);

    // Check if it's an error placeholder
    if (card.type.key === "not-found") {
      results.push({
        name: card.name,
        count,
        error: "Card not found",
      });
      continue;
    }

    if (card.type.key === "ambiguous") {
      results.push({
        name: card.name,
        count,
        error: card.type.desc,
      });
      continue;
    }

    try {
      const imageUrl = getCardImageUrl(card.key);
      const imageData = await downloadImageAsDataUrl(imageUrl);
      const imageId = storeImage(card.name, imageData);

      results.push({
        name: card.name,
        count,
        imageId,
        imageData,
      });
    } catch (err) {
      results.push({
        name: card.name,
        count,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }

    // Small delay between requests
    if (i < uniqueCards.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }

  return results;
}

registerSource({
  id: "dimrift",
  name: "Dimensional Rift",
  placeholder: `Clay Construct
2x mud_construct
[men]
[fey -artifacts extra]
[telur creature rank1]`,
  parse: parseDimRiftCardList,
  fetch: fetchCardsFromDimRift,
});
