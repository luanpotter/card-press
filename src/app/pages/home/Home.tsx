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
import { PasteCardModal } from "@/app/pages/home/PasteCardModal";
import { ImportCardsModal } from "@/app/pages/home/ImportCardsModal";
import { generatePdf, downloadPdf } from "@/utils/generatePdf";
import type { FetchResult } from "@/utils/scryfall";
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
  const { sessions, addSession, getActiveSession, addCard, updateCard, deleteCard, moveCard } = useSessionStore();
  const { templates, defaultTemplateId } = useTemplateStore();
  const { addImage, getImage } = useImageStore();
  const { getPdf } = usePdfStore();
  const initRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingCard, setEditingCard] = useState<Card | undefined>();
  const [deletingCard, setDeletingCard] = useState<Card | undefined>();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [pastedImage, setPastedImage] = useState<string | null>(null);
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

  const activeSession = getActiveSession();
  const activeTemplate = activeSession ? templates.find((t) => t.id === activeSession.templateId) : undefined;
  const cards = activeSession?.cards ?? [];

  // Clear preview when cards become empty
  useEffect(() => {
    if (cards.length === 0 && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [cards.length, previewUrl]);

  const handleSavePastedCard = (name: string, count: number) => {
    if (!activeSession || !pastedImage) return;
    const imageId = addImage("pasted-image", pastedImage);
    addCard(activeSession.id, { name, count, imageId });
    setPastedImage(null);
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

  // Cleanup preview URL on unmount or when URL changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Calculate total cards for progress tracking
  const totalExpandedCards = cards.reduce((sum, card) => sum + card.count, 0);

  const handlePreview = () => {
    if (!activeSession || !activeTemplate || previewing) return;

    setPreviewing(true);
    setPdfProgress({ current: 0, total: totalExpandedCards });
    setTimeout(() => {
      void (async () => {
        try {
          const pdfBytes = await generatePdf({
            template: activeTemplate,
            cards: activeSession.cards,
            getImage,
            getPdf,
            onProgress: (current, total) => setPdfProgress({ current, total }),
          });
          // Revoke old URL before creating new one
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }
          const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } catch {
          // TODO: show error to user
        } finally {
          setPreviewing(false);
        }
      })();
    }, 0);
  };

  const handleGenerate = () => {
    if (!activeSession || !activeTemplate || generating) return;

    setGenerating(true);
    setPdfProgress({ current: 0, total: totalExpandedCards });
    // Use setTimeout to allow React to paint loading state before blocking
    setTimeout(() => {
      void (async () => {
        try {
          const pdfBytes = await generatePdf({
            template: activeTemplate,
            cards: activeSession.cards,
            getImage,
            getPdf,
            onProgress: (current, total) => setPdfProgress({ current, total }),
          });
          const filename = `${activeSession.name}.pdf`;
          downloadPdf(pdfBytes, filename);
        } catch {
          // TODO: show error to user
        } finally {
          setGenerating(false);
        }
      })();
    }, 0);
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
            {previewing ? "Loading..." : "👁 Preview"}
          </Button>
          <Button onClick={handleGenerate} disabled={cards.length === 0 || generating}>
            {generating ? "Generating..." : "⬇ Download"}
          </Button>
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

      {pastedImage && (
        <PasteCardModal imageData={pastedImage} onSave={handleSavePastedCard} onClose={() => setPastedImage(null)} />
      )}

      {showImport && <ImportCardsModal onImport={handleImportCards} onClose={() => setShowImport(false)} />}

      {(previewing || generating) && (
        <ProgressModal
          title={previewing ? "Generating Preview" : "Generating PDF"}
          current={pdfProgress.current}
          total={pdfProgress.total}
          label="Embedding cards..."
        />
      )}
    </section>
  );
}
