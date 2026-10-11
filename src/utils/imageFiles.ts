import { DECODABLE_TYPES } from "@/utils/decodeImage";

/**
 * Helpers for the files users upload, drop or paste as images.
 * Only the image types that PDF generation can print are taken in.
 */

/** File input `accept` attribute for every image type we can print */
export const IMAGE_ACCEPT = [...DECODABLE_TYPES].join(",");

/** Whether a file (or a clipboard / drag item) holds an image we can print */
export function isImageFile(file: { type: string }): boolean {
  return DECODABLE_TYPES.has(file.type);
}

/** Read a file into a data URL, which is how images and PDFs are stored */
export function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read "${file.name}"`));
    reader.readAsDataURL(file);
  });
}

/** Name for a card made from a file: the file name without its extension */
export function cardName(file: File): string {
  return file.name.replace(/\.[^.]+$/, "");
}
