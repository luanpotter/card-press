import type { Template, PageSize } from "@/types/template";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TemplateState {
  templates: Template[];
  addTemplate: (name: string, pageSize: PageSize) => void;
  updateTemplate: (id: string, name: string, pageSize: PageSize) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (name, pageSize) =>
        set((state) => ({
          templates: [...state.templates, { id: crypto.randomUUID(), name, pageSize }],
        })),
      updateTemplate: (id, name, pageSize) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, name, pageSize } : t)),
        })),
      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),
    }),
    { name: "card-press-templates" }
  )
);
