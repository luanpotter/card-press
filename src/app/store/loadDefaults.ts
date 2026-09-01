import { usePdfStore } from "@/app/store/pdfs";
import { useTemplateStore } from "@/app/store/templates";
import { DEFAULT_TEMPLATES, type CricutTemplate, type DefaultCricutTemplate } from "@/types/template";

/**
 * Loads all missing default templates into the stores.
 * Returns the ID of the default template (either newly created or existing).
 */
export function loadDefaultTemplates(): string | undefined {
  const { templates, addTemplate, defaultTemplateId, setDefaultTemplate } = useTemplateStore.getState();

  const existingNames = new Set(templates.map((t) => t.name));
  const missingDefaults = DEFAULT_TEMPLATES.filter((dt) => !existingNames.has(dt.name));

  let newDefaultId: string | undefined;

  for (const defaultTemplate of missingDefaults) {
    const { cricut, isDefault, ...templateData } = defaultTemplate;
    const id = addTemplate({ ...templateData, cricut: cricut && loadCricutTemplate(cricut) });

    // Set as default if marked and no default exists yet
    if (isDefault && !defaultTemplateId && !newDefaultId) {
      setDefaultTemplate(id);
      newDefaultId = id;
    }
  }

  return newDefaultId ?? defaultTemplateId ?? undefined;
}

/** Stores the bundled PDF, if any, and returns the Cricut template referencing it. */
function loadCricutTemplate({ bundledPdf, cricutUrl }: DefaultCricutTemplate): CricutTemplate {
  const { addPdf } = usePdfStore.getState();
  return {
    basePdfId: bundledPdf ? addPdf(bundledPdf.name, bundledPdf.dataUrl) : undefined,
    cricutUrl,
  };
}
