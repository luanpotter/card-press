import { useEffect, useRef, useState } from "react";
import { loadDefaultTemplates } from "@/app/store/loadDefaults";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import { useImageStore } from "@/app/store/images";
import { usePdfStore } from "@/app/store/pdfs";
import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { ProgressModal } from "@/app/components/ProgressModal";
import { Table, type Column } from "@/app/components/Table";
import { CardModal } from "@/app/pages/home/CardModal";
import { CardBacksModal } from "@/app/pages/home/CardBacksModal";
import { QuickAddCardModal } from "@/app/pages/home/QuickAddCardModal";
import { ImportCardsModal } from "@/app/pages/home/ImportCardsModal";
import { SessionModal } from "@/app/pages/sessions/SessionModal";
import { usePdfGenerator } from "@/app/pages/home/usePdfGenerator";
import type { FetchResult } from "@/sources/index";
import type { Card } from "@/types/session";

type ViewMode = "list" | "images";

function LazyCardImage({ imageId, alt }: { imageId: string; alt: string }) {
  const { getImage } = useImageStore();
  const [loaded, setLoaded] = useState(false);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer to next tick so React can render skeleton first
    requestAnimationFrame(() => {
      if (cancelled) return;
      const image = getImage(imageId);
      if (image) {
        setSrc(image.data);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageId, getImage]);

  if (!src) {
    return <div className="card-icon-placeholder" />;
  }

  return (
    <>
      {!loaded && <div className="card-icon-placeholder" />}
      <img src={src} alt={alt} onLoad={() => setLoaded(true)} style={{ display: loaded ? "block" : "none" }} />
    </>
  );
}

export function Home() {
  const { sessions, addSession, getActiveSession, updateSession, addCard, updateCard, deleteCard, moveCard } =
    useSessionStore();
  const { templates, defaultTemplateId } = useTemplateStore();
  const { addImage, getImage } = useImageStore();
  const { getPdf } = usePdfStore();
  const initRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingCard, setEditingCard] = useState<Card | undefined>();
  const [showEditSession, setShowEditSession] = useState(false);
  const [showCardBacks, setShowCardBacks] = useState(false);
  const [deletingCard, setDeletingCard] = useState<Card | undefined>();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [droppedImageName, setDroppedImageName] = useState<string | undefined>(undefined);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showImport, setShowImport] = useState(false);

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

  // Handle paste event for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = () => {
            const data = reader.result as string;
            setPastedImage(data);
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, []);

  // Handle drag and drop for image files
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Only hide if leaving the document entirely
      if (e.relatedTarget === null) {
        setIsDraggingOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Filter to only image files
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0) return;

      const session = getActiveSession();
      if (!session) return;

      // Multiple files: add all directly without modal
      if (imageFiles.length > 1) {
        for (const file of imageFiles) {
          const reader = new FileReader();
          reader.onload = () => {
            const data = reader.result as string;
            const imageId = addImage(file.name, data);
            const name = file.name.replace(/\.[^.]+$/, "");
            addCard(session.id, { name, count: 1, imageId });
          };
          reader.readAsDataURL(file);
        }
        return;
      }

      // Single file: show modal with prefilled name
      const file = imageFiles[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = reader.result as string;
        setDroppedImageName(file.name.replace(/\.[^.]+$/, ""));
        setPastedImage(data);
      };
      reader.readAsDataURL(file);
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);
    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, [getActiveSession, addImage, addCard]);

  const activeSession = getActiveSession();
  const activeTemplate = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined;
  const cards = activeSession?.cards ?? [];

  // PDF generation hook
  const {
    generating,
    generatingBacks,
    previewing,
    previewUrl,
    pdfProgress,
    error: pdfError,
    handlePreview,
    handleGenerate,
    handleGenerateBacks,
    clearPreview,
    clearError: clearPdfError,
  } = usePdfGenerator({
    cards,
    session: activeSession ?? { id: "", name: "", templateId: "", cards: [], cardBacksEnabled: false },
    template: activeTemplate,
    getImage,
    getPdf,
  });

  // Clear preview when cards become empty
  useEffect(() => {
    if (cards.length === 0) {
      clearPreview();
    }
  }, [cards.length, clearPreview]);

  const handleSavePastedCard = (name: string, count: number) => {
    if (!activeSession || !pastedImage) return;
    const imageId = addImage("pasted-image", pastedImage);
    addCard(activeSession.id, { name, count, imageId });
    setPastedImage(null);
    setDroppedImageName(undefined);
  };

  const handleImportCards = (cards: FetchResult[]) => {
    if (!activeSession) return;
    for (const card of cards) {
      if (card.imageId) {
        // Images already stored during fetch - just create card entries
        addCard(activeSession.id, { name: card.name, count: card.count, imageId: card.imageId });
      }
    }
    setShowImport(false);
  };

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

  const handleMoveCard = (fromIndex: number, toIndex: number) => {
    if (!activeSession) return;
    moveCard(activeSession.id, fromIndex, toIndex);
  };

  // Drag handlers for icons view only
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    handleMoveCard(dragIndex, index);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
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

  const cardColumns: Column<Card>[] = [
    {
      key: "name",
      header: "Name",
      main: true,
      render: (card) => card.name,
    },
    {
      key: "count",
      header: "Count",
      width: "80px",
      render: (card) => (
        <input
          type="number"
          value={card.count}
          onChange={(e) => handleCountChange(card, e.target.value)}
          min={1}
          style={{ width: "60px" }}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (card, index) => (
        <div className="actions">
          <Button onClick={() => handleMoveCard(index, index - 1)} disabled={index === 0} title="Move up">
            ↑
          </Button>
          <Button
            onClick={() => handleMoveCard(index, index + 1)}
            disabled={index === cards.length - 1}
            title="Move down"
          >
            ↓
          </Button>
          <Button onClick={() => setEditingCard(card)}>Edit</Button>
          <Button onClick={() => setDeletingCard(card)} variant="danger">
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const pageCount = activeTemplate
    ? Math.ceil(cards.reduce((sum, card) => sum + card.count, 0) / activeTemplate.slots.length)
    : 0;

  const existingSessionNames = new Set(sessions.map((s) => s.name));

  const handleSaveSession = (updates: { name: string; templateId: string }) => {
    updateSession(activeSession.id, updates);
    setShowEditSession(false);
  };

  return (
    <section>
      <Box label="Session">
        <div className="columns">
          <strong>{activeSession.name}</strong>
          <div className="right">
            <Button onClick={() => setShowEditSession(true)}>Edit Session</Button>
            <Button onClick={() => setShowCardBacks(true)}>Card Backs</Button>
          </div>
        </div>
        <div className="muted">
          {activeTemplate?.name ?? "Unknown"} • {activeTemplate?.slots.length ?? 0} slots
          {activeSession.cardBacksEnabled && " • Card Backs ✓"}
        </div>
      </Box>

      <Box label="Cards">
        <div className="right">
          <span>
            {cards.length} cards / {pageCount} pages
          </span>
          <Button onClick={() => setViewMode(viewMode === "list" ? "images" : "list")}>
            {viewMode === "list" ? "⊞ Icons" : "☰ List"}
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="accent">
            + Add Card
          </Button>
          <Button onClick={() => setShowImport(true)} variant="accent">
            + Import Cards
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

        {cards.length > 0 && viewMode === "list" && (
          <Table data={cards} columns={cardColumns} keyExtractor={(c) => c.id} onReorder={handleMoveCard} />
        )}

        {cards.length > 0 && viewMode === "images" && (
          <div className="card-grid">
            {cards.map((card, index) => (
              <div
                key={card.id}
                className="card-icon"
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => setEditingCard(card)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setDeletingCard(card);
                }}
                style={{ opacity: dragIndex === index ? 0.5 : 1 }}
                title={`${card.name} (×${String(card.count)}) • Click to edit, right-click to delete`}
              >
                <LazyCardImage imageId={card.imageId} alt={card.name} />
                <span className="card-icon-name">{card.name}</span>
                <span className="card-icon-count">×{card.count}</span>
              </div>
            ))}
          </div>
        )}

        {cards.length === 0 && <p className="muted">No cards yet. Add a card to get started.</p>}
      </Box>

      <Box label="PDF">
        <div className="right">
          <Button onClick={handlePreview} disabled={cards.length === 0 || previewing}>
            {previewing ? "Loading..." : "Preview"}
          </Button>
          <Button onClick={handleGenerate} disabled={cards.length === 0 || generating}>
            {generating ? "Generating..." : "↓ Download"}
          </Button>
          {activeSession.cardBacksEnabled && (
            <Button onClick={handleGenerateBacks} disabled={cards.length === 0 || generatingBacks}>
              {generatingBacks ? "Generating..." : "↓ Download Backs"}
            </Button>
          )}
        </div>
        {previewUrl && (
          <iframe
            src={previewUrl}
            title="PDF Preview"
            style={{ width: "100%", height: "500px", border: "1px solid var(--color-border)", marginTop: "1rem" }}
          />
        )}
      </Box>

      {editingCard && (
        <CardModal
          card={editingCard}
          onSave={handleSaveCard}
          onClose={() => setEditingCard(undefined)}
          cardBacksEnabled={activeSession.cardBacksEnabled}
          defaultCardBackId={activeSession.defaultCardBackId}
        />
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

      {pastedImage && (
        <QuickAddCardModal
          imageData={pastedImage}
          defaultName={droppedImageName}
          onSave={handleSavePastedCard}
          onClose={() => {
            setPastedImage(null);
            setDroppedImageName(undefined);
          }}
        />
      )}

      {showImport && <ImportCardsModal onImport={handleImportCards} onClose={() => setShowImport(false)} />}

      {showEditSession && (
        <SessionModal
          session={activeSession}
          existingNames={existingSessionNames}
          onSave={handleSaveSession}
          onClose={() => setShowEditSession(false)}
        />
      )}

      {showCardBacks && <CardBacksModal session={activeSession} onClose={() => setShowCardBacks(false)} />}

      {(previewing || generating || generatingBacks) && (
        <ProgressModal
          title={previewing ? "Generating Preview" : "Generating PDF"}
          current={pdfProgress.current}
          total={pdfProgress.total}
          label="Embedding cards..."
        />
      )}

      {pdfError && (
        <ConfirmModal
          title="PDF Error"
          message={pdfError}
          confirmLabel="OK"
          onConfirm={clearPdfError}
          onClose={clearPdfError}
        />
      )}

      {isDraggingOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">Drop image(s) to add cards</div>
        </div>
      )}
    </section>
  );
}
