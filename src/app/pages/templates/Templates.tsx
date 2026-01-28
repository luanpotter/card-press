import { useState } from "react";
import { useTemplateStore } from "@/app/store/templates";
import { useSessionStore } from "@/app/store/sessions";
import { usePdfStore } from "@/app/store/pdfs";
import type { Template } from "@/types/template";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { TemplateModal } from "@/app/pages/templates/TemplateModal";

export function Templates() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, defaultTemplateId, setDefaultTemplate } =
    useTemplateStore();
  const { sessions, deleteSession } = useSessionStore();
  const { getPdf } = usePdfStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | undefined>();
  const [deletingTemplate, setDeletingTemplate] = useState<Template | undefined>();

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

  const handleDeleteClick = (template: Template) => {
    setDeletingTemplate(template);
  };

  const handleConfirmDelete = () => {
    if (!deletingTemplate) return;
    // Delete all sessions using this template
    const affectedSessions = sessions.filter((s) => s.templateId === deletingTemplate.id);
    for (const session of affectedSessions) {
      deleteSession(session.id);
    }
    deleteTemplate(deletingTemplate.id);
    setDeletingTemplate(undefined);
  };

  const getDeleteMessage = (template: Template) => {
    const affectedSessions = sessions.filter((s) => s.templateId === template.id);
    if (affectedSessions.length === 0) {
      return `Are you sure you want to delete "${template.name}"?`;
    }
    const sessionWord = affectedSessions.length === 1 ? "session" : "sessions";
    return `Are you sure you want to delete "${template.name}"? This will also delete ${String(affectedSessions.length)} ${sessionWord} using this template.`;
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
                <td>
                  {template.name}
                  {template.id === defaultTemplateId && <span className="badge">Default</span>}
                </td>
                <td>{template.pageSize}</td>
                <td>
                  {template.cardSize.width}×{template.cardSize.height}
                </td>
                <td>{template.slots.length}</td>
                <td>{template.basePdfId ? (getPdf(template.basePdfId)?.name ?? "—") : "—"}</td>
                <td>
                  <div className="actions">
                    <Button onClick={() => handleEdit(template)}>Edit</Button>
                    <Button onClick={() => handleDeleteClick(template)} variant="danger">
                      Delete
                    </Button>
                    {template.id !== defaultTemplateId && (
                      <Button onClick={() => setDefaultTemplate(template.id)}>Set Default</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {templates.length === 0 && <p className="muted">No templates yet.</p>}

      {modalOpen && <TemplateModal template={editingTemplate} onSave={handleSave} onClose={handleClose} />}

      {deletingTemplate && (
        <ConfirmModal
          title="Delete Template"
          message={getDeleteMessage(deletingTemplate)}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingTemplate(undefined)}
        />
      )}
    </section>
  );
}
