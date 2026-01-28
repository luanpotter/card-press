import { usePdfStore } from "@/app/store/pdfs";
import { useTemplateStore } from "@/app/store/templates";
import { DEFAULT_TEMPLATES } from "@/types/template";

/**
 * Loads all missing default templates into the stores.
 * Returns the ID of the default template (either newly created or existing).
 */
export function loadDefaultTemplates(): string | undefined {
  const { addPdf } = usePdfStore.getState();
  const { templates, addTemplate, defaultTemplateId, setDefaultTemplate } = useTemplateStore.getState();

  const existingNames = new Set(templates.map((t) => t.name));
  const missingDefaults = DEFAULT_TEMPLATES.filter((dt) => !existingNames.has(dt.name));

  let newDefaultId: string | undefined;

  for (const defaultTemplate of missingDefaults) {
    // If template has a bundled PDF, add it to the store first
    let basePdfId: string | undefined;
    if (defaultTemplate.bundledPdf) {
      basePdfId = addPdf(defaultTemplate.bundledPdf.name, defaultTemplate.bundledPdf.dataUrl);
    }

    // Create template without the bundledPdf and isDefault fields
    const { bundledPdf: _unused, isDefault, ...templateData } = defaultTemplate;
    void _unused; // Intentionally unused - we strip this field from the template
    const id = addTemplate({ ...templateData, basePdfId });

    // Set as default if marked and no default exists yet
    if (isDefault && !defaultTemplateId && !newDefaultId) {
      setDefaultTemplate(id);
      newDefaultId = id;
    }
  }

  return newDefaultId ?? defaultTemplateId ?? undefined;
}
