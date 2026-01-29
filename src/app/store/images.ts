import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getUniqueName, hashData, indexedDBZustandStorage } from "@/app/store/storage";

export interface StoredImage {
  id: string;
  name: string;
  data: string;
  hash: string;
}

interface ImageState {
  images: StoredImage[];
  _hydrated: boolean;
  _setHydrated: () => void;
  addImage: (name: string, data: string) => string;
  deleteImage: (id: string) => void;
  getImage: (id: string) => StoredImage | undefined;
  pruneImages: (usedIds: Set<string>) => number;
}

export const useImageStore = create<ImageState>()(
  persist(
    (set, get) => ({
      images: [],
      _hydrated: false,
      _setHydrated: () => set({ _hydrated: true }),
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
    {
      name: "card-press-images",
      storage: indexedDBZustandStorage,
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    }
  )
);
