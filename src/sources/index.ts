import type { FetchResult } from "@/sources/scryfall";

export type { FetchResult };

export interface ParsedCard {
  count: number;
  name?: string;
  id?: number;
}

export interface CardSource {
  id: string;
  name: string;
  placeholder: string;
  corsWarning?: string;
  parse: (text: string) => ParsedCard[];
  fetch: (
    cards: ParsedCard[],
    storeImage: (name: string, data: string) => string,
    onProgress?: (current: number, total: number, name: string) => void
  ) => Promise<FetchResult[]>;
}

const sources = new Map<string, CardSource>();

export function registerSource(source: CardSource): void {
  sources.set(source.id, source);
}

export function getSource(id: string): CardSource | undefined {
  return sources.get(id);
}

export function getAllSources(): CardSource[] {
  return Array.from(sources.values());
}
