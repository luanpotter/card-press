import { useEffect } from "react";
import { isImageFile } from "@/utils/imageFiles";

/**
 * Call back with the image pasted anywhere on the page, while mounted.
 *
 * With `preempt`, this handler runs before any regular ones and hides the paste from them,
 * so a modal can take a paste that the page under it would otherwise handle too.
 */
export function usePastedImage(onImage: (file: File) => void, { preempt = false } = {}): void {
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find(isImageFile);
      const file = item?.getAsFile();
      if (!file) return;

      e.preventDefault();
      if (preempt) {
        e.stopImmediatePropagation();
      }
      onImage(file);
    };

    document.addEventListener("paste", handlePaste, preempt);
    return () => document.removeEventListener("paste", handlePaste, preempt);
  }, [onImage, preempt]);
}
