import { useState, useCallback, useEffect, useRef } from "react";
import type { Template } from "@/types/template";
import { getCardBacks, getPrintDpi, getSvgOutput, type Card, type CardBacks, type Session } from "@/types/session";
import { generatePdf, downloadPdf } from "@/utils/generatePdf";

interface StoredImage {
  name: string;
  data: string;
}

interface StoredPdf {
  name: string;
  data: string;
}

interface PdfProgress {
  current: number;
  total: number;
}

interface UsePdfGeneratorProps {
  cards: Card[];
  session: Session;
  template: Template | undefined;
  getImage: (id: string) => StoredImage | undefined;
  getPdf: (id: string) => StoredPdf | undefined;
}

interface UsePdfGeneratorResult {
  // State
  generating: boolean;
  generatingBacks: boolean;
  previewing: boolean;
  previewUrl: string | null;
  pdfProgress: PdfProgress;
  error: string | null;

  // Actions
  handlePreview: () => void;
  handleGenerate: () => void;
  handleGenerateBacks: () => void;
  clearPreview: () => void;
  clearError: () => void;
  cancelGeneration: () => void;
}

interface Generation {
  /** Callback to flag this generation as in progress */
  setBusy: (busy: boolean) => void;
  /** Generates the backs PDF instead of the fronts one */
  backs?: Omit<CardBacks, "enabled">;
  onPdf: (pdf: Uint8Array) => void;
}

export function usePdfGenerator({
  cards,
  session,
  template,
  getImage,
  getPdf,
}: UsePdfGeneratorProps): UsePdfGeneratorResult {
  const [generating, setGenerating] = useState(false);
  const [generatingBacks, setGeneratingBacks] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<PdfProgress>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  // Revoke the preview URL once replaced, and on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const run = useCallback(
    ({ setBusy, backs, onPdf }: Generation) => {
      if (!template || cards.length === 0) return;

      // Cancel any existing generation
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setBusy(true);
      setPdfProgress({ current: 0, total: 0 });

      // Use setTimeout to allow React to paint loading state before blocking
      setTimeout(() => {
        void (async () => {
          try {
            const pdf = await generatePdf({
              template,
              cards,
              getImage,
              getPdf,
              backs,
              emptySlotColor: session.emptySlotColor,
              printDpi: getPrintDpi(session),
              svgOutput: getSvgOutput(session),
              onProgress: (current, total) => setPdfProgress({ current, total }),
              signal: abortController.signal,
            });
            onPdf(pdf);
          } catch (err) {
            // Don't show error for cancellation
            if (err instanceof DOMException && err.name === "AbortError") {
              return;
            }
            setError(err instanceof Error ? err.message : "Failed to generate PDF");
          } finally {
            setBusy(false);
            abortControllerRef.current = null;
          }
        })();
      }, 0);
    },
    [template, cards, getImage, getPdf, session]
  );

  const handlePreview = useCallback(() => {
    run({
      setBusy: setPreviewing,
      onPdf: (pdf) => {
        const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
        setPreviewUrl(URL.createObjectURL(blob));
      },
    });
  }, [run]);

  const handleGenerate = useCallback(() => {
    run({
      setBusy: setGenerating,
      onPdf: (pdf) => downloadPdf(pdf, `${session.name || "cards"}.pdf`),
    });
  }, [run, session.name]);

  const handleGenerateBacks = useCallback(() => {
    const { defaultBackId, mirror } = getCardBacks(session);
    run({
      setBusy: setGeneratingBacks,
      backs: { defaultBackId, mirror },
      onPdf: (pdf) => downloadPdf(pdf, `${session.name || "cards"}-backs.pdf`),
    });
  }, [run, session]);

  return {
    generating,
    generatingBacks,
    previewing,
    previewUrl,
    pdfProgress,
    error,
    handlePreview,
    handleGenerate,
    handleGenerateBacks,
    clearPreview,
    clearError,
    cancelGeneration,
  };
}
