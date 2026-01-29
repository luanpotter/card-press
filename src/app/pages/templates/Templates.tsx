import { useState } from "react";
import { useTemplateStore } from "@/app/store/templates";
import { useSessionStore } from "@/app/store/sessions";
import { usePdfStore } from "@/app/store/pdfs";
import type { Template } from "@/types/template";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { Table, type Column } from "@/app/components/Table";
import { TemplateModal } from "@/app/pages/templates/TemplateModal";

export function Templates() {
  const {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    defaultTemplateId,
    setDefaultTemplate,
    moveTemplate,
  } = useTemplateStore();
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

  const columns: Column<Template>[] = [
    {
      key: "name",
      header: "Name",
      main: true,
      render: (template) => (
        <>
          {template.name}
          {template.id === defaultTemplateId && <span className="badge">Default</span>}
        </>
      ),
    },
    {
      key: "page",
      header: "Page",
      render: (template) => template.pageSize,
    },
    {
      key: "card",
      header: "Card (mm)",
      render: (template) => `${String(template.cardSize.width)}×${String(template.cardSize.height)}`,
    },
    {
      key: "slots",
      header: "Slots",
      render: (template) => template.slots.length,
    },
    {
      key: "basePdf",
      header: "Base PDF",
      render: (template) => {
        if (!template.basePdfId) return "—";
        const pdf = getPdf(template.basePdfId);
        if (!pdf) return "—";
        return (
          <a href={pdf.data} download={pdf.name} onClick={(e) => e.stopPropagation()} title="Download base PDF">
            {pdf.name}
          </a>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      render: (template) => (
        <div className="actions">
          <Button onClick={() => handleEdit(template)}>Edit</Button>
          <Button onClick={() => handleDeleteClick(template)} variant="danger">
            Delete
          </Button>
          {template.id !== defaultTemplateId && (
            <Button onClick={() => setDefaultTemplate(template.id)}>Set Default</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <section>
      <div className="right">
        {templates.length} templates
        <Button onClick={handleNew} variant="accent">
          + New Template
        </Button>
      </div>

      {templates.length > 0 && (
        <Table data={templates} columns={columns} keyExtractor={(t) => t.id} onReorder={moveTemplate} />
      )}

      {templates.length === 0 && <p className="muted">No templates yet.</p>}

      {modalOpen && (
        <TemplateModal
          template={editingTemplate}
          existingNames={new Set(templates.map((t) => t.name))}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}

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
