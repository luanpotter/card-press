import { useEffect, useRef } from "react";
import { loadDefaultTemplates } from "@/app/store/loadDefaults";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import { useImageStore } from "@/app/store/images";
import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { CardModal } from "@/app/pages/home/CardModal";
import type { Card } from "@/types/session";
import { useState } from "react";

export function Home() {
  const { sessions, addSession, getActiveSession, addCard, updateCard, deleteCard } = useSessionStore();
  const { templates, defaultTemplateId } = useTemplateStore();
  const { getImage, addImage } = useImageStore();
  const initRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingCard, setEditingCard] = useState<Card | undefined>();
  const [deletingCard, setDeletingCard] = useState<Card | undefined>();

  useEffect(() => {
    // Use ref to prevent double initialization in StrictMode
    if (initRef.current) return;

    // If no templates and no sessions, initialize with defaults
    if (templates.length === 0 && sessions.length === 0) {
      initRef.current = true;
      const defaultId = loadDefaultTemplates();
      if (defaultId) {
        addSession({ name: "New Session", templateId: defaultId });
      }
      return;
    }

    // If templates exist but no sessions, create a session
    const firstTemplate = templates[0];
    if (sessions.length === 0 && firstTemplate) {
      initRef.current = true;
      const templateId = defaultTemplateId ?? firstTemplate.id;
      addSession({ name: "New Session", templateId });
    }
  }, [sessions.length, templates, defaultTemplateId, addSession]);

  const activeSession = getActiveSession();
  const activeTemplate = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSession) return;

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        const imageId = addImage(file.name, data);
        // Remove extension from filename for card name
        const name = file.name.replace(/\.[^.]+$/, "");
        addCard(activeSession.id, { name, count: 1, imageId });
      };
      reader.readAsDataURL(file);
    }

    // Reset input so same files can be selected again
    e.target.value = "";
  };

  const handleCountChange = (card: Card, newCount: string) => {
    if (!activeSession) return;
    const count = parseInt(newCount, 10);
    if (!isNaN(count) && count >= 1) {
      updateCard(activeSession.id, card.id, { count });
    }
  };

  const handleSaveCard = (updates: Partial<Omit<Card, "id">>) => {
    if (!activeSession || !editingCard) return;
    updateCard(activeSession.id, editingCard.id, updates);
    setEditingCard(undefined);
  };

  const handleConfirmDelete = () => {
    if (!activeSession || !deletingCard) return;
    deleteCard(activeSession.id, deletingCard.id);
    setDeletingCard(undefined);
  };

  if (templates.length === 0) {
    return (
      <section>
        <h1>Welcome to Card Press</h1>
        <p className="muted">Get started by creating a template in the Templates page.</p>
      </section>
    );
  }

  if (!activeSession) {
    return (
      <section>
        <h1>Card Press</h1>
        <p className="muted">Loading session...</p>
      </section>
    );
  }

  const cards = activeSession.cards;

  return (
    <section>
      <Box label="Session">
        <div className="columns">
          <strong>{activeSession.name}</strong>
          <p className="muted">
            {activeTemplate?.name ?? "Unknown"} • {activeTemplate?.slots.length ?? 0} slots
          </p>
        </div>
      </Box>

      <Box label="Cards">
        <div className="page-header" style={{ marginBottom: "12px" }}>
          <span>{cards.length} card(s)</span>
          <Button onClick={() => fileInputRef.current?.click()} variant="accent">
            + Add Card
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileSelect}
            multiple
            hidden
          />
        </div>

        {cards.length > 0 && (
          <table>
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Image</th>
                <th>Name</th>
                <th style={{ width: "80px" }}>Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => {
                const image = getImage(card.imageId);
                return (
                  <tr key={card.id}>
                    <td>
                      {image && (
                        <img
                          src={image.data}
                          alt={card.name}
                          style={{ width: "40px", height: "auto", borderRadius: "2px" }}
                        />
                      )}
                    </td>
                    <td>{card.name}</td>
                    <td>
                      <input
                        type="number"
                        value={card.count}
                        onChange={(e) => handleCountChange(card, e.target.value)}
                        min={1}
                        style={{ width: "60px" }}
                      />
                    </td>
                    <td>
                      <div className="actions">
                        <Button onClick={() => setEditingCard(card)}>Edit</Button>
                        <Button onClick={() => setDeletingCard(card)} variant="danger">
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {cards.length === 0 && <p className="muted">No cards yet. Add a card to get started.</p>}
      </Box>

      {editingCard && (
        <CardModal card={editingCard} onSave={handleSaveCard} onClose={() => setEditingCard(undefined)} />
      )}

      {deletingCard && (
        <ConfirmModal
          title="Delete Card"
          message={`Are you sure you want to delete "${deletingCard.name}"?`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingCard(undefined)}
        />
      )}
    </section>
  );
}
