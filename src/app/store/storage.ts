import { del, get, set } from "idb-keyval";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * IndexedDB storage adapter for Zustand persist middleware.
 * Provides much larger storage quota than localStorage (50MB+ vs 5-10MB).
 */
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

/**
 * Creates Zustand storage configuration for IndexedDB.
 */
export const indexedDBZustandStorage = createJSONStorage(() => indexedDBStorage);

/**
 * Hash a string for deduplication purposes.
 */
export function hashData(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Generate a unique name by appending (2), (3), etc. if needed.
 */
export function getUniqueName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;

  const match = /^(.+?)(\.\w+)?$/.exec(baseName);
  const namePart = match?.[1] ?? baseName;
  const ext = match?.[2] ?? "";

  let counter = 2;
  let newName = `${namePart} (${String(counter)})${ext}`;
  while (existingNames.has(newName)) {
    counter++;
    newName = `${namePart} (${String(counter)})${ext}`;
  }
  return newName;
}
