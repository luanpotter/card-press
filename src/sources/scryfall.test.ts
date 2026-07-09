import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  downloadImageAsDataUrl,
  fetchCardByCollectorNumber,
  fetchCardFromScryfall,
  fetchCardsFromScryfall,
  getCardImageUrl,
  parseCardList,
  type ScryfallCard,
} from "@/sources/scryfall";

// Bun's runtime has no FileReader; downloadImageAsDataUrl only needs readAsDataURL.
class FakeFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((buffer) => {
        const base64 = Buffer.from(buffer).toString("base64");
        this.result = `data:${blob.type};base64,${base64}`;
        this.onload?.();
      })
      .catch(() => {
        this.onerror?.();
      });
  }
}
globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;

describe("parseCardList", () => {
  test("parses a count and name", () => {
    expect(parseCardList("1 Mana Vault")).toEqual([{ count: 1, name: "Mana Vault" }]);
  });

  test("parses a count with an 'x' multiplier", () => {
    expect(parseCardList("2x Counterspell")).toEqual([{ count: 2, name: "Counterspell" }]);
  });

  test("defaults count to 1 when omitted", () => {
    expect(parseCardList("Sol Ring")).toEqual([{ count: 1, name: "Sol Ring" }]);
  });

  test("skips blank lines and comments", () => {
    const text = ["// a comment", "", "# another comment", "1 Mana Vault"].join("\n");
    expect(parseCardList(text)).toEqual([{ count: 1, name: "Mana Vault" }]);
  });

  test("parses a bare set code and normalizes it to uppercase", () => {
    expect(parseCardList("1x Sol Ring (uma)")).toEqual([{ count: 1, name: "Sol Ring", set: "UMA" }]);
  });

  test("excludes a zero count line", () => {
    expect(parseCardList("0 Mana Vault")).toEqual([]);
  });

  test("excludes a bare set code with no name (collector number required)", () => {
    expect(parseCardList("(UMA)")).toEqual([]);
  });

  test("parses a collector-number reference with no name, defaulting language to 'en'", () => {
    expect(parseCardList("1x (UMA:1)")).toEqual([{ count: 1, set: "UMA", number: "1", lang: "en" }]);
  });

  test("parses a collector-number reference with an explicit language", () => {
    expect(parseCardList("1x (UMA:1:ja)")).toEqual([{ count: 1, set: "UMA", number: "1", lang: "ja" }]);
  });

  test("parses a collector-number reference without a count prefix", () => {
    expect(parseCardList("(UMA:1)")).toEqual([{ count: 1, set: "UMA", number: "1", lang: "en" }]);
  });

  test("trims whitespace around set-block segments and lowercases the language", () => {
    expect(parseCardList("1x ( UMA : 1 : JA )")).toEqual([{ count: 1, set: "UMA", number: "1", lang: "ja" }]);
  });

  test("parses multiple mixed lines", () => {
    const text = ["1 Mana Vault", "2x Counterspell", "1x Sol Ring (UMA)", "1x (UMA:1:ja)"].join("\n");
    expect(parseCardList(text)).toEqual([
      { count: 1, name: "Mana Vault" },
      { count: 2, name: "Counterspell" },
      { count: 1, name: "Sol Ring", set: "UMA" },
      { count: 1, set: "UMA", number: "1", lang: "ja" },
    ]);
  });
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("fetchCardFromScryfall", () => {
  afterEach(() => {
    mock.restore();
  });

  test("requests the named endpoint with a fuzzy name", async () => {
    const card: ScryfallCard = { name: "Sol Ring" };
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(card)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchCardFromScryfall("Sol Ring");

    expect(result).toEqual(card);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.scryfall.com/cards/named?fuzzy=Sol+Ring");
  });

  test("includes a normalized, uppercased set parameter when provided", async () => {
    const card: ScryfallCard = { name: "Sol Ring" };
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(card)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchCardFromScryfall("Sol Ring", "uma");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.scryfall.com/cards/named?fuzzy=Sol+Ring&set=UMA");
  });

  test("throws the API's error details on failure", () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse({ details: "No cards found" }, { status: 404 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(fetchCardFromScryfall("Not A Real Card")).rejects.toThrow("No cards found");
  });

  test("falls back to a generic error when the API gives no details", () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(new Response("", { status: 500 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(fetchCardFromScryfall("Sol Ring")).rejects.toThrow("Card not found: Sol Ring");
  });
});

describe("fetchCardByCollectorNumber", () => {
  afterEach(() => {
    mock.restore();
  });

  test("requests the collector-number endpoint with a lowercased code and default language", async () => {
    const card: ScryfallCard = { name: "Sol Ring" };
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(card)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchCardByCollectorNumber("UMA", "1");

    expect(result).toEqual(card);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.scryfall.com/cards/uma/1/en");
  });

  test("lowercases an explicit language", async () => {
    const card: ScryfallCard = { name: "Sol Ring" };
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(card)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchCardByCollectorNumber("UMA", "1", "JA");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.scryfall.com/cards/uma/1/ja");
  });

  test("throws without calling fetch when the set code is missing", () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse({})));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(fetchCardByCollectorNumber("", "1")).rejects.toThrow("A set code and collector number are required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("throws the API's error details on failure", () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse({ details: "Card not found" }, { status: 404 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(fetchCardByCollectorNumber("UMA", "999")).rejects.toThrow("Card not found");
  });
});

describe("getCardImageUrl", () => {
  test("returns the png for a single-faced card", () => {
    const card: ScryfallCard = {
      name: "Sol Ring",
      image_uris: { small: "s", normal: "n", large: "l", png: "https://example.com/sol-ring.png" },
    };
    expect(getCardImageUrl(card)).toBe("https://example.com/sol-ring.png");
  });

  test("prefers the first face's png for a double-faced card", () => {
    const card: ScryfallCard = {
      name: "Delver of Secrets",
      card_faces: [
        {
          name: "Delver of Secrets",
          image_uris: { small: "s", normal: "n", large: "l", png: "https://example.com/front.png" },
        },
        { name: "Insectile Aberration" },
      ],
    };
    expect(getCardImageUrl(card)).toBe("https://example.com/front.png");
  });

  test("returns null when no image is available", () => {
    const card: ScryfallCard = { name: "No Image Card" };
    expect(getCardImageUrl(card)).toBeNull();
  });
});

describe("downloadImageAsDataUrl", () => {
  afterEach(() => {
    mock.restore();
  });

  test("converts a fetched image into a data URL", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(new Response(bytes, { status: 200, headers: { "content-type": "image/png" } }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const dataUrl = await downloadImageAsDataUrl("https://example.com/card.png");

    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  test("throws when the download fails", () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(new Response("", { status: 404 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(downloadImageAsDataUrl("https://example.com/missing.png")).rejects.toThrow("Failed to download image: 404");
  });
});

describe("fetchCardsFromScryfall", () => {
  let storedImages: { name: string; data: string }[];
  const storeImage = (name: string, data: string): string => {
    storedImages.push({ name, data });
    return `stored-${String(storedImages.length)}`;
  };

  beforeEach(() => {
    storedImages = [];
  });

  afterEach(() => {
    mock.restore();
  });

  test("fetches by name via the named endpoint", async () => {
    const card: ScryfallCard = { name: "Sol Ring" };
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(card)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const results = await fetchCardsFromScryfall([{ count: 1, name: "Sol Ring" }], storeImage);

    expect(results).toEqual([{ name: "Sol Ring", count: 1, error: "No image available" }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.scryfall.com/cards/named?fuzzy=Sol+Ring");
  });

  test("fetches by collector number when no name is present", async () => {
    const card: ScryfallCard = { name: "Sol Ring" };
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse(card)));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const results = await fetchCardsFromScryfall([{ count: 1, set: "UMA", number: "1", lang: "ja" }], storeImage);

    expect(results).toEqual([{ name: "Sol Ring", count: 1, error: "No image available" }]);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.scryfall.com/cards/uma/1/ja");
  });

  test("reports a card entry missing both a name and set/collector number without calling fetch", async () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() => Promise.resolve(jsonResponse({})));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const results = await fetchCardsFromScryfall([{ count: 1, set: "UMA" }], storeImage);

    expect(results).toEqual([{ name: "UMA #?", count: 1, error: "Missing card name or set/collector number" }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("falls back to a set/number label and records the error when the request fails", async () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse({ details: "Card not found" }, { status: 404 }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const results = await fetchCardsFromScryfall([{ count: 3, set: "UMA", number: "1" }], storeImage);

    expect(results).toEqual([{ name: "UMA #1", count: 3, error: "Card not found" }]);
  });

  test("stops processing once the signal is aborted", async () => {
    const fetchMock = mock<(url: string) => Promise<Response>>(() =>
      Promise.resolve(jsonResponse({ name: "Sol Ring" }))
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();

    const results = await fetchCardsFromScryfall(
      [{ count: 1, name: "Sol Ring" }],
      storeImage,
      undefined,
      controller.signal
    );

    expect(results).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
