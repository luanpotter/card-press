import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getUniqueName, hashData, indexedDBZustandStorage } from "@/app/store/storage";

export interface StoredPdf {
  id: string;
  name: string;
  data: string;
  hash: string;
}

interface PdfState {
  pdfs: StoredPdf[];
  _hydrated: boolean;
  _setHydrated: () => void;
  addPdf: (name: string, data: string) => string;
  deletePdf: (id: string) => void;
  getPdf: (id: string) => StoredPdf | undefined;
  prunePdfs: (usedIds: Set<string>) => number;
}

export const usePdfStore = create<PdfState>()(
  persist(
    (set, get) => ({
      pdfs: [],
      _hydrated: false,
      _setHydrated: () => set({ _hydrated: true }),
      addPdf: (name, data) => {
        const hash = hashData(data);
        const { pdfs } = get();

        // Check for exact duplicate (same content)
        const existing = pdfs.find((p) => p.hash === hash);
        if (existing) return existing.id;

        // Handle name collision
        const existingNames = new Set(pdfs.map((p) => p.name));
        const uniqueName = getUniqueName(name, existingNames);

        const id = crypto.randomUUID();
        set((state) => ({
          pdfs: [...state.pdfs, { id, name: uniqueName, data, hash }],
        }));
        return id;
      },
      deletePdf: (id) =>
        set((state) => ({
          pdfs: state.pdfs.filter((p) => p.id !== id),
        })),
      getPdf: (id) => get().pdfs.find((p) => p.id === id),
      prunePdfs: (usedIds) => {
        const { pdfs } = get();
        const toRemove = pdfs.filter((p) => !usedIds.has(p.id));
        if (toRemove.length > 0) {
          set((state) => ({
            pdfs: state.pdfs.filter((p) => usedIds.has(p.id)),
          }));
        }
        return toRemove.length;
      },
    }),
    {
      name: "card-press-pdfs",
      storage: indexedDBZustandStorage,
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    }
  )
);
