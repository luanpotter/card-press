import { useState, useCallback, useEffect, useRef } from "react";
import type { Template } from "@/types/template";
import type { Card, Session } from "@/types/session";
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

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handlePreview = useCallback(() => {
    if (!template || cards.length === 0) return;

    // Cancel any existing generation
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setPreviewing(true);
    setPdfProgress({ current: 0, total: 0 });

    // Use setTimeout to allow React to paint loading state before blocking
    setTimeout(() => {
      void (async () => {
        try {
          const pdfBytes = await generatePdf({
            template,
            cards,
            getImage,
            getPdf,
            onProgress: (current, total) => setPdfProgress({ current, total }),
            signal: abortController.signal,
          });

          // Revoke old URL if exists
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
          }

          const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        } catch (err) {
          // Don't show error for cancellation
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to generate preview");
        } finally {
          setPreviewing(false);
          abortControllerRef.current = null;
        }
      })();
    }, 0);
  }, [template, cards, getImage, getPdf, previewUrl]);

  const handleGenerate = useCallback(() => {
    if (!template || cards.length === 0) return;

    // Cancel any existing generation
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setGenerating(true);
    setPdfProgress({ current: 0, total: 0 });

    setTimeout(() => {
      void (async () => {
        try {
          const pdfBytes = await generatePdf({
            template,
            cards,
            getImage,
            getPdf,
            defaultCardBackId: session.defaultCardBackId,
            onProgress: (current, total) => setPdfProgress({ current, total }),
            signal: abortController.signal,
          });

          downloadPdf(pdfBytes, `${session.name || "cards"}.pdf`);
        } catch (err) {
          // Don't show error for cancellation
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to generate PDF");
        } finally {
          setGenerating(false);
          abortControllerRef.current = null;
        }
      })();
    }, 0);
  }, [template, cards, getImage, getPdf, session.defaultCardBackId, session.name]);

  const handleGenerateBacks = useCallback(() => {
    if (!template || cards.length === 0) return;

    // Cancel any existing generation
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setGeneratingBacks(true);
    setPdfProgress({ current: 0, total: 0 });

    setTimeout(() => {
      void (async () => {
        try {
          const pdfBytes = await generatePdf({
            template,
            cards,
            getImage,
            getPdf,
            defaultCardBackId: session.defaultCardBackId,
            generateBacks: true,
            onProgress: (current, total) => setPdfProgress({ current, total }),
            signal: abortController.signal,
          });

          downloadPdf(pdfBytes, `${session.name || "cards"}-backs.pdf`);
        } catch (err) {
          // Don't show error for cancellation
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to generate backs PDF");
        } finally {
          setGeneratingBacks(false);
          abortControllerRef.current = null;
        }
      })();
    }, 0);
  }, [template, cards, getImage, getPdf, session.defaultCardBackId, session.name]);

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
