import { useState } from "react";
import { useTemplateStore } from "@/app/store/templates";
import { usePdfStore } from "@/app/store/pdfs";
import type { Template } from "@/types/template";
import { Button } from "@/app/components/Button";
import { TemplateModal } from "@/app/pages/templates/TemplateModal";

export function Templates() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplateStore();
  const { getPdf } = usePdfStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>();

  const handleNew = () => {
    setEditingTemplate(undefined);
    setModalOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setModalOpen(true);
  };

  const handleSave = (data: Omit<Template, "id">) => {
    if (editingTemplate) {
      updateTemplate(editingTemplate.id, data);
    } else {
      addTemplate(data);
    }
    setModalOpen(false);
    setEditingTemplate(undefined);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingTemplate(undefined);
  };

  return (
    <section>
      <div className="page-header">
        <h1>Templates</h1>
        <Button onClick={handleNew} variant="accent">
          + New Template
        </Button>
      </div>

      {templates.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Page</th>
              <th>Card (mm)</th>
              <th>Slots</th>
              <th>Base PDF</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => (
              <tr key={template.id}>
                <td>{template.name}</td>
                <td>{template.pageSize}</td>
                <td>
                  {template.cardSize.width}×{template.cardSize.height}
                </td>
                <td>{template.slots.length}</td>
                <td>{template.basePdfId ? (getPdf(template.basePdfId)?.name ?? "—") : "—"}</td>
                <td>
                  <div className="actions">
                    <Button onClick={() => handleEdit(template)}>Edit</Button>
                    <Button onClick={() => deleteTemplate(template.id)} variant="danger">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {templates.length === 0 && <p className="muted">No templates yet.</p>}

      {modalOpen && <TemplateModal template={editingTemplate} onSave={handleSave} onClose={handleClose} />}
    </section>
  );
}
