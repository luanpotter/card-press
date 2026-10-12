import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadDefaultTemplates } from "@/app/store/loadDefaults";
import { useSessionStore } from "@/app/store/sessions";
import { useTemplateStore } from "@/app/store/templates";
import { useImageStore } from "@/app/store/images";
import { usePdfStore } from "@/app/store/pdfs";
import { Box } from "@/app/components/Box";
import { Button } from "@/app/components/Button";
import { ConfirmModal } from "@/app/components/ConfirmModal";
import { ErrorModal } from "@/app/components/ErrorModal";
import { ProgressModal } from "@/app/components/ProgressModal";
import { Table, type Column } from "@/app/components/Table";
import { useModules } from "@/app/components/useModules";
import { usePastedImage } from "@/app/components/usePastedImage";
import { CardModal } from "@/app/pages/home/CardModal";
import { CardBacksModal } from "@/app/pages/home/CardBacksModal";
import { QuickAddCardModal } from "@/app/pages/home/QuickAddCardModal";
import { ImportCardsModal } from "@/app/pages/home/ImportCardsModal";
import { SessionModal } from "@/app/pages/sessions/SessionModal";
import { type PdfReport, usePdfGenerator } from "@/app/pages/home/usePdfGenerator";
import type { FetchResult } from "@/sources/index";
import {
  DEFAULT_SVG_OUTPUT,
  getCardBacks,
  getSvgOutput,
  type Card,
  type Session,
  type SvgOutput,
} from "@/types/session";
import { cardName, IMAGE_ACCEPT, readDataUrl, validateImageFiles } from "@/utils/imageFiles";
import type { PageReport } from "@/utils/generatePdf";
import { cardImageProblem } from "@/utils/preflight";
import { MAX_PAGE_MEGAPIXELS } from "@/utils/printResolution";

type ViewMode = "list" | "images";

/** Why each stored image cannot print with the given SVG output, if it cannot */
function useImageProblems(svgOutput: SvgOutput): Map<string, string | undefined> {
  const { images } = useImageStore();
  return useMemo(
    () => new Map(images.map((image) => [image.id, cardImageProblem(image.data, svgOutput)])),
    [images, svgOutput]
  );
}

/** Flags something that cannot print, saying why on hover */
function ProblemMark({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <span className="danger" title={problems.join("\n")}>
      {" "}
      ⚠
    </span>
  );
}

