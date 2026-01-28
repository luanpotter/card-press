import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoredImage {
  id: string;
  name: string;
  data: string;
  hash: string;
}

interface ImageState {
  images: StoredImage[];
  addImage: (name: string, data: string) => string;
  deleteImage: (id: string) => void;
  getImage: (id: string) => StoredImage | undefined;
  pruneImages: (usedIds: Set<string>) => number;
}

function hashData(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

function getUniqueName(baseName: string, existingNames: Set<string>): string {
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

export const useImageStore = create<ImageState>()(
  persist(
    (set, get) => ({
      images: [],
      addImage: (name, data) => {
        const hash = hashData(data);
        const { images } = get();

        // Check for exact duplicate (same content)
        const existing = images.find((img) => img.hash === hash);
        if (existing) return existing.id;

        // Handle name collision
        const existingNames = new Set(images.map((img) => img.name));
        const uniqueName = getUniqueName(name, existingNames);

        const id = crypto.randomUUID();
        set((state) => ({
          images: [...state.images, { id, name: uniqueName, data, hash }],
        }));
        return id;
      },
      deleteImage: (id) =>
        set((state) => ({
          images: state.images.filter((img) => img.id !== id),
        })),
      getImage: (id) => get().images.find((img) => img.id === id),
      pruneImages: (usedIds) => {
        const { images } = get();
        const toRemove = images.filter((img) => !usedIds.has(img.id));
        if (toRemove.length > 0) {
          set((state) => ({
            images: state.images.filter((img) => usedIds.has(img.id)),
          }));
        }
        return toRemove.length;
      },
    }),
    { name: "card-press-images" }
  )
);
