import type { Template } from "@/types/template";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TemplateState {
  templates: Template[];
  addTemplate: (template: Omit<Template, "id">) => void;
  updateTemplate: (id: string, template: Omit<Template, "id">) => void;
  deleteTemplate: (id: string) => void;
  deleteAllTemplates: () => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      templates: [],
      addTemplate: (template) =>
        set((state) => ({
          templates: [...state.templates, { ...template, id: crypto.randomUUID() }],
        })),
      updateTemplate: (id, template) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...template } : t)),
        })),
      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),
      deleteAllTemplates: () => set({ templates: [] }),
    }),
    { name: "card-press-templates" }
  )
);
