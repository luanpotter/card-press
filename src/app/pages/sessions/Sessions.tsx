import { useState } from "react";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import type { Session } from "@/types/session";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { Table, type Column } from "@/app/components/Table";
import { SessionModal } from "@/app/pages/sessions/SessionModal";

export function Sessions() {
  const { sessions, activeSessionId, addSession, updateSession, deleteSession, setActiveSession, moveSession } =
    useSessionStore();
  const { templates } = useTemplateStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | undefined>();
  const [deletingSession, setDeletingSession] = useState<Session | undefined>();

  const getTemplateName = (templateId: string) => {
    return templates.find((t) => t.id === templateId)?.name ?? "—";
  };

  const existingNames = new Set(sessions.map((s) => s.name));

  const handleNew = () => {
    setEditingSession(undefined);
    setModalOpen(true);
  };

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    setModalOpen(true);
  };

  const handleSave = (data: Omit<Session, "id" | "cards">) => {
    if (editingSession) {
      updateSession(editingSession.id, data);
    } else {
      addSession(data);
    }
    setModalOpen(false);
    setEditingSession(undefined);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditingSession(undefined);
  };

  const handleDeleteClick = (session: Session) => {
    setDeletingSession(session);
  };

  const handleConfirmDelete = () => {
    if (!deletingSession) return;
    deleteSession(deletingSession.id);
    setDeletingSession(undefined);
  };

  const columns: Column<Session>[] = [
    {
      key: "name",
      header: "Name",
      main: true,
      render: (session) => (
        <>
          {session.name}
          {session.id === activeSessionId && <span className="badge">Active</span>}
        </>
      ),
    },
    {
      key: "template",
      header: "Template",
      render: (session) => getTemplateName(session.templateId),
    },
    {
      key: "actions",
      header: "Actions",
      render: (session) => (
        <div className="actions">
          <Button onClick={() => handleEdit(session)}>Edit</Button>
          <Button onClick={() => handleDeleteClick(session)} variant="danger">
            Delete
          </Button>
          {session.id !== activeSessionId && <Button onClick={() => setActiveSession(session.id)}>Set Active</Button>}
        </div>
      ),
    },
  ];

  return (
    <section>
      <Button onClick={handleNew} variant="accent" disabled={templates.length === 0}>
        + New Session
      </Button>

      {templates.length === 0 && <p className="muted">Create a template first before creating sessions.</p>}

      {sessions.length > 0 && (
        <Table data={sessions} columns={columns} keyExtractor={(s) => s.id} onReorder={moveSession} />
      )}

      {sessions.length === 0 && templates.length > 0 && <p className="muted">No sessions yet.</p>}

      {modalOpen && (
        <SessionModal
          session={editingSession}
          existingNames={existingNames}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}

      {deletingSession && (
        <ConfirmModal
          title="Delete Session"
          message={`Are you sure you want to delete "${deletingSession.name}"?`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingSession(undefined)}
        />
      )}
    </section>
  );
}
