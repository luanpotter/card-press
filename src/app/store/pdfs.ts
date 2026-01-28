import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoredPdf {
  id: string;
  name: string;
  data: string;
  hash: string;
}

interface PdfState {
  pdfs: StoredPdf[];
  addPdf: (name: string, data: string) => string;
  deletePdf: (id: string) => void;
  getPdf: (id: string) => StoredPdf | undefined;
  prunePdfs: (usedIds: Set<string>) => number;
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

export const usePdfStore = create<PdfState>()(
  persist(
    (set, get) => ({
      pdfs: [],
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
    { name: "card-press-pdfs" }
  )
);
