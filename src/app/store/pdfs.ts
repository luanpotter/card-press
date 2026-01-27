import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoredPdf {
  id: string;
  name: string;
  data: string;
}

interface PdfState {
  pdfs: StoredPdf[];
  addPdf: (name: string, data: string) => string;
  deletePdf: (id: string) => void;
  getPdf: (id: string) => StoredPdf | undefined;
}

export const usePdfStore = create<PdfState>()(
  persist(
    (set, get) => ({
      pdfs: [],
      addPdf: (name, data) => {
        const id = crypto.randomUUID();
        set((state) => ({
          pdfs: [...state.pdfs, { id, name, data }],
        }));
        return id;
      },
      deletePdf: (id) =>
        set((state) => ({
          pdfs: state.pdfs.filter((p) => p.id !== id),
        })),
      getPdf: (id) => get().pdfs.find((p) => p.id === id),
    }),
    { name: "card-press-pdfs" }
  )
);
