import { useState } from "react";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import type { Session } from "@/types/session";
import { Button } from "@/app/components/Button";
import { SessionModal } from "@/app/pages/sessions/SessionModal";

export function Sessions() {
  const { sessions, activeSessionId, addSession, updateSession, deleteSession, setActiveSession } = useSessionStore();
  const { templates } = useTemplateStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | undefined>();

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

  const handleSave = (data: Omit<Session, "id">) => {
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

  return (
    <section>
      <div className="page-header">
        <h1>Sessions</h1>
        <Button onClick={handleNew} variant="accent" disabled={templates.length === 0}>
          + New Session
        </Button>
      </div>

      {templates.length === 0 && <p className="muted">Create a template first before creating sessions.</p>}

      {sessions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Template</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  {session.name}
                  {session.id === activeSessionId && <span className="badge">Active</span>}
                </td>
                <td>{getTemplateName(session.templateId)}</td>
                <td>
                  <div className="actions">
                    <Button onClick={() => handleEdit(session)}>Edit</Button>
                    <Button onClick={() => deleteSession(session.id)} variant="danger">
                      Delete
                    </Button>
                    {session.id !== activeSessionId && (
                      <Button onClick={() => setActiveSession(session.id)}>Set Active</Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    </section>
  );
}