/** What the last generated PDF holds, warning of pages too heavy for printers */
function PdfSummary({ report }: { report: PdfReport }) {
  const count = (n: number, noun: string) => `${String(n)} ${noun}${n === 1 ? "" : "s"}`;
  const sum = (key: keyof PageReport) => report.pages.reduce((total, page) => total + page[key], 0);
  const heaviest = Math.max(0, ...report.pages.map((page) => page.megapixels));
  const tooHeavy = heaviest > MAX_PAGE_MEGAPIXELS;

  return (
    <p className={tooHeavy ? "danger" : "muted"}>
      Last {report.backs ? "backs " : ""}PDF: {count(report.pages.length, "page")} •{" "}
      {count(sum("rasterCards"), "raster card")}, {count(sum("vectorCards"), "vector card")} • fullest page{" "}
      {heaviest.toFixed(1)} MP
      {tooHeavy && `, over the ${String(MAX_PAGE_MEGAPIXELS)} MP printers handle well: lower the DPI`}
    </p>
  );
}

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
  const [dropRejection, setDropRejection] = useState<string>();
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    // Use ref to prevent double initialization in StrictMode
    if (initRef.current) return;

    // If no templates and no sessions, initialize with defaults
    if (templates.length === 0 && sessions.length === 0) {
      initRef.current = true;
      loadDefaultTemplates().then(
        (defaultId) => {
          if (defaultId) {
            addSession({ name: "New Session", templateId: defaultId });
          }
        },
        () => {
          // The download failed (shown in Config); try again on the next change
          initRef.current = false;
        }
      );
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

  // A pasted image opens the quick add modal
  usePastedImage(
    useCallback((file: File) => {
      void readDataUrl(file).then(setPastedImage);
    }, [])
  );

  // Each file becomes a card named after it, in the order given
  const addFileCards = useCallback(
    async (sessionId: string, files: File[]) => {
      for (const file of files) {
        const imageId = addImage(file.name, await readDataUrl(file));
        addCard(sessionId, { name: cardName(file), count: 1, imageId });
      }
    },
    [addImage, addCard]
  );

  // Handle drag and drop for image files
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Only show overlay for external file drags, not internal element drags
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
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
      if (!e.dataTransfer?.types.includes("Files")) return;
      setIsDraggingOver(false);
      // Dropped on a modal's dropzone, which took the files
      if (e.defaultPrevented) return;
      e.preventDefault();
      e.stopPropagation();

      const { images: imageFiles, rejection } = validateImageFiles(e.dataTransfer.files);
      setDropRejection(rejection);
      if (imageFiles.length === 0) return;

      const session = getActiveSession();
      if (!session) return;

      // Multiple files: add all directly without modal
      if (imageFiles.length > 1) {
        void addFileCards(session.id, imageFiles);
        return;
      }

      // Single file: show modal with prefilled name
      const file = imageFiles[0];
      if (!file) return;
      void readDataUrl(file).then((data) => {
        setDroppedImageName(cardName(file));
        setPastedImage(data);
      });
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
  }, [getActiveSession, addFileCards]);

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
    report: pdfReport,
    handlePreview,
    handleGenerate,
    handleGenerateBacks,
    clearPreview,
    clearError: clearPdfError,
    cancelGeneration,
  } = usePdfGenerator({
    cards,
    session: activeSession ?? { id: "", name: "", templateId: "", cards: [] },
    template: activeTemplate,
    getImage,
    getPdf,
  });
  // A download the PDF waits for, when made before it was done
  const awaitedModule = useModules().find((module) => module.needed);

  // Why images cannot print with the session's settings, to flag their cards before generating.
  // Checked only when the images or settings change, as SVGs are parsed for it.
  const imageProblems = useImageProblems(activeSession ? getSvgOutput(activeSession) : DEFAULT_SVG_OUTPUT);
  const imageProblem = (imageId: string | undefined) => (imageId ? imageProblems.get(imageId) : undefined);

  // Clear preview when cards become empty
  useEffect(() => {
    if (cards.length === 0) {
      clearPreview();
    }
  }, [cards.length, clearPreview]);

  const handleSavePastedCard = (name: string, count: number) => {
    if (!activeSession || !pastedImage) return;
    // Pastes have no file name, and the card's is the one the user chose (for drops, prefilled from the file's)
    const imageId = addImage(name, pastedImage);
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

    void addFileCards(activeSession.id, Array.from(files));

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

  const cardBacks = getCardBacks(activeSession);

  /** Why a card cannot print: its front, or its own back (the default back is flagged on the session) */
  const cardProblems = (card: Card): string[] => {
    const front = imageProblem(card.imageId);
    const back = cardBacks.enabled ? imageProblem(card.cardBackId) : undefined;
    return [front && `Cannot print: ${front}`, back && `Cannot print its back: ${back}`].filter(
      (problem) => problem !== undefined
    );
  };
  const defaultBackProblem = cardBacks.enabled ? imageProblem(cardBacks.defaultBackId) : undefined;
  const flaggedCards = cards.filter((card) => cardProblems(card).length > 0).length;

  const cardColumns: Column<Card>[] = [
    {
      key: "name",
      header: "Name",
      main: true,
      render: (card) => (
        <>
          {card.name}
          <ProblemMark problems={cardProblems(card)} />
        </>
      ),
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

  const handleSaveSession = (updates: Omit<Session, "id" | "cards">) => {
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
          {cardBacks.enabled && " • Card Backs ✓"}
          {defaultBackProblem && (
            <span className="danger" title={defaultBackProblem}>
              {" "}
              • Default back cannot print ⚠
            </span>
          )}
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
          <input ref={fileInputRef} type="file" accept={IMAGE_ACCEPT} onChange={handleFileSelect} multiple hidden />
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
                title={[
                  `${card.name} (×${String(card.count)}) • Click to edit, right-click to delete`,
                  ...cardProblems(card),
                ].join("\n")}
              >
                <LazyCardImage imageId={card.imageId} alt={card.name} />
                <span className="card-icon-name">{card.name}</span>
                <span className="card-icon-count">
                  ×{card.count}
                  <ProblemMark problems={cardProblems(card)} />
                </span>
              </div>
            ))}
          </div>
        )}

        {cards.length === 0 && <p className="muted">No cards yet. Add a card to get started.</p>}
      </Box>

      <Box label="PDF">
        {flaggedCards > 0 && (
          <p className="danger">
            {flaggedCards === 1 ? "1 card" : `${String(flaggedCards)} cards`} cannot print with this session&apos;s
            settings: hover their ⚠ for why.
          </p>
        )}
        <div className="right">
          <Button onClick={handlePreview} disabled={cards.length === 0 || previewing}>
            {previewing ? "Loading..." : "Preview"}
          </Button>
          <Button onClick={handleGenerate} disabled={cards.length === 0 || generating}>
            {generating ? "Generating..." : "↓ Download"}
          </Button>
          {cardBacks.enabled && (
            <Button onClick={handleGenerateBacks} disabled={cards.length === 0 || generatingBacks}>
              {generatingBacks ? "Generating..." : "↓ Download Backs"}
            </Button>
          )}
        </div>
        {pdfReport && <PdfSummary report={pdfReport} />}
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
          cardBacks={cardBacks}
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
          label={awaitedModule ? `Downloading ${awaitedModule.label}...` : "Embedding cards..."}
          onCancel={cancelGeneration}
        />
      )}

      {pdfError && <ErrorModal title="PDF Error" message={pdfError} onClose={clearPdfError} />}

      {dropRejection && (
        <ErrorModal title="Unsupported Files" message={dropRejection} onClose={() => setDropRejection(undefined)} />
      )}

      {isDraggingOver && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">Drop image(s) to add cards</div>
        </div>
      )}
    </section>
  );
}
