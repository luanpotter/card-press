import type { Template } from "@/types/template";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TemplateState {
  templates: Template[];
  defaultTemplateId: string | null;
  addTemplate: (template: Omit<Template, "id">) => string;
  updateTemplate: (id: string, template: Omit<Template, "id">) => void;
  deleteTemplate: (id: string) => void;
  deleteAllTemplates: () => void;
  setDefaultTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set, get) => ({
      templates: [],
      defaultTemplateId: null,
      addTemplate: (template) => {
        const id = crypto.randomUUID();
        set((state) => {
          const newTemplates = [...state.templates, { ...template, id }];
          // If this is the first template, make it default
          const defaultId = state.defaultTemplateId ?? id;
          return { templates: newTemplates, defaultTemplateId: defaultId };
        });
        return id;
      },
      updateTemplate: (id, template) =>
        set((state) => ({
          templates: state.templates.map((t) => (t.id === id ? { ...t, ...template } : t)),
        })),
      deleteTemplate: (id) =>
        set((state) => {
          const newTemplates = state.templates.filter((t) => t.id !== id);
          // If deleting the default, pick the first remaining or null
          const newDefault = state.defaultTemplateId === id ? (newTemplates[0]?.id ?? null) : state.defaultTemplateId;
          return { templates: newTemplates, defaultTemplateId: newDefault };
        }),
      deleteAllTemplates: () => set({ templates: [], defaultTemplateId: null }),
      setDefaultTemplate: (id) => {
        const { templates } = get();
        if (templates.some((t) => t.id === id)) {
          set({ defaultTemplateId: id });
        }
      },
    }),
    { name: "card-press-templates" }
  )
);
